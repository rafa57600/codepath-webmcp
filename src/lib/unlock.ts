// Progressive-unlock logic for the learner experience.
//
// This is PURE + DETERMINISTIC: it derives locked/unlocked state entirely from
// the EXISTING persisted progress (completedLessons, completedExercises). No new
// state architecture, no backend. Everything survives reload because it is
// recomputed from localStorage-backed Zustand state.
//
// Lesson-navigation locking is UI-guidance only: the WebMCP `open_lesson` tool
// calls the store directly and is NEVER affected by these helpers.

import type { Lesson, LearningStepType, ActiveStep } from '../types';

// ---------------------------------------------------------------------------
// Lesson-navigation unlocks (the lesson LIST)
// ---------------------------------------------------------------------------

/** A lesson is unlocked when it is the first, or the lesson before it is complete. */
export function isLessonLocked(
  lessonIds: string[],
  completedLessons: string[],
  lessonIndex: number
): boolean {
  if (lessonIndex <= 0) return false;
  return !completedLessons.includes(lessonIds[lessonIndex - 1]);
}

/** Whether the student may navigate to a lesson via the UI. NOT used by WebMCP open_lesson. */
export function canOpenLesson(
  lessonIds: string[],
  completedLessons: string[],
  lessonIndex: number
): boolean {
  return !isLessonLocked(lessonIds, completedLessons, lessonIndex);
}

/** Human hint for a locked lesson, e.g. "Complete Conditions to unlock." */
export function lessonUnlockHint(
  lessonTitles: string[],
  lessonIndex: number
): string | null {
  if (lessonIndex <= 0) return null;
  const prev = lessonTitles[lessonIndex - 1];
  if (!prev) return null;
  return `Complete ${prev} to unlock.`;
}

// ---------------------------------------------------------------------------
// In-lesson step progression
// ---------------------------------------------------------------------------

export type StepKind = 'explanation' | 'visual' | 'example' | 'tryit' | 'exercise' | 'quiz';

export interface LessonStep {
  kind: StepKind;
  key: string;
  title: string;
  /** For 'exercise' steps, the exercise index within the lesson (0-based). */
  exerciseIndex?: number;
  /** For 'exercise' steps, the Display index (1-based) shown to the learner. */
  exerciseNumber?: number;
}

/**
 * Build the ordered step sequence for a lesson (all 4 lessons use the same
 * shape regardless of how many exercises they contain):
 *   0 explanation, 1 visual, 2 example, 3 try-it, then N exercises, then quiz.
 */
export function stepsForLesson(lesson: Lesson): LessonStep[] {
  const steps: LessonStep[] = [
    { kind: 'explanation', key: 'explanation', title: 'Simple explanation' },
    { kind: 'visual', key: 'visual', title: 'Visual explanation' },
    { kind: 'example', key: 'example', title: 'Example' },
    { kind: 'tryit', key: 'tryit', title: 'Try it yourself' },
  ];
  lesson.exercises.forEach((ex, i) => {
    steps.push({
      kind: 'exercise',
      key: ex.id,
      title: ex.title,
      exerciseIndex: i,
      exerciseNumber: i + 1,
    });
  });
  steps.push({ kind: 'quiz', key: 'quiz', title: 'Mini quiz' });
  return steps;
}

/**
 * Index of the current (furthest unlocked / active) step.
 *
 * Reading steps (0..3) are ALWAYS readable. Hands-on progression is sequential
 * and deterministic: the m-th exercise is active after (m) exercises are done;
 * the quiz is active once every exercise is completed.
 */
export function activeStepIndex(lesson: Lesson, completedExercises: string[]): number {
  const steps = stepsForLesson(lesson);
  const total = lesson.exercises.length;
  const done = lesson.exercises.filter((ex) => completedExercises.includes(ex.id)).length;
  if (done >= total) return steps.length - 1; // quiz
  // reading steps occupy indexes 0..3; first exercise is step index 4.
  return 4 + done;
}

