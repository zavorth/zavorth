import React, { useEffect, useState } from 'react';
import { ModelSelectionService, ResolvedProviderRuntime } from '../../../../src/services/ModelSelectionService.js';
import { Server, Key, AlertCircle, CheckCircle2 } from 'lucide-react';

export function ProviderRuntimeStatus() {
  const [status, setStatus] = useState<ResolvedProviderRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const selector = ModelSelectionService.getInstance();
        const resolved = await selector.selectProvider({});
        setStatus(resolved);
        setError(null);
      } catch (e: any) {
        setStatus(null);
        setError(e.message);
      }
    };

    fetchStatus();
    // In a real app, we'd listen to an event bus to update this when settings change
  }, []);

  if (error) {
    if (error === 'no_suitable_provider_found') {
      return (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30">
          <AlertCircle size={18} />
          <span>No suitable provider found. Please configure a provider.</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30">
        <AlertCircle size={18} />
        <span>Provider Error: {error}</span>
      </div>
    );
  }

  if (!status) {
    return <div className="text-gray-500">Checking provider status...</div>;
  }

  if (!status.runtimeReady) {
    return (
      <div className="flex items-center gap-3 text-yellow-400 bg-yellow-900/20 p-3 rounded-lg border border-yellow-500/30">
        <Key size={18} />
        <div className="flex flex-col">
          <span className="font-semibold">{status.displayName} ({status.modelId})</span>
          <span className="text-sm">Missing API Key</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-green-400 bg-green-900/20 p-3 rounded-lg border border-green-500/30">
      <CheckCircle2 size={18} />
      <div className="flex flex-col">
        <span className="font-semibold">{status.displayName} ({status.modelId})</span>
        <span className="text-sm text-green-500">Ready</span>
      </div>
    </div>
  );
}
