import { render, screen, fireEvent } from '@testing-library/react';

import UpdateModal from './UpdateModal';

vi.mock('./Button', () => ({
    default: ({ children, onClick }: any) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    )
}));

describe('UpdateModal', () => {
    it('hides changelog by default and toggles it', () => {
        render(
            <UpdateModal
                isOpen={true}
                onClose={() => {}}
                onUpdate={() => {}}
                version="1.2.3"
                downloading={false}
                readyToInstall={false}
                releaseNotes={'- Added feature A\n- Fixed bug B'}
            />
        );

        // Hidden by default
        expect(screen.queryByText(/Added feature A/i)).not.toBeInTheDocument();

        const toggle = screen.getByRole('button', { name: /Changelog/i });
        fireEvent.click(toggle);

        expect(screen.getByText(/Added feature A/i)).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(screen.queryByText(/Added feature A/i)).not.toBeInTheDocument();
    });

    it('does not render changelog while downloading', () => {
        render(
            <UpdateModal
                isOpen={true}
                onClose={() => {}}
                onUpdate={() => {}}
                version="1.2.3"
                downloading={true}
                progress={10}
                readyToInstall={false}
                releaseNotes={'- Added feature A'}
            />
        );

        expect(screen.queryByRole('button', { name: /Changelog/i })).not.toBeInTheDocument();
    });

    it('normalizes array release notes and renders as plain text (no HTML tags)', () => {
        const { container } = render(
            <UpdateModal
                isOpen={true}
                onClose={() => {}}
                onUpdate={() => {}}
                version="1.2.3"
                downloading={false}
                readyToInstall={false}
                releaseNotes={[
                    { version: '1.2.3', note: '<b>Added</b> feature A' },
                    { version: '1.2.3', notes: 'Fixed bug B' },
                ]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Changelog/i }));

        // HTML tags are stripped to plain text
        expect(screen.getByText(/Added feature A/i)).toBeInTheDocument();
        expect(container.textContent).not.toContain('<b>');
        expect(container.querySelector('b')).toBeNull();
    });
});
