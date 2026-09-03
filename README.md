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
- **Progressive learning steps** — each lesson flows explanation → visual →
  example → Try It Yourself → exercises → mini quiz. Future steps are visible
  but locked/obscured until the learner passes the step that unlocks them.
- **Tutor Mode in the top navigation** — a compact switcher (Guide / Balanced /
  Explain). Guide mode only gives hints, never solutions until asked.
- **WebMCP / Agent status indicator** — a compact header indicator honestly
  reports whether the 7 tools are registered and available.
- **Contextual tutor actions/tips** — tutor hints and feedback appear in the
  lesson experience, tied to the learner's actual step, rather than a permanent
  floating panel.
- **Reduced card-heavy layout** — a leaner lesson surface; the permanent
  right-hand "AI Tutor" panel has been removed.
- **WebMCP** — the app registers its 7 tools **app-wide** at the stable App/root
  lifecycle via the real browser WebMCP API (`document.modelContext.registerTool`),
  so a WebMCP-compatible AI agent can discover and read the learner's lesson,
  exercise, code and mistakes from the welcome page onward, and act on them.
- **Responsive UI** — sidebar + lesson area.

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

The same is done for **all seven tools**. Registration is **app-wide**: it runs
once at the stable App/root lifecycle (`src/main.tsx` → `registerBrowserWebmcp()`),
so the tools are discoverable from the **welcome/landing page** in a
WebMCP-capable browser — before the course is even opened. It is idempotent, so
re-mounts never accumulate duplicate tools.

The implementation lives in:

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
| `get_current_exercise` | The exercise the learner is actively working on. Returns `active: false` when the learner is not actually on an exercise/practice/challenge step, instead of pretending an exercise is active |
| `run_code` | Run the student's code in the real sandbox, return stdout / variables / errors |
| `submit_solution` | Validate the exercise against the deterministic tests, return a structured pass/fail + hints |
| `open_lesson` | Navigate the learning UI to a specific lesson |
| `get_learning_context` | The primary tutor context tool: current screen, current lesson, active learning step + type, current learner activity, relevant student code, course/lesson progress, completed steps, next locked/unlocked step, recent mistakes and tutor mode |

**Read vs. write:** the read-only tools (`get_course_progress`,
`get_current_lesson`, `get_current_exercise`, `get_learning_context`) never mutate
state. `open_lesson` changes visible navigation (allowed). `submit_solution`
records the attempt in progress state when appropriate (allowed). `run_code`
executes code and returns output. Errors return a clean structured message —
never a raw internal exception dump.

### `get_learning_context` — the primary tutor context tool

Before tutoring anything, the agent should call `get_learning_context`. It returns
the full, live picture of where the learner actually is right now:

- **current screen** — `welcome` (landing page) or inside the course;
- **current lesson** — id + title when inside a lesson;
- **active learning step** — id, type, title, index, whether it is unlocked;
- **step type** — explanation / visual / example / practice / exercise / challenge / quiz;
- **current learner activity** — e.g. `reading`, `editing_code`,
  `running_code`, `solving_exercise`, `reviewing_feedback`, `answering_quiz`;
- **relevant student code** — the learner's current code when the active step is
  code-oriented;
- **course / lesson progress** — course percent, lesson percent, completed lessons;
- **completed steps** — the steps already passed to reach the active step;
- **next step** — the following step and whether it is locked/unlocked;
- **recent mistakes** and **tutor mode**.

On the welcome screen it truthfully reports
`{ screen: 'welcome', currentActivity: 'choosing_course', ... }` with the
available course(s) listed — it never pretends the learner is studying a lesson
they have not entered.

### The main demo

The core WebMCP demo is an agent coaching a student start to finish, beginning on
the **welcome page**:

1. **Judge opens CodePath** (the production URL) in a WebMCP-capable browser.
2. **Agent immediately discovers the 7 WebMCP tools** on the welcome page —
   registration is app-wide, so no course entry is needed first.
3. **Agent calls `get_learning_context`** and receives
   `{ screen: 'welcome', currentActivity: 'choosing_course', availableCourses: [...] }`.
4. **Learner asks to start / open a lesson.**
5. **Agent calls `open_lesson({ lessonId: 'introduction' })`** directly from
   welcome — it enters the requested JavaScript lesson and navigates visibly.
6. **Agent reads the active step / current activity** via `get_learning_context`
   (e.g. `explanation` / `reading`).
7. **Student progresses** from explanation → visual → practice (Try it yourself)
   → exercise; `get_learning_context` changes to reflect their real activity.
8. **Student submits an incorrect solution.** `submit_solution` → structured
   pass/fail, no answer leaked.
9. **Agent receives the structured feedback and tutors** (hint, not the answer)
   using `get_learning_context` + `get_current_exercise`.
10. **Student corrects the code** and submits again → passes.
11. **Progress updates** (exercise recorded, lesson advances).
12. **Agent can navigate to another lesson.** `open_lesson`

### How judges can test it

**WebMCP requires a WebMCP-capable browser.** As of today that is **Chrome 149+**
with the WebMCP testing flag enabled.

1. In Chrome, open `chrome://flags/#enable-webmcp-testing` and set the flag to
   **Enabled**, then relaunch Chrome.
2. Open the CodePath production URL — <https://codepath-webmcp.vercel.app>.
   Because registration is **app-wide**, the header should immediately show
   **"● WebMCP Ready · 7 tools"** on the **welcome page** — before entering the
   course.
3. Ask your WebMCP-compatible agent to run the demo above. From the welcome page
   it will immediately discover the 7 tools via `document.modelContext`, call
   `get_learning_context` (getting `welcome` / `choosing_course`), call
   `open_lesson({ lessonId: '...' })` directly to enter a lesson, and then
   continue interacting with the active lesson (read step/activity, run code,
   submit solutions, etc.).

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
  components/      UI: Landing, CourseView, LessonView, Sidebar, TopBar, CodeRunner,
                   CodeEditor, QuizBlock, DebugPanel, VisualExplanation
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
