import React from 'react';
import { createLogger } from '../logger';

const logger = createLogger('shell');
import { RecoveryOverlay } from './ProductPolishComponents';

type DesktopRecoveryBoundaryProps = {
  children: React.ReactNode;
  onRecover?: () => void;
  onOpenDiagnostics?: () => void;
};

type DesktopRecoveryBoundaryState = {
  error: Error | null;
};

export class DesktopRecoveryBoundary extends React.Component<
  DesktopRecoveryBoundaryProps,
  DesktopRecoveryBoundaryState
> {
  state: DesktopRecoveryBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DesktopRecoveryBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('Zavorth desktop renderer recovered from an error.', error, info);
  }

  private handleRecover = () => {
    this.props.onRecover?.();
    this.setState({ error: null });
  };

  private handleDiagnostics = () => {
    this.props.onOpenDiagnostics?.();
  };

  render() {
    if (this.state.error) {
      return (
        <RecoveryOverlay
          title="A interface encontrou um problema"
          message="Zavorth isolated the visual failure to keep the desktop recoverable. Reopen the interface or review diagnostics."
          retryLabel="Reabrir interface"
          settingsLabel="Abrir diagnosticos"
          onRetry={this.handleRecover}
          onSettings={this.handleDiagnostics}
        />
      );
    }

    return this.props.children;
  }
}
