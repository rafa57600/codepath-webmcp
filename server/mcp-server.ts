// Node MCP server for CodePath.
//
// Exposes the app's WebMCP tools over the standard Model Context Protocol using
// `@modelcontextprotocol/sdk` (high-level McpServer + registerTool). This lets any
// MCP-compatible client act as the learner's tutor with real, deterministic data.
// State is shared via a local JSON file (server/state.ts) that the browser app
// also syncs to through the /api proxy, keeping both views in agreement.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import vm from 'node:vm';
import { loadState, saveState } from './state.js';
import { javascriptCourse } from '../src/data/javascript';
import {
  stepsForLesson,
  activeStepIndex,
  isStepLocked,
  activeStepAt,
  defaultActiveStep,
  isExerciseLikeStep,
  learningStepType,
} from '../src/lib/unlock';
import { getTutorPolicy } from '../src/lib/webmcp';
import type { ServerState } from './state.js';

const server = new McpServer({
  name: 'codepath',
  version: '0.1.0',
});

// ---- helpers ---------------------------------------------------------------

function textResult(obj: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function findLesson(lessonId: string) {
  const idx = javascriptCourse.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) return null;
  return { lesson: javascriptCourse.lessons[idx], index: idx };
}

/**
 * Resolve the effective active step for the current lesson. Prefers the live
 * cursor when it is valid & reachable; otherwise falls back to the furthest
 * unlocked step derived from real progress.
 */
function resolveActiveStep(
  state: ServerState,
  lesson: (typeof javascriptCourse)['lessons'][number]
) {
  const steps = stepsForLesson(lesson);
  const furthestActive = activeStepIndex(lesson, state.completedExercises);
  const cursor = state.activeStep;
  const inLesson =
    cursor &&
    cursor.index >= 0 &&
    cursor.index < steps.length &&
    steps[cursor.index].key === cursor.stepId;
  const cursorReachable = inLesson && !isStepLocked(lesson, state.completedExercises, cursor!.index);
  const choice = cursorReachable ? cursor! : activeStepAt(lesson, furthestActive);
  return choice ?? defaultActiveStep(lesson, state.completedExercises);
}

// ---- live editor draft helpers (mirror webmcp.ts) --------------------------

function editorIdFor(courseId: string, lessonId: string, stepId: string): string {
  return `${courseId}:${lessonId}:${stepId}`;
}

function liveCodeFor(
  state: ServerState,
  lesson: (typeof javascriptCourse)['lessons'][number],
  stepId: string,
  fallbackStarter: string
): { code: string; dirty: boolean } {
  const id = editorIdFor(state.courseId, lesson.id, stepId);
  const draft = state.editorDrafts[id];
  if (draft) return { code: draft.code, dirty: draft.dirty };
  const saved = state.studentCode[stepId];
  if (saved !== undefined) return { code: saved, dirty: saved !== fallbackStarter };
  return { code: fallbackStarter, dirty: false };
}

function editorContext(
  state: ServerState,
  lesson: (typeof javascriptCourse)['lessons'][number],
  active: { stepId: string; type: string }
): Record<string, unknown> {
  const isCodeStep =
    active.stepId === 'tryit' ||
    active.type === 'exercise' ||
    active.type === 'challenge' ||
    active.type === 'practice';
  if (!isCodeStep) return { active: false };
  const editorId = editorIdFor(state.courseId, lesson.id, active.stepId);
  const draft = state.editorDrafts[editorId];
  if (!draft) return { active: false, stepId: active.stepId };
  const exerciseId =
    active.stepId === 'tryit' ? null : active.stepId;
  return {
    active: true,
    id: editorId,
    kind: active.stepId === 'tryit' ? 'practice' : active.type,
    exerciseId,
    stepId: active.stepId,
    code: draft.code,
    dirty: draft.dirty,
    lastEditedAt: draft.lastEditedAt,
    focused: state.activeEditorId === editorId,
  };
}

