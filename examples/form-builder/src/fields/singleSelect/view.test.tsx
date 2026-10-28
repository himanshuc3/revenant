import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createField } from '../../domain/template';
import { validateForm } from '../../logic/validate';
import { SELECT_DISPLAYS, type SelectDisplay } from './model';
import { singleSelectView } from './view';

const Input = singleSelectView.Input;

function setup(display: SelectDisplay, pick?: (config: ReturnType<typeof createField<'singleSelect'>>) => string) {
  const config = { ...createField('singleSelect'), display, required: true };
  const onChange = vi.fn();
  render(<Input config={config} value={pick?.(config)} onChange={onChange} required inputId="x" />);
  return { config, onChange };
}

describe.each(SELECT_DISPLAYS)('single select displayed as %s', (display) => {
  it('emits the option id when an option is chosen', async () => {
    const { config, onChange } = setup(display);
    const user = userEvent.setup();
    if (display === 'dropdown') await user.click(screen.getByRole('combobox'));
    // antd renders the dropdown label both in a hidden a11y list and visible list; click the last match.
    const matches = screen.getAllByText('Option 2');
    await user.click(matches[matches.length - 1]!);
    expect(onChange).toHaveBeenCalledWith(config.options[1]!.id);
  });

  it('offers to clear a selection, emitting undefined', async () => {
    const { onChange } = setup(display, (c) => c.options[0]!.id);
    await userEvent.setup().click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows no clear button while nothing is selected', () => {
    setup(display);
    expect(screen.queryByRole('button', { name: /clear selection/i })).not.toBeInTheDocument();
  });

  it('required validation is independent of the display type', () => {
    const config = { ...createField('singleSelect'), display, required: true };
    expect(validateForm([config], {})).toEqual({ [config.id]: 'This field is required' });
    expect(validateForm([config], { [config.id]: config.options[0]!.id })).toEqual({});
  });
});
