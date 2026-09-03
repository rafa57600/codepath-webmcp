// WebMCP tool implementations — the core of the app's agent integration.
//
// These handlers operate on a live "state provider" so the SAME logic can run
// in the browser (backed by the Zustand store) and in the Node MCP server
// (backed by the app's persisted JSON). We never fabricate results: every tool
// reads/writes real application state.

import { javascriptCourse } from '../data/javascript';
import type { Exercise, Lesson, ActiveStep, LearningActivity, LearningStepType } from '../types';
import {
  stepsForLesson,
  activeStepIndex,
  isStepLocked,
  activeStepAt,
  defaultActiveStep,
  isExerciseLikeStep,
  learningStepType,
} from './unlock';

export interface SessionState {
  courseId: string;
  currentLessonId: string;
  completedLessons: string[];
  completedExercises: string[];
  quizResults: Record<string, { correct: boolean; selectedId: string }>;
  attempts: Array<{ exerciseId: string; passed: boolean; timestamp: number }>;
  recentMistakes: Array<{ concept: string; exerciseId: string; timestamp: number }>;
  studentCode: Record<string, string>;
  tutorMode: 'guide' | 'balanced' | 'explain';
  activeStep: ActiveStep | null;
  currentActivity: LearningActivity | null;
  /** Which app screen the learner is on: landing ('welcome') or in the course. */
  currentScreen: 'welcome' | 'course';
}

export type StateProvider = {
  get: () => SessionState;
  setCurrentLesson: (lessonId: string) => void;
  setCourse: (courseId: string) => void;
  setScreen: (screen: 'welcome' | 'course') => void;
};

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  // For tool registry listing / debug panel.
}

function findLesson(lessonId: string): { lesson: Lesson; index: number; course: typeof javascriptCourse } | null {
  const idx = javascriptCourse.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) return null;
  return { lesson: javascriptCourse.lessons[idx], index: idx, course: javascriptCourse };
}

/**
 * Resolve the effective active step for the current lesson. Prefers the live
 * activeStep cursor when it points into the current lesson; otherwise falls back
 * to the furthest unlocked step derived from real progress. Never stale > the
 * learner's actual progress.
 */
function resolveActiveStep(state: SessionState, lesson: Lesson): ActiveStep {
  const steps = stepsForLesson(lesson);
  const furthestActive = activeStepIndex(lesson, state.completedExercises);
  const cursor = state.activeStep;
  const inLesson =
    cursor &&
    cursor.index >= 0 &&
    cursor.index < steps.length &&
    steps[cursor.index].key === cursor.stepId;
  // Don't let the cursor point at a step that has become unreachable (locked) —
  // e.g. after a reset the cursor may still reference a now-locked exercise.
  const cursorReachable = inLesson && !isStepLocked(lesson, state.completedExercises, cursor!.index);
  const choice = cursorReachable ? cursor! : activeStepAt(lesson, furthestActive);
  return choice ?? defaultActiveStep(lesson, state.completedExercises);
}

// ---- Tool handlers ---------------------------------------------------------

export function getCourseProgress(state: SessionState): ToolResult {
  const lessons = javascriptCourse.lessons;
  const completedLessons = lessons
    .filter((l) => state.completedLessons.includes(l.id))
    .map((l) => l.id);
  const progressPercent = lessons.length
    ? Math.round((completedLessons.length / lessons.length) * 100)
    : 0;
  // If the learner is on the welcome screen, still expose real persisted
  // progress but clearly indicate they are not inside a lesson right now.
  if (state.currentScreen === 'welcome') {
    const payload = {
      screen: 'welcome',
      language: state.courseId,
      // Brand-new learners have no active lesson until they enter one.
      currentLesson:
        state.completedLessons.length || state.completedExercises.length
          ? state.currentLessonId
          : null,
      progressPercent,
      completedLessons,
      completedExercises: state.completedExercises,
      currentLessonTitle:
        javascriptCourse.lessons.find((l) => l.id === state.currentLessonId)?.title ?? '',
    };
    return text(payload);
  }
  const payload = {
    language: state.courseId,
    currentLesson: state.currentLessonId,
    progressPercent,
    completedLessons,
    completedExercises: state.completedExercises,
    currentLessonTitle:
      javascriptCourse.lessons.find((l) => l.id === state.currentLessonId)?.title ?? '',
  };
  return text(payload);
}

