/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('nanostores', () => ({
  atom: (initial: any) => {
    let value = initial;
    const listeners = new Set<Function>();
    return {
      get: () => value,
      set: (v: any) => { value = v; listeners.forEach(fn => fn(v)); },
      subscribe: (fn: Function) => { listeners.add(fn); return () => listeners.delete(fn); },
    };
  },
}));

jest.mock('@nanostores/react', () => ({
  useStore: (store: any) => store.get(),
}));

jest.mock('@tabler/icons-react', () => {
  const MockIcon = (props: any) => <span data-testid="mock-icon" />;
  return {
    IconCoin: MockIcon,
    IconClock: MockIcon,
    IconStack2: MockIcon,
    IconDownload: MockIcon,
    IconFlask: MockIcon,
    IconRobot: MockIcon,
    IconChartBar: MockIcon,
    IconActivity: MockIcon,
    IconCheck: MockIcon,
    IconX: MockIcon,
  };
});

import UsageAnalyticsPanel, {
  type TokenUsage,
  type ToolCall,
  type SessionData,
  type UsageAnalyticsPanelProps,
} from '../../../apps/zavorth-desktop/src/views/panels/UsageAnalyticsPanel';

function makeTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    model: 'gpt-4',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    name: 'bash',
    success: true,
    durationMs: 150,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: 'session-1',
    startedAt: Date.now() - 60000,
    endedAt: Date.now(),
    status: 'completed',
    model: 'gpt-4',
    tokenUsage: makeTokenUsage(),
    ...overrides,
  };
}

function defaultProps(overrides: Partial<UsageAnalyticsPanelProps> = {}): UsageAnalyticsPanelProps {
  return {
    tokenUsages: [makeTokenUsage()],
    toolCalls: [makeToolCall()],
    sessions: [makeSession()],
    costPerModel: { 'gpt-4': { input: 30, output: 60 } },
    ...overrides,
  };
}

describe('UsageAnalyticsPanel', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders summary cards with token counts', () => {
    render(<UsageAnalyticsPanel {...defaultProps()} />);
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Avg Duration')).toBeInTheDocument();
    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('renders cost breakdown table', () => {
    render(<UsageAnalyticsPanel {...defaultProps()} />);
    fireEvent.click(screen.getByText('Models'));
    expect(screen.getByText('Cost Breakdown by Model')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('renders tool usage ranking', () => {
    render(<UsageAnalyticsPanel {...defaultProps()} />);
    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('renders session statistics', () => {
    render(<UsageAnalyticsPanel {...defaultProps()} />);
    fireEvent.click(screen.getByText('Sessions'));
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('Active Now')).toBeInTheDocument();
    expect(screen.getByText('Unique Models')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(
      <UsageAnalyticsPanel
        tokenUsages={[]}
        toolCalls={[]}
        sessions={[]}
      />,
    );
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('switches between tabs (Overview, Tools, Models, Sessions)', () => {
    render(<UsageAnalyticsPanel {...defaultProps()} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tools'));
    expect(screen.getByText('Search tools...')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Models'));
    expect(screen.getByText('Cost Breakdown by Model')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sessions'));
    expect(screen.getByText('Search sessions...')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Overview'));
    expect(screen.getByText('Token Usage (Last 7 Days)')).toBeInTheDocument();
  });

  it('exports data as JSON', () => {
    const clickSpy = jest.fn();
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy } as any;
      }
      return document.createElement.call(document, tag);
    });

    render(<UsageAnalyticsPanel {...defaultProps()} />);
    fireEvent.click(screen.getByText('Export JSON'));

    expect(clickSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith('a');
    createElementSpy.mockRestore();
  });

  it('filters tools by search query', () => {
    const props = defaultProps({
      toolCalls: [
        makeToolCall({ name: 'bash' }),
        makeToolCall({ name: 'read_file' }),
        makeToolCall({ name: 'write_file' }),
      ],
    });
    render(<UsageAnalyticsPanel {...props} />);
    fireEvent.click(screen.getByText('Tools'));

    const searchInput = screen.getByPlaceholderText('Search tools...');
    fireEvent.change(searchInput, { target: { value: 'bash' } });
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.queryByText('read_file')).not.toBeInTheDocument();
    expect(screen.queryByText('write_file')).not.toBeInTheDocument();
  });

  it('shows correct cost calculations', () => {
    const props = defaultProps({
      tokenUsages: [makeTokenUsage({ inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000, model: 'gpt-4' })],
      costPerModel: { 'gpt-4': { input: 30, output: 60 } },
    });
    render(<UsageAnalyticsPanel {...props} />);
    fireEvent.click(screen.getByText('Models'));
    expect(screen.getByText('$0.0900')).toBeInTheDocument();
  });

  it('handles missing props', () => {
    render(
      <UsageAnalyticsPanel
        tokenUsages={[]}
        toolCalls={[]}
        sessions={[]}
      />,
    );
    expect(screen.getByText('Usage Analytics')).toBeInTheDocument();
    expect(screen.getByText('0 tokens')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});
