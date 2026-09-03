import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import type { VisualType } from '../types';

// ---------- Lesson 1: Interaction ----------
function InteractionVisual() {
  const [message, setMessage] = useState('Nothing happened yet.');
  const [animationStep, setAnimationStep] = useState(0);
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setAnimationStep(1); // user clicks
    setTimeout(() => {
      setAnimationStep(2); // JS runs
    }, 500);
    setTimeout(() => {
      setMessage('Hello from JavaScript!');
      setAnimationStep(3); // page changes
    }, 1000);
  };

  const reset = () => {
    setClicked(false);
    setAnimationStep(0);
    setMessage('Nothing happened yet.');
  };

  const arrow = (from: number, to: number) =>
    animationStep >= to ? (
      <div className="step-arrow show">
        <span className="arrow-line" />
        <span className="arrow-head">↓</span>
      </div>
    ) : (
      <div className="step-arrow">
        <span className="arrow-line dim" />
        <span className="arrow-head dim">↓</span>
      </div>
    );

  return (
    <div className="card p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleClick}
            className={`rounded-xl px-6 py-3 text-lg font-semibold transition-all ${
              animationStep === 1
                ? 'animate-ping-once scale-105 bg-kumo-brand text-white'
                : 'bg-kumo-brand text-white hover:bg-kumo-brand-hover'
            }`}
          >
            Click me
          </button>
          <div className="w-full max-w-xs rounded-xl border border-kumo-hairline bg-kumo-tint p-4 text-center shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-kumo-text-subtle">Message</div>
            <div
              className={`mt-1 text-sm font-semibold ${
                message !== 'Nothing happened yet.' ? 'text-kumoText-info' : 'text-kumo-text-default'
              }`}
            >
              {message}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 pl-2">
          <div className={`chip ${animationStep >= 1 ? 'chip-active' : ''}`}>User clicks</div>
          {arrow(1, 2)}
          <div className={`chip ${animationStep >= 2 ? 'chip-active' : ''}`}>JavaScript runs</div>
          {arrow(2, 3)}
          <div className={`chip ${animationStep >= 3 ? 'chip-active' : ''}`}>Website changes</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-kumo-hairline pt-3">
        <p className="text-sm text-kumo-text-subtle">
          JavaScript = making the page react to what happens.
        </p>
        {clicked && (
          <button
            onClick={reset}
            className="btn btn-secondary btn-sm"
          >
            <RotateCcw size={12} /> Reset demo
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Lesson 2: Variable box ----------
function VariableBoxVisual() {
  const step = useAutoSteps(4);
  const value = step >= 3 ? 'Sara' : 'Adam';

  return (
    <div className="card p-6">
      <div className="flex flex-col items-center gap-4">
        {/* The box */}
        <div className="flex flex-col items-center">
          <div className={`box-wrap transition-all ${step >= 1 ? 'box-filled' : ''}`}>
            <div className="box-label">name</div>
            <div className="box-value">{step >= 1 ? `"${value}"` : ''}</div>
          </div>
        </div>

        {/* Code reveal */}
        {step >= 2 && (
          <pre
            className={`visual-code transition-opacity duration-500 ${
              step >= 2 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <code>{step >= 3 ? 'name = "Sara";' : 'let name = "Adam";'}</code>
          </pre>
        )}

        {/* Value change arrow */}
        {step === 3 && (
          <div className="flex items-center gap-3 text-sm">
            <span className="visual-tag">"Adam"</span>
            <span className="text-kumo-brand">↓</span>
            <span className="visual-tag highlight">"Sara"</span>
          </div>
        )}

        <p
          className={`text-sm text-center ${step >= 4 ? 'font-medium text-kumoText-info' : 'text-kumo-text-subtle'}`}
        >
          {step >= 4
            ? 'The value inside the box changed — that is a variable.'
            : 'Watch the box fill as a variable is created.'}
        </p>
      </div>
      <StepDots total={4} current={step} />
    </div>
  );
}

// ---------- Lesson 3: Condition tree ----------
function ConditionTreeVisual() {
  const step = useAutoSteps(6, 900);
  const age = 20;
  const isAdult = age >= 18;
  // Define evaluation phases (0..5) with step 4 = decision, 5 = outcome.
  const showDecision = step >= 4;
  const showOutcome = step >= 5;

  return (
    <div className="card p-6">
      <div className="mb-4 text-center">
        <span className="visual-tag">
          age = {age} &nbsp;&nbsp; age &gt;= 18 ?
        </span>
      </div>

      <div className="flex flex-col items-center gap-1 text-sm">
        <div className="visual-tag"> {age} &gt;= 18 ? </div>
        <div className={`h-6 w-px ${showDecision ? 'tree-active' : 'bg-kumo-fill'}`} />

        <div className="flex items-start gap-6">
          {/* YES branch */}
          <div className="flex flex-col items-center">
            {showDecision && <span className="text-xs font-bold text-kumo-brand">YES</span>}
            <div
              className={`branch-connector ${showDecision ? 'tree-active' : 'bg-kumo-fill'}`}
            />
            <div
              className={`rounded-xl px-4 py-2 transition-all ${
                showOutcome && isAdult
                  ? 'outcome-active bg-kumo-brand text-white'
                  : 'visual-tag'
              }`}
            >
              Adult
            </div>
          </div>

          {/* NO branch */}
          <div className="flex flex-col items-center">
            {showDecision && <span className="text-xs font-bold text-kumo-text-subtle">NO</span>}
            <div
              className={`branch-connector ${showDecision ? 'tree-active' : 'bg-kumo-fill'}`}
            />
            <div
              className={`rounded-xl px-4 py-2 transition-all ${
                showOutcome && !isAdult ? 'outcome-active bg-kumoDanger text-white' : 'visual-tag'
              }`}
            >
              Minor
            </div>
          </div>
        </div>
      </div>

      {showOutcome && (
        <pre className="visual-code mt-4 animate-fade-in text-left text-xs">
          <code>
            {'let age = 20;\nif (age >= 18) {\n  console.log("Adult");\n} else {\n  console.log("Minor");\n}'}
          </code>
        </pre>
      )}

      <StepDots total={6} current={step} />
    </div>
  );
}

// ---------- Lesson 4: Loop flow ----------
function LoopFlowVisual() {
  const [step, setStep] = useState(0);
  const totalRounds = 5;
  const maxStep = totalRounds * 3 + 1; // for each round: i init/check, print, then final check
  const printed: number[] = [];
  let i = 1;
  let cur = step;
  let stopped = false;
  while (cur >= 3 && i <= totalRounds) {
    printed.push(i);
    i++;
    cur -= 3;
    if (cur < 3 && i <= totalRounds) {
      // Entering a new iteration's condition check
    }
  }
  // Determine the last executed condition result.
  let lastCheck: { i: number; passed: boolean; printing?: boolean } | null = null;
  if (step >= 1) {
    if (step >= totalRounds * 3 + 1) {
      lastCheck = { i: totalRounds + 1, passed: false };
    } else {
      const roundIdx = Math.floor(step / 3);
      const within = step % 3;
      lastCheck = { i: roundIdx + 1, passed: true, printing: within === 1 };
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <span className="visual-tag">for (i = 1; i &lt;= 5; i++)</span>
        <button
          onClick={() => setStep(0)}
          className="btn btn-secondary btn-sm"
        >
          <RotateCcw size={12} /> Restart
        </button>
        <button
          onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
          className="btn btn-success btn-sm"
        >
          <Play size={12} /> Next
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-center gap-4">
        {/* Condition box */}
        <div className="flex flex-col items-center">
          <div
            className={`min-w-[100px] rounded-xl border-2 px-4 py-2 font-mono text-sm transition-colors ${
              lastCheck && lastCheck.passed
                ? 'border-kumo-brand bg-kumoInfo-tint text-kumoText-info'
                : lastCheck
                  ? 'border-kumoDanger bg-kumoDanger-tint text-kumoText-danger'
                  : 'border-kumo-line bg-white text-kumo-text-subtle'
            }`}
          >
            {lastCheck ? (lastCheck.passed ? `i = ${lastCheck.i} ✓` : 'i = 6 ✗ Stop') : 'i = 1'}
          </div>
        </div>

        {/* Printed output */}
        <div className="rounded-xl border border-kumo-hairline bg-kumo-tint p-3 text-right">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-kumo-text-subtle">
            Printed
          </div>
          <div className="min-h-[64px] text-left font-mono text-sm">
            {printed.length === 0 && <span className="text-kumo-text-subtle">—</span>}
            {printed.map((n) => (
              <div key={n} className="animate-fade-in text-kumoText-info">
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>

      {lastCheck?.printing && (
        <p className="mt-3 animate-fade-in text-center text-sm font-medium text-kumoText-info">
          i = {lastCheck.i} → condition true → print {lastCheck.i}
        </p>
      )}
      {lastCheck && !lastCheck.passed && (
        <p className="mt-3 animate-fade-in text-center text-sm font-medium text-kumoText-danger">
          i = 6 → condition false → loop stops
        </p>
      )}

      <StepDots total={maxStep + 1} current={step} compact />
    </div>
  );
}

function useAutoSteps(total: number, interval = 1100) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= total) return;
    const t = setTimeout(() => setStep((s) => s + 1), interval);
    return () => clearTimeout(t);
  }, [step, total, interval]);
  return step;
}

function StepDots({ total, current, compact }: { total: number; current: number; compact?: boolean }) {
  const shown = compact ? Math.min(total, 12) : total;
  return (
    <div className="mt-4 flex items-center justify-center gap-1.5">
      {Array.from({ length: shown }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current ? 'w-4 bg-kumo-brand' : 'w-1.5 bg-kumo-fill'
          }`}
        />
      ))}
    </div>
  );
}

export default function VisualExplanation({
  type,
  onActive,
}: {
  type: VisualType;
  onActive?: () => void;
}) {
  useEffect(() => {
    onActive?.();
  }, []);
  switch (type) {
    case 'interaction':
      return <InteractionVisual />;
    case 'variable-box':
      return <VariableBoxVisual />;
    case 'condition-tree':
      return <ConditionTreeVisual />;
    case 'loop-flow':
      return <LoopFlowVisual />;
    default:
      return null;
  }
}

export { useAutoSteps };
