/**
 * Critical path smoke (Fase 6): auth → catalog → sync resolve → metrics.
 * Requires API on API_BASE (default http://localhost:3000/v1).
 *
 * Usage: node scripts/e2e-critical.mjs
 */
const base = process.env.API_BASE ?? "http://localhost:3000/v1";

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${opts.method ?? "GET"} ${path} → ${res.status} ${text}`);
  }
  return body;
}

async function main() {
  const health = await req("/health");
  if (health.status !== "ok") throw new Error("health not ok");

  const login = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: process.env.E2E_EMAIL ?? "admin@cifratrack.local",
      password: process.env.E2E_PASSWORD ?? "Admin123!",
    }),
  });
  const token = login.accessToken;
  if (!token) throw new Error("no accessToken");

  const track = await req("/tracks/meu-amor-acoustic-playalong", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!track.sync?.url && !track.id) throw new Error("demo track missing");

  // Player sync contract: fixture JSON must have events sorted by t
  const syncUrl = track.sync?.url?.startsWith("http")
    ? track.sync.url
    : `http://localhost:5173${track.sync?.url ?? "/fixtures/meu-amor-acoustic-playalong.json"}`;
  let eventsOk = true;
  try {
    const syncRes = await fetch(syncUrl);
    if (syncRes.ok) {
      const doc = await syncRes.json();
      eventsOk = Array.isArray(doc.events) && doc.events.length > 0;
      for (let i = 1; i < doc.events.length; i++) {
        if (doc.events[i].t < doc.events[i - 1].t) eventsOk = false;
      }
    }
  } catch {
    // fixture host optional when web not running
    eventsOk = true;
  }
  if (!eventsOk) throw new Error("sync events invalid");

  const metrics = await req("/admin/metrics", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (typeof metrics.users !== "number") throw new Error("metrics invalid");

  const prom = await fetch(`${base}/metrics`);
  if (!prom.ok) throw new Error("prometheus metrics missing");

  console.log("E2E_CRITICAL_OK", {
    phase: health.phase,
    users: metrics.users,
    track: track.slug,
  });
}

main().catch((err) => {
  console.error("E2E_CRITICAL_FAIL", err.message);
  process.exit(1);
});
