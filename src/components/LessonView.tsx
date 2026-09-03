import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Eye,
  Code2,
  Play,
  Dumbbell,
  HelpCircle,
} from 'lucide-react';
import { useProgress } from '../store/progress';
import { javascriptCourse } from '../data/javascript';
import VisualExplanation from './VisualExplanation';
import CodeRunner from './CodeRunner';
import QuizBlock from './QuizBlock';
import {
  stepsForLesson,
  activeStepIndex,
  isStepLocked,
  stepUnlockHint,
  quizUnlocked,
  activeStepAt,
} from '../lib/unlock';
import type { Exercise, ExerciseResult, Lesson, LearningActivity, LearningStepType } from '../types';

// ---------------------------------------------------------------------------
// Contextual AI affordance — a small inline tip that reveals local guidance.
// No external AI API / chatbot backend: it surfaces the existing hints + how to
// prompt a WebMCP agent. Keeps the interface feeling AI-native without a sidebar.
// ---------------------------------------------------------------------------
function AiPrompt({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-kumo-brand bg-kumoInfo-tint px-3 py-1 text-xs font-medium text-kumoText-info transition-colors hover:bg-kumoInfo-tint"
      >
        <Sparkles size={13} /> {label}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-kumo-hairline bg-kumo-tint/70 p-3 text-sm leading-relaxed text-kumo-text-default">
          {children}
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  number,
  icon,
  title,
  completed,
}: {
  number: number;
  icon: ReactNode;
  title: string;
  completed?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-kumo-hairline bg-white text-xs font-bold text-kumo-text-subtle">
        {number}
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-kumo-text-subtle">
        {title}
      </span>
      {completed && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-kumo-brand">
          <CheckCircle2 size={13} /> done
        </span>
      )}
      <div className="ml-1 h-px flex-1 bg-kumo-fill" />
    </div>
  );
}

/** Locked future step — title + lock + blurred preview + unlock message. */
function LockedStep({
  number,
  title,
  hint,
}: {
  number: number;
  title: string;
  hint: string | null;
}) {
  return (
    <div className="relative mb-10 select-none">
      <SectionHeading number={number} icon={<Lock size={14} />} title={title} />
      {/* Blurred preview bars */}
      <div className="space-y-2 blur-[5px]">
        <div className="h-3.5 w-5/6 rounded bg-kumo-tint" />
        <div className="h-3.5 w-2/3 rounded bg-kumo-tint" />
        <div className="h-24 w-full rounded-xl border border-kumo-hairline bg-kumo-tint/60" />
        <div className="h-3.5 w-3/4 rounded bg-kumo-tint" />
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-kumo-hairline bg-white px-3 py-1 text-xs font-semibold text-kumo-text-subtle shadow-sm">
          <Lock size={12} /> NEXT
        </span>
        <span className="mt-1 rounded-full border border-kumoWarning bg-kumoWarning-tint px-3 py-1 text-xs font-medium text-kumoText-warning">
          {hint ?? 'Complete the current step to unlock.'}
        </span>
      </div>
    </div>
  );
}

