// Browser WebMCP client.
//
// PRIMARY (WebMCP Challenge requirement): registers the app's WebMCP tools through
// the REAL browser WebMCP API — `document.modelContext.registerTool(...)` — exactly
// as the WebMCP Challenge specifies. This is what an agent (Chrome 149+ with the
// WebMCP flag enabled) discovers and calls.
//
// When the browser does NOT expose `document.modelContext` (any normal browser
// today), we do NOT polyfill or fake it. The app keeps working normally for the
// learner, and `getWebmcpStatus()` reports "unavailable in this browser".
//
// SECONDARY (dev/testing only): we also expose the same tool handlers on
// `window.__webmcp` so that our own automated tests / dev harness can call the
// tools in-page without needing a WebMCP-capable browser. This bridge is NOT the
// WebMCP Challenge implementation, it is never reported as "WebMCP connected",
// and it is clearly documented as a development/testing convenience.
//
// Crucially, BOTH surfaces call the SAME underlying handler functions, which call
// the SAME business logic used by the UI and the deterministic tests — so there is
// no duplicated or divergent behavior.

import { useProgress } from '../store/progress';
import { runUserCode } from './sandbox';
import { validateSolution } from './validator';
import { javascriptCourse } from '../data/javascript';
import {
  toolMetadata,
  getCourseProgress,
  getCurrentLesson,
  getCurrentExercise,
  openLesson,
  getLearningContext,
  editorIdFor,
  getTutorPolicy,
  type StateProvider,
  type SessionState,
} from './webmcp';
import type { ToolResult } from './webmcp';
import type { LastRun, LastSubmission } from '../types';
import { isExerciseLikeStep } from './unlock';

// ---------------------------------------------------------------------------
// Shared tool handlers — the single source of truth used by BOTH registration
// surfaces below. Each handler returns a CLEAN plain-object result (no MCP
// `content` envelope) so Chrome WebMCP never double-wraps. The shared business
// logic in webmcp.ts still returns MCP-style ToolResults; `toPlain` unwraps
// them here, and that shared logic is left untouched for the Node MCP server.
// ---------------------------------------------------------------------------

export type ToolHandler = (args?: Record<string, unknown>) => Promise<unknown>;

function snapshot(): SessionState {
  const s = useProgress.getState();
  return {
    courseId: s.courseId,
    currentLessonId: s.currentLessonId,
    completedLessons: s.completedLessons,
    completedExercises: s.completedExercises,
    quizResults: s.quizResults,
    attempts: s.attempts,
    recentMistakes: s.recentMistakes,
    studentCode: s.studentCode,
    tutorMode: s.tutorMode,
    activeStep: s.activeStep,
    currentActivity: s.currentActivity,
    currentScreen: s.currentScreen,
    editorDrafts: s.editorDrafts,
    activeEditorId: s.activeEditorId,
    lastRun: s.lastRun,
    lastSubmission: s.lastSubmission,
  };
}

const provider: StateProvider = {
  get: snapshot,
  setCurrentLesson: (lessonId) => useProgress.getState().setCurrentLesson(lessonId),
  setCourse: (courseId) => useProgress.getState().setCourse(courseId),
  setScreen: (screen) => useProgress.getState().setScreen(screen),
};

function asRecord(args: unknown): Record<string, unknown> | undefined {
  return args && typeof args === 'object' ? (args as Record<string, unknown>) : undefined;
}

/**
 * Convert a shared MCP-style `ToolResult` ({ content: [{type:'text',
 * text: JSON.stringify(payload)}] }) into a CLEAN plain object suitable for
 * Chrome WebMCP.
 *
 * Chrome WebMCP wraps whatever `execute` resolves to inside its OWN single
 * { content: [{ type:'text', text }] } envelope. If we returned the shared MCP
 * ToolResult object as-is, Chrome would stringify that whole envelope into
 * `text`, yielding a nested { content:[...] } JSON *inside* the outer envelope
 * (the double-wrap observed in the wild). Unwrapping here means `text` holds
 * the actual JSON payload exactly once — the clean result an agent expects.
 *
 * Shared business logic is NOT touched; we only unpack the envelope it returns.
 */
function toPlain(result: ToolResult): Record<string, unknown> {
  const first = result.content?.[0];
  const raw = first && first.type === 'text' ? first.text : undefined;
  if (raw === undefined || raw === '') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return { value: parsed };
  } catch {
    // Not valid JSON (never expected, since output is always JSON.stringify'd).
    return { text: raw };
  }
}

