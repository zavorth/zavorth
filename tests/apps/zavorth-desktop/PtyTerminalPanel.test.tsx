import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PtyTerminalPanel } from '../../../apps/zavorth-desktop/src/shell/PtyTerminalPanel';

// Mock the API client
jest.mock('../../../apps/zavorth-desktop/src/apiClient', () => ({
  getPtyOutput: jest.fn().mockResolvedValue({ chunks: [{ chunk: 'test output', seq: 1 }], lastSeq: 1 }),
  terminatePtySession: jest.fn().mockResolvedValue({})
}));

describe('PtyTerminalPanel', () => {
  it('renders session active state and output', async () => {
    render(<PtyTerminalPanel sessionId="test-session" workspaceId="ws1" hostPowerModeActive={true} />);

    expect(await screen.findByText(/test output/)).toBeInTheDocument();
    expect(screen.getByText(/Session ID: test-session/)).toBeInTheDocument();
  });

  it('shows kill switch and calls terminate on click', async () => {
    const { terminatePtySession } = require('../../../apps/zavorth-desktop/src/apiClient');
    render(<PtyTerminalPanel sessionId="test-session" workspaceId="ws1" hostPowerModeActive={true} />);

    const killBtn = screen.getByText('Kill PTY Session');
    fireEvent.click(killBtn);

    expect(terminatePtySession).toHaveBeenCalledWith('ws1', 'test-session');
  });

  it('differentiates manual user input from agent input (shows input box)', () => {
    render(<PtyTerminalPanel sessionId="test-session" workspaceId="ws1" hostPowerModeActive={true} />);
    const input = screen.getByPlaceholderText(/Type command.../);
    expect(input).toBeInTheDocument();
  });
});
