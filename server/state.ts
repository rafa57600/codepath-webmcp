// Shared state file used by the Node MCP server and (optionally) the browser
// app to keep an external MCP client's view in sync with the learner.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

export interface ServerState {
  courseId: string;
  currentLessonId: string;
  completedLessons: string[];
  completedExercises: string[];
  quizResults: Record<string, { correct: boolean; selectedId: string }>;
  attempts: Array<{ exerciseId: string; passed: boolean; timestamp: number }>;
  recentMistakes: Array<{ concept: string; exerciseId: string; timestamp: number }>;
  studentCode: Record<string, string>;
  tutorMode: 'guide' | 'balanced' | 'explain';
  activeStep: {
    stepId: string;
    type: 'explanation' | 'visual' | 'example' | 'practice' | 'exercise' | 'challenge' | 'quiz';
    title: string;
    index: number;
  } | null;
  currentActivity:
    | 'reading'
    | 'viewing_visual'
    | 'viewing_example'
    | 'editing_code'
    | 'running_code'
    | 'solving_exercise'
    | 'reviewing_feedback'
    | 'answering_quiz'
    | null;
  // Live editor state — mirrors the browser's authoritative drafts.
  editorDrafts: Record<string, {
    code: string;
    lessonId: string;
    stepId: string;
    exerciseId: string | null;
    starterCode: string;
    dirty: boolean;
    lastEditedAt: number;
  }>;
  activeEditorId: string | null;
  lastRun: {
    codeUsed: string;
    success: boolean;
    stdout: string[];
    runtimeError: string | null;
    timestamp: number;
  } | null;
  lastSubmission: {
    exerciseId: string;
    codeUsed: string;
    passed: boolean;
    testsPassed: number;
    testsTotal: number;
    failedTests: Array<{ id: string; description: string }>;
    feedback: string;
    hintContext: string;
    stdout: string[];
    runtimeError: string | null;
    timestamp: number;
  } | null;
}

const DEFAULT_STATE: ServerState = {
  courseId: 'javascript',
  currentLessonId: 'introduction',
  completedLessons: [],
  completedExercises: [],
  quizResults: {},
  attempts: [],
  recentMistakes: [],
  studentCode: {},
  tutorMode: 'guide',
  activeStep: null,
  currentActivity: null,
  editorDrafts: {},
  activeEditorId: null,
  lastRun: null,
  lastSubmission: null,
};

let cache: ServerState | undefined;

export async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadState(): Promise<ServerState> {
  if (cache) return cache;
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    const parsed = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    // A reload/restart means any in-flight run is gone. Never report (or
    // persist) `running_code` across restart — clamp to the stable post-run
    // activity the browser hydrates to.
    if (parsed.currentActivity === 'running_code') {
      parsed.currentActivity = 'reviewing_feedback';
    }
    // activeEditorId is transient — no editor is focused after a restart.
    parsed.activeEditorId = null;
    cache = parsed;
  } catch {
    cache = structuredClone(DEFAULT_STATE);
    await saveState(cache);
  }
  return cache!;
}

export async function saveState(state: ServerState): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  cache = state;
}

export function patchState(patch: Partial<ServerState>): ServerState {
  const merged = { ...(cache ?? structuredClone(DEFAULT_STATE)), ...patch };
  cache = merged;
  void saveState(merged);
  return merged;
}
