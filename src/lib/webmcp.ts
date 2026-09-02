// WebMCP tool implementations — the core of the app's agent integration.
//
// These handlers operate on a live "state provider" so the SAME logic can run
// in the browser (backed by the Zustand store) and in the Node MCP server
// (backed by the app's persisted JSON). We never fabricate results: every tool
// reads/writes real application state.

import { javascriptCourse } from '../data/javascript';
import type { Exercise, Lesson } from '../types';

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
}

export type StateProvider = {
  get: () => SessionState;
  setCurrentLesson: (lessonId: string) => void;
  setCourse: (courseId: string) => void;
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

// ---- Tool handlers ---------------------------------------------------------

export function getCourseProgress(state: SessionState): ToolResult {
  const lessons = javascriptCourse.lessons;
  const completedLessons = lessons
    .filter((l) => state.completedLessons.includes(l.id))
    .map((l) => l.id);
  const progressPercent = lessons.length
    ? Math.round((completedLessons.length / lessons.length) * 100)
    : 0;
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
  const found = findLesson(state.currentLessonId);
  if (!found) return text({ error: 'Current lesson not found.' });
  return text({
    id: found.lesson.id,
    title: found.lesson.title,
    learningObjective: found.lesson.objective,
    summary: found.lesson.summary,
    concepts: found.lesson.concepts,
  });
}

export function getCurrentExercise(state: SessionState, args?: { exerciseId?: string }): ToolResult {
  const found = findLesson(state.currentLessonId);
  if (!found) return text({ error: 'Lesson not found.' });
  let exercise: Exercise | undefined;
  if (args?.exerciseId) {
    exercise = found.lesson.exercises.find((e) => e.id === args.exerciseId);
  } else {
    // Prefer the first unfinished exercise.
    exercise =
      found.lesson.exercises.find(
        (e) => !state.completedExercises.includes(e.id) && !state.completedExercises.includes(e.id)
      ) ?? found.lesson.exercises[0];
  }
  if (!exercise) return text({ error: 'No exercise found in this lesson.' });
  return text({
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
  provider.setCurrentLesson(args.lessonId);
  return text({ ok: true, opened: args.lessonId, title: found.lesson.title });
}

export function getLearningContext(state: SessionState): ToolResult {
  const found = findLesson(state.currentLessonId);
  const completedLessons = state.completedLessons;
  const currentExercise = found ? getCurrentExercise(state) : undefined;
  return text({
    currentLesson: state.currentLessonId,
    currentLessonTitle: found?.lesson.title ?? '',
    completedTopics: completedLessons,
    recentMistakes: state.recentMistakes.slice(0, 5),
    currentStudentCode: found
      ? (() => {
          const ex = found.lesson.exercises.find((e) => !state.completedExercises.includes(e.id));
          return ex ? state.studentCode[ex.id] ?? ex.starterCode : null;
        })()
      : null,
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
        'Read-only. Return the current lesson content (objective, summary, concepts).',
      readOnly: true,
      schema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_current_exercise',
      description:
        'Read-only. Return the current exercise details and the student’s current code. Omit exerciseId to use the current exercise.',
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
        'Read-only. Return the learner’s full context: progress, mistakes, code, tutor mode.',
      readOnly: true,
      schema: { type: 'object', properties: {}, required: [] },
    },
  ];
}
