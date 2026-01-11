import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Button from './Button';

describe('Button', () => {
    it('renders children correctly', () => {
        render(<Button>Click Me</Button>);
        expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('renders loading state correctly', () => {
        render(<Button loading>Submit</Button>);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByText('Submit')).not.toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('applies variant classes', () => {
        const { container } = render(<Button variant="danger">Delete</Button>);
        expect(container.firstChild).toHaveClass('bg-red-50');
    });

    it('applies size classes', () => {
        const { container } = render(<Button size="lg">Big</Button>);
        expect(container.firstChild).toHaveClass('px-6');
    });

    it('handles disabled state', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