function runInVm(code: string): {
  success: boolean;
  stdout: string[];
  runtimeError: string | null;
  variables: Record<string, unknown>;
} {
  const stdout: string[] = [];
  const context: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) =>
        stdout.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      error: (...args: unknown[]) => stdout.push('[error] ' + args.map(String).join(' ')),
    },
  };
  const declRe = /\b(?:let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=|,)/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(code)) !== null) names.add(m[1]);
  for (const n of names) {
    if (n !== 'console' && n !== 'window' && n !== 'document') context[n] = undefined;
  }

  // Run the student code and read its declared variables in the SAME script,
  // so top-level `let`/`const` are visible to the harvest reads (a separate
  // directive/libeval would not see lexical bindings from a prior eval). In a
  // vm Script a top-level `return` is illegal, so wrap in an IIFE whose return
  // value is the harvested object.
  const harvest =
    names.size === 0
      ? '{}'
      : '{' +
        Array.from(names)
          .map((n) => `${JSON.stringify(n)}: (typeof ${n} !== 'undefined') ? ${n} : undefined`)
          .join(',') +
        '};';
  const combined = '(function () {\n' + code + '\nreturn ' + harvest + '})()';

  try {
    const variables = (vm.runInNewContext(combined, context, {
      timeout: 3000,
      filename: 'student.js',
    }) as Record<string, unknown> | null | undefined) ?? {};
    return { success: true, stdout, runtimeError: null, variables };
  } catch (err) {
    return {
      success: false,
      stdout,
      runtimeError: err instanceof Error ? err.message : String(err),
      variables: {},
    };
  }
}

// ---- Tools -----------------------------------------------------------------

server.registerTool(
  'get_course_progress',
  {
    description: 'Return where the learner currently is (language, lesson, progress %, completions).',
  },
  async () => {
    const state = await loadState();
    const completedLessons = javascriptCourse.lessons
      .filter((l) => state.completedLessons.includes(l.id))
      .map((l) => l.id);
    const percent = javascriptCourse.lessons.length
      ? Math.round((completedLessons.length / javascriptCourse.lessons.length) * 100)
      : 0;
    return textResult({
      language: state.courseId,
      currentLesson: state.currentLessonId,
      progressPercent: percent,
      completedLessons,
      completedExercises: state.completedExercises,
    });
  }
);

server.registerTool(
  'get_current_lesson',
  { description: 'Return the current lesson (objective, summary, concepts) plus the active learning step and activity.' },
  async () => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    if (!found) return textResult({ error: 'Lesson not found.' });
    const active = resolveActiveStep(state, found.lesson);
    return textResult({
      id: found.lesson.id,
      title: found.lesson.title,
      learningObjective: found.lesson.objective,
      summary: found.lesson.summary,
      concepts: found.lesson.concepts,
      activeStep: {
        id: active.stepId,
        type: active.type,
        title: active.title,
        index: active.index,
      },
      currentActivity: state.currentActivity,
    });
  }
);

server.registerTool(
  'get_current_exercise',
  {
    description:
      'Return the exercise the learner is actively working on, OR structured truth (active:false + current step) when they are NOT on an exercise/practice step. An explicit exerciseId always requests that exercise. Includes tutorMode + compact tutorPolicy so an agent knows how to tutor.',
    inputSchema: { exerciseId: z.string().optional() },
  },
  async ({ exerciseId }) => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    if (!found) return textResult({ error: 'Lesson not found.' });

    // Explicit exerciseId always honored.
    if (exerciseId) {
      const exercise = found.lesson.exercises.find((e) => e.id === exerciseId);
      if (!exercise) return textResult({ error: `Exercise "${exerciseId}" not found in this lesson.` });
      const live = liveCodeFor(state, found.lesson, exercise.id, exercise.starterCode);
      const policy = getTutorPolicy(state.tutorMode);
      return textResult({
        active: true,
        exerciseId: exercise.id,
        lesson: found.lesson.id,
        lessonTitle: found.lesson.title,
        instructions: exercise.instructions,
        starterCode: exercise.starterCode,
        studentCode: live.code,
        dirty: live.dirty,
        difficulty: exercise.difficulty,
        hint: exercise.hint ?? null,
        tutorMode: state.tutorMode,
        tutorPolicy: { mustNotRevealFinalSolution: policy.mustNotRevealFinalSolution, responseStrategy: policy.responseStrategy },
      });
    }

    const active = resolveActiveStep(state, found.lesson);

    // Learner is on an exercise-like step → return it (practice has no tests).
    if (isExerciseLikeStep(active.type) && active.stepId !== 'tryit') {
      const exercise =
        found.lesson.exercises.find((e) => e.id === active.stepId) ??
        found.lesson.exercises.find((e) => !state.completedExercises.includes(e.id)) ??
        found.lesson.exercises[0];
      if (!exercise) return textResult({ error: 'No exercise in this lesson.' });
      const live = liveCodeFor(state, found.lesson, exercise.id, exercise.starterCode);
      const policy = getTutorPolicy(state.tutorMode);
      return textResult({
        active: true,
        exerciseId: exercise.id,
        lesson: found.lesson.id,
        lessonTitle: found.lesson.title,
        instructions: exercise.instructions,
        starterCode: exercise.starterCode,
        studentCode: live.code,
        dirty: live.dirty,
        difficulty: exercise.difficulty,
        hint: exercise.hint ?? null,
        tutorMode: state.tutorMode,
        tutorPolicy: { mustNotRevealFinalSolution: policy.mustNotRevealFinalSolution, responseStrategy: policy.responseStrategy },
      });
    }

    // Learner is on the try-it playground step.
    if (active.stepId === 'tryit' || active.type === 'practice') {
      const draft = state.editorDrafts[editorIdFor(state.courseId, found.lesson.id, 'tryit')];
      return textResult({
        active: true,
        currentStepType: 'practice',
        currentStepTitle: 'Try it yourself',
        reason: "The learner is on the 'Try it yourself' playground step (no tests to submit).",
        exerciseId: null,
        editor: draft
          ? { active: true, kind: 'practice', code: draft.code, dirty: draft.dirty }
          : { active: false },
      });
    }

    // Not on an exercise step → structured truth.
    return textResult({
      active: false,
      currentStepType: active.type,
      currentStepTitle: active.title,
      reason: `The learner is currently on a ${active.type} step ("${active.title}"), not an exercise.`,
    });
  }
);