/**
 * The 7 shared tool handlers. `buildToolHandlers()` returns an object keyed by
 * tool name. Both `document.modelContext.registerTool` and the dev bridge call
 * the functions herein.
 *
 * Each handler resolves to a CLEAN plain result (no MCP `content` envelope) so
 * Chrome WebMCP's own single envelope is the only wrapper — never a nested
 * `content` inside a serialized `content`.
 */
export function buildToolHandlers(): Record<string, ToolHandler> {
  const handlers: Record<string, ToolHandler> = {
    get_course_progress: async () => toPlain(getCourseProgress(snapshot())),

    get_current_lesson: async () => toPlain(getCurrentLesson(snapshot())),

    get_current_exercise: async (args) => toPlain(getCurrentExercise(snapshot(), asRecord(args))),

    run_code: async (args) => {
      const a = asRecord(args);
      const state = snapshot();
      // On the welcome screen there is no active code context. Do NOT silently
      // run the first lesson's starter code. If the caller supplied explicit
      // code/exerciseId, that is still a valid, truthful request.
      if (state.currentScreen === 'welcome' && !a?.code && !a?.exerciseId) {
        return { error: 'No active coding exercise. Open a lesson or exercise first.' };
      }
      const found = javascriptCourse.lessons.find((l) => l.id === state.currentLessonId);

      // Resolve which code to run. Priority:
      //   1. explicit `code` argument
      //   2. current active editor draft (explicit exerciseId OR the active step)
      //   3. saved studentCode (legacy)
      //   4. starter code only if no learner code exists
      let code = found?.tryIt?.starterCode ?? '';
      if (typeof a?.code === 'string' && a.code.trim() !== '') {
        code = a.code;
      } else {
        // Determine the editor context: an explicit exerciseId OR the active step.
        const active = useProgress.getState().activeStep;
        let stepId: string | null = null;
        if (typeof a?.exerciseId === 'string') {
          const ex = found?.exercises.find((e) => e.id === a.exerciseId);
          stepId = ex ? ex.id : a.exerciseId;
        } else if (active) {
          stepId =
            active.stepId === 'tryit'
              ? 'tryit'
              : isExerciseLikeStep(active.type)
                ? active.stepId
                : 'tryit';
        }
        const editorKey = stepId
          ? editorIdFor(state.courseId, state.currentLessonId, stepId)
          : null;
        const draft = editorKey ? state.editorDrafts[editorKey] : undefined;
        if (draft) {
          code = draft.code;
        } else if (typeof a?.exerciseId === 'string' && state.studentCode[a.exerciseId]) {
          code = state.studentCode[a.exerciseId];
        }
      }

      // Keep the learning cursor honest: the learner just ran code (or is now
      // reviewing the output). Non-essential but cheap and truthful.
      useProgress.getState().setCurrentActivity('running_code');
      const result = await runUserCode(code);
      useProgress.getState().setCurrentActivity('reviewing_feedback');
      // Store structured lastRun context for tutoring.
      const lastRun: LastRun = {
        codeUsed: code,
        success: result.success,
        stdout: result.stdout,
        runtimeError: result.runtimeError,
        timestamp: Date.now(),
      };
      useProgress.getState().setLastRun(lastRun);
      const tutorMode = useProgress.getState().tutorMode;
      const tutorPolicy = getTutorPolicy(tutorMode);
      return {
        success: result.success,
        stdout: result.stdout,
        runtimeError: result.runtimeError,
        variables: result.variables,
        codeUsed: code,
        exerciseId: a?.exerciseId ?? null,
        tutorMode,
        tutorPolicy,
      };
    },

    submit_solution: async (args) => {
      const a = asRecord(args);
      const state = snapshot();
      const exerciseId = a?.exerciseId as string | undefined;
      const lessonId = a?.lessonId as string | undefined;
      // On the welcome screen the learner has no active exercise. Only allow a
      // submission when the caller explicitly names the exercise+lesson; never
      // silently default to the first exercise of the first lesson.
      if (state.currentScreen === 'welcome' && !exerciseId) {
        return { error: 'No active coding exercise. Open a lesson or exercise first.' };
      }
      const lesson =
        javascriptCourse.lessons.find((l) => l.id === lessonId) ??
        javascriptCourse.lessons.find((l) => l.id === state.currentLessonId);
      const exercise = lesson?.exercises.find((e) => e.id === exerciseId) ?? lesson?.exercises[0];
      if (!lesson || !exercise) {
        return { error: 'Exercise not found.' };
      }

      // Resolve which code to validate. Priority:
      //   1. explicit `code` argument
      //   2. the live editor draft for this exercise (what's visibly in CodeMirror)
      //   3. saved studentCode (legacy)
      //   4. starter only when truly untouched
      let code: string;
      if (typeof a?.code === 'string' && a.code.trim() !== '') {
        code = a.code;
      } else {
        const editorKey = editorIdFor(state.courseId, lesson.id, exercise.id);
        const draft = state.editorDrafts[editorKey];
        if (draft) {
          code = draft.code;
        } else if (state.studentCode[exercise.id]) {
          code = state.studentCode[exercise.id];
        } else {
          code = exercise.starterCode;
        }
      }

      useProgress.getState().setCurrentActivity('solving_exercise');
      const result = await validateSolution(lesson, exercise, code);
      useProgress.getState().setCurrentActivity('reviewing_feedback');
      // Record the attempt in real state (mutating action — allowed for this tool).
      useProgress.getState().recordExerciseResult(
        {
          passed: result.passed,
          testsPassed: result.testsPassed,
          testsTotal: result.testsTotal,
          feedback: result.feedback,
          hintContext: result.hintContext,
        },
        lesson.id,
        exercise.id
      );
      // Store structured lastSubmission context for tutoring.
      const lastSubmission: LastSubmission = {
        exerciseId: exercise.id,
        codeUsed: code,
        passed: result.passed,
        testsPassed: result.testsPassed,
        testsTotal: result.testsTotal,
        failedTests: result.failedTests,
        feedback: result.feedback,
        hintContext: result.hintContext,
        stdout: result.stdout,
        runtimeError: result.runtimeError,
        timestamp: Date.now(),
      };
      useProgress.getState().setLastSubmission(lastSubmission);
      const tutorMode = useProgress.getState().tutorMode;
      const tutorPolicy = getTutorPolicy(tutorMode);
      return {
        passed: result.passed,
        testsPassed: result.testsPassed,
        testsTotal: result.testsTotal,
        feedback: result.feedback,
        hintContext: result.hintContext,
        failedTests: result.failedTests.map((f) => f.description),
        codeUsed: code,
        exerciseId: exercise.id,
        lesson: lesson.id,
        tutorMode,
        tutorPolicy,
      };
    },

    open_lesson: async (args) => {
      const a = asRecord(args);
      const lessonId = a?.lessonId;
      const VALID_IDS = ['introduction', 'variables', 'conditions', 'loops'];
      const missingError =
        'lessonId is required. One of: introduction, variables, conditions, loops.';
      const invalidError = (id: string) =>
        `Invalid lessonId "${id}". Must be one of: introduction, variables, conditions, loops.`;

      // Defensive: open_lesson REQUIRES a valid lessonId. Missing or invalid
      // returns a clean structured error and never changes navigation.
      if (typeof lessonId !== 'string' || lessonId.trim() === '') {
        return { error: missingError, navigated: false };
      }
      if (!VALID_IDS.includes(lessonId)) {
        return { error: invalidError(lessonId), navigated: false };
      }
      const r = openLesson(provider, { lessonId });
      return { ...toPlain(r), navigated: true };
    },

    get_learning_context: async () => toPlain(getLearningContext(snapshot())),
  };
  return handlers;
}

