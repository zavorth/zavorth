import { getExperienceCoreService } from "../../experience/experienceRouteSupport";

export function nowIso() {
  return new Date().toISOString();
}

export function buildControlSessionState(sessionId = "main") {
  const generatedAt = nowIso();
  const home = getExperienceCoreService().buildHome({
    surface: "zavorthControl",
    sessionId,
    generatedAt: new Date(generatedAt),
  });
  return {
    ok: true,
    snapshot: {
      sessionId,
      messages: home.messages ?? [],
      tasks: [
        {
          id: "task-first-run",
          title: "First run",
          status: "ready",
          summary: "Chat, approvals, providers, channels and receipts are available from this surface.",
          createdAt: generatedAt,
        },
      ],
      toolRuns: [],
    },
    session: {
      sessionId,
      label: "main",
      status: "ready",
      updatedAt: generatedAt,
    },
    sessions: {
      sessions: [
        {
          id: sessionId,
          sessionId,
          label: "main",
          status: "ready",
          updatedAt: generatedAt,
        },
      ],
    },
    gateway: {
      status: "ready",
      transport: "next-local",
    },
    productMode: {
      id: "chat",
      label: "chat",
    },
    approvalPlane: {
      pending: [],
      recent: [],
    },
    capabilityPlane: {
      capabilities: [
        {
          id: "chat",
          label: "Chat",
          status: "ready",
        },
        {
          id: "approvals",
          label: "Approvals",
          status: "ready",
        },
        {
          id: "receipts",
          label: "Receipts",
          status: "ready",
        },
      ],
    },
    artifactPlane: {
      artifacts: [],
      toolRuns: [],
    },
    resourcePlane: {
      status: "normal",
      generatedAt,
      topConsumers: [],
      warnings: [],
      recommendations: [],
    },
    companionPlane: {
      companions: [],
    },
    uiSurfaceHints: {
      journeys: [
        {
          id: "review-workspace",
          label: "Review workspace",
          recommended: true,
        },
        {
          id: "connect-channel",
          label: "Connect channel",
          recommended: true,
        },
      ],
      surfaces: [
        {
          id: "zavorth-control",
          label: "Zavorth Control",
          visible: true,
        },
        {
          id: "cli",
          label: "Terminal",
          visible: true,
        },
      ],
    },
    memoryRecall: {
      sources: [],
    },
    runtimeWarnings: [],
    actionRecommendations: [
      {
        id: "ask",
        label: "Ask Zavorth",
        command: "Use the Inbox composer.",
      },
    ],
  };
}

export function buildZavorthControlRuntimeSnapshot(sessionId = "main") {
  const generatedAt = nowIso();
  return {
    generatedAt,
    status: "ready",
    surface: "zavorth-control",
    sessionId,
    contractsV1: buildZavorthControlContracts(),
    approvalsV1: {
      data: [],
    },
    receiptsV1: {
      cards: [],
    },
    providersV1: {
      providers: [],
    },
    channelsV1: {
      channels: [
        {
          id: "telegram",
          label: "Telegram",
          status: "configurable",
        },
        {
          id: "discord",
          label: "Discord",
          status: "configurable",
        },
      ],
    },
  };
}

export function buildZavorthControlContracts() {
  return {
    approvals: {
      data: [],
    },
    receipts: {
      cards: [],
    },
    providers: {
      providers: [],
    },
    channels: {
      channels: [
        {
          id: "telegram",
          label: "Telegram",
          status: "configurable",
        },
        {
          id: "discord",
          label: "Discord",
          status: "configurable",
        },
      ],
    },
    missions: {
      missions: [],
    },
  };
}

export function buildGatewayRuntime() {
  return {
    ok: true,
    runtime: {
      status: "ready",
      summary: "ready",
      gateway: {
        status: "ready",
      },
      health: {
        status: "ready",
      },
    },
  };
}