export function getCurrentLesson(state: SessionState): ToolResult {
  // On the welcome/landing screen there is no active lesson — be truthful.
  if (state.currentScreen === 'welcome') {
    return text({
      active: false,
      screen: 'welcome',
      reason: 'The learner has not entered a course lesson yet.',
    });
  }
  const found = findLesson(state.currentLessonId);
  if (!found) return text({ error: 'Current lesson not found.' });
  const active = resolveActiveStep(state, found.lesson);
  return text({
    id: found.lesson.id,
    title: found.lesson.title,
    learningObjective: found.lesson.objective,
    summary: found.lesson.summary,
    concepts: found.lesson.concepts,
    // New: the active learning step + what the learner is doing right now.
    activeStep: {
      id: active.stepId,
      type: active.type,
      title: active.title,
      index: active.index,
    },
    currentActivity: state.currentActivity,
  });
}

export function getCurrentExercise(state: SessionState, args?: { exerciseId?: string }): ToolResult {
  // On the welcome screen the learner is not working on any exercise. Returning
  // `active:false` is the honest answer; an explicitly-requested exerciseId may
  // still be fetched (the agent asked for it by name), but we never silently
  // default to "the first exercise".
  if (state.currentScreen === 'welcome') {
    if (args?.exerciseId) {
      const found = findLesson(state.currentLessonId);
      const exercise = found?.lesson.exercises.find((e) => e.id === args.exerciseId);
      if (found && exercise) {
        return text({
          active: true,
          exerciseId: exercise.id,
          lesson: found.lesson.id,
          lessonTitle: found.lesson.title,
          instructions: exercise.instructions,
          starterCode: exercise.starterCode,
          studentCode: state.studentCode[exercise.id] ?? exercise.starterCode,
          difficulty: exercise.difficulty,
          hint: exercise.hint ?? null,
        });
      }
      return text({ error: `Exercise "${args.exerciseId}" not found.` });
    }
    return text({
      active: false,
      screen: 'welcome',
      reason: 'The learner is not currently working on an exercise.',
    });
  }
  const found = findLesson(state.currentLessonId);
  if (!found) return text({ error: 'Lesson not found.' });

  // "current exercise" is the ONE tied to the active step the learner is working
  // on. We must NOT pretend an exercise is active when the learner is on an
  // explanation / visual / example step.
  const active = resolveActiveStep(state, found.lesson);

  // Explicit exerciseId overrides: an agent may still request a specific exercise.
  if (args?.exerciseId) {
    const exercise = found.lesson.exercises.find((e) => e.id === args.exerciseId);
    if (!exercise) return text({ error: `Exercise "${args.exerciseId}" not found in this lesson.` });
    return text({
      active: true,
      exerciseId: exercise.id,
      lesson: found.lesson.id,
      lessonTitle: found.lesson.title,
      instructions: exercise.instructions,
      starterCode: exercise.starterCode,
      studentCode: state.studentCode[exercise.id] ?? exercise.starterCode,
      difficulty: exercise.difficulty,
      hint: exercise.hint ?? null,
    });
  }

  // The learner is genuinely on an exercise-like step (exercise / challenge /
  // practice) → return that exercise normally.
  if (isExerciseLikeStep(active.type)) {
    const exercise =
      active.stepId === 'tryit'
        ? undefined // the "Try it yourself" playground has no Exercise record
        : found.lesson.exercises.find((e) => e.id === active.stepId) ??
          found.lesson.exercises.find((e) => !state.completedExercises.includes(e.id)) ??
          found.lesson.exercises[0];
    // Practice (Try it yourself) has no tests — report it truthfully as practice.
    if (active.type === 'practice' || !exercise) {
      return text({
        active: true,
        currentStepType: active.type,
        currentStepTitle: active.title,
        reason:
          active.type === 'practice'
            ? "The learner is on the 'Try it yourself' playground step (no tests to submit)."
            : 'No exercise exists for the current step.',
        exerciseId: null,
      });
    }
    return text({
      active: true,
      exerciseId: exercise.id,
      lesson: found.lesson.id,
      lessonTitle: found.lesson.title,
      instructions: exercise.instructions,
      starterCode: exercise.starterCode,
      studentCode: state.studentCode[exercise.id] ?? exercise.starterCode,
      difficulty: exercise.difficulty,
      hint: exercise.hint ?? null,
    });
  }

  // The learner is NOT on an exercise-like step. Report the structured truth.
  return text({
    active: false,
    currentStepType: active.type,
    currentStepTitle: active.title,
    reason: `The learner is currently on a ${active.type} step ("${active.title}"), not an exercise.`,
  });
}

export function runCode(state: SessionState, args?: { code?: string; exerciseId?: string }): ToolResult {
  // In the browser this runs in the real sandbox (see browser client). The
  // server implementation runs in its own vm sandbox. The handler payload is
  // structured identically.
  const code =
    args?.code ??
    (args?.exerciseId ? state.studentCode[args.exerciseId] : undefined) ??
    javascriptCourse.lessons.find((l) => l.id === state.currentLessonId)?.tryIt.starterCode ??
    '';
  return text({
    exerciseId: args?.exerciseId ?? null,
    action: 'executed',
    // success/stdout/runtimeError are filled in by the concrete runner.
    _pending: true,
    _code: code,
  });
}

