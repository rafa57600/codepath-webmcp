// Best-effort sync of browser progress to the Node MCP server's state file.
//
// DEVELOPMENT ONLY. This is the optional bridge to the companion HTTP/mcp server
// on :3002 used during development so an external MCP client can see learner
// state. It is gated behind `import.meta.env.DEV`, so the PRODUCTION build makes
// ZERO requests to localhost:3002 (or any local service) — the judged browser
// experience is fully self-contained via localStorage.
//
// Even in dev it only activates if the server is reachable (checked once via
// /health over CORS), so no noisy proxy/500 errors appear in the console.

const BASE = (import.meta.env.VITE_SYNC_URL as string | undefined) ?? 'http://localhost:3002';

let serverUp: boolean | null = null;

async function checkServer(): Promise<boolean> {
  if (serverUp !== null) return serverUp;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`${BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }
  return serverUp;
}

export function syncToServer(state: unknown): void {
  // Never contact localhost from a production build.
  if (!import.meta.env.DEV) return;
  void (async () => {
    try {
      const alive = await checkServer();
      if (!alive) return;
      await fetch(`${BASE}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        keepalive: true,
      });
    } catch {
      /* ignore — optional feature */
    }
  })();
}
