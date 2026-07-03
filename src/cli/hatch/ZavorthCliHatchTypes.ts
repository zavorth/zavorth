import type { ZavorthCliHomeSnapshot } from '../home/index.js';

export type ZavorthCliHatchStatus = 'ready' | 'needs_setup' | 'needs_approval' | 'blocked';

export type ZavorthCliHatchStep = {
  id: string;
  title: string;
  status: 'ready' | 'waiting' | 'warning' | 'blocked';
  detail: string;
};

export type ZavorthCliHatchSnapshot = {
  contractVersion: 'zavorth-cli-hatch/1';
  generatedAt: string;
  projectRoot: string;
  status: ZavorthCliHatchStatus;
  headline: string;
  home: Pick<ZavorthCliHomeSnapshot, 'status' | 'provider' | 'runtime' | 'channels' | 'approvals' | 'safety'>;
  launch: {
    recommended: string;
    terminal: string;
    zavorthControl: string;
    setup: string;
    approve: string | null;
  };
  firstPrompt: string;
  checklist: ZavorthCliHatchStep[];
  guardrails: string[];
  nextActions: Array<{
    label: string;
    command: string;
    detail?: string;
  }>;
};
