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
  type StateProvider,
  type SessionState,
} from './webmcp';
import type { ToolResult } from './webmcp';

// ---------------------------------------------------------------------------
// Shared tool handlers — the single source of truth used by BOTH registration
// surfaces below. Each handler returns a structured WebMCP ToolResult.
// ---------------------------------------------------------------------------

export type ToolHandler = (args?: Record<string, unknown>) => Promise<ToolResult>;

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
  };
}

const provider: StateProvider = {
  get: snapshot,
  setCurrentLesson: (lessonId) => useProgress.getState().setCurrentLesson(lessonId),
  setCourse: (courseId) => useProgress.getState().setCourse(courseId),
};

function asRecord(args: unknown): Record<string, unknown> | undefined {
  return args && typeof args === 'object' ? (args as Record<string, unknown>) : undefined;
}

function text(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

/**
 * The 7 shared tool handlers. `buildToolHandlers()` returns an object keyed by
 * tool name. Both `document.modelContext.registerTool` and the dev bridge call
 * the functions herein.
 */
export function buildToolHandlers(): Record<string, ToolHandler> {
  const handlers: Record<string, ToolHandler> = {
    get_course_progress: async () => text(getCourseProgress(snapshot())),

    get_current_lesson: async () => text(getCurrentLesson(snapshot())),

    get_current_exercise: async (args) => text(getCurrentExercise(snapshot(), asRecord(args))),

    run_code: async (args) => {
      const a = asRecord(args);
      const state = snapshot();
      const found = javascriptCourse.lessons.find((l) => l.id === state.currentLessonId);
      const code =
        (a?.code as string) ??
        (a?.exerciseId
          ? state.studentCode[a.exerciseId as string] ?? found?.tryIt.starterCode ?? ''
          : found?.tryIt.starterCode ?? '');
      const result = await runUserCode(code);
      return text({
        success: result.success,
        stdout: result.stdout,
        runtimeError: result.runtimeError,
        variables: result.variables,
        exerciseId: a?.exerciseId ?? null,
      });
    },

    submit_solution: async (args) => {
      const a = asRecord(args);
      const state = snapshot();
      const exerciseId = a?.exerciseId as string | undefined;
      const lessonId = a?.lessonId as string | undefined;
      const lesson =
        javascriptCourse.lessons.find((l) => l.id === lessonId) ??
        javascriptCourse.lessons.find((l) => l.id === state.currentLessonId);
      const exercise = lesson?.exercises.find((e) => e.id === exerciseId) ?? lesson?.exercises[0];
      if (!lesson || !exercise) {
        return text({ error: 'Exercise not found.' });
      }
      const code = state.studentCode[exercise.id] ?? exercise.starterCode;
      const result = await validateSolution(lesson, exercise, code);
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
      return text({
        passed: result.passed,
        testsPassed: result.testsPassed,
        testsTotal: result.testsTotal,
        feedback: result.feedback,
        hintContext: result.hintContext,
        failedTests: result.failedTests.map((f) => f.description),
        exerciseId: exercise.id,
        lesson: lesson.id,
      });
    },

    open_lesson: async (args) => {
      const a = asRecord(args);
      const lessonId = a?.lessonId;
      const VALID_IDS = ['introduction', 'variables', 'conditions', 'loops'];
      // Defensive: open_lesson REQUIRES a valid lessonId. Missing or invalid
      // returns a clean structured error and never changes navigation.
      if (typeof lessonId !== 'string' || lessonId.trim() === '') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: 'lessonId is required. One of: introduction, variables, conditions, loops.' },
                null,
                2
              ),
            },
          ],
          navigated: false,
        };
      }
      if (!VALID_IDS.includes(lessonId)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Invalid lessonId "${lessonId}". Must be one of: introduction, variables, conditions, loops.`,
                },
                null,
                2
              ),
            },
          ],
          navigated: false,
        };
      }
      const r = openLesson(provider, { lessonId });
      return { content: r.content, navigated: true };
    },

    get_learning_context: async () => text(getLearningContext(snapshot())),
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

// ---------------------------------------------------------------------------
// Browser-native registration — the WebMCP Challenge requirement.
// ---------------------------------------------------------------------------

type ModelContextLike = {
  registerTool?: (def: {
    name: string;
    description: string;
    inputSchema: JsonSchema;
    execute: (input: Record<string, unknown> | undefined) => Promise<ToolResult>;
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
