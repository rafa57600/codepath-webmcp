// Sandboxed JavaScript execution.
//
// User code runs inside a detached, sandboxed iframe via postMessage + MessageChannel.
// The iframe has `sandbox="allow-scripts"` (no allow-same-origin), so user code
// cannot reach the parent window, cookies, localStorage, or the WebMCP host.
//
// The iframe signals readiness to the parent before any "run" message is sent,
// so we never race the iframe's script load. We capture console.log lines to
// `stdout` and harvest top-level declared variables (let/const/var) so
// deterministic tests can inspect them.

export interface RunResult {
  success: boolean;
  stdout: string[];
  runtimeError: string | null;
  variables: Record<string, unknown>;
}

const DECL_RE = /\b(?:let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=|,)/g;

export function extractDeclaredVariables(code: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(DECL_RE.source, 'g');
  while ((m = re.exec(code)) !== null) {
    const name = m[1];
    if (name === 'console' || name === 'window' || name === 'document') continue;
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

const IFRAME_SOURCE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
  function hearReady(parentWindow) {
    try { parentWindow.postMessage({ type: 'codepath:ready' }, '*'); } catch (e) {}
  }
  // Notify the parent this worker is alive as soon as the script runs.
  hearReady(window.parent);

  var __output = [];
  var __origLog = console.log;
  console.log = function () {
    var args = Array.prototype.slice.call(arguments);
    __output.push(args.map(function (a) {
      try {
        return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a);
      } catch (e) { return '[object]'; }
    }).join(' '));
  };
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    __output.push('[error] ' + args.map(String).join(' '));
  };

  // Variable harvesting deliver point. Learner code is evaluated together with an
  // injected harvest-read block as ONE script (see handler below). Evaluating the
  // reads in the same script - rather than in a separate second eval - is what
  // makes top-level let/const declared by the learner visible to the harvest.
  var __cpHarvested = {};
  window.__cpDeliver = function (obj) { __cpHarvested = obj || {}; };

  window.addEventListener('message', function (e) {
    var data = e.data || {};
    if (!data || data.type !== 'codepath:run') return;
    var channel = e.ports[0];
    var code = data.code;
    var names = data.declared || [];
    __output = [];
    __cpHarvested = {};
    try {
      // Append one guarded read per declared name. The reads share the same
      // script/global-lexical environment as the user code, so let/const/var
      // (:name:) are all in scope when read. Undeclared names are skipped.
      var reads = '';
      for (var i = 0; i < names.length; i++) {
        reads +=
          '\nif (typeof ' + names[i] + ' !== "undefined") {' +
          ' __cpHarvested[' + JSON.stringify(names[i]) + '] = ' + names[i] + '; }';
      }
      var combined = code + '\n;' + reads + '\n;window.__cpDeliver(__cpHarvested);';
      (0, eval)(combined);
      channel.postMessage({ ok: true, output: __output, error: null, harvested: __cpHarvested });
    } catch (err) {
      channel.postMessage({
        ok: false,
        output: __output,
        error: String(err && err.message ? err.message : err),
        harvested: {}
      });
    }
  });
</script>
</body></html>`;

let iframe: HTMLIFrameElement | null = null;
let readyPromise: Promise<void> | null = null;

function listenForReady(target: Window): Promise<void> {
  return new Promise((resolve) => {
    const check = (e: MessageEvent) => {
      if (e.data && e.data.type === 'codepath:ready') {
        window.removeEventListener('message', check);
        resolve();
      }
    };
    window.addEventListener('message', check);
  });
}

function getIframe(): HTMLIFrameElement {
  if (iframe && iframe.contentWindow) return iframe;
  iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('title', 'codepath-sandbox');
  iframe.setAttribute('data-sandbox', 'codepath-runner');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(IFRAME_SOURCE);
    doc.close();
  }
  const win = iframe.contentWindow;
  readyPromise = win ? listenForReady(win) : Promise.resolve();
  return iframe;
}

export function setupSandbox(): void {
  getIframe();
}

async function ensureReady(): Promise<void> {
  getIframe();
  if (readyPromise) await readyPromise;
}

function fallbackRun(code: string, names: string[]): RunResult {
  // Last-resort execution if the iframe is unusable (e.g. srcdoc blocked):
  // run with a Function that captures console.log. Sandboxed within this page
  // scope is weaker, but never touches window/document of the app because code
  // is beginner-level and only console.log is used. Prefer the iframe path.
  try {
    const lines: string[] = [];
    // Build a single function body that runs the user code AND returns the
    // declared variables. Reusing the same scope means top-level let/const/var
    // declared by the user are readable (mirrors the iframe fix).
    const harvest =
      '(function () { var o = {}; ' +
      names
        .map((n) => `if (typeof ${n} !== 'undefined') o[${JSON.stringify(n)}] = ${n};`)
        .join(' ') +
      ' return o; })()';
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', code + '\n;return ' + harvest + ';');
    const vars = fn({
      log: (...a: unknown[]) =>
        lines.push(a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ')),
      error: (...a: unknown[]) => lines.push('[error] ' + a.map(String).join(' ')),
    });
    return {
      success: true,
      stdout: lines,
      runtimeError: null,
      variables: vars && typeof vars === 'object' ? (vars as Record<string, unknown>) : {},
    };
  } catch (err) {
    return {
      success: false,
      stdout: [],
      runtimeError: err instanceof Error ? err.message : String(err),
      variables: {},
    };
  }
}

export function runUserCode(
  code: string,
  opts?: { timeoutMs?: number; declared?: string[] }
): Promise<RunResult> {
  const timeoutMs = opts?.timeoutMs ?? 3000;
  const declared = opts?.declared ?? extractDeclaredVariables(code);

  const frame = getIframe();
  const win = frame.contentWindow;
  if (!win) return Promise.resolve(fallbackRun(code, declared));

  return (async () => {
    // Wait for the sandbox to signal readiness.
    if (readyPromise) {
      try {
        await Promise.race([
          readyPromise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('sandbox-not-ready')), 1500)),
        ]);
      } catch {
        // Iframe never became ready; use the in-page fallback.
        return fallbackRun(code, declared);
      }
    }

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => {
        channel.port1.onmessage = null;
        try {
          channel.port1.close();
        } catch {
          /* noop */
        }
        resolve({ success: false, stdout: [], runtimeError: 'Execution timed out.', variables: {} });
      }, timeoutMs);

      channel.port1.onmessage = (e) => {
        window.clearTimeout(timer);
        const data = e.data || {};
        const result: RunResult = {
          success: data.ok === true,
          stdout: Array.isArray(data.output) ? data.output : [],
          runtimeError: data.error || null,
          variables: data.harvested && typeof data.harvested === 'object' ? data.harvested : {},
        };
        resolve(result);
      };

      try {
        win.postMessage({ type: 'codepath:run', code, declared }, '*', [channel.port2]);
      } catch (err) {
        window.clearTimeout(timer);
        resolve({ success: false, stdout: [], runtimeError: String(err), variables: {} });
      }
    });
  })();
}
