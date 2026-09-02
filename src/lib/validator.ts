import { runUserCode, extractDeclaredVariables } from './sandbox';
import type { Exercise, Lesson } from '../types';

export interface ValidationResult {
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  feedback: string;
  hintContext: string;
  stdout: string[];
  runtimeError: string | null;
  failedTests: Array<{ id: string; description: string }>;
}

/**
 * Runs a student's solution against deterministic tests.
 *
 * Student code is executed in the sandbox. Then each configured test predicate
 * (`run`) is evaluated with a scope containing:
 *   - outputs : array of console.log lines (strings)
 *   - vars    : the harvested declared-variable object
 *   - city, age, ... : harvested variables bound by their own names for ergonomic
 *                      predicates like `city === "Paris"`.
 *
 * Predicates come from lesson data (trusted), not from user code. We never
 * reveal the final solution through this function.
 */
export async function validateSolution(
  lesson: Lesson,
  exercise: Exercise,
  studentCode: string
): Promise<ValidationResult> {
  const declared = extractDeclaredVariables(studentCode);
  const run = await runUserCode(studentCode, { declared });

  const scope: Record<string, unknown> = {
    outputs: run.stdout,
    vars: run.variables,
  };
  for (const [k, v] of Object.entries(run.variables)) {
    scope[k] = v;
  }

  let testsPassed = 0;
  const failedTests: Array<{ id: string; description: string }> = [];

  for (const test of exercise.tests) {
    let ok = false;
    try {
      // Build a function whose parameters are the scope keys, so predicates can
      // reference `outputs`, `city`, etc. directly.
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        ...Object.keys(scope),
        `return (${test.run});`
      );
      ok = Boolean(fn(...Object.keys(scope).map((k) => scope[k])));
    } catch {
      ok = false;
    }
    if (ok) {
      testsPassed++;
    } else {
      failedTests.push({ id: test.id, description: test.description });
    }
  }

  const testsTotal = exercise.tests.length;
  const passed = testsPassed === testsTotal;

  let feedback: string;
  if (run.runtimeError) {
    feedback = `Your code hit an error: ${run.runtimeError}`;
  } else if (passed) {
    feedback = 'All tests passed. Well done!';
  } else {
    const failDesc = failedTests.map((f) => f.description).join('; ');
    feedback = failDesc
      ? `Your program is running, but ${failDesc.toLowerCase()}.`
      : 'Some tests failed. Run it again and check the output.';
  }

  const hintContext = passed
    ? ''
    : exercise.hint && exercise.hint.length > 0
      ? exercise.hint
      : failedTests[0]
        ? `Focus on: ${failedTests[0].description}`
        : 'Re-read the lesson and try again.';

  return {
    passed,
    testsPassed,
    testsTotal,
    feedback,
    hintContext,
    stdout: run.stdout,
    runtimeError: run.runtimeError,
    failedTests,
  };
}

export function expectedMatches(result: { stdout: string[] }, expected: string[]): boolean {
  if (result.stdout.length !== expected.length) return false;
  return result.stdout.every((line, i) => line.trim() === expected[i]);
}
