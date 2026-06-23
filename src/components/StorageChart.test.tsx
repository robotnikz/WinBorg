import { render, screen } from '@testing-library/react';

import StorageChart from './StorageChart';

describe('StorageChart', () => {
  const data = [
    { date: '2026-06-01T00:00:00Z', size: 100, originalSize: 200 },
    { date: '2026-06-02T00:00:00Z', size: 150, originalSize: 260 },
    { date: '2026-06-03T00:00:00Z', size: 220, originalSize: 300 },
  ];

  it('renders an empty state when there is no data', () => {
    render(<StorageChart data={[]} />);
    expect(screen.getByText(/No history data available/i)).toBeInTheDocument();
  });

  it('renders y-axis labels as HTML in a gutter, not as clippable SVG text', () => {
    const { container } = render(<StorageChart data={data} />);

    expect(screen.getByText(/Storage Growth/i)).toBeInTheDocument();

    // Baseline label is rendered (as HTML text in the gutter)
    expect(screen.getByText('0 B')).toBeInTheDocument();

    // Five horizontal grid lines and the plotted line are present
    expect(container.querySelectorAll('line').length).toBe(5);
    expect(container.querySelector('polyline')).toBeTruthy();

    // Regression guard for issue #214: axis labels must NOT live inside the
    // stretched SVG (preserveAspectRatio="none") where they get clipped/distorted.
    expect(container.querySelectorAll('svg text').length).toBe(0);
  });
});
