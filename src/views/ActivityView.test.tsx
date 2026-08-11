import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ActivityView from './ActivityView';
import { ActivityLogEntry } from '../types';

vi.mock('../components/Button', () => ({
  default: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="mock-button" {...props}>
      {children}
    </button>
  ),
}));

const withOutput: ActivityLogEntry = {
  id: 'log-1',
  title: 'Backup Job Warning',
  detail: 'Archive created with warnings: daily-2026-08-11-0300',
  time: new Date().toISOString(),
  status: 'warning',
  cmd: 'file changed while we backed it up: C:/Users/demo/ntuser.dat\nArchive name: daily-2026-08-11-0300',
};

const withoutOutput: ActivityLogEntry = {
  id: 'log-2',
  title: 'Backup Job Started',
  detail: 'Job: Daily (Repo: Main)',
  time: new Date().toISOString(),
  status: 'info',
};

describe('ActivityView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('keeps the borg output collapsed until the user asks for it', () => {
    render(<ActivityView logs={[withOutput]} onClearLogs={vi.fn()} />);

    expect(screen.queryByText(/file changed while we backed it up/)).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show output/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByText(/file changed while we backed it up/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide output/i })).toHaveAttribute('aria-expanded', 'true');
  });

  test('collapses the output again on a second click', () => {
    render(<ActivityView logs={[withOutput]} onClearLogs={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /show output/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide output/i }));

    expect(screen.queryByText(/file changed while we backed it up/)).not.toBeInTheDocument();
  });

  test('offers no toggle for entries without output', () => {
    render(<ActivityView logs={[withoutOutput]} onClearLogs={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /show output/i })).not.toBeInTheDocument();
  });

  test('copies the output to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ActivityView logs={[withOutput]} onClearLogs={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /show output/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy output to clipboard/i }));

    expect(writeText).toHaveBeenCalledWith(withOutput.cmd);
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
  });

  test('expands entries independently', () => {
    const second: ActivityLogEntry = { ...withOutput, id: 'log-3', cmd: 'second entry output' };
    render(<ActivityView logs={[withOutput, second]} onClearLogs={vi.fn()} />);

    const toggles = screen.getAllByRole('button', { name: /show output/i });
    fireEvent.click(toggles[0]);

    expect(screen.getByText(/file changed while we backed it up/)).toBeInTheDocument();
    expect(screen.queryByText('second entry output')).not.toBeInTheDocument();
  });
});
