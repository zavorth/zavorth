import type {
  ZavorthMissionContract,
  ZavorthMissionRiskLevel,
} from '../ZavorthMissionContract.js';

export type ZavorthVisualReceiptContract = {
  schemaVersion: 1;
  surface: 'visual-receipt';
  id: string;
  missionId: string;
  generatedAt: string;
  mode: 'simple' | 'advanced';
  summary: {
    title: string;
    risk: ZavorthMissionRiskLevel;
    outcome: string;
    filesRead: number;
    filesChanged: number;
    actionsBlocked: number;
    networkUsed: number;
    networkBlocked: number;
    approvals: number;
    rollbackAvailable: boolean;
  };
  simpleText: string;
  advanced: {
    policyBroker: 'required';
    trustPlane: 'active';
    zavorthControlCanExecute: false;
    sandboxMutationMode: ZavorthMissionContract['execution']['mutationMode'];
    approvalOptions: string[];
    artifacts: string[];
  };
  redaction: {
    rawSecretsPresent: false;
    policy: 'secretrefs-only';
  };
};
