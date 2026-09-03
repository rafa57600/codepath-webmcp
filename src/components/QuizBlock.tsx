import { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import type { Quiz, QuizResult } from '../types';

interface QuizProps {
  quiz: Quiz;
  lessonId: string;
  onAnswer: (lessonId: string, result: QuizResult) => void;
  initialResult?: QuizResult;
  /** Called when the learner enters/interacts with the quiz so the cursor updates. */
  onActive?: () => void;
}

export default function QuizBlock({ quiz, lessonId, onAnswer, initialResult, onActive }: QuizProps) {
  const [result, setResult] = useState<QuizResult | null>(initialResult ?? null);

  const choose = (optionId: string) => {
    if (result) return; // locked after answer
    onActive?.();
    const correct = optionId === quiz.correctId;
    const res: QuizResult = { correct, selectedId: optionId };
    setResult(res);
    onAnswer(lessonId, res);
  };

  const isCorrect = result?.correct;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-kumoInfo-tint px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-kumoText-info">
          <HelpCircle size={13} /> Mini quiz
        </span>
      </div>

      <p className="mb-4 text-lg font-semibold text-kumo-text-strong">{quiz.question}</p>

      <div className="space-y-2">
        {quiz.options.map((opt) => {
          const isSelected = result?.selectedId === opt.id;
          const isCorrectOpt = opt.id === quiz.correctId;
          let cls = 'border-kumo-hairline bg-white text-kumo-text-default hover:border-kumo-line hover:bg-kumo-tint';
          if (result) {
            if (isCorrectOpt) cls = 'border-kumo-brand bg-kumoInfo-tint text-kumoText-info';
            else if (isSelected) cls = 'border-kumoDanger bg-kumoDanger-tint text-kumoText-danger';
            else cls = 'border-kumo-hairline bg-white text-kumo-text-subtle opacity-60';
          }
          return (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              disabled={!!result}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${cls}`}
            >
              <span>{opt.text}</span>
              {result && isCorrectOpt && (
                <CheckCircle2 size={18} className="shrink-0 text-kumo-brand" />
              )}
              {result && isSelected && !isCorrectOpt && (
                <XCircle size={18} className="shrink-0 text-kumoDanger" />
              )}
            </button>
          );
        })}
      </div>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-3.5 text-sm ${
            isCorrect
              ? 'border-kumo-brand bg-kumoInfo-tint text-kumoText-info'
              : 'border-kumoDanger bg-kumoDanger-tint text-kumoText-danger'
          }`}
        >
          <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
            {isCorrect ? (
              <CheckCircle2 size={15} className="text-kumo-brand" />
            ) : (
              <XCircle size={15} className="text-kumoDanger" />
            )}
            {isCorrect ? 'Correct!' : 'Not quite.'}
          </div>
          {quiz.explanation}
        </div>
      )}
    </div>
  );
}
