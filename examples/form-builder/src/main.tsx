import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import * as Sentry from "@sentry/react";
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './App';
import { theme } from './theme';
import './index.css';

Sentry.init({
  dsn: "https://a02ca005532a822df7faff6ef4e1455e@o4504073652142080.ingest.us.sentry.io/4512334725578752",
  integrations: [
    Sentry.browserTracingIntegration()
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/]
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// A data router (rather than <BrowserRouter>) is required for `useBlocker`, which guards unsaved edits.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

createRoot(root).render(
  <StrictMode>
    <ConfigProvider theme={theme}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ConfigProvider>
  </StrictMode>,
);
