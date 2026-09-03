// Core types for the course structure.
// These types keep lesson data separate from UI components so that
// future languages and lessons reuse the same rendering system.

export type VisualType =
  | 'interaction'
  | 'variable-box'
  | 'condition-tree'
  | 'loop-flow';

export interface CodeExample {
  title?: string;
  code: string;
  explanation?: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface Quiz {
  question: string;
  options: QuizOption[];
  correctId: string;
  explanation: string;
}

export interface TestStep {
  id: string;
  description: string;
  // A predicate function (string) that receives parsed outputs and returns boolean.
  run: string;
}

export interface Exercise {
  id: string;
  title: string;
  instructions: string;
  starterCode: string;
  difficulty: 'beginner' | 'intermediate';
  // Deterministic tests. `run` is evaluated in the sandbox with the user's
  // stdout + captured console.log lines available.
  tests: TestStep[];
  hint?: string;
}

export interface Lesson {
  id: string;
  title: string;
  objective: string;
  summary: string;
  simpleExplanation: string[];
  concepts: string[];
  visualType: VisualType;
  examples: CodeExample[];
  tryIt: {
    title: string;
    starterCode: string;
    expectedOutput: string[];
    hint?: string;
  };
  exercises: Exercise[];
  quiz: Quiz;
}

export interface Course {
  id: string;
  title: string;
  status: 'available' | 'coming-soon';
  color: string;
  lessons: Lesson[];
}

export interface ExerciseResult {
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  feedback: string;
  hintContext: string;
}

export interface QuizResult {
  correct: boolean;
  selectedId: string;
}

// ---------------------------------------------------------------------------
// Active learning cursor — tells the AI tutor exactly which step the learner is
// currently on and what kind of step it is. These types correspond 1:1 to the
// step kinds the UI actually renders (see src/lib/unlock.ts). We never invent a
// step type the UI does not produce.
// ---------------------------------------------------------------------------

/** The kinds of learning steps the UI renders (normalized for the agent). */
export type LearningStepType =
  | 'explanation'
  | 'visual'
  | 'example'
  | 'practice' // the "Try it yourself" playground
  | 'exercise'
  | 'challenge' // final exercise of a lesson, labelled "Challenge" in the UI
  | 'quiz';

/** What the learner is doing RIGHT NOW (lightweight, not analytics). */
export type LearningActivity =
  | 'reading'
  | 'viewing_visual'
  | 'viewing_example'
  | 'editing_code'
  | 'running_code'
  | 'solving_exercise'
  | 'reviewing_feedback'
  | 'answering_quiz';

/** The persisted active-step cursor for the current lesson. */
export interface ActiveStep {
  /** Stable step key within the lesson ('explanation' | 'visual' | 'example' | 'tryit' | <exerciseId> | 'quiz'). */
  stepId: string;
  type: LearningStepType;
  title: string;
  /** 0-based index in the lesson step sequence. */
  index: number;
}

// ---------------------------------------------------------------------------
// Live editor state — the authoritative draft the learner is editing RIGHT NOW.
// ---------------------------------------------------------------------------

/** What kind of editor this is (maps to the step kind). */
export type EditorKind = 'tryit' | 'exercise' | 'challenge';

/** One editor's live draft, keyed by a stable composite ID. */
export interface EditorDraft {
  code: string;
  /** The lesson this editor belongs to. */
  lessonId: string;
  /** The step/exercise within the lesson (e.g. 'tryit', 'introduction-1'). */
  stepId: string;
  /** The exercise ID (null for tryit). */
  exerciseId: string | null;
  /** The original starter code this editor was seeded with. */
  starterCode: string;
  /** Whether this draft is dirty (learner has edited beyond the starter code). */
  dirty: boolean;
  /** Epoch ms when the learner last typed. */
  lastEditedAt: number;
}

/** Structured result of the most recent code execution. */
export interface LastRun {
  /** The exact code that was executed. */
  codeUsed: string;
  /** Whether the execution succeeded (no runtime error). */
  success: boolean;
  /** Console.log output lines. */
  stdout: string[];
  /** Runtime/syntax error message, or null. */
  runtimeError: string | null;
  /** Epoch ms of the run. */
  timestamp: number;
}

/** Structured result of the most recent submission. */
export interface LastSubmission {
  /** The exercise that was submitted. */
  exerciseId: string;
  /** The exact code that was validated. */
  codeUsed: string;
  /** Whether all tests passed. */
  passed: boolean;
  /** Number of tests that passed. */
  testsPassed: number;
  /** Total number of tests. */
  testsTotal: number;
  /** Descriptions of failed tests. */
  failedTests: Array<{ id: string; description: string }>;
  /** Feedback message. */
  feedback: string;
  /** Hint context (static hint). */
  hintContext: string;
  /** Console.log output from execution. */
  stdout: string[];
  /** Runtime error, if any. */
  runtimeError: string | null;
  /** Epoch ms of the submission. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Tutor policy — derived from the selected tutorMode. This is the authoritative
// instruction set a WebMCP agent must follow when tutoring the learner.
// Never stored independently; always computed from tutorMode.
// ---------------------------------------------------------------------------

/** The shape of the policy object returned by getTutorPolicy(). */
export interface TutorPolicy {
  mode: string;
  goal: string;
  /** Absolute rule: never give the full corrected solution unless mode allows it. */
  mustNotRevealFinalSolution: boolean;
  /** May the agent provide the complete corrected code without being asked? */
  revealCompleteSolutionByDefault: boolean;
  /** May the agent show small code snippets (e.g. pointing to a line)? */
  smallCodeSnippetsAllowed: boolean;
  /** One-paragraph response strategy the agent must follow. */
  responseStrategy: string;
  /** Step-by-step instructions for the agent. */
  instructions: string[];
}
