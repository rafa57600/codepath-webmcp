import { useState } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useProgress } from '../store/progress';
import { javascriptCourse } from '../data/javascript';
import VisualExplanation from './VisualExplanation';
import CodeRunner from './CodeRunner';
import QuizBlock from './QuizBlock';
import type { Exercise, Lesson as LessonType } from '../types';

export default function LessonView({ lessonId }: { lessonId: string }) {
  const course = javascriptCourse;
  const lessonIndex = course.lessons.findIndex((l) => l.id === lessonId);
  const lesson = course.lessons[lessonIndex];

  const state = useProgress();
  const [exerciseResults, setExerciseResults] = useState<Record<string, boolean>>({});
  const [tryItDone, setTryItDone] = useState(false);

  if (!lesson) return <div className="p-6 text-slate-400">Lesson not found.</div>;

  const prev = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
  const next = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null;

  const allExercisesDone =
    lesson.exercises.length > 0 &&
    lesson.exercises.every((ex) => exerciseResults[ex.id] || state.completedExercises.includes(ex.id));
  const completing = Boolean(
    state.completedExercises.filter((e) => lesson.exercises.some((ex) => ex.id === e)).length
  );

  const handleExerciseResult = (exercise: Exercise, passed: boolean) => {
    setExerciseResults((prev) => ({ ...prev, [exercise.id]: passed }));
    if (passed) {
      state.completeLesson(lesson.id);
    }
  };

  const handleQuiz = (lessonId: string, res: { correct: boolean; selectedId: string }) => {
    state.recordQuiz(lessonId, res);
  };

  const goTo = (id: string) => {
    state.setCurrentLesson(id);
    state.setCourse('javascript');
  };

  const completed = state.completedLessons.includes(lesson.id);
  const quizDone = Boolean(state.quizResults[lesson.id]);
  const quizCorrect = state.quizResults[lesson.id]?.correct;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      {/* Lesson header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>JavaScript</span>
          <span>/</span>
          <span>{String(lessonIndex + 1).padStart(2, '0')}</span>
          {completed && (
            <span className="ml-2 flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
              <CheckCircle2 size={12} /> Completed
            </span>
          )}
        </div>
        <h1 className="mt-1 text-3xl font-bold text-white md:text-4xl">{lesson.title}</h1>
      </div>

      {/* Learning objective */}
      <section className="mb-8 rounded-xl border border-white/10 bg-slate-900 p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
          Learning objective
        </span>
        <p className="mt-2 text-lg text-slate-100">{lesson.objective}</p>
      </section>

      {/* Simple explanation */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">Simple explanation</h2>
        {lesson.simpleExplanation.map((p, i) => (
          <p key={i} className="mb-2 text-slate-300">
            {p}
          </p>
        ))}
        {lesson.id === 'loops' && (
          <pre className="mt-2 rounded-lg bg-slate-950 p-3 font-mono text-sm text-slate-300">
            <code>
              {`console.log(1);
console.log(2);
console.log(3);
console.log(4);
console.log(5);`}
            </code>
          </pre>
        )}
      </section>

      {/* Visual explanation */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">Visual explanation</h2>
        <VisualExplanation type={lesson.visualType} />
      </section>

      {/* Code examples */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">Examples</h2>
        {lesson.examples.map((ex, i) => (
          <div key={i} className="mb-4">
            {ex.title && (
              <div className="mb-1 text-sm font-medium text-slate-300">{ex.title}</div>
            )}
            <pre className="overflow-x-auto rounded-lg border border-white/10 bg-slate-950 p-4 font-mono text-sm text-emerald-200">
              <code>{ex.code}</code>
            </pre>
            {ex.explanation && (
              <p className="mt-2 text-sm text-slate-400">{ex.explanation}</p>
            )}
          </div>
        ))}
      </section>

      {/* Try it yourself */}
      <section className="mb-8" id="try-it">
        <h2 className="mb-3 text-xl font-semibold text-white">Try it yourself</h2>
        <CodeRunner
          lesson={lesson}
          mode="tryit"
          initialCode={lesson.tryIt.starterCode}
          onCodeChange={() => {}}
          expectedOutput={lesson.tryIt.expectedOutput}
        />
        {lesson.tryIt.hint && (
          <p className="mt-2 text-sm text-slate-400">💡 {lesson.tryIt.hint}</p>
        )}
      </section>

      {/* Exercises */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">Exercises</h2>
        <div className="space-y-4">
          {lesson.exercises.map((exercise, i) => (
            <div key={exercise.id} className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-white">
                  Exercise {i + 1}: {exercise.title}
                </h3>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs capitalize text-slate-300">
                  {exercise.difficulty}
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-300">{exercise.instructions}</p>
              <CodeRunner
                lesson={lesson}
                exercise={exercise}
                mode="exercise"
                initialCode={exercise.starterCode}
                onCodeChange={(c) => state.setStudentCode(exercise.id, c)}
                onSubmitResult={(res) => handleExerciseResult(exercise, res.passed)}
              />
              {exerciseResults[exercise.id] && (
                <p className="mt-2 flex items-center gap-1 text-sm text-emerald-300">
                  <CheckCircle2 size={14} /> Solved
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Mini quiz */}
      <section className="mb-8">
        <QuizBlock
          quiz={lesson.quiz}
          lessonId={lesson.id}
          onAnswer={handleQuiz}
          initialResult={state.quizResults[lesson.id]}
        />
      </section>

      {/* Progress summary */}
      <section className="mb-8 rounded-xl border border-white/10 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-white">Lesson progress</h3>
            <p className="text-sm text-slate-400">
              Complete all exercises and the quiz to finish this lesson.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-white">
              {completing ? 'Exercises' : '—'}
            </span>
            <div className="text-xs text-slate-400">
              {lesson.exercises.length} exercises·quiz {quizCorrect ? '✓' : quizDone ? '✗' : '○'}
            </div>
          </div>
        </div>
        {allExercisesDone && quizCorrect && !completed && (
          <p className="mt-3 text-sm text-emerald-300">
            ✓ You finished this lesson! Mark it complete and move on.
          </p>
        )}
      </section>

      {/* Next / prev navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
        {prev ? (
          <button
            onClick={() => goTo(prev.id)}
            className="flex items-center gap-1 rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <ChevronLeft size={16} /> {prev.title}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button
            onClick={() => goTo(next.id)}
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            {next.title} <ChevronRight size={16} />
          </button>
        ) : (
          <span className="text-sm text-emerald-300">🎉 Course complete!</span>
        )}
      </div>
    </div>
  );
}
