# CodePath

**Learn programming from scratch with your AI tutor.**

CodePath is a structured, beginner-first programming course designed for humans
and AI agents to learn together. It uses **WebMCP** to let an AI agent understand
where you are in the course, read your current lesson and exercise, run your code,
validate your solution, and tutor you — without giving the answers away.

Built for a WebMCP hackathon MVP. Currently covers **JavaScript** across 4 lessons;
Python and HTML/CSS appear as "coming soon".

---

## ✨ Features

- **4 interactive JavaScript lessons**
  1. Introduction to JavaScript
  2. Variables
  3. Conditions
  4. Loops
- **Reusable lesson structure** — objective → explanation → visual animation →
  examples → Try It Yourself → exercises → mini quiz → progress.
- **Visual / animated explanations** (CSS animations, no videos):
  - Interaction demo, labeled variable box, condition decision tree, loop-flow.
- **Sandboxed code editor** — CodeMirror editor; code runs in an isolated iframe
  (`sandbox="allow-scripts"`), never `eval`'d in the main page.
- **Deterministic exercise tests** — each exercise validates against fixed tests
  with a structured `{ passed, testsPassed, testsTotal, feedback, hintContext }`
  result.
- **Progress tracking** — persisted to `localStorage` (current lesson, completed
  lessons/exercises, quiz results, recent attempts and mistakes).
- **AI Tutor panel** — tutor mode selector (Guide / Balanced / Explain). Guide
  mode only gives hints, never solutions until asked.
- **WebMCP** — the app registers its 7 tools on the real browser WebMCP API
  (`document.modelContext.registerTool`), so a WebMCP-compatible AI agent can
  read the learner's lesson, exercise, code and mistakes, and act on them.
- **Responsive UI** — sidebar, lesson area and floating AI Tutor panel.

---

## 🚀 Quick start

### 1. Install

```bash
npm install
```

### 2. Run the web app (development)

```bash
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

The web app and its **browser WebMCP tools are fully self-contained** — they work
purely by opening the URL. No backend or server is required for the core judging
flow.

### 3. Production build

```bash
npm run build
npm run preview
```

---

## 🌐 WebMCP

WebMCP is what makes CodePath "agent-native": a standard way for the **web page
itself** to expose its live state and actions to an AI agent. Instead of the agent
guessing at scraping the DOM, the page declares structured tools — the agent calls
them and gets real, structured answers about the learner's progress.

### Why WebMCP?

A tutor that knows exactly where the student is — their current lesson, the exact
exercise, the code they've typed, and which mistakes they've made — can give
far more useful, context-aware help. With WebMCP the agent gets all of that on
demand, and it can even move the learner to another lesson. No mock data: every
tool reads or writes real application state.

### How browser WebMCP registration works

This project satisfies the WebMCP Challenge requirement exactly as specified: the
application itself registers tools through the browser WebMCP API.

```js
if ('modelContext' in document) {
  document.modelContext.registerTool({
    name: 'submit_solution',
    description: 'Validate the current exercise against deterministic tests.',
    inputSchema: { type: 'object', properties: { exerciseId: { type: 'string' } }, required: [] },
    async execute(input) {
      // validates against the real deterministic tests, then returns a structured result
    },
  });
}
```

The same is done for **all seven tools**. Registration happens once when the
course is opened, in:

`src/lib/webmcp-browser.ts` → `registerBrowserWebmcp()`

That function:
1. Checks `'modelContext' in document` (real feature detection — see below).
2. Registers each tool via `document.modelContext.registerTool({ name, description,
   inputSchema, execute })`.
3. Returns an honest status (`browser-webmcp` / `unavailable`) that the UI shows.

**Feature detection is safe and honest.** If the browser has no
`document.modelContext` (any today), we do **not** polyfill or fake it — the tools
simply cannot be agent-discovered there, the app keeps working normally for the
learner, and the UI clearly reports **"WebMCP unavailable in this browser"**.
Only when `document.modelContext` actually exists do we report **"WebMCP Ready ·
7 tools"**. We never report "connected" just because `window.__webmcp` exists.

The registration's `execute` handlers call the **same shared functions** used by
the UI and the deterministic tests (`src/lib/webmcp.ts` + `src/lib/validator.ts`),
so agent results exactly match what the student sees.

### The 7 tools

| Tool | What it does |
|------|--------------|
| `get_course_progress` | Where the learner is: language, current lesson, progress %, completed lessons/exercises |
| `get_current_lesson` | Current lesson objective, summary and concepts |
| `get_current_exercise` | The exact current exercise and the student's current code |
| `run_code` | Run the student's code in the real sandbox, return stdout / variables / errors |
| `submit_solution` | Validate the exercise against the deterministic tests, return a structured pass/fail + hints |
| `open_lesson` | Navigate the learning UI to a specific lesson |
| `get_learning_context` | Full tutor context: progress, mistakes, code, tutor mode — everything a tutor needs |

**Read vs. write:** the six read/inspect tools never mutate state. `open_lesson`
changes visible navigation (allowed). `submit_solution` records the attempt in
progress state when appropriate (allowed). Errors return a clean structured
message — never a raw internal exception dump.

### The main demo

The core WebMCP demo is an agent coaching a student start to finish:

1. **Agent reads learning progress.** `get_course_progress`
2. **Agent reads current lesson/exercise.** `get_current_lesson` /
   `get_current_exercise`
3. **Student attempts the exercise** (types code in the sandbox editor).
4. **Agent submits / checks it.** `submit_solution` → structured pass/fail, no answer leaked.
5. **Agent gives contextual tutoring.** `get_learning_context` drives a hint, not the answer.
6. **Student fixes the code.**
7. **Agent submits again.** `submit_solution` → passes.
8. **Progress updates** (exercise recorded, lesson auto-completes at 100%).
9. **Agent can navigate to another lesson.** `open_lesson`

### How judges can test it

**WebMCP requires a WebMCP-capable browser.** As of today that is **Chrome 149+**
with the WebMCP testing flag enabled.

1. In Chrome, open `chrome://flags/#enable-webmcp-testing` and set the flag to
   **Enabled**, then relaunch Chrome.
