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

type UserOwnedBucket = (typeof userOwnedBuckets)[number];

type StorageFile = {
  id?: string | null;
  metadata?: Record<string, unknown> | null;
  name: string;
};

type StorageCleanupPlan = {
  userId: string;
  userPathsByBucket: Record<UserOwnedBucket, string[]>;
  relatedEventGalleryPaths: string[];
  relatedCrewGalleryPaths: string[];
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

async function buildStorageCleanupPlan(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<StorageCleanupPlan> {
  // Complete every read before the first irreversible Storage delete. If a
  // bucket, gallery query, or ownership lookup is unavailable, deletion stops
  // here with the account and all files untouched.
  const [ownedEventIds, ownedCrewIds, userPathEntries] = await Promise.all([
    loadOwnedIds(admin, "events", userId),
    loadOwnedIds(admin, "crews", userId),
    Promise.all(
      userOwnedBuckets.map(async (bucket) => [
        bucket,
        await collectFolderFiles(admin, bucket, userId),
      ] as const),
    ),
  ]);
  const [relatedEventGalleryPaths, relatedCrewGalleryPaths] = await Promise.all([
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

  return {
    userId,
    userPathsByBucket: Object.fromEntries(userPathEntries) as Record<
      UserOwnedBucket,
      string[]
    >,
    relatedEventGalleryPaths,
    relatedCrewGalleryPaths,
  };
}

async function removeUserOwnedStorage(
  admin: ReturnType<typeof createClient>,
  plan: StorageCleanupPlan,
) {
  const failures: string[] = [];

  // Account-owned files are the only Storage objects that need to disappear
  // before auth.admin.deleteUser can succeed. Try every bucket so a retry can
  // continue from the remaining files instead of stopping after the first one.
  for (const bucket of userOwnedBuckets) {
    try {
      await removePaths(admin, bucket, plan.userPathsByBucket[bucket]);
    } catch (error) {
      failures.push(
        `${bucket}: ${error instanceof Error ? error.message : "remove failed"}`,
      );
    }
  }

  // Re-list from Storage instead of trusting remove() responses. This also
  // catches a file uploaded between preflight and cleanup. The server-side
  // Storage policies force normal user uploads under the user's first folder.
  const remainingEntries = await Promise.all(
    userOwnedBuckets.map(async (bucket) => [
      bucket,
      await collectFolderFiles(admin, bucket, plan.userId),
    ] as const),
  );
  const remaining = remainingEntries.flatMap(([bucket, paths]) =>
    paths.map((path) => `${bucket}/${path}`),
  );

  if (remaining.length > 0) {
    console.error("NOXA account-owned Storage cleanup incomplete.", {
      failures,
      remainingCount: remaining.length,
    });
    throw new Error("Account-owned Storage cleanup is incomplete.");
  }

  if (failures.length > 0) {
    // A remove request may report an error after the underlying objects were
    // already removed. Verification is authoritative, so deletion may proceed.
    console.warn("NOXA Storage remove reported recoverable errors.", failures);
  }
}

function pathsOutsideUserFolder(paths: string[], userId: string) {
  const ownPrefix = `${userId}/`;
  return [...new Set(paths)].filter((path) => !path.startsWith(ownPrefix));
}

async function removeRelatedGalleryStorageAfterAccountDeletion(
  admin: ReturnType<typeof createClient>,
  plan: StorageCleanupPlan,
) {
  // These files may belong to other uploaders. They do not block deletion of
  // this auth user, so never destroy them before the account deletion commits.
  const eventPaths = pathsOutsideUserFolder(
    plan.relatedEventGalleryPaths,
    plan.userId,
  );
  const crewPaths = pathsOutsideUserFolder(
    plan.relatedCrewGalleryPaths,
    plan.userId,
  );

  await Promise.all([
    removePaths(admin, "event-gallery", eventPaths),
    removePaths(admin, "crew-gallery", crewPaths),
  ]);
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

  let cleanupPlan: StorageCleanupPlan;
  try {
    cleanupPlan = await buildStorageCleanupPlan(admin, user.id);
    await removeUserOwnedStorage(admin, cleanupPlan);
  } catch (error) {
    console.error(
      "NOXA account deletion preflight/storage cleanup failed.",
      error instanceof Error ? error.message : "Unknown error",
    );
    return response(
      { error: "Your account could not be deleted. Please try again." },
      500,
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(
    user.id,
    false,
  );
  if (deleteError) {
    console.error("NOXA auth user deletion failed.", deleteError.message);
    return response(
      { error: "Your account could not be deleted. Please try again." },
      500,
    );
  }

  try {
    await removeRelatedGalleryStorageAfterAccountDeletion(admin, cleanupPlan);
  } catch (error) {
    // The user's account is already deleted. Do not turn a successful account
    // deletion into a client-visible failure that can no longer be retried with
    // the deleted user's token. Related orphan cleanup is operational follow-up.
    console.error(
      "NOXA post-delete related gallery cleanup failed.",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return response({ success: true });
});
