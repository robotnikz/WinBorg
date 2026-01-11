import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import Sidebar from './Sidebar';
import { View } from '../types';

// Mock AppLogo
vi.mock('./AppLogo', () => ({
    default: () => <div data-testid="app-logo">Logo</div>
}));

// Mock window.require for shell.openExternal
const mockShell = { openExternal: vi.fn() };
const mockRequire = vi.fn((module) => {
    if (module === 'electron') return { shell: mockShell };
    return {};
});

describe('Sidebar', () => {
    beforeAll(() => {
        vi.stubEnv('APP_VERSION', '1.0.0');

        Object.defineProperty(window, 'require', {
            value: mockRequire,
            writable: true
        });
        Object.defineProperty(window, 'open', {
             value: vi.fn(),
             writable: true
        });
    });

    it('renders all nav items', () => {
        render(<Sidebar currentView={View.DASHBOARD} onChangeView={vi.fn()} />);
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Repositories')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByTestId('app-logo')).toBeInTheDocument();
    });

    it('highlights current view', () => {
        const { getByText } = render(<Sidebar currentView={View.REPOSITORIES} onChangeView={vi.fn()} />);
        const repoButton = getByText('Repositories').closest('button');
        const dashButton = getByText('Dashboard').closest('button');
        
        expect(repoButton?.className).toContain('bg-white'); // Active style
        expect(dashButton?.className).not.toContain('bg-white'); // Inactive
    });

    it('calls onChangeView when clicked', () => {
        const onChangeView = vi.fn();
        render(<Sidebar currentView={View.DASHBOARD} onChangeView={onChangeView} />);
        
        fireEvent.click(screen.getByText('Mounts'));
        expect(onChangeView).toHaveBeenCalledWith(View.MOUNTS);
    });

    it('handles GitHub link click (Electron mode)', () => {
        render(<Sidebar currentView={View.DASHBOARD} onChangeView={vi.fn()} />);
        const devArea = screen.getByTitle('View on GitHub');
        
        fireEvent.click(devArea);
        expect(mockRequire).toHaveBeenCalledWith('electron');
        expect(mockShell.openExternal).toHaveBeenCalled();
    });

    it('handles GitHub link click (Fallback mode)', () => {
        // Suppress mockRequire to force fallback
        mockRequire.mockImplementationOnce(() => { throw new Error('Not found') });
        
        render(<Sidebar currentView={View.DASHBOARD} onChangeView={vi.fn()} />);
        const devArea = screen.getByTitle('View on GitHub');
        
        fireEvent.click(devArea);
        expect(window.open).toHaveBeenCalled();
    });
});