2. Open the CodePath URL and enter the JavaScript course. The header should show
   **"● WebMCP Ready · 7 tools"**.
3. Ask your WebMCP-compatible agent (or run the browser's WebMCP tool handler) to
   run the demo above. The agent will discover `get_course_progress`,
   `get_current_exercise`, `submit_solution`, etc., via `document.modelContext`
   and act on them.

**No WebMCP browser?** The UI will honestly show "WebMCP unavailable" — the app
still works for learning. For development/testing you can still call the same
shared tool handlers in-page via `window.__webmcp` (see below), but that bridge is
**not** the WebMCP Challenge integration and is never used to claim availability.

### Where the registration code lives

- `src/lib/webmcp-browser.ts` — browser WebMCP registration
  (`document.modelContext.registerTool`) + shared tool handlers + honest status.
- `src/lib/webmcp.ts` — shared tool metadata, input schemas and pure business logic
  (`getCourseProgress`, `getCurrentLesson`, `getCurrentExercise`, `openLesson`, ...).
- `src/lib/validator.ts` + `src/lib/sandbox.ts` — the deterministic tests and the
  sandbox, reused by the tools.

### Optional development/testing bridge (`window.__webmcp`)

For convenience the **same** handlers are exposed on `window.__webmcp` (tagged
`native: false`). This is only for development and automated testing inside a
non-WebMCP browser:

```js
await window.__webmcp.tools.get_course_progress({});
await window.__webmcp.tools.run_code({ code: 'console.log(1+1);' });
```

It is **not** the WebMCP Challenge browser implementation and is never treated as
a substitute for `document.modelContext`.

---

## 🚀 Optional — Node MCP server (external MCP integration)

**Optional development / external MCP integration only.** The core browser WebMCP
experience does **not** use this. The web app is fully self-contained and works by
just opening the URL.

For an **external** Model Context Protocol client (e.g. a desktop agent that talks
to servers over stdio — not the browser WebMCP API), start:

```bash
npm run mcp
```

This starts an MCP server over **stdio** exposing the same 7 tools, backed by a
shared state file at `data/state.json`. A companion HTTP server syncs browser
progress to that file:

```bash
npx tsx server/http-server.ts
# GET  /api/state    read learner state
# POST /api/state    merge progress from the browser
# GET  /health
```

This is useful for development and for proving the tools work against a standard
MCP client, but it is **not** the WebMCP Challenge browser requirement — that is
`document.modelContext.registerTool`, which needs no server.

---

## 🏗 Architecture

```
src/
  components/      UI: Landing, CourseView, LessonView, Sidebar, CodeRunner,
                   CodeEditor, QuizBlock, TutorPanel, DebugPanel, VisualExplanation
  data/            Course/lesson content (structured data — add languages here)
  lib/
    sandbox.ts      iframe-based isolated JS execution
    validator.ts    deterministic exercise tests
    webmcp.ts       shared tool metadata, input schemas + pure business logic
    webmcp-browser.ts   BROWSER WebMCP registration (document.modelContext)
                        + shared handlers + honest status + dev bridge
    sync.ts         best-effort progress sync to the optional MCP server
  store/           Zustand progress store (localStorage-persisted)
  types.ts         shared TypeScript types
server/            OPTIONAL external MCP integration (not required by the browser app)
  mcp-server.ts    Node MCP server (stdio) — same 7 tools
  http-server.ts   HTTP sync companion + state endpoints
  state.ts         shared JSON state file manager
```

Lesson content lives as plain structured data in `src/data/` so Python or other
languages can reuse the exact same rendering and validation system.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

## ⚠️ Notes

- The **browser WebMCP registration** (`document.modelContext.registerTool`) is the
  primary, WebMCP-Challenge-compliant integration and works with no backend — the
  judged URL works by just opening it.
- `window.__webmcp` is a development/testing bridge only and is **not** the
  WebMCP Challenge implementation (it is never used to claim WebMCP availability).
- The Node MCP server (`server/`) is optional and targets the standard Model
  Context Protocol via `@modelcontextprotocol/sdk` for external (desktop) clients.
- All course text is original and not copied from W3Schools or any other source.
