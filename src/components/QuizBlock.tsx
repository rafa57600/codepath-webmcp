import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Quiz, QuizResult } from '../types';

interface QuizProps {
  quiz: Quiz;
  lessonId: string;
  onAnswer: (lessonId: string, result: QuizResult) => void;
  initialResult?: QuizResult;
}

export default function QuizBlock({ quiz, lessonId, onAnswer, initialResult }: QuizProps) {
  const [result, setResult] = useState<QuizResult | null>(initialResult ?? null);

  const choose = (optionId: string) => {
    if (result) return; // locked after answer
    const correct = optionId === quiz.correctId;
    const res: QuizResult = { correct, selectedId: optionId };
    setResult(res);
    onAnswer(lessonId, res);
  };

  const isCorrect = result?.correct;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-white/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Mini quiz
        </span>
      </div>

      <p className="mb-4 text-lg font-medium text-white">{quiz.question}</p>

      <div className="space-y-2">
        {quiz.options.map((opt) => {
          const isSelected = result?.selectedId === opt.id;
          const isCorrectOpt = opt.id === quiz.correctId;
          let cls = 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10';
          if (result) {
            if (isCorrectOpt) cls = 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200';
            else if (isSelected) cls = 'border-rose-400/50 bg-rose-400/10 text-rose-200';
            else cls = 'border-white/10 bg-white/5 text-slate-400 opacity-60';
          }
          return (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              disabled={!!result}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${cls}`}
            >
              <span>{opt.text}</span>
              {result && isCorrectOpt && <CheckCircle2 size={18} className="text-emerald-400" />}
              {result && isSelected && !isCorrectOpt && (
                <XCircle size={18} className="text-rose-400" />
              )}
            </button>
          );
        })}
      </div>

      {result && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            isCorrect
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
              : 'border-rose-400/40 bg-rose-400/10 text-rose-200'
          }`}
        >
          {isCorrect ? '✓ Correct! ' : '✗ Not quite. '}
          {quiz.explanation}
        </div>
      )}
    </div>
  );
}
