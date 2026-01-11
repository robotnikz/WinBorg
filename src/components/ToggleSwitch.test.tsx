import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ToggleSwitch from './ToggleSwitch';

describe('ToggleSwitch', () => {
    it('renders correctly', () => {
        render(<ToggleSwitch id="test-switch" checked={false} onChange={vi.fn()} />);
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('renders checked state', () => {
        render(<ToggleSwitch id="test-switch" checked={true} onChange={vi.fn()} />);
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('calls onChange when clicked', () => {
        const onChange = vi.fn();
        render(<ToggleSwitch id="test-switch" checked={false} onChange={onChange} />);
        
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('applies color variants', () => {
        const { container } = render(<ToggleSwitch id="test-switch" checked={true} onChange={vi.fn()} color="red" />);
        // Since styling is applied to sibling label via peer-checked, we check if the label has the class via regex or simply that render doesn't crash
        // Testing CSS classes on the label
        // The label is sibling to input
        const label = container.querySelector('label');
        expect(label).toHaveClass('peer-checked:bg-red-600');
    });
});
