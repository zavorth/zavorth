import React from 'react';
import { render } from '@testing-library/react';
import {
  StatusBadge,
  RiskBadge,
  SurfaceCard,
  EmptyState,
  InlineAlert,
  SectionHeader,
  ActionHint,
} from '../../../apps/zavorth-desktop/src/components/ProductPolishComponents';

describe('ProductSurfacePolish UX Tests', () => {
  it('renders StatusBadge with different statuses without crashing', () => {
    const { container: success } = render(<StatusBadge status="success">Ready</StatusBadge>);
    expect(success.textContent).toContain('Ready');

    const { container: warning } = render(<StatusBadge status="warning">Atencao</StatusBadge>);
    expect(warning.textContent).toContain('Atencao');
  });

  it('renders RiskBadge with correct labels', () => {
    const { container: low } = render(<RiskBadge level="LOW" />);
    expect(low.textContent).toContain('Risco Baixo');

    const { container: critical } = render(<RiskBadge level="CRITICAL" />);
    expect(critical.textContent).toContain('Risco Critico');
  });

  it('renders SurfaceCard with title and children', () => {
    const { container } = render(
      <SurfaceCard title="Test Card">
        <p>Content</p>
      </SurfaceCard>
    );
    expect(container.textContent).toContain('Test Card');
    expect(container.textContent).toContain('Content');
  });

  it('renders EmptyState with title and description', () => {
    const { container } = render(
      <EmptyState title="No task found" description="Start a task to see results" />
    );
    expect(container.textContent).toContain('No task found');
    expect(container.textContent).toContain('Start a task to see results');
  });

  it('renders InlineAlert with correct messages', () => {
    const { container } = render(
      <InlineAlert type="warning" title="Important warning" message="This action consumes an approval." />
    );
    expect(container.textContent).toContain('Important warning');
    expect(container.textContent).toContain('This action consumes an approval.');
  });

  it('renders SectionHeader and ActionHint', () => {
    const { container: header } = render(
      <SectionHeader title="Posture Policies" description="Global security settings" />
    );
    expect(header.textContent).toContain('Posture Policies');
    expect(header.textContent).toContain('Global security settings');

    const { container: hint } = render(<ActionHint message="Click recalculate to update." />);
    expect(hint.textContent).toContain('Click recalculate to update.');
  });
});
