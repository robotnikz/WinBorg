import { render, screen } from '@testing-library/react';

import FuseSetupModal from './FuseSetupModal';

describe('FuseSetupModal', () => {
  it('shows an install command that works on Ubuntu 22.04 to 26.04', () => {
    render(<FuseSetupModal isOpen={true} onClose={() => {}} />);

    const command = screen.getByText(/sudo apt install/);
    // python3-llfuse is not available on Ubuntu 26.04; asking for it makes apt install nothing.
    expect(command.textContent).toContain('python3-pyfuse3');
    expect(command.textContent).not.toContain('python3-llfuse');
    expect(command.textContent).toContain('fuse3');
  });

  it('renders nothing when closed', () => {
    const { container } = render(<FuseSetupModal isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
