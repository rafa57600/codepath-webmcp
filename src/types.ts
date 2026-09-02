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
