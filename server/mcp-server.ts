// Node MCP server for CodePath.
//
// Exposes the app's WebMCP tools over the standard Model Context Protocol using
// `@modelcontextprotocol/sdk` (high-level McpServer + registerTool). This lets any
// MCP-compatible client act as the learner's tutor with real, deterministic data.
// State is shared via a local JSON file (server/state.ts) that the browser app
// also syncs to through the /api proxy, keeping both views in agreement.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import vm from 'node:vm';
import { loadState, saveState } from './state.js';
import { javascriptCourse } from '../src/data/javascript';

const server = new McpServer({
  name: 'codepath',
  version: '0.1.0',
});

// ---- helpers ---------------------------------------------------------------

function textResult(obj: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function findLesson(lessonId: string) {
  const idx = javascriptCourse.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) return null;
  return { lesson: javascriptCourse.lessons[idx], index: idx };
}

function runInVm(code: string): { success: boolean; stdout: string[]; runtimeError: string | null } {
  const stdout: string[] = [];
  const context: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) =>
        stdout.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      error: (...args: unknown[]) => stdout.push('[error] ' + args.map(String).join(' ')),
    },
  };
  const declRe = /\b(?:let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=|,)/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(code)) !== null) names.add(m[1]);
  for (const n of names) {
    if (n !== 'console' && n !== 'window' && n !== 'document') context[n] = undefined;
  }

  try {
    vm.runInNewContext(code, context, { timeout: 3000, filename: 'student.js' });
    return { success: true, stdout, runtimeError: null };
  } catch (err) {
    return {
      success: false,
      stdout,
      runtimeError: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---- Tools -----------------------------------------------------------------

server.registerTool(
  'get_course_progress',
  {
    description: 'Return where the learner currently is (language, lesson, progress %, completions).',
  },
  async () => {
    const state = await loadState();
    const completedLessons = javascriptCourse.lessons
      .filter((l) => state.completedLessons.includes(l.id))
      .map((l) => l.id);
    const percent = javascriptCourse.lessons.length
      ? Math.round((completedLessons.length / javascriptCourse.lessons.length) * 100)
      : 0;
    return textResult({
      language: state.courseId,
      currentLesson: state.currentLessonId,
      progressPercent: percent,
      completedLessons,
      completedExercises: state.completedExercises,
    });
  }
);

server.registerTool(
  'get_current_lesson',
  { description: 'Return the current lesson (objective, summary, concepts).' },
  async () => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    if (!found) return textResult({ error: 'Lesson not found.' });
    return textResult({
      id: found.lesson.id,
      title: found.lesson.title,
      learningObjective: found.lesson.objective,
      summary: found.lesson.summary,
      concepts: found.lesson.concepts,
    });
  }
);

server.registerTool(
  'get_current_exercise',
  {
    description: 'Return the current exercise and the student’s current code.',
    inputSchema: { exerciseId: z.string().optional() },
  },
  async ({ exerciseId }) => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    if (!found) return textResult({ error: 'Lesson not found.' });
    let exercise = found.lesson.exercises.find((e) => e.id === exerciseId);
    if (!exercise) {
      exercise =
        found.lesson.exercises.find((e) => !state.completedExercises.includes(e.id)) ??
        found.lesson.exercises[0];
    }
    if (!exercise) return textResult({ error: 'No exercise in this lesson.' });
    return textResult({
      exerciseId: exercise.id,
      lesson: found.lesson.id,
      lessonTitle: found.lesson.title,
      instructions: exercise.instructions,
      starterCode: exercise.starterCode,
      studentCode: state.studentCode[exercise.id] ?? exercise.starterCode,
      difficulty: exercise.difficulty,
      hint: exercise.hint ?? null,
    });
  }
);

