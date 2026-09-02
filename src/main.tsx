import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './components/Landing';
import CourseView from './components/CourseView';
import './index.css';

function App() {
  const [view, setView] = useState<'landing' | 'course'>('landing');
  if (view === 'course') {
    return <CourseView onExit={() => setView('landing')} />;
  }
  return <Landing onStart={() => setView('course')} />;
}

createRoot(document.getElementById('root')!).render(<App />);
