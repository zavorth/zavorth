"use client";

import type { Dispatch, SetStateAction } from "react";

export type ControlStateResponse = {
  ok?: boolean;
  snapshot?: Record<string, any> | null;
  agentRuntime?: Record<string, any> | null;
  session?: Record<string, any> | null;
  sessions?: Record<string, any> | null;
  sessionsSummary?: Record<string, any> | null;
  gatewaySessionTools?: Record<string, any> | null;
  gateway?: Record<string, any> | null;
  productMode?: Record<string, any> | null;
  modeEscalation?: Record<string, any> | null;
  uiSurfaceHints?: Record<string, any> | null;
  memoryRecall?: Record<string, any> | null;
  approvalPlane?: Record<string, any> | null;
  capabilityPlane?: Record<string, any> | null;
  artifactPlane?: Record<string, any> | null;
  selfmodPlane?: Record<string, any> | null;
  resourcePlane?: Record<string, any> | null;
  companionPlane?: Record<string, any> | null;
  controlPlane?: Record<string, any> | null;
  sessionPlane?: Record<string, any> | null;
  runtimeApiV1?: Record<string, any> | null;
  runtimeWarnings?: string[];
  actionRecommendations?: Record<string, any>[];
  send?: Record<string, any> | null;
  error?: string;
};

export type GatewayRuntimeResponse = {
  ok?: boolean;
  runtime?: Record<string, any> | null;
};

export type GatewayControlResponse = {
  ok?: boolean;
  contractVersion?: string;
  generatedAt?: string;
  resource?: string;
  boundary?: Record<string, any> | null;
  health?: Record<string, any> | null;
  providers?: Record<string, any> | null;
  models?: Record<string, any> | null;
  modelPicker?: Record<string, any> | null;
  profiles?: Record<string, any>[];
  combos?: Record<string, any> | null;
  cache?: Record<string, any> | null;
  rateLimits?: Record<string, any> | null;
  operations?: Record<string, any>[];
  warnings?: string[];
  error?: string;
};

export type DeveloperWorkspaceResponse = {
  ok?: boolean;
  contractVersion?: string;
  generatedAt?: string;
  manifestPath?: string | null;
  projectRoot?: string | null;
  project?: Record<string, any> | null;
  policy?: Record<string, any> | null;
  summary?: Record<string, any> | null;
  processes?: Record<string, any>[];
  hooks?: Record<string, any>[];
  agents?: Record<string, any>[];
  ptyProfiles?: Record<string, any>[];
  logWatch?: Record<string, any> | null;
  operations?: Record<string, any>[];
  warnings?: string[];
  error?: string | null;
};

export type ExperienceSnapshotResponse = Record<string, any> & {
  contractVersion?: "ExperienceSnapshot/v1";
  generatedAt?: string;
  agent?: Record<string, any> | null;
  journey?: Record<string, any> | null;
  chat?: Record<string, any> | null;
  approvals?: Record<string, any>[];
  timeline?: Record<string, any>[];
  receipts?: Record<string, any>[];
  memory?: Record<string, any> | null;
  learning?: Record<string, any> | null;
  trust?: Record<string, any> | null;
  nextActions?: Record<string, any>[];
  health?: Record<string, any> | null;
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
  patches: Array<Record<string, any>>;
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
  runtime: Record<string, any> | null;
  gatewayControl: GatewayControlResponse | null;
  gatewayControlError: string | null;
  experience: ExperienceSnapshotResponse | null;
  experienceError: string | null;
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
  sessionEntries: Record<string, any>[];
  transcriptEntries: Record<string, any>[];
  taskEntries: Record<string, any>[];
  toolRuns: Record<string, any>[];
  artifacts: Record<string, any>[];
  approvals: Record<string, any>[];
  capabilities: Record<string, any>[];
  companions: Record<string, any>[];
  topConsumers: Record<string, any>[];
  uiSurfaceHints: Record<string, any> | null;
  memoryRecall: Record<string, any> | null;
  memoryRecallSources: Record<string, any>[];
  recommendedJourneys: Record<string, any>[];
  visibleSurfaces: Record<string, any>[];
  runtimeWarnings: string[];
  recommendations: Record<string, any>[];
  runtimeApiV1: Record<string, any> | null;
  receiptCards: Record<string, any>[];
  providerRows: Record<string, any>[];
  channelRows: Record<string, any>[];
  missionRows: Record<string, any>[];
  effectiveSessionId: string | null;
  escalationRequest: Record<string, any> | null;
  productModeId: string;
  productModeLabel: string;
  runtimeStatus: string;
  timelineItems: TimelineItem[];
  loadControlState: (preferredSessionId?: string | null) => Promise<void>;
  reloadGatewayControl: () => Promise<GatewayControlResponse | null>;
  reloadExperience: () => Promise<ExperienceSnapshotResponse | null>;
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
