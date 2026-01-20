import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import ConnectionsView from './ConnectionsView';
import { borgService } from '../services/borgService';

vi.mock('../services/borgService', () => ({
  borgService: {
    manageSSHKey: vi.fn(async (action: string) => {
      if (action === 'check') return { exists: false };
      if (action === 'read') return { success: false, key: '' };
      if (action === 'generate') return { success: true };
      return { success: false };
    }),
    testSshConnection: vi.fn(async () => ({ success: false, error: 'no-key' })),
    installSSHKey: vi.fn(async () => ({ success: false, error: 'no-key' })),
  },
}));

vi.mock('../services/electron', () => ({
  getIpcRendererOrNull: () => null,
}));

vi.mock('../utils/eventBus', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    show: vi.fn(() => 't'),
    dismiss: vi.fn(),
  },
}));

describe('ConnectionsView', () => {
  it('disables Test/Deploy buttons in list when SSH key is missing', async () => {
    render(
      <ConnectionsView
        connections={[{ id: 'c1', name: 'Test', serverUrl: 'ssh://user@host:22' }]}
        onAddConnection={vi.fn()}
        onUpdateConnection={vi.fn()}
        onDeleteConnection={vi.fn()}
        onReorderConnections={vi.fn()}
      />
    );

    await waitFor(() => expect(borgService.manageSSHKey).toHaveBeenCalled());

    const testBtn = screen.getByRole('button', { name: /test ssh/i });
    const deployBtn = screen.getByRole('button', { name: /deploy key/i });

    expect(testBtn).toBeDisabled();
    expect(deployBtn).toBeDisabled();
  });

  it('imports an SSH private key via modal', async () => {
    (borgService.manageSSHKey as any).mockImplementation(async (action: string) => {
      if (action === 'check') return { exists: false };
      if (action === 'import') return { success: true };
      return { success: true };
    });

    render(
      <ConnectionsView
        connections={[]}
        onAddConnection={vi.fn()}
        onUpdateConnection={vi.fn()}
        onDeleteConnection={vi.fn()}
        onReorderConnections={vi.fn()}
      />
    );

    // Open import modal
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    expect(screen.getByRole('dialog', { name: 'Import SSH Key' })).toBeInTheDocument();

    // Paste key and import
    fireEvent.change(screen.getByLabelText(/private key/i), {
      target: { value: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----' },
    });
    fireEvent.click(screen.getByRole('button', { name: /import key/i }));

    await waitFor(() => {
      expect(borgService.manageSSHKey).toHaveBeenCalledWith(
        'import',
        'ed25519',
        expect.objectContaining({ privateKey: expect.stringContaining('BEGIN OPENSSH PRIVATE KEY') })
      );
    });
  });
});
