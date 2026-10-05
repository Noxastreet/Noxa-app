const PROJECT_REF = process.env.NOXA_SUPABASE_PROJECT_REF;
const API_KEY = process.env.NOXA_SUPABASE_PUBLISHABLE_KEY;

if (!PROJECT_REF || !API_KEY) {
  throw new Error('Missing NOXA_SUPABASE_PROJECT_REF or NOXA_SUPABASE_PUBLISHABLE_KEY');
}

const PRODUCTION_PROJECT_REF = 'wzfpwuyyaotvofdijhin';

if (PROJECT_REF === PRODUCTION_PROJECT_REF) {
  throw new Error('Refusing to run Realtime capacity probe against NOXA production Supabase.');
}

const TARGETS = [25, 50, 100, 150, 180, 195, 205, 220, 250];
const JOIN_TIMEOUT_MS = 12000;
const STAGE_HOLD_MS = 5000;
const clients = [];
let nextId = 0;
let heartbeatRef = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const aliveJoined = () => clients.filter((c) => c.joined && !c.closed).length;
const failedCount = () => clients.filter((c) => c.failed).length;

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
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(state);
    };

    const timer = setTimeout(() => {
      state.failed = true;
      state.failure ||= 'join_timeout';
      try { ws.close(1000, 'join timeout'); } catch {}
      finish();
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
      try { message = JSON.parse(String(event.data)); } catch { return; }

      if (message.event === 'phx_reply' && message.ref === String(id)) {
        if (message.payload?.status === 'ok') {
          state.joined = true;
        } else {
          state.failed = true;
          state.failure = JSON.stringify(message.payload ?? {});
        }
        finish();
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
        finish();
      }
    };
  });
}

const heartbeat = setInterval(() => {
  for (const client of clients) {
    const ws = client.ws;
    if (!client.joined || client.closed || !ws || ws.readyState !== WebSocket.OPEN) continue;
    try {
      ws.send(JSON.stringify({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: String(++heartbeatRef),
        join_ref: null,
      }));
    } catch {}
  }
}, 15000);

function snapshot(target, stageFailures = 0) {
  return {
    target,
    attempted: clients.length,
    opened: clients.filter((c) => c.opened).length,
    joined_alive: aliveJoined(),
    failed_total: failedCount(),
    stage_failures: stageFailures,
    closed: clients.filter((c) => c.closed).length,
    recent_failures: clients.filter((c) => c.failed).slice(-8).map((c) => ({
      id: c.id,
      failure: c.failure,
    })),
  };
}

async function reachTarget(target) {
  const failuresAtStart = failedCount();
  let noProgressRounds = 0;
  let attemptsThisStage = 0;

  while (aliveJoined() < target) {
    const before = aliveJoined();
    const gap = target - before;
    const batchSize = Math.min(before >= 150 ? 5 : 10, gap);
    attemptsThisStage += batchSize;

    await Promise.all(Array.from({ length: batchSize }, () => openClient()));
    await sleep(before >= 150 ? 600 : 300);

    const after = aliveJoined();
    if (after <= before) noProgressRounds += 1;
    else noProgressRounds = 0;

    const stageFailures = failedCount() - failuresAtStart;

    // Once near the documented Free-plan ceiling, stop if repeated new clients
    // cannot increase the live connection count. This prevents a runaway test.
    if (before >= 180 && (noProgressRounds >= 3 || stageFailures >= 15)) {
      return { reached: false, stageFailures };
    }

    if (attemptsThisStage >= 100) {
      return { reached: false, stageFailures };
    }
  }

  await sleep(STAGE_HOLD_MS);
  return { reached: true, stageFailures: failedCount() - failuresAtStart };
}

try {
  console.log('NOXA realtime capacity probe v2');
  console.log(JSON.stringify({ project: PROJECT_REF, targets: TARGETS, writes: false }, null, 2));

  for (const target of TARGETS) {
    const result = await reachTarget(target);
    console.log(`STAGE ${target}: ${JSON.stringify(snapshot(target, result.stageFailures))}`);

    if (!result.reached) {
      console.log(`CAPACITY_LIMIT_OBSERVED: could not sustain target ${target}; stopping safely.`);
      break;
    }
  }

  console.log('FINAL:', JSON.stringify(snapshot(aliveJoined()), null, 2));
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
