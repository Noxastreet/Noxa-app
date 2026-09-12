// @ts-nocheck -- Supabase Edge runtime (Deno), not the Expo TypeScript runtime.
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

type NotificationCategory = "social" | "crews" | "events" | "messages";
type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data: Record<string, unknown>;
};
type PushDevice = { id: string; expo_push_token: string };
type ExpoTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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

function safeEqual(first: string, second: string) {
  if (first.length !== second.length) return false;
  let mismatch = 0;
  for (let index = 0; index < first.length; index += 1) {
    mismatch |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return mismatch === 0;
}

function notificationIdFromBody(body: Record<string, unknown>) {
  if (typeof body.notification_id === "string") return body.notification_id;
  if (body.record && typeof body.record === "object") {
    const id = (body.record as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  return null;
}

function categoryEnabled(
  category: NotificationCategory,
  preferences: Record<string, boolean> | null,
) {
  if (preferences?.push_enabled === false) return false;
  const key = {
    social: "social_enabled",
    crews: "crews_enabled",
    events: "events_enabled",
    messages: "messages_enabled",
  }[category];
  return preferences?.[key] !== false;
}

async function finishNotification(
  admin: ReturnType<typeof createClient>,
  notificationId: string,
  values: {
    push_status: "sent" | "skipped" | "failed";
    push_ticket_ids?: string[];
    push_error?: string | null;
  },
) {
  const { error } = await admin
    .from("notifications")
    .update({
      push_status: values.push_status,
      push_ticket_ids: values.push_ticket_ids ?? [],
      push_error: values.push_error?.slice(0, 500) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", notificationId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return response({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = readSecretKey();
  if (!supabaseUrl || !secretKey) {
    return response({ error: "Server configuration is incomplete." }, 500);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const providedWebhookSecret = req.headers.get("x-noxa-push-secret") ?? "";
  const { data: expectedWebhookSecret, error: webhookSecretError } = await admin.rpc(
    "noxa_get_push_webhook_secret",
  );
  if (
    webhookSecretError ||
    typeof expectedWebhookSecret !== "string" ||
    !providedWebhookSecret ||
    !safeEqual(providedWebhookSecret, expectedWebhookSecret)
  ) {
    return response({ error: "Webhook authentication required." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return response({ error: "Invalid request body." }, 400);
  }

  const notificationId = notificationIdFromBody(body);
  if (!notificationId) {
    return response({ error: "Notification ID is required." }, 400);
  }

  const { data: claimedRows, error: claimError } = await admin.rpc(
    "noxa_claim_push_notification",
    { target_notification_id: notificationId },
  );
  if (claimError) {
    console.error("NOXA push claim failed.", claimError.message);
    return response({ error: "Notification could not be claimed." }, 500);
  }

  const notification = (claimedRows?.[0] ?? null) as NotificationRow | null;
  if (!notification) {
    return response({ success: true, status: "already_processed" });
  }

  try {
    const [preferencesResult, devicesResult] = await Promise.all([
      admin
        .from("notification_preferences")
        .select(
          "push_enabled,social_enabled,crews_enabled,events_enabled,messages_enabled",
        )
        .eq("user_id", notification.user_id)
        .maybeSingle(),
      admin
        .from("push_devices")
        .select("id,expo_push_token")
        .eq("user_id", notification.user_id)
        .eq("enabled", true)
        .order("last_seen_at", { ascending: false }),
    ]);

    if (preferencesResult.error) throw preferencesResult.error;
    if (devicesResult.error) throw devicesResult.error;

    const preferences = preferencesResult.data as Record<string, boolean> | null;
    const devices = (devicesResult.data ?? []) as PushDevice[];

    if (!categoryEnabled(notification.category, preferences)) {
      await finishNotification(admin, notification.id, {
        push_status: "skipped",
        push_error: "Disabled by notification preferences.",
      });
      return response({ success: true, status: "preference_disabled" });
    }

    if (devices.length === 0) {
      await finishNotification(admin, notification.id, {
        push_status: "skipped",
        push_error: "No enabled device token.",
      });
      return response({ success: true, status: "no_device" });
    }

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        devices.map((device) => ({
          to: device.expo_push_token,
          sound: "default",
          channelId: "noxa_activity",
          title: notification.title,
          body: notification.body,
          data: {
            ...notification.data,
            kind: notification.kind,
            notificationId: notification.id,
          },
          priority: "default",
        })),
      ),
    });

    if (!pushResponse.ok) {
      throw new Error(`Expo push service returned HTTP ${pushResponse.status}.`);
    }

    const pushBody = (await pushResponse.json()) as {
      data?: ExpoTicket[] | ExpoTicket;
    };
    const tickets = Array.isArray(pushBody.data)
      ? pushBody.data
      : pushBody.data
        ? [pushBody.data]
        : [];

    const ticketIds = tickets
      .map((ticket) => ticket.id)
      .filter((id): id is string => typeof id === "string");

    const invalidDeviceIds = tickets
      .map((ticket, index) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
          ? devices[index]?.id
          : null,
      )
      .filter((id): id is string => typeof id === "string");

    if (invalidDeviceIds.length > 0) {
      const { error: disableError } = await admin
        .from("push_devices")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in("id", invalidDeviceIds);
      if (disableError) throw disableError;
    }

    const successCount = tickets.filter((ticket) => ticket.status === "ok").length;
    const errorCodes = tickets
      .filter((ticket) => ticket.status === "error")
      .map((ticket) => ticket.details?.error ?? ticket.message ?? "Expo push error")
      .slice(0, 5);

    await finishNotification(admin, notification.id, {
      push_status: successCount > 0 ? "sent" : "failed",
      push_ticket_ids: ticketIds,
      push_error: errorCodes.length > 0 ? errorCodes.join(", ") : null,
    });

    return response({
      success: successCount > 0,
      delivered: successCount,
      rejected: Math.max(0, tickets.length - successCount),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown push error";
    console.error("NOXA push delivery failed.", message);
    await finishNotification(admin, notification.id, {
      push_status: "failed",
      push_error: message,
    }).catch(() => undefined);
    return response({ error: "Push delivery failed." }, 500);
  }
});