server.registerTool(
  'run_code',
  {
    description: 'Run the student’s current code in a sandbox and return output.',
    inputSchema: { code: z.string().optional(), exerciseId: z.string().optional() },
  },
  async ({ code, exerciseId }) => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    const target =
      code ?? (exerciseId ? state.studentCode[exerciseId] ?? found?.lesson.tryIt.starterCode ?? '' : found?.lesson.tryIt.starterCode ?? '');
    const r = runInVm(target);
    return textResult({
      success: r.success,
      stdout: r.stdout,
      runtimeError: r.runtimeError,
      exerciseId: exerciseId ?? null,
    });
  }
);

server.registerTool(
  'submit_solution',
  {
    description: 'Validate the current exercise against deterministic tests.',
    inputSchema: { exerciseId: z.string().optional(), lessonId: z.string().optional() },
  },
  async ({ exerciseId, lessonId }) => {
    const state = await loadState();
    const targetLesson = lessonId ?? state.currentLessonId;
    const found = findLesson(targetLesson);
    if (!found) return textResult({ error: 'Lesson not found.' });
    const exercise =
      found.lesson.exercises.find((e) => e.id === exerciseId) ?? found.lesson.exercises[0];
    if (!exercise) return textResult({ error: 'Exercise not found.' });
    const code = state.studentCode[exercise.id] ?? exercise.starterCode;
    const run = runInVm(code);
    const scope: Record<string, unknown> = { outputs: run.stdout };
    let testsPassed = 0;
    const failed: string[] = [];
    for (const test of exercise.tests) {
      let ok = false;
      try {
        const fn = new Function(...Object.keys(scope), `return (${test.run});`);
        ok = Boolean(fn(...Object.keys(scope).map((k) => scope[k])));
      } catch {
        ok = false;
      }
      if (ok) testsPassed++;
      else failed.push(test.description);
    }
    const passed = testsPassed === exercise.tests.length;

    if (passed) {
      state.completedExercises = Array.from(new Set([...state.completedExercises, exercise.id]));
      if (found.lesson.exercises.every((e) => state.completedExercises.includes(e.id))) {
        state.completedLessons = Array.from(new Set([...state.completedLessons, targetLesson]));
      }
      await saveState(state);
    }

    return textResult({
      passed,
      testsPassed,
      testsTotal: exercise.tests.length,
      feedback: run.runtimeError
        ? `Error: ${run.runtimeError}`
        : passed
          ? 'All tests passed.'
          : 'Some tests failed.',
      hintContext: passed ? '' : exercise.hint ?? '',
      failedTests: failed,
      exerciseId: exercise.id,
      lesson: targetLesson,
    });
  }
);

server.registerTool(
  'open_lesson',
  {
    description: 'Navigate the learning UI to a specific lesson.',
    inputSchema: { lessonId: z.string() },
  },
  async ({ lessonId }) => {
    const state = await loadState();
    const found = findLesson(lessonId);
    if (!found) return textResult({ error: `Lesson "${lessonId}" not found.` });
    state.currentLessonId = lessonId;
    await saveState(state);
    return textResult({ ok: true, opened: lessonId, title: found.lesson.title });
  }
);

server.registerTool(
  'get_learning_context',
  {
    description: 'Return the learner’s full context: progress, mistakes, code, tutor mode.',
  },
  async () => {
    const state = await loadState();
    const found = findLesson(state.currentLessonId);
    const currentExercise = found
      ? found.lesson.exercises.find((e) => !state.completedExercises.includes(e.id)) ??
        found.lesson.exercises[0]
      : null;
    return textResult({
      currentLesson: state.currentLessonId,
      currentLessonTitle: found?.lesson.title ?? '',
      completedTopics: state.completedLessons,
      recentMistakes: state.recentMistakes.slice(0, 5),
      currentStudentCode: currentExercise
        ? state.studentCode[currentExercise.id] ?? currentExercise.starterCode
        : null,
      tutorMode: state.tutorMode,
    });
  }
);

// ---- Transport -------------------------------------------------------------

async function main(): Promise<void> {
  await loadState();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CodePath MCP server running (stdio).');
  console.error(
    'Tools: get_course_progress, get_current_lesson, get_current_exercise, run_code, submit_solution, open_lesson, get_learning_context'
  );
}

main().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
