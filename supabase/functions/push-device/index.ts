// @ts-nocheck -- This file runs in Supabase's Deno Edge runtime, not the Expo TypeScript runtime.
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const appId = "com.karaketidis.noxa";
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
      // Fall back to the legacy service-role key during Supabase's key transition.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

function validExpoToken(value: string) {
  return (
    value.length >= 20 &&
    value.length <= 255 &&
    ((value.startsWith("ExpoPushToken[") && value.endsWith("]")) ||
      (value.startsWith("ExponentPushToken[") && value.endsWith("]")))
  );
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

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accessToken = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return response({ error: "Authentication required." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return response({ error: "Invalid request body." }, 400);
  }

  const action = body.action;
  const token = typeof body.expo_push_token === "string"
    ? body.expo_push_token.trim()
    : "";
  if (!validExpoToken(token)) {
    return response({ error: "Invalid Expo push token." }, 400);
  }

  if (action === "unregister") {
    const { error } = await admin
      .from("push_devices")
      .update({ enabled: false, last_seen_at: new Date().toISOString() })
      .eq("user_id", userData.user.id)
      .eq("expo_push_token", token);
    if (error) {
      console.error("NOXA push-device unregister failed.", error.message);
      return response({ error: "Device could not be unregistered." }, 500);
    }
    return response({ success: true });
  }

  if (action !== "register") {
    return response({ error: "Unsupported action." }, 400);
  }

  const platform = typeof body.platform === "string" ? body.platform.trim() : "";
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  const requestedAppId = typeof body.app_id === "string" ? body.app_id.trim() : "";
  if (!["ios", "android"].includes(platform)) {
    return response({ error: "Unsupported push platform." }, 400);
  }
  if (projectId.length < 1 || projectId.length > 120) {
    return response({ error: "Invalid Expo project ID." }, 400);
  }
  if (requestedAppId !== appId) {
    return response({ error: "Invalid NOXA application ID." }, 400);
  }

  const now = new Date().toISOString();
  const { error: deviceError } = await admin.from("push_devices").upsert(
    {
      user_id: userData.user.id,
      expo_push_token: token,
      platform,
      project_id: projectId,
      app_id: appId,
      enabled: true,
      last_seen_at: now,
    },
    { onConflict: "expo_push_token" },
  );
  if (deviceError) {
    console.error("NOXA push-device registration failed.", deviceError.message);
    return response({ error: "Device could not be registered." }, 500);
  }

  const { data: updatedPreference, error: preferenceError } = await admin
    .from("notification_preferences")
    .update({ push_enabled: true })
    .eq("user_id", userData.user.id)
    .select("user_id")
    .maybeSingle();
  if (preferenceError) {
    console.error("NOXA push preference update failed.", preferenceError.message);
    return response({ error: "Notification preference could not be updated." }, 500);
  }
  if (!updatedPreference) {
    const { error: insertPreferenceError } = await admin
      .from("notification_preferences")
      .insert({ user_id: userData.user.id, push_enabled: true });
    if (insertPreferenceError) {
      console.error(
        "NOXA push preference creation failed.",
        insertPreferenceError.message,
      );
      return response({ error: "Notification preference could not be created." }, 500);
    }
  }

  return response({ success: true });
});
