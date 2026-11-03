import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorPage } from './pages/ErrorPage';
import { ToastProvider } from './components/ui/Toast';
import { queryClient } from './queryClient';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          {/* Last line of defence: anything the shell's own boundary did not catch (the shell itself, the public pages). */}
          <ErrorBoundary fallback={(err) => <ErrorPage error={err} fullPage />}>
            <App />
          </ErrorBoundary>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
