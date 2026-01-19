import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

import CreateBackupModal from './CreateBackupModal';
import { borgService } from '../services/borgService';
import { Repository } from '../types';

// Mock dependencies
vi.mock('../services/borgService', () => ({
    borgService: {
        selectDirectory: vi.fn(),
        createArchive: vi.fn(),
        stopCommand: vi.fn(),
    }
}));

vi.mock('../utils/eventBus', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

const mockRepo: Repository = {
    id: 'repo-1',
    name: 'Test Repo',
    url: 'ssh://test',
    status: 'connected',
    lastBackup: null,
    encryption: 'repokey',
    size: '0 B',
    fileCount: 0
};

describe('CreateBackupModal', () => {
    const defaultProps = {
        initialRepo: mockRepo,
        isOpen: true,
        onClose: vi.fn(),
        onLog: vi.fn(),
        onSuccess: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly when open', () => {
        render(<CreateBackupModal {...defaultProps} />);
        
        expect(screen.getByText('Create New Backup')).toBeInTheDocument();
        expect(screen.getByText(`Upload to ${mockRepo.name}`)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<CreateBackupModal {...defaultProps} isOpen={false} />);
        
        expect(screen.queryByText('Create New Backup')).not.toBeInTheDocument();
    });

    it('updates source path when folder is selected', async () => {
        vi.mocked(borgService.selectDirectory).mockResolvedValue(['C:\\MyData']);
        
        render(<CreateBackupModal {...defaultProps} />);
        
        // The button text might vary slightly, checking typical text or icon
        // Looking at the code in previous turn: "handleSelectFolder" is used.
        // Let's assume there is a button that triggers it.
        // Looking at file content from turn 4:
        // const handleSelectFolder = async () => { ... }
        // It's likely attached to an input group or button. I'll search for it or look at file content.
        // Re-reading CreateBackupModal.tsx content from turn 4...
        // <Button onClick={handleSelectFolder} ... >Select Folder</Button> (Assumed based on pattern)
        // Wait, I should check the file content more carefully if I can.
        // I have lines 1-100 of CreateBackupModal.tsx in turn 4. It ends at `availableRepos.length > 1`.
        // The buttons are likely further down.
        // I'll assume "Select Folder" is the text or close.
        // If it fails, I'll fix it. But let's look at the imports: `Folder` icon from lucide-react.
        
        const folderBtn = screen.getByRole('button', { name: /browse/i }); // Broad match first
        fireEvent.click(folderBtn);

        await waitFor(() => {
            expect(borgService.selectDirectory).toHaveBeenCalled();
            expect(screen.getByDisplayValue('C:\\MyData')).toBeInTheDocument();
        });
    });

    it('calls createArchive with correct parameters on submit', async () => {
        vi.mocked(borgService.selectDirectory).mockResolvedValue(['C:\\Source']);
        vi.mocked(borgService.createArchive).mockResolvedValue(true);
        
        render(<CreateBackupModal {...defaultProps} />);
        
        // Select folder
        const folderBtn = screen.getByRole('button', { name: /browse/i });
        fireEvent.click(folderBtn);
        await waitFor(() => screen.getByDisplayValue('C:\\Source'));
        
        // Change name (targeting input by placeholder or value)
        // Code from turn 4: `const [archiveName, setArchiveName] = useState(...)`
        // It usually has a default value like `backup-YYYY-...`.
        // I'll search for the input.
        const inputs = screen.getAllByRole('textbox');
        const nameInput = inputs.find(i => (i as HTMLInputElement).value.startsWith('backup-'));
        if (nameInput) {
             fireEvent.change(nameInput, { target: { value: 'my-backup' } });
        }

        // Submit
        const createBtn = screen.getByRole('button', { name: /start backup/i });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(borgService.createArchive).toHaveBeenCalledWith(
                mockRepo.url,
                'my-backup',
                ['C:\\Source'],
                expect.any(Function),
                expect.objectContaining({ repoId: mockRepo.id })
            );
            expect(defaultProps.onSuccess).toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    it('handles backup failure', async () => {
        vi.mocked(borgService.selectDirectory).mockResolvedValue(['C:\\Source']);
        vi.mocked(borgService.createArchive).mockResolvedValue(false); // Simulate fail
        
        render(<CreateBackupModal {...defaultProps} />);
        
        // Setup valid state
        const folderBtn = screen.getByRole('button', { name: /browse/i });
        fireEvent.click(folderBtn);
        await waitFor(() => screen.getByDisplayValue('C:\\Source'));

        // Submit
        const createBtn = screen.getByRole('button', { name: /start backup/i });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(borgService.createArchive).toHaveBeenCalled();
            expect(defaultProps.onLog).toHaveBeenCalled(); // Should log failure
            expect(defaultProps.onSuccess).not.toHaveBeenCalled();
        });
    });

    it('passes exclude patterns to createArchive when provided', async () => {
        vi.mocked(borgService.selectDirectory).mockResolvedValue(['C:\\Source']);
        vi.mocked(borgService.createArchive).mockResolvedValue(true);

        render(<CreateBackupModal {...defaultProps} />);

        // Select folder
        const folderBtn = screen.getByRole('button', { name: /browse/i });
        fireEvent.click(folderBtn);
        await waitFor(() => screen.getByDisplayValue('C:\\Source'));

        // Enter excludes
        const excludesTextarea = screen.getByPlaceholderText(/node_modules/i);
        fireEvent.change(excludesTextarea, { target: { value: 'node_modules\nC:\\Temp' } });

        // Submit
        const createBtn = screen.getByRole('button', { name: /start backup/i });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(borgService.createArchive).toHaveBeenCalledWith(
                mockRepo.url,
                expect.any(String),
                ['C:\\Source'],
                expect.any(Function),
                expect.objectContaining({ repoId: mockRepo.id }),
                { excludePatterns: ['node_modules', 'C:\\Temp'] }
            );
        });
    });

    it('allows cancelling while a backup is running', async () => {
        vi.mocked(borgService.selectDirectory).mockResolvedValue(['C:\\Source']);

        let resolveCreate: (v: boolean) => void;
        const createPromise = new Promise<boolean>((resolve) => {
            resolveCreate = resolve;
        });
        vi.mocked(borgService.createArchive).mockReturnValue(createPromise as any);
        vi.mocked(borgService.stopCommand).mockResolvedValue(true);

        const onClose = vi.fn();
        render(<CreateBackupModal {...defaultProps} onClose={onClose} />);

        // Select folder
        const folderBtn = screen.getByRole('button', { name: /browse/i });
        fireEvent.click(folderBtn);
        await waitFor(() => screen.getByDisplayValue('C:\\Source'));

        // Start backup
        const startBtn = screen.getByRole('button', { name: /start backup/i });
        fireEvent.click(startBtn);

        // Cancel Backup should be enabled while processing
        const cancelBackupBtn = await screen.findByRole('button', { name: /cancel backup/i });
        expect(cancelBackupBtn).not.toBeDisabled();
        fireEvent.click(cancelBackupBtn);

        await waitFor(() => {
            expect(borgService.stopCommand).toHaveBeenCalledTimes(1);
            expect(onClose).toHaveBeenCalled();
        });

        // Allow promise to resolve to avoid pending promise leakage
        await act(async () => {
            resolveCreate!(false);
        });
    });
});
