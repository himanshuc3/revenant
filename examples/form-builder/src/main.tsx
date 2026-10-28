import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './App';
import { theme } from './theme';
import './index.css';

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
