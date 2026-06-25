"use client";

import type { Dispatch, SetStateAction } from "react";

type LooseRecord = Record<string, any>;

export type ControlStateResponse = {
  ok?: boolean;
  snapshot?: LooseRecord | null;
  agentRuntime?: LooseRecord | null;
  session?: LooseRecord | null;
  sessions?: LooseRecord | null;
  sessionsSummary?: LooseRecord | null;
  gatewaySessionTools?: LooseRecord | null;
  gateway?: LooseRecord | null;
  productMode?: LooseRecord | null;
  modeEscalation?: LooseRecord | null;
  uiSurfaceHints?: LooseRecord | null;
  memoryRecall?: LooseRecord | null;
  approvalPlane?: LooseRecord | null;
  capabilityPlane?: LooseRecord | null;
  artifactPlane?: LooseRecord | null;
  selfmodPlane?: LooseRecord | null;
  resourcePlane?: LooseRecord | null;
  companionPlane?: LooseRecord | null;
  controlPlane?: LooseRecord | null;
  sessionPlane?: LooseRecord | null;
  runtimeApiV1?: LooseRecord | null;
  runtimeWarnings?: string[];
  actionRecommendations?: LooseRecord[];
  send?: LooseRecord | null;
  error?: string;
};

export type GatewayRuntimeResponse = {
  ok?: boolean;
  runtime?: LooseRecord | null;
};

export type GatewayControlResponse = {
  ok?: boolean;
  contractVersion?: string;
  generatedAt?: string;
  resource?: string;
  boundary?: LooseRecord | null;
  health?: LooseRecord | null;
  providers?: LooseRecord | null;
  models?: LooseRecord | null;
  modelPicker?: LooseRecord | null;
  profiles?: LooseRecord[];
  combos?: LooseRecord | null;
  cache?: LooseRecord | null;
  rateLimits?: LooseRecord | null;
  resilience?: LooseRecord | null;
  operations?: LooseRecord[];
  warnings?: string[];
  error?: string;
};

export type DeveloperWorkspaceResponse = {
  ok?: boolean;
  contractVersion?: string;
  generatedAt?: string;
  manifestPath?: string | null;
  projectRoot?: string | null;
  project?: LooseRecord | null;
  policy?: LooseRecord | null;
  summary?: LooseRecord | null;
  processes?: LooseRecord[];
  hooks?: LooseRecord[];
  agents?: LooseRecord[];
  ptyProfiles?: LooseRecord[];
  logWatch?: LooseRecord | null;
  operations?: LooseRecord[];
  warnings?: string[];
  error?: string | null;
};

export type DeveloperWorkspaceActionResult = {
  ok?: boolean;
  httpStatus?: number;
  status?: string;
  message?: string;
  errors?: string[];
  processId?: string | null;
  snapshot?: DeveloperWorkspaceResponse | null;
};

export type DiffPreviewState = {
  toolRunId: string;
  summary: string;
  patches: Array<LooseRecord>;
  consolidatedDiff: string | null;
} | null;

export type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

export type TimelineItem = {
  kind: "message" | "task";
  id: string;
  title: string;
  body: string;
  timestamp: string;
};

export type ControlPageClientModel = {
  state: ControlStateResponse | null;
  runtime: LooseRecord | null;
  gatewayControl: GatewayControlResponse | null;
  gatewayControlError: string | null;
  developerWorkspace: DeveloperWorkspaceResponse | null;
  developerWorkspaceError: string | null;
  developerWorkspaceActionResult: DeveloperWorkspaceActionResult | null;
  developerWorkspaceActionPending: string | null;
  activeSessionId: string;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  loading: boolean;
  sending: boolean;
  resolvingApprovalId: string | null;
  resolvingProviderId: string | null;
  resolvingChannelActionId: string | null;
  resolvingMissionId: string | null;
  resolvingModeEscalation: boolean;
  diffPreview: DiffPreviewState;
  setDiffPreview: Dispatch<SetStateAction<DiffPreviewState>>;
  wsStatus: "connecting" | "connected" | "disconnected";
  error: string | null;
  sessionEntries: LooseRecord[];
  transcriptEntries: LooseRecord[];
  taskEntries: LooseRecord[];
  toolRuns: LooseRecord[];
  artifacts: LooseRecord[];
  approvals: LooseRecord[];
  capabilities: LooseRecord[];
  companions: LooseRecord[];
  topConsumers: LooseRecord[];
  uiSurfaceHints: LooseRecord | null;
  memoryRecall: LooseRecord | null;
  memoryRecallSources: LooseRecord[];
  recommendedJourneys: LooseRecord[];
  visibleSurfaces: LooseRecord[];
  runtimeWarnings: string[];
  recommendations: LooseRecord[];
  runtimeApiV1: LooseRecord | null;
  receiptCards: LooseRecord[];
  providerRows: LooseRecord[];
  channelRows: LooseRecord[];
  missionRows: LooseRecord[];
  effectiveSessionId: string | null;
  escalationRequest: LooseRecord | null;
  productModeId: string;
  productModeLabel: string;
  runtimeStatus: string;
  timelineItems: TimelineItem[];
  loadControlState: (preferredSessionId?: string | null) => Promise<void>;
  reloadGatewayControl: () => Promise<GatewayControlResponse | null>;
  reloadDeveloperWorkspace: () => Promise<DeveloperWorkspaceResponse | null>;
  handleDeveloperWorkspaceAction: (
    action: "start" | "stop" | "restart",
    processId?: string | null,
  ) => Promise<DeveloperWorkspaceActionResult | null>;
  handleSend: (options?: { live?: boolean }) => Promise<void>;
  handleSessionChange: (sessionId: string) => Promise<void>;
  handleApproval: (approvalId: string, decision: "approve" | "reject") => Promise<void>;
  handleMissionCancel: (missionId: string) => Promise<void>;
  handleProviderTest: (providerId: string, options?: { live?: boolean; approved?: boolean }) => Promise<void>;
  handleChannelAction: (channelId: string, actionId: string, options?: { approved?: boolean }) => Promise<void>;
  handleModeEscalation: (
    decision: "approve" | "reject",
    scope?: "once" | "session" | "host",
  ) => Promise<void>;
  handleOpenDiff: (toolRunId: string) => Promise<void>;
};
