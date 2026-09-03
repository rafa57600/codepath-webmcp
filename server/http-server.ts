// Lightweight HTTP companion to the CodePath MCP server.
//
// Exposes:
//   GET  /api/state      -> current learner state (from the shared JSON file)
//   POST /api/state      -> merge a progress patch from the browser app
//   GET  /health         -> liveness
//
// The browser app POSTs its progress here (via the Vite dev proxy or CORS), so
// an external MCP client connected over stdio sees the learner's real browser
// progress, not a separate copy.

import express from 'express';
import cors from 'cors';
import { loadState, patchState } from './state.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'codepath-http', tools: 7 });
});

app.get('/api/state', async (_req, res) => {
  const state = await loadState();
  res.json(state);
});

app.post('/api/state', async (req, res) => {
  const patch = req.body ?? {};
  const allowed = [
    'courseId',
    'currentLessonId',
    'completedLessons',
    'completedExercises',
    'quizResults',
    'attempts',
    'recentMistakes',
    'studentCode',
    'tutorMode',
    'activeStep',
    'currentActivity',
  ];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in patch) clean[key] = patch[key];
  }
  const merged = patchState(clean);
  res.json({ ok: true, state: merged });
});

const PORT = Number(process.env.PORT || 3002);
app.listen(PORT, () => {
  console.error(`CodePath HTTP sync server running on http://localhost:${PORT}`);
});
