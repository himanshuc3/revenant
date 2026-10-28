import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App as AntApp } from 'antd';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { BuilderRoute } from './BuilderPage';
import { repository } from '../storage';

function renderBuilder(path = '/builder/new') {
  const router = createMemoryRouter(
    [
      { path: '/builder/:templateId', element: <BuilderRoute /> },
      { path: '/', element: <div>home</div> },
    ],
    { initialEntries: [path] },
  );
  render(
    <AntApp>
      <RouterProvider router={router} />
    </AntApp>,
  );
  return router;
}

beforeEach(() => window.localStorage.clear());

describe('Builder', () => {
  it('adds fields, edits a label, and persists the template on save', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.clear(screen.getByLabelText('Form title'));
    await user.type(screen.getByLabelText('Form title'), 'Survey');
    await user.click(screen.getByRole('button', { name: 'Add Number' }));
    await user.clear(screen.getByLabelText('Label'));
    await user.type(screen.getByLabelText('Label'), 'Age');
    await user.click(screen.getByRole('button', { name: /save/i }));

    const saved = repository.loadTemplates().items;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: 'Survey' });
    expect(saved[0]?.fields.map((f) => [f.type, f.label])).toEqual([['number', 'Age']]);
  });

  it('refuses to save an incomplete calculation and says why', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Add Calculation' }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(repository.loadTemplates().items).toHaveLength(0);
    expect((await screen.findAllByText(/at least one Number field/i)).length).toBeGreaterThan(0);
  });

  it('reorders and deletes fields from the canvas', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole('button', { name: 'Add Number' }));
    await user.click(screen.getByRole('button', { name: 'Add Date' }));
    const labels = () =>
      screen.getAllByTestId(/canvas-field-/).map((el) => within(el).getAllByText(/^(Number|Date)$/)[0]?.textContent);
    expect(labels()).toEqual(['Number', 'Date']);

    await user.click(screen.getByRole('button', { name: 'Move Date up' }));
    expect(labels()).toEqual(['Date', 'Number']);

    await user.click(screen.getByRole('button', { name: 'Delete Number' }));
    expect(labels()).toEqual(['Date']);
  });

  it('shows 404 for an unknown template id', () => {
    renderBuilder('/builder/does-not-exist');
    expect(screen.getByText('Template not found')).toBeInTheDocument();
  });
});