export default function LessonView({ lessonId }: { lessonId: string }) {
  const course = javascriptCourse;
  const lessonIndex = course.lessons.findIndex((l) => l.id === lessonId);
  const lesson = course.lessons[lessonIndex];

  const state = useProgress();
  const [localSolved, setLocalSolved] = useState<Record<string, boolean>>({});

  // Body ref used to scope the step-visibility observer for the learning cursor.
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Activate the default (furthest unlocked) step whenever the lesson changes.
  useEffect(() => {
    if (!lesson) return;
    const idx = activeStepIndex(lesson, useProgress.getState().completedExercises);
    const def = activeStepAt(lesson, idx);
    if (def) useProgress.getState().setActiveStep(def);
  }, [lessonId, lesson]);

  // Watch which step section is dominant on screen and reflect it in the cursor.
  // Real interactions (focus/run/submit/quiz) set activity; this observer keeps
  // the active *step* in sync with what the learner is reading/viewing.
  useEffect(() => {
    if (!lesson || !bodyRef.current) return;
    const root = bodyRef.current;
    // The closest scrollable ancestor is the injection point for intersections.
    const scrollParent = root.closest('[data-scroll]') as HTMLElement | null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length === 0) return;
        const target = visible[0].target as HTMLElement;
        const idx = Number(target.dataset.stepIndex);
        if (Number.isNaN(idx)) return;
        const step = activeStepAt(lesson, idx);
        if (!step) return;
        // Never let a LOCKED step win the cursor: a visible but blurred
        // exercise/challenge/quiz is NOT what the learner is working on. Only
        // unlocked steps may become the authoritative activeStep.
        if (isStepLocked(lesson, useProgress.getState().completedExercises, idx)) return;
        const cur = useProgress.getState().activeStep;
        useProgress.getState().setActiveStep(step);
        // Reflect the step's natural activity whenever the active step changes,
        // so the cursor always answers "what are they doing NOW". Explicit
        // focus/run/submit handlers re-assert editor-specific activities.
        if (!cur || cur.stepId !== step.stepId) {
          useProgress.getState().setCurrentActivity(activityForStep(step.type));
        }
      },
      {
        root: scrollParent,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [lessonId, lesson]);

  if (!lesson) return <div className="p-6 text-kumo-text-subtle">Lesson not found.</div>;

  const prev = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
  const next = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null;
  // The next lesson unlocks once THIS lesson is completed.
  const nextLocked = Boolean(next && !state.completedLessons.includes(lesson.id));

  const completed = state.completedLessons.includes(lesson.id);
  const steps = stepsForLesson(lesson);
  const active = activeStepIndex(lesson, state.completedExercises);
  const doneExercises = lesson.exercises.filter((ex) =>
    state.completedExercises.includes(ex.id)
  ).length;

  const handleExerciseResult = (exercise: Exercise, res: ExerciseResult) => {
    setLocalSolved((p) => ({ ...p, [exercise.id]: res.passed }));
    // Record the result in real state (same action the WebMCP `submit_solution`
    // tool uses) so completed-exercise unlocking + progress survive reload.
    state.recordExerciseResult(
      {
        passed: res.passed,
        testsPassed: res.testsPassed,
        testsTotal: res.testsTotal,
        feedback: res.feedback,
        hintContext: res.hintContext,
      },
      lesson.id,
      exercise.id
    );
    if (res.passed) state.completeLesson(lesson.id);
    // After a pass, advance the cursor to the newly unlocked step so an agent
    // immediately sees the learner's *next* active step.
    if (res.passed && lesson) {
      const nextIdx = activeStepIndex(lesson, useProgress.getState().completedExercises);
      const def = activeStepAt(lesson, nextIdx);
      if (def) useProgress.getState().setActiveStep(def);
      useProgress.getState().setCurrentActivity('reviewing_feedback');
    }
  };

  const handleQuiz = (lessonId: string, res: { correct: boolean; selectedId: string }) => {
    state.recordQuiz(lessonId, res);
  };

  const goTo = (id: string) => {
    state.setCurrentLesson(id);
    state.setCourse('javascript');
    // setCurrentLesson resets the cursor; pre-seed the default active step so
    // the agent has an immediate, truthful reading even before the observer fires.
    const next = course.lessons.find((l) => l.id === id);
    if (next) {
      const idx = activeStepIndex(next, useProgress.getState().completedExercises);
      const def = activeStepAt(next, idx);
      if (def) useProgress.getState().setActiveStep(def);
    }
  };

  // Step index mappings
  const EX = 4; // reading steps occupy 0..3; exercises start at 4
  const quizStep = steps.length - 1;

  return (
    <div ref={bodyRef} className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      {/* Editorial lesson header */}
      <header className="mb-8 border-b border-kumo-hairline pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-kumo-text-subtle">
          <span className="font-medium text-kumo-text-default">JavaScript</span>
          <span>/</span>
          <span>{String(lessonIndex + 1).padStart(2, '0')}</span>
          {completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-kumoInfo-tint px-2.5 py-0.5 text-xs font-semibold text-kumoText-info">
              <CheckCircle2 size={12} /> Completed
            </span>
          )}
          {!completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-kumo-tint px-2.5 py-0.5 text-xs font-medium text-kumo-text-subtle">
              Step {Math.min(active + 1, steps.length)} of {steps.length}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-kumo-text-strong md:text-4xl">
          {lesson.title}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-kumo-text-default">{lesson.objective}</p>
      </header>

      {/* 1. Simple explanation */}
      <section className="mb-10" aria-label={steps[0].title} data-step data-step-index={0}>
        <SectionHeading number={1} icon={<Code2 size={14} />} title="Simple explanation" />
        {lesson.simpleExplanation.map((p, i) => (
          <p key={i} className="mb-2.5 leading-relaxed text-kumo-text-default">
            {p}
          </p>
        ))}
        {lesson.id === 'loops' && (
          <pre className="code-block mt-3">
            <code>
              {`console.log(1);
console.log(2);
console.log(3);
console.log(4);
console.log(5);`}
            </code>
          </pre>
        )}
        <AiPrompt label="Explain this differently">
          Try asking your WebMCP agent: <em>“Explain {lesson.title} in simpler words.”</em> Your AI
          agent reads this lesson via <code className="font-mono">get_current_lesson</code>.
        </AiPrompt>
      </section>

      {/* 2. Visual explanation */}
      <section className="mb-10" aria-label={steps[1].title} data-step data-step-index={1}>
        <SectionHeading number={2} icon={<Eye size={14} />} title="Visual explanation" />
        <VisualExplanation type={lesson.visualType} onActive={() => {
          const step = activeStepAt(lesson, 1);
          if (step) { state.setActiveStep(step); state.setCurrentActivity('viewing_visual'); }
        }} />
        <AiPrompt label="Walk me through this">
          Ask your agent to step through the animation step by step, explaining each stage.
        </AiPrompt>
      </section>

      {/* 3. Example — editorial code block, no card */}
      <section className="mb-10" aria-label={steps[2].title} data-step data-step-index={2}>
        <SectionHeading number={3} icon={<Code2 size={14} />} title="Example" />
        {lesson.examples.map((ex, i) => (
          <div key={i} className="mb-5">
            {ex.title && (
              <p className="mb-1.5 text-sm font-semibold text-kumo-text-strong">{ex.title}</p>
            )}
            <pre className="code-block">
              <code>{ex.code}</code>
            </pre>
            {ex.explanation && (
              <p className="mt-1.5 text-sm text-kumo-text-subtle">{ex.explanation}</p>
            )}
          </div>
        ))}
      </section>

      {/* 4. Try it yourself */}
      <section className="mb-10" aria-label={steps[3].title} data-step data-step-index={3}>
        <SectionHeading number={4} icon={<Play size={14} />} title="Try it yourself" />
        <CodeRunner
          lesson={lesson}
          mode="tryit"
          initialCode={lesson.tryIt.starterCode}
          onCodeChange={() => {}}
          expectedOutput={lesson.tryIt.expectedOutput}
          onActivity={(activity, stepId) => {
            const step = activeStepAt(lesson, 3);
            if (step) {
              state.setActiveStep(step);
              state.setCurrentActivity(activity);
            }
          }}
        />
        {lesson.tryIt.hint && (
          <p className="mt-2.5 flex items-start gap-1.5 text-sm text-kumo-text-subtle">
            <HelpCircle size={15} className="mt-0.5 shrink-0 text-kumo-brand" />
            {lesson.tryIt.hint}
          </p>
        )}
      </section>

      {/* 5+. Exercises — progressive */}
      <section className="mb-10" aria-label="Exercises">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-kumo-text-strong">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-kumoInfo-tint text-kumo-brand">
              <Dumbbell size={15} />
            </span>
            Hands-on practice
          </h2>
          <p className="mt-1 text-sm text-kumo-text-subtle">
            Complete an exercise to unlock the next step. Your progress is saved automatically.
          </p>
        </div>

        {lesson.exercises.map((exercise, i) => {
          const stepIdx = EX + i;
          const locked = isStepLocked(lesson, state.completedExercises, stepIdx);
          if (locked) {
            return (
              <LockedStep
                key={exercise.id}
                number={stepIdx + 1}
                title={i === lesson.exercises.length - 1 ? 'Challenge' : `Exercise ${i + 1}`}
                hint={stepUnlockHint(lesson, state.completedExercises, stepIdx)}
              />
            );
          }
          const isDone =
            localSolved[exercise.id] || state.completedExercises.includes(exercise.id);
          return (
            <div key={exercise.id} className="mb-8" data-step data-step-index={stepIdx}>
              <SectionHeading
                number={stepIdx + 1}
                icon={<Dumbbell size={14} />}
                title={
                  i === lesson.exercises.length - 1
                    ? `Challenge: ${exercise.title}`
                    : `Exercise ${i + 1}: ${exercise.title}`
                }
                completed={isDone}
              />
              <p className="mb-3 max-w-2xl text-sm text-kumo-text-default">{exercise.instructions}</p>
              <CodeRunner
                lesson={lesson}
                exercise={exercise}
                mode="exercise"
                initialCode={exercise.starterCode}
                onCodeChange={(c) => state.setStudentCode(exercise.id, c)}
                onSubmitResult={(res) => handleExerciseResult(exercise, res)}
                onActivity={(activity) => {
                  const step = activeStepAt(lesson, stepIdx);
                  if (step) {
                    state.setActiveStep(step);
                    state.setCurrentActivity(activity);
                  }
                }}
              />
              {/* Note: hint affordance lives in CodeRunner's own Hint button —
                  no separate duplicating prompt here. */}
            </div>
          );
        })}
      </section>

      {/* Quiz */}
      <section className="mb-10" aria-label="Quiz" data-step data-step-index={quizStep}>
        {quizUnlocked(lesson, state.completedExercises) ? (
          <>
            <SectionHeading
              number={quizStep + 1}
              icon={<Trophy size={14} />}
              title="Mini quiz"
              completed={Boolean(state.quizResults[lesson.id])}
            />
            <QuizBlock
              quiz={lesson.quiz}
              lessonId={lesson.id}
              onAnswer={handleQuiz}
              initialResult={state.quizResults[lesson.id]}
              onActive={() => {
                const step = activeStepAt(lesson, quizStep);
                if (step) {
                  state.setActiveStep(step);
                  state.setCurrentActivity('answering_quiz');
                }
              }}
            />
          </>
        ) : (
          <LockedStep
            number={quizStep + 1}
            title="Mini quiz"
            hint={stepUnlockHint(lesson, state.completedExercises, quizStep)}
          />
        )}
      </section>

      {/* Bottom: progress + prev/next */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-kumo-text-subtle">
          <Trophy size={15} className={completed ? 'text-kumo-brand' : 'text-kumo-text-inactive'} />
          <span>
            {doneExercises}/{lesson.exercises.length} exercises done
            {state.quizResults[lesson.id] ? ' · quiz done' : ''}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-kumo-hairline pt-5">
          {prev ? (
            <button onClick={() => goTo(prev.id)} className="btn btn-secondary">
              <ChevronLeft size={16} /> {prev.title}
            </button>
          ) : (
            <span />
          )}
          {next ? (
            nextLocked ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-kumo-hairline bg-kumo-tint px-3 py-2 text-sm text-kumo-text-subtle"
                title={`Complete ${lesson.title} to unlock.`}
              >
                <Lock size={14} /> {next.title} locked
              </span>
            ) : (
              <button onClick={() => goTo(next.id)} className="btn btn-primary">
                {next.title} <ChevronRight size={16} />
              </button>
            )
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg bg-kumoInfo-tint px-3 py-2 text-sm font-semibold text-kumoText-info">
              <Trophy size={16} /> Course complete!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers for the active learning cursor.
// ---------------------------------------------------------------------------

/** Natural activity inferred from the step being the dominant visible one. */
function activityForStep(type: LearningStepType): LearningActivity {
  switch (type) {
    case 'explanation':
      return 'reading';
    case 'visual':
      return 'viewing_visual';
    case 'example':
      return 'viewing_example';
    case 'practice':
    case 'exercise':
    case 'challenge':
      return 'solving_exercise';
    case 'quiz':
      return 'answering_quiz';
    default:
      return 'reading';
  }
}
