import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppLayout } from './components/Layout/AppLayout';
import { ThoughtsOverlay } from './components/Thoughts/ThoughtsOverlay';
import { useFileWatcher } from './hooks/useFileWatcher';
import './types';

function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.opacity = '0';
  setTimeout(() => splash.remove(), 400);
}

function isThoughtsWindow() {
  return window.location.hash === '#thoughts';
}

export function App() {
  useEffect(dismissSplash, []);

  if (isThoughtsWindow()) {
    return <ThoughtsOverlay />;
  }
  return <MainApp />;
}

function MainApp() {
  useFileWatcher();
  return (
    <TooltipProvider delayDuration={300}>
      <AppLayout />
    </TooltipProvider>
  );
}
