import { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import CodeEditor from './CodeEditor';
import { runUserCode } from '../lib/sandbox';
import { validateSolution, type ValidationResult } from '../lib/validator';
import type { Exercise, Lesson, LearningActivity } from '../types';

interface RunnerProps {
  lesson: Lesson;
  exercise?: Exercise;
  initialCode: string;
  onCodeChange: (code: string) => void;
  onSubmitResult?: (result: ValidationResult) => void;
  mode: 'tryit' | 'exercise';
  expectedOutput?: string[];
  /** Optional activity callback so the parent can keep the learning cursor in sync. */
  onActivity?: (activity: LearningActivity, stepId?: string) => void;
}

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; stdout: string[]; error: string | null };

export default function CodeRunner({
  lesson,
  exercise,
  initialCode,
  onCodeChange,
  onSubmitResult,
  mode,
  expectedOutput,
  onActivity,
}: RunnerProps) {
  const [code, setCode] = useState(initialCode);
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Notify the parent that the learner is engaging with this code editor.
  const reportActivity = (activity: LearningActivity) => {
    onActivity?.(activity, exercise?.id);
  };

  const handleCodeChange = (c: string) => {
    setCode(c);
    onCodeChange(c);
    reportActivity('editing_code');
    // Invalidate previous validation if code changes
    if (validation && validation.testsPassed < validation.testsTotal) {
      setValidation(null);
    }
  };

  const handleRun = async () => {
    setRunState({ status: 'running' });
    reportActivity('running_code');
    const result = await runUserCode(code);
    setRunState({ status: 'done', stdout: result.stdout, error: result.runtimeError });
    reportActivity('reviewing_feedback');
  };

  const handleReset = () => {
    setCode(initialCode);
    onCodeChange(initialCode);
    setRunState({ status: 'idle' });
    setValidation(null);
    setShowHint(false);
  };

  const handleSubmit = async () => {
    if (!exercise) return;
    setSubmitting(true);
    reportActivity('solving_exercise');
    try {
      const result = await validateSolution(lesson, exercise, code);
      setValidation(result);
      setSubmittedId(exercise.id);
      if (onSubmitResult) onSubmitResult(result);
      setRunState({ status: 'done', stdout: result.stdout, error: result.runtimeError });
      reportActivity('reviewing_feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const isComplete = validation?.passed ?? false;

  return (
    <div className="overflow-hidden rounded-2xl border border-kumo-hairline bg-white shadow-card">
      {/* Editor window header */}
      <div className="flex items-center justify-between gap-2 border-b border-kumo-hairline bg-kumo-tint/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-kumoDanger" />
            <span className="h-2.5 w-2.5 rounded-full bg-kumoWarning" />
            <span className="h-2.5 w-2.5 rounded-full bg-kumo-brand" />
          </span>
          <span className="ml-2 inline-flex items-center gap-1 font-mono text-xs text-kumo-text-subtle">
            script.js
          </span>
        </div>
        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-kumo-text-subtle ring-1 ring-kumo-hairline">
          {mode === 'exercise' ? 'Exercise' : 'Try it yourself'}
        </span>
      </div>

      <div className="p-4">
        <CodeEditor value={code} onChange={handleCodeChange} onFocus={() => reportActivity('editing_code')} />

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            onClick={handleRun}
            disabled={runState.status === 'running' || submitting}
            className="btn btn-success"
          >
            {runState.status === 'running' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            Run
          </button>
          <button onClick={handleReset} className="btn btn-secondary">
            <RotateCcw size={15} /> Reset
          </button>
          {exercise && (
            <button
              onClick={handleSubmit}
              disabled={submitting || runState.status === 'running'}
              className={`btn ${isComplete ? 'btn-success' : 'btn-primary'}`}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
              {isComplete ? '✓ Solved' : 'Submit'}
            </button>
          )}
          {exercise?.hint && !isComplete && (
            <button
              onClick={() => setShowHint((s) => !s)}
              className={`btn btn-secondary ${showHint ? '!border-kumoWarning !bg-kumoWarning-tint !text-kumoText-warning' : ''}`}
            >
              <HelpCircle size={15} /> Hint
            </button>
          )}
        </div>

        {/* Output box */}
        <div className="mt-4 rounded-xl border border-kumo-hairline bg-kumo-tint/60 p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-kumo-text-subtle">
            Output
          </div>
          <div className="overflow-x-auto font-mono text-sm">
            {runState.status === 'idle' ? (
              <p className="text-kumo-text-subtle">Press Run to see the result.</p>
            ) : runState.status === 'running' ? (
              <p className="animate-pulse text-kumo-text-subtle">Running…</p>
            ) : (
              <>
                {runState.stdout.length === 0 && !runState.error && (
                  <p className="text-kumo-text-subtle">(no output)</p>
                )}
                {runState.stdout.map((line, i) => (
                  <div key={i} className="text-kumo-text-strong">
                    {line}
                  </div>
                ))}
                {runState.error && <div className="text-kumoText-danger">Error: {runState.error}</div>}
                {mode === 'tryit' && expectedOutput && runState.stdout.length > 0 && (
                  <div className="mt-2 border-t border-kumo-hairline pt-2 text-xs text-kumo-text-subtle">
                    {expectedMatchesLocal(runState.stdout, expectedOutput)
                      ? '✓ Matches the expected output.'
                      : 'Expected output shown in the lesson.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showHint && exercise?.hint && (
          <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-kumoWarning bg-kumoWarning-tint p-3 text-sm text-kumoText-warning">
            <HelpCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <strong>Hint:</strong> {exercise.hint}
            </div>
          </div>
        )}

        {validation && (
          <div
            className={`mt-3.5 flex items-start gap-3 rounded-xl border p-3.5 text-sm ${
              validation.passed
                ? 'border-kumo-brand bg-kumoInfo-tint text-kumoText-info'
                : 'border-kumoDanger bg-kumoDanger-tint text-kumoText-danger'
            }`}
          >
            {validation.passed ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-kumo-brand" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-kumoDanger" />
            )}
            <div>
              <div className="font-semibold">
                {validation.passed
                  ? 'All tests passed!'
                  : `Not quite — ${validation.testsPassed}/${validation.testsTotal} tests passed`}
              </div>
              <p className="mt-1 text-kumo-text-default">{validation.feedback}</p>
              {!validation.passed && (
                <p className="mt-1.5 text-xs text-kumo-text-subtle">
                  Tutor hint: {validation.hintContext}
                </p>
              )}
            </div>
          </div>
        )}

        {submittedId && submittedId === exercise?.id && (
          <div className="mt-2 text-right">
            <button
              onClick={() => setValidation(null)}
              className="text-xs text-kumo-text-subtle hover:text-kumo-text-default"
            >
              Dismiss result
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function expectedMatchesLocal(stdout: string[], expected: string[]): boolean {
  if (stdout.length !== expected.length) return false;
  return stdout.every((l, i) => l.trim() === expected[i]);
}