/** A step is locked if it lies beyond the current active step. */
export function isStepLocked(lesson: Lesson, completedExercises: string[], index: number): boolean {
  return index > activeStepIndex(lesson, completedExercises);
}

/** The active exercise (the one the learner should do next), if any. */
export function activeExerciseNumber(lesson: Lesson, completedExercises: string[]): number | null {
  const done = lesson.exercises.filter((ex) => completedExercises.includes(ex.id)).length;
  if (done >= lesson.exercises.length) return null;
  return done + 1;
}

/** Unlock hint for a locked step, e.g. "Complete Exercise 1 to unlock." */
export function stepUnlockHint(
  lesson: Lesson,
  completedExercises: string[],
  index: number
): string | null {
  const steps = stepsForLesson(lesson);
  if (index <= activeStepIndex(lesson, completedExercises)) return null;
  const prev = steps[index - 1];
  if (!prev) return null;
  if (prev.kind === 'exercise') {
    return `Complete ${prev.title} to unlock.`;
  }
  return 'Complete the current step to unlock.';
}

/** Convenience for the quiz card: whether the quiz is reachable yet. */
export function quizUnlocked(lesson: Lesson, completedExercises: string[]): boolean {
  const total = lesson.exercises.length;
  if (total === 0) return true;
  return lesson.exercises.every((ex) => completedExercises.includes(ex.id));
}

// ---------------------------------------------------------------------------
// Active learning cursor — the normalized step-type + title an agent sees.
//
// The UI's internal step kinds (unlock.ts StepKind) are normalized here to the
// agent-facing LearningStepType set:
//   explanation -> explanation
//   visual      -> visual
//   example     -> example
//   tryit       -> practice      (the "Try it yourself" playground)
//   exercise    -> exercise, except the lesson's LAST exercise, which the UI
//                  labels "Challenge" and is reported as type `challenge`.
//   quiz        -> quiz
// We never invent a step type the UI does not render.
// ---------------------------------------------------------------------------

/** Map a UI step to its agent-facing LearningStepType (lesson needed to detect the trailing Challenge). */
export function learningStepType(step: LessonStep, lesson: Lesson): LearningStepType {
  switch (step.kind) {
    case 'explanation':
      return 'explanation';
    case 'visual':
      return 'visual';
    case 'example':
      return 'example';
    case 'tryit':
      return 'practice';
    case 'exercise': {
      const isLast = step.exerciseIndex === lesson.exercises.length - 1;
      return isLast ? 'challenge' : 'exercise';
    }
    case 'quiz':
      return 'quiz';
    default:
      return 'explanation';
  }
}

/**
 * Build the ActiveStep cursor for a given step index in a lesson's step
 * sequence. `null` if the index is out of range.
 */
export function activeStepAt(
  lesson: Lesson,
  stepIndex: number
): ActiveStep | null {
  const steps = stepsForLesson(lesson);
  const step = steps[stepIndex];
  if (!step) return null;
  return {
    stepId: step.key,
    type: learningStepType(step, lesson),
    title: step.title,
    index: stepIndex,
  };
}

/** The default ActiveStep cursor = the furthest unlocked step for a lesson. */
export function defaultActiveStep(
  lesson: Lesson,
  completedExercises: string[]
): ActiveStep {
  const idx = activeStepIndex(lesson, completedExercises);
  return (
    activeStepAt(lesson, idx) ?? {
      stepId: 'explanation',
      type: 'explanation',
      title: 'Simple explanation',
      index: 0,
    }
  );
}

/**
 * Whether a current step is an "exercise-like" step the learner actively works
 * on in a code editor (exercise / challenge / practice), i.e. the cases where
 * `get_current_exercise` should report an active exercise.
 */
export function isExerciseLikeStep(type: LearningStepType): boolean {
  return type === 'exercise' || type === 'challenge' || type === 'practice';
}