export function submitSolution(
  state: SessionState,
  args: { exerciseId: string; lessonId?: string }
): ToolResult {
  const lessonId = args.lessonId ?? state.currentLessonId;
  const found = findLesson(lessonId);
  if (!found) return text({ error: 'Lesson not found.' });
  const exercise = found.lesson.exercises.find((e) => e.id === args.exerciseId);
  if (!exercise) return text({ error: 'Exercise not found.' });
  const code = state.studentCode[args.exerciseId] ?? exercise.starterCode;
  // The concrete runner fills in passed/testsPassed/testsTotal. This shape matches
  // the contract WebMCP agents expect.
  return text({
    exerciseId: args.exerciseId,
    lesson: lessonId,
    _pending: true,
    _code: code,
    studentCode: code,
    passed: false,
    testsPassed: 0,
    testsTotal: exercise.tests.length,
    feedback: 'Awaiting sandbox evaluation…',
  });
}

export function openLesson(provider: StateProvider, args: { lessonId: string }): ToolResult {
  const found = findLesson(args.lessonId);
  if (!found) return text({ error: `Lesson "${args.lessonId}" not found.` });
  // Entering a lesson means entering the course screen. If the learner is on the
  // welcome page, flip to the course so the lesson opens visibly. Safe to call
  // unconditionally (idempotent when already in the course; the Node MCP server
  // simply records the field with no UI to navigate).
  provider.setScreen('course');
  provider.setCurrentLesson(args.lessonId);
  return text({ ok: true, opened: args.lessonId, title: found.lesson.title });
}

export function getLearningContext(state: SessionState): ToolResult {
  // Welcome / landing screen: report truthful "choosing a course" context rather
  // than pretending the learner is studying the first lesson.
  if (state.currentScreen === 'welcome') {
    const coursePercent = state.completedLessons.length
      ? Math.round(
          (javascriptCourse.lessons.filter((l) => state.completedLessons.includes(l.id)).length /
            javascriptCourse.lessons.length) *
            100
        )
      : 0;
    return text({
      screen: 'welcome',
      language: null,
      lesson: null,
      currentStep: null,
      currentActivity: 'choosing_course',
      availableCourses: [
        {
          id: 'javascript',
          title: 'JavaScript',
          available: true,
        },
      ],
      progress: {
        coursePercent,
        completedLessons: javascriptCourse.lessons
          .filter((l) => state.completedLessons.includes(l.id))
          .map((l) => l.id),
      },
      tutorMode: state.tutorMode,
    });
  }
  const found = findLesson(state.currentLessonId);
  if (!found) {
    return text({
      language: state.courseId,
      error: 'Current lesson not found.',
    });
  }
  const lesson = found.lesson;
  const steps = stepsForLesson(lesson);
  const active = resolveActiveStep(state, lesson);

  // ---- progress ------------------------------------------------------------
  const completedLessons = javascriptCourse.lessons
    .filter((l) => state.completedLessons.includes(l.id))
    .map((l) => l.id);
  const coursePercent = javascriptCourse.lessons.length
    ? Math.round((completedLessons.length / javascriptCourse.lessons.length) * 100)
    : 0;
  const lessonDoneExercises = lesson.exercises.filter((ex) =>
    state.completedExercises.includes(ex.id)
  ).length;
  const lessonPercent = lesson.exercises.length
    ? Math.round((lessonDoneExercises / lesson.exercises.length) * 100)
    : 0;

  // ---- completed steps (steps the learner has passed to reach the active step) ----
  const completedSteps = steps
    .slice(0, active.index)
    .map((s) => ({
      id: s.key,
      type: learningStepType(s, lesson),
      title: s.title,
      index: steps.indexOf(s),
    }));

  // ---- next / locked step --------------------------------------------------
  let nextStep: Record<string, unknown> | null = null;
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

  // ---- student code (code from the active step when it is code-oriented) ----
  let studentCode: string | null = null;
  let studentCodeFor: string | null = null;
  if (active.stepId === 'tryit') {
    studentCode = lesson.tryIt.starterCode;
    studentCodeFor = 'tryit';
  } else if (isExerciseLikeStep(active.type)) {
    const ex = lesson.exercises.find((e) => e.id === active.stepId);
    if (ex) {
      studentCode = state.studentCode[ex.id] ?? ex.starterCode;
      studentCodeFor = ex.id;
    }
  }

  // ---- latest execution / submission context --------------------------------
  const latestAttempt = state.attempts[0] ?? null;
  const lastSubmissionContext: Record<string, unknown> | null = latestAttempt
    ? {
        exerciseId: latestAttempt.exerciseId,
        passed: latestAttempt.passed,
        timestamp: latestAttempt.timestamp,
      }
    : null;

  return text({
    language: state.courseId,

    lesson: {
      id: lesson.id,
      title: lesson.title,
    },

    currentStep: {
      id: active.stepId,
      type: active.type,
      title: active.title,
      index: active.index,
      unlocked: !isStepLocked(lesson, state.completedExercises, active.index),
    },

    currentActivity: state.currentActivity,

    studentCode,
    studentCodeFor,

    progress: {
      coursePercent,
      lessonPercent,
      completedLessons,
    },

    completedSteps,

    nextStep,

    currentExercise: (() => {
      // Truthful: whether the learner is actively on an exercise-like step.
      if (isExerciseLikeStep(active.type) && active.stepId !== 'tryit') {
        const ex = lesson.exercises.find((e) => e.id === active.stepId);
        if (ex) {
          return {
            active: true,
            exerciseId: ex.id,
            exercisesCompletedInLesson: lessonDoneExercises,
            exercisesTotalInLesson: lesson.exercises.length,
          };
        }
      }
      return { active: false };
    })(),

    recentMistakes: state.recentMistakes.slice(0, 5).map((m) => ({ ...m })),

    latestSubmission: lastSubmissionContext,

    tutorMode: state.tutorMode,
    quizResults: state.quizResults,
  });
}

