// Phase 006 D-009 load measurement — synthetic PerfCorp data only.
// Runs in the frontend container: node /app/tests/performance/load_scenario.mjs
// Measures p95 latency for reads/writes at 25 concurrent sessions.

const BASE = process.env.PERF_BASE_URL || "http://backend:8000";
const CONCURRENCY = 25;
const ROUNDS = 4; // requests per endpoint per worker

function percentile(values, p) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

const cookieHeader = (res) =>
  (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

async function login(email) {
  const csrf = await fetch(`${BASE}/api/v1/auth/csrf/`, { redirect: "manual" });
  const cookie = cookieHeader(csrf);
  const token = /csrftoken=([^;]+)/.exec(csrf.headers.getSetCookie?.().join(";") ?? "")?.[1] ?? "";
  const res = await fetch(`${BASE}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, "x-csrftoken": token },
    body: JSON.stringify({ email, password: "PerfPassw0rd1" }),
    redirect: "manual",
  });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  const session = cookieHeader(res);
  return [cookie, session].filter(Boolean).join("; ");
}

const ENDPOINTS = [
  ["me", "/api/v1/me/"],
  ["timesheet-list", "/api/v1/timesheets/"],
  ["personal-dashboard", "/api/v1/dashboards/personal/"],
  ["hours-report", "/api/v1/reports/working-hours/?from=2025-01-01&to=2025-12-31"],
  ["requests-report", "/api/v1/reports/requests/?from=2025-01-01&to=2025-12-31"],
  ["notifications", "/api/v1/notifications/"],
];

async function worker(i, results, errors) {
  const cookie = await login(`emp${(i * 20) % 500}-perf@perf.test`);
  // Warmup: absorb one-time worker/connection/JIT costs outside measurement.
  for (const [, path] of ENDPOINTS) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
    await res.arrayBuffer();
  }
  for (let r = 0; r < ROUNDS; r++) {
    for (const [name, path] of ENDPOINTS) {
      const t0 = performance.now();
      const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
      const ms = performance.now() - t0;
      await res.arrayBuffer();
      if (res.status >= 400) errors.push(`${name}: ${res.status}`);
      else results[name].push(ms);
    }
  }
}

const results = Object.fromEntries(ENDPOINTS.map(([n]) => [n, []]));
const errors = [];
const t0 = performance.now();
await Promise.all(
  Array.from({ length: CONCURRENCY }, (_, i) => worker(i, results, errors))
);
const wall = performance.now() - t0;

console.log(`\nD-009 measurement — ${CONCURRENCY} concurrent sessions, ${wall.toFixed(0)}ms wall`);
console.log("endpoint\t\tn\tp50\tp95\tmax\tbudget");
const budgets = { "me": 300, "timesheet-list": 300, "personal-dashboard": 300,
                  "hours-report": 1000, "requests-report": 1000, "notifications": 300 };
let fail = 0;
for (const [name, vals] of Object.entries(results)) {
  const p95 = percentile(vals, 95);
  const ok = p95 < budgets[name];
  if (!ok) fail++;
  console.log(`${name}\t${vals.length}\t${percentile(vals, 50).toFixed(0)}\t${p95.toFixed(0)}\t${Math.max(...vals).toFixed(0)}\t${budgets[name]}ms ${ok ? "PASS" : "FAIL"}`);
}
console.log(`errors: ${errors.length} ${errors.slice(0, 5).join(", ")}`);
process.exit(fail || errors.length ? 1 : 0);
