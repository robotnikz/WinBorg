import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import ArchivesView from './ArchivesView';
import { Archive, Repository } from '../types';
import { borgService } from '../services/borgService';

// Mock dependencies
vi.mock('../services/borgService', () => ({
    borgService: {
        diffArchives: vi.fn(),
        deleteArchive: vi.fn(),
    }
}));

// Mock child components
vi.mock('../components/ArchiveBrowserModal', () => ({
    default: ({ isOpen, onClose }: any) => isOpen ? (
        <div data-testid="archive-browser-modal">
            Archive Browser
            <button onClick={onClose}>Close</button>
        </div>
    ) : null
}));

vi.mock('../components/DiffViewerModal', () => ({
    default: ({ isOpen, onClose }: any) => isOpen ? (
        <div data-testid="diff-viewer-modal">
            Diff Viewer
            <button onClick={onClose}>Close</button>
        </div>
    ) : null
}));

// Setup default props
const mockArchives: Archive[] = [
    { id: '1', name: 'archive-2023-01-01', time: '2023-01-01T10:00:00', duration: '10s', size: '100MB' },
    { id: '2', name: 'archive-2023-01-02', time: '2023-01-02T10:00:00', duration: '12s', size: '105MB' },
    { id: '3', name: 'archive-old', time: '2022-01-01T10:00:00', duration: '30s', size: 'Unknown' },
];

const mockRepo: Repository = {
    id: 'repo1', name: 'TestRepo', url: '/tmp', encryption: 'none', status: 'connected', size: '0', fileCount: 0, lastBackup: '2023-01-01'
};

describe('ArchivesView', () => {
    const defaultProps = {
        archives: mockArchives,
        repos: [mockRepo],
        onMount: vi.fn(),
        onRefresh: vi.fn(),
        onGetInfo: vi.fn(), // Mock info fetching
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders list of archives', () => {
        render(<ArchivesView {...defaultProps} />);
        
        expect(screen.getByText('archive-2023-01-01')).toBeInTheDocument();
        expect(screen.getByText('archive-2023-01-02')).toBeInTheDocument();
        // Check for calculated relative time or formatted date display if needed
        // Since formatting logic is internal, we just check existence of name
    });

    it('mounts an archive when mount button is clicked', () => {
        render(<ArchivesView {...defaultProps} />);
        
        // Find Mount button for first archive (assuming structure includes a mount button with aria-label or title)
        // Since we don't know exact markup, we'll try to find a button within the archive row
        // Let's assume there is a button with title "Mount"
        const mountBtns = screen.getAllByTitle('Mount Archive'); // Or similar
        // If exact title unknown, we can look for specific text or icons if they were mocked.
        // Assuming the real component uses Tooltips/Titles
        
        // Fallback: Look for "Mount" text?
        // Let's rely on looking for a button in the first row
        // However, better to rely on known text.
        // Reading source earlier: title="Mount" exists.
        
        // Let's target the buttons.
        // Since ArchivesView rows are likely iterated, we can find by text 'Mount' if available or title
        // Re-reading code: Button has title="Mount Archive"
        const mountBtn = screen.getAllByTitle('Mount Archive')[0];
        fireEvent.click(mountBtn);
        
        expect(defaultProps.onMount).toHaveBeenCalledWith(mockRepo, 'archive-2023-01-01');
    });

    it('opens extraction/browser modal when browse button is clicked', () => {
        render(<ArchivesView {...defaultProps} />);
        
        // Button likely title="Browse Files" or has icon
        const browseBtn = screen.getAllByTitle('Browse Files')[0];
        fireEvent.click(browseBtn);
        
        expect(screen.getByTestId('archive-browser-modal')).toBeInTheDocument();
    });

    it('opens diff viewer when two archives are selected and compare clicked', async () => {
        render(<ArchivesView {...defaultProps} />);
        
        // Select checkboxed
        const checkboxes = screen.getAllByRole('checkbox');
        // Assuming first checkbox is "Select All", next are items. 
        // Need to be careful. The table likely has checkboxes for rows.
        
        // Let's select two checkboxes corresponding to items
        // Since simple table, let's just click the first two item checkboxes
        fireEvent.click(checkboxes[0]); // First item
        fireEvent.click(checkboxes[1]); // Second item
        
        // Now find the Compare button which should appear
        const compareBtn = screen.getByText('Diff');
        fireEvent.click(compareBtn);
        
        expect(screen.getByTestId('diff-viewer-modal')).toBeInTheDocument();
        
        await waitFor(() => {
            expect(borgService.diffArchives).toHaveBeenCalled();
        });
    });

    it('requests info for archives with Unknown stats', async () => {
        render(<ArchivesView {...defaultProps} />);
        
        const fetchBtn = screen.getByTitle('Fetch size & duration for all archives');
        fireEvent.click(fetchBtn);
        
        expect(defaultProps.onGetInfo).toHaveBeenCalledWith('archive-old');
    });
});
