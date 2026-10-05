const PROJECT_REF = process.env.NOXA_SUPABASE_PROJECT_REF;
const API_KEY = process.env.NOXA_SUPABASE_PUBLISHABLE_KEY;

if (!PROJECT_REF || !API_KEY) {
  throw new Error('Missing NOXA_SUPABASE_PROJECT_REF or NOXA_SUPABASE_PUBLISHABLE_KEY');
}

const TARGETS = [25, 50, 100, 150, 190, 205, 225, 250];
const JOIN_TIMEOUT_MS = 8000;
const STAGE_HOLD_MS = 8000;

const clients = [];
let nextId = 0;
let heartbeatRef = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function realtimeUrl() {
  return `wss://${PROJECT_REF}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(API_KEY)}&vsn=1.0.0`;
}

function openClient() {
  const id = ++nextId;
  return new Promise((resolve) => {
    const state = {
      id,
      ws: null,
      opened: false,
      joined: false,
      failed: false,
      failure: null,
      closed: false,
    };

    const ws = new WebSocket(realtimeUrl());
    state.ws = ws;
    clients.push(state);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      state.failed = true;
      state.failure = 'join_timeout';
      try { ws.close(1000, 'join timeout'); } catch {}
      finish(state);
    }, JOIN_TIMEOUT_MS);

    ws.onopen = () => {
      state.opened = true;
      const ref = String(id);
      ws.send(JSON.stringify({
        topic: `realtime:noxa-capacity-probe-${id}`,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { enabled: false },
            private: false,
            postgres_changes: [],
          },
        },
        ref,
        join_ref: ref,
      }));
    };

    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (message.event === 'phx_reply' && message.ref === String(id)) {
        if (message.payload?.status === 'ok') {
          state.joined = true;
          finish(state);
        } else {
          state.failed = true;
          state.failure = JSON.stringify(message.payload ?? {});
          finish(state);
        }
      }

      if (message.event === 'phx_error') {
        state.failed = true;
        state.failure ||= 'phx_error';
      }
    };

    ws.onerror = () => {
      state.failed = true;
      state.failure ||= 'websocket_error';
    };

    ws.onclose = (event) => {
      state.closed = true;
      if (!state.joined) {
        state.failed = true;
        state.failure ||= `closed_${event.code}_${event.reason || 'no_reason'}`;
        finish(state);
      }
    };
  });
}

const heartbeat = setInterval(() => {
  for (const client of clients) {
    const ws = client.ws;
    if (!client.joined || client.closed || !ws || ws.readyState !== WebSocket.OPEN) continue;
    const ref = String(++heartbeatRef);
    try {
      ws.send(JSON.stringify({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref,
        join_ref: null,
      }));
    } catch {}
  }
}, 15000);

function snapshot(target) {
  const opened = clients.filter((c) => c.opened).length;
  const joined = clients.filter((c) => c.joined && !c.closed).length;
  const failed = clients.filter((c) => c.failed).length;
  const closed = clients.filter((c) => c.closed).length;
  const recentFailures = clients
    .filter((c) => c.failed)
    .slice(-10)
    .map((c) => ({ id: c.id, failure: c.failure }));
  return { target, attempted: clients.length, opened, joined, failed, closed, recentFailures };
}

try {
  console.log('NOXA realtime capacity probe');
  console.log(JSON.stringify({ project: PROJECT_REF, targets: TARGETS, writes: false }, null, 2));

  for (const target of TARGETS) {
    const need = Math.max(0, target - clients.length);
    if (need > 0) {
      await Promise.all(Array.from({ length: need }, () => openClient()));
    }

    await sleep(STAGE_HOLD_MS);
    const result = snapshot(target);
    console.log(`STAGE ${target}: ${JSON.stringify(result)}`);

    if (target >= 205 && result.failed > 0) {
      console.log('CAPACITY_LIMIT_OBSERVED: stopping after first failure above documented Free-plan connection limit.');
      break;
    }
  }

  console.log('FINAL:', JSON.stringify(snapshot(clients.length), null, 2));
} finally {
  clearInterval(heartbeat);
  for (const client of clients) {
    try {
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'capacity probe complete');
      }
    } catch {}
  }
  await sleep(1000);
}
