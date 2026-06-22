import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ArchiveBrowserModal from './ArchiveBrowserModal';
import { Archive, Repository } from '../types';
import { borgService } from '../services/borgService';

// Mock Dependencies
vi.mock('../services/borgService', () => ({
    borgService: {
        listArchiveFiles: vi.fn(),
        getDownloadsPath: vi.fn(),
        createDirectory: vi.fn(),
        extractFiles: vi.fn(),
        openPath: vi.fn()
    }
}));

const mockRepo: Repository = {
    id: 'repo1', name: 'TestRepo', url: '/tmp', encryption: 'none', status: 'connected', size: '0', fileCount: 0, lastBackup: 'now'
};

const mockArchive: Archive = { 
    id: '1', name: 'archive-1', time: 'now', duration: '1s', size: '100MB' 
};

describe('ArchiveBrowserModal', () => {
    const defaultProps = {
        repo: mockRepo,
        archive: mockArchive,
        isOpen: true,
        onClose: vi.fn(),
        onLog: vi.fn(),
        onExtractSuccess: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders and lists files', async () => {
        (borgService.listArchiveFiles as any).mockResolvedValue([
            { path: 'home/user/doc.txt', type: 'f', size: 100 },
            { path: 'home/user/pic.jpg', type: 'f', size: 2000 },
            { path: 'home/user', type: 'd' },
            { path: 'home', type: 'd' },
        ]);

        render(<ArchiveBrowserModal {...defaultProps} />);
        
        // Wait for loading
        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });

        // Initial view should show 'home' folder
        expect(screen.getByText('home')).toBeInTheDocument();
        
        // Should NOT show nested files yet
        expect(screen.queryByText('doc.txt')).not.toBeInTheDocument();
    });

    it('navigates into folders', async () => {
        (borgService.listArchiveFiles as any).mockResolvedValue([
            { path: 'folder1/file1.txt', type: 'f' },
            { path: 'folder1', type: 'd' }
        ]);

        render(<ArchiveBrowserModal {...defaultProps} />);
        
        await waitFor(() => expect(screen.getByText('folder1')).toBeInTheDocument());

        // Click folder
        fireEvent.click(screen.getByText('folder1'));

        // Should update path and show contents
        await waitFor(() => {
            expect(screen.getByText('file1.txt')).toBeInTheDocument();
        });
        
        // Check breadcrumb or nav state
        // Assuming current path is displayed
    });

    it('acts as a path picker when onUsePaths is provided', async () => {
        (borgService.listArchiveFiles as any).mockResolvedValue([
            { path: 'mnt/d/Project/info.yaml', type: 'f', size: 100 }
        ]);

        const onUsePaths = vi.fn();
        const onClose = vi.fn();
        render(
            <ArchiveBrowserModal
                {...defaultProps}
                onClose={onClose}
                onExtractSuccess={undefined}
                onUsePaths={onUsePaths}
            />
        );

        await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

        // Picker mode swaps the extract actions for a single confirm button
        expect(screen.queryByText(/Download Selection/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Restore To/i)).not.toBeInTheDocument();

        // Confirm is disabled until something is selected
        const useBtn = screen.getByRole('button', { name: /Use \d+ path/i });
        expect(useBtn).toBeDisabled();

        // Reveal the nested file via search (flat view) and select it
        fireEvent.change(screen.getByLabelText(/search files/i), { target: { value: 'info.yaml' } });
        await waitFor(() => screen.getByText('info.yaml'));
        fireEvent.click(screen.getByText('info.yaml'));

        const useBtnAfter = screen.getByRole('button', { name: /Use 1 path/i });
        expect(useBtnAfter).not.toBeDisabled();
        fireEvent.click(useBtnAfter);

        expect(onUsePaths).toHaveBeenCalledWith(['mnt/d/Project/info.yaml']);
        expect(onClose).toHaveBeenCalledTimes(1);
        // Must never trigger an extraction in picker mode
        expect(borgService.extractFiles).not.toHaveBeenCalled();
    });

    it('extracts selected files', async () => {
        (borgService.listArchiveFiles as any).mockResolvedValue([
            { path: 'file.txt', type: 'f' }
        ]);
        (borgService.getDownloadsPath as any).mockResolvedValue('C:\\Users\\User\\Downloads');
        (borgService.createDirectory as any).mockResolvedValue(true);
        (borgService.extractFiles as any).mockResolvedValue(true);

        const onClose = vi.fn();
        const onExtractSuccess = vi.fn();
        render(<ArchiveBrowserModal {...defaultProps} onClose={onClose} onExtractSuccess={onExtractSuccess} />);
        await waitFor(() => screen.getByText('file.txt'));

        // Select file (click the file name to toggle)
        fireEvent.click(screen.getByText('file.txt'));
        
        // Click Download
        const dlBtn = screen.getByText(/Download Selection/i);
        fireEvent.click(dlBtn);
        
        await waitFor(() => {
            expect(borgService.extractFiles).toHaveBeenCalledWith(
                mockRepo.url,
                mockArchive.name,
                ['file.txt'],
                expect.stringContaining('WinBorg Restores'),
                expect.any(Function),
                expect.anything()
            );
        });

        await waitFor(() => {
            expect(onExtractSuccess).toHaveBeenCalledTimes(1);
            expect(onExtractSuccess).toHaveBeenCalledWith(expect.stringContaining('WinBorg Restores'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