server.registerTool(
  'run_code',
  {
    description: "Run the student\u2019s current code in a sandbox and return output. The response includes tutorMode and tutorPolicy \u2014 follow the policy when explaining syntax errors, runtime errors, or unexpected output to the learner.",
    inputSchema: { code: z.string().optional(), exerciseId: z.string().optional() },
  },
  async ({ code, exerciseId }) => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);

    // Resolve code priority: explicit code > live editor draft > saved > starter.
    let target: string;
    if (code) {
      target = code;
    } else if (exerciseId) {
      const ex = found?.lesson.exercises.find((e) => e.id === exerciseId);
      if (ex) {
        const live = liveCodeFor(state, found!.lesson, ex.id, ex.starterCode);
        target = live.code;
      } else if (state.studentCode[exerciseId]) {
        target = state.studentCode[exerciseId];
      } else {
        target = found?.lesson.tryIt.starterCode ?? '';
      }
    } else if (found) {
      const active = resolveActiveStep(state, found.lesson);
      if (active.stepId === 'tryit') {
        const live = liveCodeFor(state, found.lesson, 'tryit', found.lesson.tryIt.starterCode);
        target = live.code;
      } else if (isExerciseLikeStep(active.type)) {
        const activeExId = active.stepId;
        const ex = found.lesson.exercises.find((e) => e.id === activeExId);
        if (ex) {
          const live = liveCodeFor(state, found.lesson, ex.id, ex.starterCode);
          target = live.code;
        } else {
          target = found.lesson.tryIt.starterCode;
        }
      } else {
        target = found.lesson.tryIt.starterCode;
      }
    } else {
      target = '';
    }

    const r = runInVm(target);
    const lastRun = {
      codeUsed: target,
      success: r.success,
      stdout: r.stdout,
      runtimeError: r.runtimeError,
      timestamp: Date.now(),
    };
    state.lastRun = lastRun;
    if (state.currentActivity !== 'running_code') {
      state.currentActivity = 'reviewing_feedback';
    }
    await saveState(state);
    const policy = getTutorPolicy(state.tutorMode);
    return textResult({
      success: r.success,
      stdout: r.stdout,
      runtimeError: r.runtimeError,
      codeUsed: target,
      exerciseId: exerciseId ?? null,
      tutorMode: state.tutorMode,
      tutorPolicy: policy,
    });
  }
);