// ---- helpers ---------------------------------------------------------------

function text(obj: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
  };
}

export interface WebmcpToolMeta {
  name: string;
  description: string;
  /** Read-only tools never mutate state. State/action tools may update it. */
  readOnly: boolean;
  schema: WebmcpJsonSchema;
}

export interface WebmcpJsonSchema {
  type: 'object';
  properties: Record<
    string,
    { type: string; enum?: string[]; description?: string }
  >;
  required: string[];
}

// The JavaScript course lesson ids — used for open_lesson's enum.
const LESSON_IDS = ['introduction', 'variables', 'conditions', 'loops'];

export function toolMetadata(): WebmcpToolMeta[] {
  return [
    {
      name: 'get_course_progress',
      description:
        'Read-only. Return where the learner currently is (language, lesson, percent, completions).',
      readOnly: true,
      schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_current_lesson',
      description:
        'Read-only. Return the current lesson content (objective, summary, concepts) plus the active learning step the learner is on and what they are currently doing.',
      readOnly: true,
      schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_current_exercise',
      description:
        'Read-only. Return the exercise the learner is actively working on, OR structured truth (active:false + current step type/title) when the learner is NOT on an exercise/practice step. Omit exerciseId to use the current exercise; an explicit exerciseId always requests that exercise.',
      readOnly: true,
      schema: {
        type: 'object',
        properties: { exerciseId: { type: 'string', description: 'Optional exercise id; defaults to the current exercise.' } },
        required: [],
      },
    },
    {
      name: 'run_code',
      description:
        'State/action. Run the student’s current code in a sandbox and return output. Omit code/exerciseId to run the current exercise starter code.',
      readOnly: false,
      schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Optional source code to run; defaults to the current exercise code/starter.' },
          exerciseId: { type: 'string', description: 'Optional exercise id whose saved code should run; defaults to current.' },
        },
        required: [],
      },
    },
    {
      name: 'submit_solution',
      description:
        'State/action. Validate the current exercise against deterministic tests and record the attempt. Omit exerciseId/lessonId to use the current exercise.',
      readOnly: false,
      schema: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string', description: 'Optional exercise id to validate; defaults to the current exercise.' },
          lessonId: { type: 'string', description: 'Optional lesson id containing the exercise; defaults to the current lesson.' },
        },
        required: [],
      },
    },
    {
      name: 'open_lesson',
      description:
        'State/action. Navigate the learning UI to a specific lesson.',
      readOnly: false,
      schema: {
        type: 'object',
        properties: {
          lessonId: {
            type: 'string',
            enum: LESSON_IDS,
            description: 'The lesson to open in the JavaScript course.',
          },
        },
        required: ['lessonId'],
      },
    },
    {
      name: 'get_learning_context',
      description:
        "Read-only. Return exactly what the learner is currently doing in CodePath: active lesson, active learning step, activity type, code when relevant, progress, recent mistakes, and next step. Use this before tutoring or explaining what the learner is working on.",
      readOnly: true,
      schema: { type: 'object', properties: {}, required: [] },
    },
  ];
}