// ---------------------------------------------------------------------------
// JSON-Schema `inputSchema` for each tool, derived from our own metadata so that
// the browser registration and the metadata stay in lock-step.
// ---------------------------------------------------------------------------

type JsonSchema = {
  type: string;
  properties: Record<string, unknown>;
  required: string[];
};

/**
 * The tool metadata already carries a complete JSON Schema (type 'object',
 * `properties`, and a per-tool `required` array). This just returns it in the
 * exact shape `document.modelContext.registerTool` expects.
 */
function jsonSchema(schema: JsonSchema): JsonSchema {
  return schema;
}

// ---------------------------------------------------------------------------
// WebMCP status model — HONEST about what we found in the browser.
// ---------------------------------------------------------------------------

export type WebmcpStatus =
  | { mode: 'browser-webmcp'; supported: true; count: number; reason?: never }
  | { mode: 'unavailable'; supported: false; count: number; reason: string };

/**
 * Feature detection. Returns only the DECLARED environment facts:
 *   - whether `document.modelContext` exists (real browser WebMCP support)
 *   - whether browser-native registration ran and how many tools it registered
 * The dev bridge's existence is deliberately NOT used as evidence of WebMCP.
 */
let cachedStatus: WebmcpStatus | null = null;

function detectStatus(count: number): WebmcpStatus {
  const hasModelContext = typeof document !== 'undefined' && 'modelContext' in document;
  if (hasModelContext) {
    return { mode: 'browser-webmcp', supported: true, count };
  }
  return {
    mode: 'unavailable',
    supported: false,
    count,
    reason: 'document.modelContext is not present in this browser. WebMCP requires Chrome 149+ with chrome://flags/#enable-webmcp-testing enabled.',
  };
}

