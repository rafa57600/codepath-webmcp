import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { courses } from '../data/javascript';
import type { Lesson, ExerciseResult, QuizResult } from '../types';

export interface Attempt {
  exerciseId: string;
  passed: boolean;
  timestamp: number;
}

export interface Mistake {
  concept: string;
  exerciseId: string;
  timestamp: number;
}

interface ProgressState {
  courseId: string;
  currentLessonId: string;
  completedLessons: string[];
  completedExercises: string[];
  quizResults: Record<string, QuizResult>;
  attempts: Attempt[];
  recentMistakes: Mistake[];
  studentCode: Record<string, string>;
  tutorMode: 'guide' | 'balanced' | 'explain';

  // actions
  setCourse: (courseId: string) => void;
  setCurrentLesson: (lessonId: string) => void;
  completeLesson: (lessonId: string) => void;
  recordExerciseResult: (result: ExerciseResult, lessonId: string, exerciseId: string) => void;
  clearExerciseExercise: (lessonId: string, exerciseId: string) => void;
  recordQuiz: (lessonId: string, quiz: QuizResult) => void;
  setStudentCode: (exerciseId: string, code: string) => void;
  setTutorMode: (mode: 'guide' | 'balanced' | 'explain') => void;
  resetProgress: () => void;
}

function conceptForLesson(lessonId: string): string {
  switch (lessonId) {
    case 'introduction':
      return 'console.log output';
    case 'variables':
      return 'string vs number';
    case 'conditions':
      return 'condition comparison';
    case 'loops':
      return 'loop boundary';
    default:
      return 'general';
  }
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      courseId: 'javascript',
      currentLessonId: 'introduction',
      completedLessons: [],
      completedExercises: [],
      quizResults: {},
      attempts: [],
      recentMistakes: [],
      studentCode: {},
      tutorMode: 'guide',

      setCourse: (courseId) => set({ courseId }),

      setCurrentLesson: (lessonId) => set({ currentLessonId: lessonId }),

      completeLesson: (lessonId) =>
        set((state) => ({
          completedLessons: state.completedLessons.includes(lessonId)
            ? state.completedLessons
            : [...state.completedLessons, lessonId],
        })),

      recordExerciseResult: (result, lessonId, exerciseId) =>
        set((state) => {
          const passed = result.passed;
          let completedExercises = state.completedExercises;
          if (passed && !completedExercises.includes(exerciseId)) {
            completedExercises = [...completedExercises, exerciseId];
          }
          let mistakes = state.recentMistakes;
          if (!passed) {
            mistakes = [
              {
                concept: conceptForLesson(lessonId),
                exerciseId,
                timestamp: Date.now(),
              },
              ...state.recentMistakes,
            ].slice(0, 10);
          } else {
            mistakes = state.recentMistakes.filter((m) => m.exerciseId !== exerciseId);
          }
          // If all exercises in the current lesson are completed, mark lesson complete.
          const course = courses.find((c) => c.id === state.courseId);
          const lesson = course?.lessons.find((l) => l.id === lessonId);
          let completedLessons = state.completedLessons;
          if (lesson && lesson.exercises.every((ex) => completedExercises.includes(ex.id))) {
            if (!completedLessons.includes(lessonId)) {
              completedLessons = [...completedLessons, lessonId];
            }
          }
          return {
            completedExercises,
            recentMistakes: mistakes,
            completedLessons,
            attempts: [
              { exerciseId, passed, timestamp: Date.now() },
              ...state.attempts,
            ].slice(0, 50),
          };
        }),

      clearExerciseExercise: (lessonId, exerciseId) =>
        set((state) => ({
          completedExercises: state.completedExercises.filter((e) => e !== exerciseId),
          attempts: state.attempts.filter((a) => a.exerciseId !== exerciseId),
        })),

      recordQuiz: (lessonId, quiz) =>
        set((state) => ({
          quizResults: { ...state.quizResults, [lessonId]: quiz },
        })),

      setStudentCode: (exerciseId, code) =>
        set((state) => ({
          studentCode: { ...state.studentCode, [exerciseId]: code },
        })),

      setTutorMode: (mode) => set({ tutorMode: mode }),

      resetProgress: () =>
        set({
          currentLessonId: 'introduction',
          completedLessons: [],
          completedExercises: [],
          quizResults: {},
          attempts: [],
          recentMistakes: [],
          studentCode: {},
        }),
    }),
    {
      name: 'codepath-progress',
    }
  )
);
