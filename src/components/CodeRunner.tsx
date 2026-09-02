import { useState } from 'react';
import { Play, RotateCcw, CheckCircle2, XCircle, Loader2, HelpCircle } from 'lucide-react';
import CodeEditor from './CodeEditor';
import { runUserCode } from '../lib/sandbox';
import { validateSolution, type ValidationResult } from '../lib/validator';
import type { Exercise, Lesson } from '../types';

interface RunnerProps {
  lesson: Lesson;
  exercise?: Exercise;
  initialCode: string;
  onCodeChange: (code: string) => void;
  onSubmitResult?: (result: ValidationResult) => void;
  mode: 'tryit' | 'exercise';
  expectedOutput?: string[];
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
}: RunnerProps) {
  const [code, setCode] = useState(initialCode);
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const handleCodeChange = (c: string) => {
    setCode(c);
    onCodeChange(c);
    // Invalidate previous validation if code changes
    if (validation && validation.testsPassed < validation.testsTotal) {
      setValidation(null);
    }
  };

  const handleRun = async () => {
    setRunState({ status: 'running' });
    const result = await runUserCode(code);
    setRunState({ status: 'done', stdout: result.stdout, error: result.runtimeError });
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
    try {
      const result = await validateSolution(lesson, exercise, code);
      setValidation(result);
      setSubmittedId(exercise.id);
      if (onSubmitResult) onSubmitResult(result);
      setRunState({ status: 'done', stdout: result.stdout, error: result.runtimeError });
    } finally {
      setSubmitting(false);
    }
  };

  const isComplete = validation?.passed ?? false;

  const buttonBase =
    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50';

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
      <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/50 px-3 py-2">
        <span className="flex h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-xs font-mono text-slate-400">script.js</span>
      </div>

      <div className="p-3">
        <CodeEditor value={code} onChange={handleCodeChange} />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleRun}
            disabled={runState.status === 'running' || submitting}
            className={`${buttonBase} bg-emerald-500 text-slate-900 hover:bg-emerald-400`}
          >
            {runState.status === 'running' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run
          </button>
          <button
            onClick={handleReset}
            className={`${buttonBase} bg-white/5 text-slate-300 hover:bg-white/10`}
          >
            <RotateCcw size={14} /> Reset
          </button>
          {exercise && (
            <button
              onClick={handleSubmit}
              disabled={submitting || runState.status === 'running'}
              className={`${buttonBase} ${
                isComplete
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400'
              }`}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {isComplete ? '✓ Solved' : 'Submit'}
            </button>
          )}
          {exercise?.hint && !isComplete && (
            <button
              onClick={() => setShowHint((s) => !s)}
              className={`${buttonBase} bg-white/5 text-slate-300 hover:bg-white/10`}
            >
              <HelpCircle size={14} /> Hint
            </button>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-slate-950 p-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            Output
          </div>
          <div className="overflow-x-auto font-mono text-sm">
            {runState.status === 'idle' ? (
              <p className="text-slate-600">Press Run to see the result.</p>
            ) : runState.status === 'running' ? (
              <p className="text-slate-400 animate-pulse">Running…</p>
            ) : (
              <>
                {runState.stdout.length === 0 && !runState.error && (
                  <p className="text-slate-400">(no output)</p>
                )}
                {runState.stdout.map((line, i) => (
                  <div key={i} className="text-slate-200">
                    {line}
                  </div>
                ))}
                {runState.error && (
                  <div className="text-rose-400">Error: {runState.error}</div>
                )}
                {mode === 'tryit' && expectedOutput && runState.stdout.length > 0 && (
                  <div className="mt-2 border-t border-white/10 pt-2 text-xs text-slate-500">
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
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            <strong>Hint:</strong> {exercise.hint}
          </div>
        )}

        {validation && (
          <div
            className={`mt-3 rounded-lg border p-3 text-sm ${
              validation.passed
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-rose-400/40 bg-rose-400/10 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {validation.passed ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <XCircle size={16} className="text-rose-400" />
              )}
              {validation.passed
                ? 'All tests passed!'
                : `Not quite — ${validation.testsPassed}/${validation.testsTotal} tests passed`}
            </div>
            <p className="mt-1 text-slate-300">{validation.feedback}</p>
            {!validation.passed && (
              <p className="mt-2 text-xs text-slate-400">
                Tutor hint: {validation.hintContext}
              </p>
            )}
          </div>
        )}

        {submittedId && submittedId === exercise?.id && (
          <div className="mt-2 text-right">
            <button
              onClick={() => setValidation(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
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
