import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftInstance } from '../domain/instance';
import { createField } from '../domain/template';
import { num, rule, templateOf, text, withId } from '../logic/testing';
import { repository } from '../storage';
import { FillPage } from './FillPage';

const yes = { kind: 'text', operator: 'equals', value: 'yes' } as const;

function seed() {
  const calc = withId(createField('calculation'), 'total', { label: 'Total', sourceIds: ['a', 'b'] });
  const template = templateOf([
    text('name', { label: 'Name', required: true }),
    text('toggle', { label: 'Toggle' }),
    // hidden by default, revealed by toggle = yes, and required once revealed
    text('why', { label: 'Why', visible: false, required: true, rules: [rule('toggle', yes, 'show')] }),
    num('a', { label: 'A' }),
    num('b', { label: 'B' }),
    calc,
  ]);
  repository.saveTemplate(template);
  const draft = repository.saveInstance(createDraftInstance(template));
  return { template, draft };
}

function renderFill(id: string) {
  return render(
    <AntApp>
      <MemoryRouter initialEntries={[`/fill/${id}`]}>
        <Routes>
          <Route path="/fill/:instanceId" element={<FillPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </AntApp>,
  );
}

beforeEach(() => window.localStorage.clear());

describe('FillPage', () => {
  it('shows nothing red on first paint, then blocks submit on an empty required field', async () => {
    const { draft } = seed();
    const user = userEvent.setup();
    renderFill(draft.id);
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(repository.getInstance(draft.id)?.status).toBe('draft');
  });

  it('ignores a required field that is hidden, and never persists its value', async () => {
    const { draft } = seed();
    const user = userEvent.setup();
    renderFill(draft.id);

    expect(screen.queryByLabelText('Why')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Toggle'), 'yes');
    await user.type(await screen.findByLabelText('Why'), 'because');
    // flipping the rule back hides it again; the answer must not be submitted
    await user.clear(screen.getByLabelText('Toggle'));
    await user.type(screen.getByLabelText('Toggle'), 'no');
    expect(screen.queryByLabelText('Why')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(repository.getInstance(draft.id)?.status).toBe('submitted'));
    const stored = repository.getInstance(draft.id)!;
    expect(stored.values).toEqual({ name: 'Ada', toggle: 'no' });
    expect(stored.submittedAt).toBeDefined();
  });

  it('requires a conditionally-shown required field once it is visible', async () => {
    const { draft } = seed();
    const user = userEvent.setup();
    renderFill(draft.id);
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Toggle'), 'yes');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(repository.getInstance(draft.id)?.status).toBe('draft');
  });

  it('updates the calculation in real time', async () => {
    const { draft } = seed();
    const user = userEvent.setup();
    renderFill(draft.id);
    await user.type(screen.getByLabelText('A'), '4');
    await user.type(screen.getByLabelText('B'), '6');
    expect(screen.getByLabelText('Total')).toHaveValue('10.00');
  });

  it('keeps the draft across a refresh (unmount + remount)', async () => {
    const { draft } = seed();
    const user = userEvent.setup();
    const first = renderFill(draft.id);
    await user.type(screen.getByLabelText('Name'), 'Grace');
    first.unmount(); // leaving the page flushes the pending autosave

    renderFill(draft.id);
    expect(screen.getByLabelText('Name')).toHaveValue('Grace');
  });

  it('renders a submitted response read-only', async () => {
    const { draft } = seed();
    repository.saveInstance({
      ...draft,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      values: { name: 'Ada' },
    });
    renderFill(draft.id);
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByText(/can no longer be edited/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });

  it('shows 404 for an unknown response', () => {
    renderFill('nope');
    expect(screen.getByText('Response not found')).toBeInTheDocument();
  });
});