server.registerTool(
  'submit_solution',
  {
    description: "Validate the current exercise against deterministic tests. The validated code is the learner\u2019s live editor draft unless an explicit code/exerciseId/lessonId is provided. The response includes tutorPolicy \u2014 follow it when presenting feedback to the learner.",
    inputSchema: { exerciseId: z.string().optional(), lessonId: z.string().optional(), code: z.string().optional() },
  },
  async ({ exerciseId, lessonId, code }) => {
    const state = await loadState();
    const targetLesson = lessonId ?? state.currentLessonId;
    const found = findLesson(targetLesson);
    if (!found) return textResult({ error: 'Lesson not found.' });
    const exercise =
      found.lesson.exercises.find((e) => e.id === exerciseId) ?? found.lesson.exercises[0];
    if (!exercise) return textResult({ error: 'Exercise not found.' });

    // Resolve code priority: explicit code > live editor draft > saved > starter.
    let validatedCode: string;
    if (code) {
      validatedCode = code;
    } else {
      const live = liveCodeFor(state, found.lesson, exercise.id, exercise.starterCode);
      validatedCode = live.code;
    }

    const run = runInVm(validatedCode);
    const scope: Record<string, unknown> = { outputs: run.stdout, vars: run.variables };
    for (const [k, v] of Object.entries(run.variables)) scope[k] = v;
    let testsPassed = 0;
    const failed: string[] = [];
    for (const test of exercise.tests) {
      let ok = false;
      try {
        const fn = new Function(...Object.keys(scope), `return (${test.run});`);
        ok = Boolean(fn(...Object.keys(scope).map((k) => scope[k])));
      } catch {
        ok = false;
      }
      if (ok) testsPassed++;
      else failed.push(test.description);
    }
    const passed = testsPassed === exercise.tests.length;

    if (passed) {
      state.completedExercises = Array.from(new Set([...state.completedExercises, exercise.id]));
      if (found.lesson.exercises.every((e) => state.completedExercises.includes(e.id))) {
        state.completedLessons = Array.from(new Set([...state.completedLessons, targetLesson]));
      }
    }

    // Store structured lastSubmission context.
    state.lastSubmission = {
      exerciseId: exercise.id,
      codeUsed: validatedCode,
      passed,
      testsPassed,
      testsTotal: exercise.tests.length,
      failedTests: failed.map((description) => ({ id: description, description })),
      feedback: run.runtimeError
        ? `Error: ${run.runtimeError}`
        : passed
          ? 'All tests passed.'
          : 'Some tests failed.',
      hintContext: passed ? '' : exercise.hint ?? '',
      stdout: run.stdout,
      runtimeError: run.runtimeError,
      timestamp: Date.now(),
    };
    await saveState(state);

    const subPolicy = getTutorPolicy(state.tutorMode);
    return textResult({
      passed,
      testsPassed,
      testsTotal: exercise.tests.length,
      feedback: run.runtimeError
        ? `Error: ${run.runtimeError}`
        : passed
          ? 'All tests passed.'
          : 'Some tests failed.',
      hintContext: passed ? '' : exercise.hint ?? '',
      failedTests: failed,
      codeUsed: validatedCode,
      exerciseId: exercise.id,
      lesson: targetLesson,
      tutorMode: state.tutorMode,
      tutorPolicy: subPolicy,
    });
  }
);

server.registerTool(
  'open_lesson',
  {
    description: 'Navigate the learning UI to a specific lesson.',
    inputSchema: { lessonId: z.string() },
  },
  async ({ lessonId }) => {
    const state = await loadState();
    const found = findLesson(lessonId);
    if (!found) return textResult({ error: `Lesson "${lessonId}" not found.` });
    state.currentLessonId = lessonId;
    await saveState(state);
    return textResult({ ok: true, opened: lessonId, title: found.lesson.title });
  }
);

