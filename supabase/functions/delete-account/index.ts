// @ts-nocheck -- This file runs in Supabase's Deno Edge runtime, not the Expo TypeScript runtime.
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

const userOwnedBuckets = [
  "avatars",
  "vehicle-images",
  "post-images",
  "event-gallery",
  "crew-gallery",
] as const;

type StorageFile = {
  id?: string | null;
  metadata?: Record<string, unknown> | null;
  name: string;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function readSecretKey() {
  const keysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson) as Record<
        string,
        string | { api_key?: string; key?: string }
      >;
      const candidate = keys.default ?? Object.values(keys)[0];
      if (typeof candidate === "string") return candidate;
      if (candidate?.api_key) return candidate.api_key;
      if (candidate?.key) return candidate.key;
    } catch {
      // Fall back to the legacy key during Supabase's 2026 key transition.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function collectFolderFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 6) throw new Error(`Storage path in ${bucket} is unexpectedly deep.`);

  const paths: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    const items = (data ?? []) as StorageFile[];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const isFile = Boolean(item.id) || Boolean(item.metadata);
      if (isFile) {
        paths.push(path);
      } else {
        paths.push(...(await collectFolderFiles(admin, bucket, path, depth + 1)));
      }
    }

    if (items.length < pageSize) break;
    offset += pageSize;
  }

  return paths;
}

async function removePaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
) {
  const uniquePaths = [...new Set(paths)];
  for (const batch of chunk(uniquePaths, 1000)) {
    if (!batch.length) continue;
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) throw error;
  }
}

async function loadOwnedIds(
  admin: ReturnType<typeof createClient>,
  table: "events" | "crews",
  userId: string,
) {
  const ids: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const ownerColumn = table === "events" ? "creator_id" : "owner_id";
    const { data, error } = await admin
      .from(table)
      .select("id")
      .eq(ownerColumn, userId)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const rows = data ?? [];
    ids.push(...rows.map((row) => row.id));
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return ids;
}

async function loadGalleryPaths(
  admin: ReturnType<typeof createClient>,
  table: "event_gallery_items" | "crew_gallery_items",
  foreignKey: "event_id" | "crew_id",
  ownerIds: string[],
) {
  const paths: string[] = [];
  for (const idBatch of chunk(ownerIds, 100)) {
    if (!idBatch.length) continue;
    const { data, error } = await admin
      .from(table)
      .select("object_path")
      .in(foreignKey, idBatch);
    if (error) throw error;
    paths.push(...(data ?? []).map((row) => row.object_path));
  }
  return paths;
}

async function removeAccountStorage(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const [ownedEventIds, ownedCrewIds] = await Promise.all([
    loadOwnedIds(admin, "events", userId),
    loadOwnedIds(admin, "crews", userId),
  ]);
  const [ownedEventGalleryPaths, ownedCrewGalleryPaths] = await Promise.all([
    loadGalleryPaths(
      admin,
      "event_gallery_items",
      "event_id",
      ownedEventIds,
    ),
    loadGalleryPaths(
      admin,
      "crew_gallery_items",
      "crew_id",
      ownedCrewIds,
    ),
  ]);

  for (const bucket of userOwnedBuckets) {
    const userPaths = await collectFolderFiles(admin, bucket, userId);
    const relatedPaths =
      bucket === "event-gallery"
        ? ownedEventGalleryPaths
        : bucket === "crew-gallery"
          ? ownedCrewGalleryPaths
          : [];
    await removePaths(admin, bucket, [...userPaths, ...relatedPaths]);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return response({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readSecretKey();
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !secretKey) {
    return response({ error: "Server configuration is incomplete." }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Authentication required." }, 401);
  }

  let body: { confirmation?: unknown };
  try {
    body = (await req.json()) as { confirmation?: unknown };
  } catch {
    return response({ error: "Invalid request body." }, 400);
  }
  if (body.confirmation !== "DELETE") {
    return response({ error: "Deletion confirmation is required." }, 400);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) {
    return response({ error: "Authentication required." }, 401);
  }

  const lastSignIn = user.last_sign_in_at
    ? Date.parse(user.last_sign_in_at)
    : Number.NaN;
  if (!Number.isFinite(lastSignIn) || Date.now() - lastSignIn > 10 * 60 * 1000) {
    return response(
      { error: "Sign in again before deleting your account." },
      403,
    );
  }

  try {
    await removeAccountStorage(admin, user.id);
    const { error: deleteError } = await admin.auth.admin.deleteUser(
      user.id,
      false,
    );
    if (deleteError) throw deleteError;
    return response({ success: true });
  } catch (error) {
    console.error(
      "NOXA account deletion failed.",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response(
      { error: "Your account could not be deleted. Please try again." },
      500,
    );
  }
});
