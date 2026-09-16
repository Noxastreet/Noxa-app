// @ts-nocheck -- Supabase Edge Function runtime.
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function readSecretKey() {
  const keysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson) as Record<string, string | { api_key?: string; key?: string }>;
      const candidate = keys.default ?? Object.values(keys)[0];
      if (typeof candidate === "string") return candidate;
      if (candidate?.api_key) return candidate.api_key;
      if (candidate?.key) return candidate.key;
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}
async function removeStoragePaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return;
  const { error } = await admin.storage.from(bucket).remove(unique);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readSecretKey();
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !secretKey) {
    return response({ error: "Server configuration is incomplete." }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Authentication required." }, 401);
  }

  let body: { crewId?: unknown };
  try {
    body = (await req.json()) as { crewId?: unknown };
  } catch {
    return response({ error: "Invalid request body." }, 400);
  }
  const crewId = typeof body.crewId === "string" ? body.crewId : "";
  if (!/^[0-9a-f-]{36}$/i.test(crewId)) {
    return response({ error: "Invalid Crew." }, 400);
  }
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return response({ error: "Authentication required." }, 401);

  const { data: crew, error: crewError } = await admin
    .from("crews")
    .select("id,owner_id")
    .eq("id", crewId)
    .maybeSingle();
  if (crewError) return response({ error: "Crew could not be loaded." }, 500);
  if (!crew) return response({ error: "Crew not found." }, 404);
  if (crew.owner_id !== user.id) {
    return response({ error: "Only the Crew owner can delete this Crew." }, 403);
  }

  const [{ data: galleryRows, error: galleryError }, coverList] = await Promise.all([
    admin.from("crew_gallery_items").select("object_path").eq("crew_id", crewId),
    admin.storage.from("entity-covers").list(`crews/${crewId}`, { limit: 1000 }),
  ]);
  if (galleryError || coverList.error) {
    return response({ error: "Crew deletion could not be prepared. Retry." }, 500);
  }

  const galleryPaths = (galleryRows ?? []).map((row) => String(row.object_path));
  const coverPaths = (coverList.data ?? [])
    .filter((item) => Boolean(item.id) || Boolean(item.metadata))
    .map((item) => `crews/${crewId}/${item.name}`);

  const { data: deletedRows, error: deleteError } = await admin
    .from("crews")
    .delete()
    .eq("id", crewId)
    .eq("owner_id", user.id)
    .select("id");
  if (deleteError || !deletedRows?.length) {
    return response({ error: "Crew could not be deleted. Retry." }, 500);
  }
  try {
    await Promise.all([
      removeStoragePaths(admin, "crew-gallery", galleryPaths),
      removeStoragePaths(admin, "entity-covers", coverPaths),
    ]);
  } catch (cleanupError) {
    console.error(
      "NOXA Crew post-delete storage cleanup failed.",
      cleanupError instanceof Error ? cleanupError.message : "Unknown error",
    );
  }

  return response({ success: true });
});