server.registerTool(
  'get_learning_context',
  {
    description:
      "Read-only. Call this before tutoring the learner. The returned tutorPolicy represents the learner's selected tutoring preference and should guide how much help, explanation, hinting, or solution content you provide. Returns exactly what the learner is currently doing in CodePath: active lesson, active learning step, activity type, live editor code, last run/submission context, progress, recent mistakes, and next step.",
  },
  async () => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    if (!found) {
      return textResult({ language: state.courseId, error: 'Current lesson not found.' });
    }
    const lesson = found.lesson;
    const steps = stepsForLesson(lesson);
    const active = resolveActiveStep(state, lesson);

    const completedLessons = javascriptCourse.lessons
      .filter((l) => state.completedLessons.includes(l.id))
      .map((l) => l.id);
    const coursePercent = javascriptCourse.lessons.length
      ? Math.round((completedLessons.length / javascriptCourse.lessons.length) * 100)
      : 0;
    const lessonDone = lesson.exercises.filter((ex) => state.completedExercises.includes(ex.id)).length;
    const lessonPercent = lesson.exercises.length
      ? Math.round((lessonDone / lesson.exercises.length) * 100)
      : 0;

    const completedSteps = steps.slice(0, active.index).map((s) => ({
      id: s.key,
      type: learningStepType(s, lesson),
      title: s.title,
      index: steps.indexOf(s),
    }));

    let nextStep: { id: string; type: string; title: string; index: number; locked: boolean } | null = null;
    const nextIndex = active.index + 1;
    const next = steps[nextIndex];
    if (next) {
      nextStep = {
        id: next.key,
        type: learningStepType(next, lesson),
        title: next.title,
        index: nextIndex,
        locked: isStepLocked(lesson, state.completedExercises, nextIndex),
      };
    }

    let studentCode: string | null = null;
    let studentCodeFor: string | null = null;
    if (active.stepId === 'tryit') {
      const live = liveCodeFor(state, lesson, 'tryit', lesson.tryIt.starterCode);
      studentCode = live.code;
      studentCodeFor = 'tryit';
    } else if (isExerciseLikeStep(active.type)) {
      const ex = lesson.exercises.find((e) => e.id === active.stepId);
      if (ex) {
        const live = liveCodeFor(state, lesson, ex.id, ex.starterCode);
        studentCode = live.code;
        studentCodeFor = ex.id;
      }
    }

    const latestAttempt = state.attempts[0] ?? null;
    const currentExercise =
      isExerciseLikeStep(active.type) && active.stepId !== 'tryit'
        ? (() => {
            const ex = lesson.exercises.find((e) => e.id === active.stepId);
            return ex
              ? {
                  active: true,
                  exerciseId: ex.id,
                  exercisesCompletedInLesson: lessonDone,
                  exercisesTotalInLesson: lesson.exercises.length,
                }
              : { active: false };
          })()
        : { active: false };

    return textResult({
      language: state.courseId,
      lesson: { id: lesson.id, title: lesson.title },
      currentStep: {
        id: active.stepId,
        type: active.type,
        title: active.title,
        index: active.index,
        unlocked: !isStepLocked(lesson, state.completedExercises, active.index),
      },
      currentActivity: state.currentActivity,
      editor: editorContext(state, lesson, active),
      studentCode,
      studentCodeFor,
      studentCodeDirty:
        typeof studentCode === 'string' && studentCodeFor
          ? (state.editorDrafts[editorIdFor(state.courseId, lesson.id, studentCodeFor)]?.dirty ?? false)
          : null,
      lastRun: state.lastRun
        ? {
            codeUsed: state.lastRun.codeUsed,
            success: state.lastRun.success,
            stdout: state.lastRun.stdout,
            runtimeError: state.lastRun.runtimeError,
            timestamp: state.lastRun.timestamp,
          }
        : null,
      lastSubmission: state.lastSubmission
        ? {
            exerciseId: state.lastSubmission.exerciseId,
            codeUsed: state.lastSubmission.codeUsed,
            passed: state.lastSubmission.passed,
            testsPassed: state.lastSubmission.testsPassed,
            testsTotal: state.lastSubmission.testsTotal,
            failedTests: state.lastSubmission.failedTests,
            feedback: state.lastSubmission.feedback,
            hintContext: state.lastSubmission.hintContext,
            stdout: state.lastSubmission.stdout,
            runtimeError: state.lastSubmission.runtimeError,
            timestamp: state.lastSubmission.timestamp,
          }
        : null,
      progress: { coursePercent, lessonPercent, completedLessons },
      completedSteps,
      nextStep,
      currentExercise,
      recentMistakes: state.recentMistakes.slice(0, 5).map((m) => ({ ...m })),
      latestSubmission: latestAttempt
        ? {
            exerciseId: latestAttempt.exerciseId,
            passed: latestAttempt.passed,
            timestamp: latestAttempt.timestamp,
          }
        : null,
      tutorMode: state.tutorMode,
      tutorPolicy: getTutorPolicy(state.tutorMode),
      quizResults: state.quizResults,
    });
  }
);

// ---- Transport -------------------------------------------------------------

async function main(): Promise<void> {
  await loadState();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CodePath MCP server running (stdio).');
  console.error(
    'Tools: get_course_progress, get_current_lesson, get_current_exercise, run_code, submit_solution, open_lesson, get_learning_context'
  );
}

main().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
