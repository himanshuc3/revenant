import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDraftInstance } from '../domain/instance';
import { templateOf, text } from '../logic/testing';
import { printInstance } from '../print/printInstance';
import { repository } from '../storage';
import { ResponsesPage } from './ResponsesPage';

vi.mock('../print/printInstance', () => ({ printInstance: vi.fn() }));

function seed() {
  const template = { ...templateOf([text('name', { label: 'Name' })]), title: 'Survey' };
  repository.saveTemplate(template);
  const make = (name: string, submittedAt: string) =>
    repository.saveInstance({
      ...createDraftInstance(template),
      status: 'submitted',
      submittedAt,
      values: { name },
    });
  const older = make('Old', '2026-01-01T09:00:00.000Z');
  const newer = make('New', '2026-02-01T09:00:00.000Z');
  const draft = repository.saveInstance(createDraftInstance(template));
  return { template, older, newer, draft };
}

function renderPage(templateId: string) {
  return render(
    <AntApp>
      <MemoryRouter initialEntries={[`/templates/${templateId}/responses`]}>
        <Routes>
          <Route path="/templates/:templateId/responses" element={<ResponsesPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </AntApp>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(printInstance).mockClear();
});

describe('ResponsesPage', () => {
  it('lists submitted responses newest first and drafts separately', () => {
    const { template } = seed();
    renderPage(template.id);
    expect(screen.getByText('Submitted (2)')).toBeInTheDocument();
    expect(screen.getByText('In progress (1)')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1); // drop header row
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText(/Feb 1, 2026/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/Jan 1, 2026/)).toBeInTheDocument();
  });

  it('re-downloads the PDF for the chosen response only', async () => {
    const { template, newer } = seed();
    renderPage(template.id);
    const rows = screen.getAllByRole('row').slice(1);
    await userEvent.setup().click(within(rows[0]!).getByRole('button', { name: /re-download pdf/i }));
    expect(printInstance).toHaveBeenCalledTimes(1);
    expect(vi.mocked(printInstance).mock.calls[0]?.[0].id).toBe(newer.id);
  });

  it('deletes a response after confirmation', async () => {
    const { template, newer } = seed();
    const user = userEvent.setup();
    renderPage(template.id);
    const rows = screen.getAllByRole('row').slice(1);
    await user.click(within(rows[0]!).getByRole('button', { name: /delete response/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(repository.getInstance(newer.id)).toBeUndefined();
    expect(await screen.findByText('Submitted (1)')).toBeInTheDocument();
  });

  it('shows an empty state and 404 for a missing template', () => {
    const { template } = seed();
    window.localStorage.clear();
    repository.saveTemplate(template);
    renderPage(template.id);
    expect(screen.getByText('No submitted responses yet')).toBeInTheDocument();
  });

  it('404s for an unknown template', () => {
    renderPage('missing');
    expect(screen.getByText('Template not found')).toBeInTheDocument();
  });
});