export function getWebmcpStatus(): WebmcpStatus {
  if (cachedStatus) return cachedStatus;
  const count = browserWebmcpRegisteredCount();
  cachedStatus = detectStatus(count);
  return cachedStatus;
}

export function refreshWebmcpStatus(): WebmcpStatus {
  cachedStatus = detectStatus(browserWebmcpRegisteredCount());
  return cachedStatus;
}

// Count of tools actually registered via document.modelContext (if it existed).
let registeredCount = 0;
function browserWebmcpRegisteredCount(): number {
  return registeredCount;
}

// Idempotency guard: register the 7 tools on document.modelContext at most once
// per page load. Repeated calls (e.g. an App remount under hot reload, or a
// careless re-run) must not accumulate duplicate tool registrations.
let browserRegistrationDone = false;

// ---------------------------------------------------------------------------
// Browser-native registration — the WebMCP Challenge requirement.
// ---------------------------------------------------------------------------

type ModelContextLike = {
  registerTool?: (def: {
    name: string;
    description: string;
    inputSchema: JsonSchema;
    execute: (input: Record<string, unknown> | undefined) => Promise<unknown>;
  }) => unknown;
};

declare global {
  interface Document {
    // Experiment WebMCP (Chrome 149+). Declared loosely to avoid TS errors when
    // the ambient type does not exist yet.
    modelContext?: ModelContextLike;
  }
}

/**
 * Register all 7 tools on the REAL browser WebMCP API (`document.modelContext`).
 * Returns the WebMCP status so callers can show an accurate UI badge.
 *
 * This never constructs or fakes `document.modelContext`. If the browser does not
 * expose it, nothing is registered and the status reports "unavailable".
 */
export function registerBrowserWebmcp(): WebmcpStatus {
  if (browserRegistrationDone) {
    // Already registered once this page load — do not register again (would
    // accumulate duplicate tools). Report the same status and let the UI refresh.
    cachedStatus = detectStatus(registeredCount);
    (window as any).dispatchEvent(
      new CustomEvent('webmcp:status', { detail: cachedStatus })
    );
    return cachedStatus;
  }
  browserRegistrationDone = true;
  const ctx: ModelContextLike | undefined = document.modelContext;
  const handlers = buildToolHandlers();
  const meta = toolMetadata();

  if (ctx && typeof ctx.registerTool === 'function') {
    let registered = 0;
    for (const m of meta) {
      const handler = handlers[m.name];
      if (!handler) continue;
      try {
        ctx.registerTool({
          name: m.name,
          description: m.description,
          inputSchema: jsonSchema(m.schema),
          execute: (input: Record<string, unknown> | undefined) => handler(input),
        });
        registered++;
      } catch (err) {
        // Fail softly for a single tool so a bad schema can't take down the whole
        // registration. Do NOT leak raw exception internals to any agent.
        // eslint-disable-next-line no-console
        console.warn(`[webmcp] Failed to register '${m.name}'`, err);
      }
    }
    registeredCount = registered;
  } else {
    registeredCount = 0;
  }

  cachedStatus = detectStatus(registeredCount);
  (window as any).dispatchEvent(
    new CustomEvent('webmcp:status', { detail: cachedStatus })
  );
  return cachedStatus;
}

// ---------------------------------------------------------------------------
// Development/testing bridge (NOT the WebMCP Challenge implementation).
// ---------------------------------------------------------------------------

export type WebmcpTools = Record<string, ToolHandler>;

/**
 * DEVELOPMENT / TESTING ONLY. Exposes the same shared handlers on
 * `window.__webmcp` so our automated tests (and a human dev with the console open)
 * can call the tools in-page without a WebMCP-capable browser.
 *
 * This is explicitly NOT the WebMCP Challenge browser integration and is never
 * used to claim WebMCP availability. It is kept strictly parallel to (and calls
 * the identical handlers as) the real registration.
 */
export function registerDevBridge(): number {
  const handlers = buildToolHandlers();
  const w = window as unknown as {
    __webmcp?: { tools: WebmcpTools; metadata: ReturnType<typeof toolMetadata>; native: boolean };
  };
  w.__webmcp = { tools: handlers as unknown as WebmcpTools, metadata: toolMetadata(), native: false };
  return Object.keys(handlers).length;
}

export function listBrowserToolsCount(): number {
  return toolMetadata().length;
}
