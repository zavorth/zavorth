import {
  buildDashboardCommandCenterViewModel,
  type DashboardCommandCenterAdapterInput,
} from "../adapters/dashboardCommandCenterAdapter";
import type { DashboardCommandCenterViewModel } from "../contracts";

export const DASHBOARD_COMMAND_CENTER_FIXTURE_IDS = [
  "safe-run",
  "awaiting-approval",
  "remote-mesh-mcp-approval",
  "failed-run",
  "artifact-ready",
  "replay-available",
  "policy-blocked",
  "budget-exceeded",
  "auto-subagents",
  "first-run-pending",
  "doctor-degraded",
  "release-preview-ready",
] as const;

export type DashboardCommandCenterFixtureId = typeof DASHBOARD_COMMAND_CENTER_FIXTURE_IDS[number];

export type DashboardCommandCenterFixture = {
  id: DashboardCommandCenterFixtureId;
  label: string;
  description: string;
  input: DashboardCommandCenterAdapterInput;
};

const BASE_INPUT: DashboardCommandCenterAdapterInput = {
  adapterSource: {
    kind: "universal-agent-runtime",
    label: "Zavorth Agent Gateway",
    version: "fixture-v1",
  },
  state: {
    operator: {
      label: "Grey",
    },
  },
  runtime: {
    status: "ready",
    provider: "OpenAI",
    model: "gpt-5.2",
  },
  runtimeStatus: "ready",
  wsStatus: "connected",
  productModeLabel: "agent",
  effectiveSessionId: "session-command-center",
  replyPorts: [
    {
      id: "web:control",
      label: "Command Center",
      kind: "web",
      status: "available",
      primary: true,
    },
    {
      id: "cli:local",
      label: "Terminal",
      kind: "cli",
      status: "available",
    },
  ],
  modelProfile: {
    providerLabel: "OpenAI",
    modelLabel: "gpt-5.2",
    routingPolicy: "gateway",
    supportsTools: true,
    supportsStreaming: true,
  },
  providerCockpit: {
    contractVersion: "2026-05-13.phase-6",
    schemaVersion: 1,
    surface: "command-center-provider-cockpit",
    generatedAt: "2026-05-13T20:00:00.000Z",
    status: "ready",
    sourceMatrixContractVersion: "2026-05-13.phase-5",
    visualMutationApplied: false,
    executionAuthority: false,
    selectedProviderId: "openai",
    summary: {
      totalProviders: 6,
      readyProviders: 4,
      livePassed: 1,
      liveFailed: 0,
      liveBlocked: 1,
      missingAuth: 1,
      missingBaseUrl: 0,
      needsProbe: 3,
    },
    cards: [
      {
        id: "provider-cockpit-openai",
        providerId: "openai",
        title: "OpenAI",
        status: "ready",
        liveStatus: "passed",
        priority: "primary",
        model: "gpt-5.2",
        summary: "Provider principal com evidencia live sanitizada.",
        evidence: {
          liveNetworkUsed: true,
          target: "https://api.openai.com/v1/models",
          httpStatus: 200,
          durationMs: 318,
          modelCount: 117,
          evidenceHash: "sha256:fixture-provider-openai",
        },
        actions: [
          {
            id: "provider-openai-read",
            label: "Ver matriz",
            command: "zavorth providers cockpit --provider openai",
            kind: "read",
            providerId: "openai",
            risk: "read",
            requiresApproval: false,
            dashboardCanExecute: false,
            summary: "Leitura da matriz de provider.",
          },
          {
            id: "provider-openai-live",
            label: "Preparar probe",
            command: "zavorth providers live --provider openai",
            kind: "live_probe",
            providerId: "openai",
            risk: "sensitive",
            requiresApproval: true,
            dashboardCanExecute: false,
            summary: "Probe live exige acao explicita do operador.",
          },
        ],
      },
      {
        id: "provider-cockpit-ollama",
        providerId: "ollama",
        title: "Ollama",
        status: "needs_probe",
        liveStatus: "not_run",
        priority: "normal",
        model: "local",
        summary: "Endpoint local precisa de probe neste host.",
        evidence: {
          liveNetworkUsed: false,
          target: "http://127.0.0.1:11434/api/tags",
          httpStatus: null,
          durationMs: null,
          modelCount: null,
          evidenceHash: null,
        },
        actions: [
          {
            id: "provider-ollama-read",
            label: "Ver matriz",
            command: "zavorth providers cockpit --provider ollama",
            kind: "read",
            providerId: "ollama",
            risk: "read",
            requiresApproval: false,
            dashboardCanExecute: false,
            summary: "Leitura da matriz local.",
          },
        ],
      },
      {
        id: "provider-cockpit-anthropic",
        providerId: "anthropic",
        title: "Anthropic",
        status: "missing_auth",
        liveStatus: "blocked",
        priority: "blocked",
        model: "claude",
        summary: "Credencial ausente; live probe bloqueado.",
        evidence: {
          liveNetworkUsed: false,
          target: "https://api.anthropic.com/v1/models",
          httpStatus: null,
          durationMs: null,
          modelCount: null,
          evidenceHash: null,
        },
        actions: [
          {
            id: "provider-anthropic-configure",
            label: "Configurar",
            command: "zavorth providers configure anthropic",
            kind: "configure",
            providerId: "anthropic",
            risk: "sensitive",
            requiresApproval: true,
            dashboardCanExecute: false,
            summary: "Configurar SecretRef antes de usar.",
          },
        ],
      },
    ],
    actions: [
      {
        id: "provider-cockpit-read",
        label: "Ver matriz",
        command: "zavorth providers cockpit",
        kind: "read",
        providerId: null,
        risk: "read",
        requiresApproval: false,
        dashboardCanExecute: false,
        summary: "Leitura da matriz de providers.",
      },
    ],
    healthChecks: [
      {
        id: "provider-cockpit-render",
        label: "Render safety",
        status: "ready",
        detail: "Dashboard renderiza projection-only sem fetch de provider.",
      },
    ],
    receipts: [
      {
        id: "provider-cockpit-safety",
        kind: "safety",
        status: "recorded",
        providerId: null,
        detail: "Sem chaves brutas na projection.",
        evidenceHash: null,
      },
    ],
    commandCenterProjection: {
      route: "/control",
      endpoint: "/api/providers/readiness",
      renderMode: "projection-only",
      visualApprovalRequired: false,
      canRenderCardsAfterApproval: true,
    },
    safety: {
      noRawProviderSecrets: true,
      normalRenderMakesNoNetworkCalls: true,
      liveProbeRequiresExplicitOperatorAction: true,
      commandCenterCannotExecuteProviderCalls: true,
    },
    nextAction: "Use a matriz live para escolher ou testar um provider.",
  },
  healthChecks: [
    {
      id: "gateway",
      label: "Gateway",
      status: "ready",
      detail: "Gateway aceitando eventos do Command Center.",
    },
  ],
  releaseStatus: {
    status: "stable",
    channel: "stable",
    version: "local",
    rollbackAvailable: false,
    summary: "Canal local estavel para desenvolvimento.",
  },
  integrations: [
    {
      id: "provider-openai",
      label: "OpenAI",
      category: "provider",
      status: "connected",
      detail: "Provider atual respondendo pelo gateway.",
    },
    {
      id: "command-center",
      label: "Command Center",
      category: "channel",
      status: "connected",
      detail: "Surface web oficial conectada.",
    },
  ],
  identity: {
    agentName: "Zavorth",
    userName: "Grey",
    language: "en-US",
    tone: "claro, direto e poderoso",
    initiative: "balanced",
    firstRunStatus: "complete",
  },
};

function cloneInput(input: DashboardCommandCenterAdapterInput): DashboardCommandCenterAdapterInput {
  return JSON.parse(JSON.stringify(input));
}

function withBase(input: DashboardCommandCenterAdapterInput): DashboardCommandCenterAdapterInput {
  return {
    ...BASE_INPUT,
    ...input,
    state: {
      ...(BASE_INPUT.state || {}),
      ...(input.state || {}),
    },
    runtime: {
      ...(BASE_INPUT.runtime || {}),
      ...(input.runtime || {}),
    },
    modelProfile: input.modelProfile || BASE_INPUT.modelProfile,
    replyPorts: input.replyPorts || BASE_INPUT.replyPorts,
    healthChecks: input.healthChecks || BASE_INPUT.healthChecks,
    releaseStatus: input.releaseStatus || BASE_INPUT.releaseStatus,
    integrations: input.integrations || BASE_INPUT.integrations,
    identity: {
      ...(BASE_INPUT.identity || {}),
      ...(input.identity || {}),
    },
  };
}

export const DASHBOARD_COMMAND_CENTER_FIXTURES: Record<DashboardCommandCenterFixtureId, DashboardCommandCenterFixture> = {
  "safe-run": {
    id: "safe-run",
    label: "Run seguro",
    description: "Uma execucao comum, sem approval, com ferramenta segura e resposta final.",
    input: withBase({
      effectiveSessionId: "session-safe-run",
      agentRun: {
        runId: "run-safe-001",
        traceId: "trace-safe-001",
        status: "completed",
        goal: "Revisar o README e resumir o estado atual",
        sessionId: "session-safe-run",
        summary: "Resumo preparado sem tocar ferramentas sensiveis.",
        startedAt: "2026-04-26T12:00:00.000Z",
        updatedAt: "2026-04-26T12:02:00.000Z",
        events: [
          {
            id: "safe-event-read",
            kind: "tool",
            title: "read_file",
            detail: "README.md consultado em modo leitura.",
            status: "done",
          },
        ],
      },
      traceEvents: [
        {
          id: "safe-trace-thinking",
          kind: "thinking.summary",
          title: "Thought for 1s",
          summary: "Identifiquei que o pedido e leitura segura e nao precisa de approval.",
          status: "done",
          chipLabel: "thinking",
        },
        {
          id: "safe-trace-skill",
          kind: "skill.selected",
          title: "Selected skill",
          summary: "Usei o perfil de workspace-read para consultar contexto sem mutacao.",
          status: "done",
          skillName: "workspace-read",
          capability: {
            id: "workspace-read",
            label: "workspace-read",
            kind: "skill",
            risk: "safe",
            requiresApproval: false,
            previewRequired: false,
            allowed: true,
            sideEffect: "read",
            reason: "Selecionado para consultar contexto de workspace sem mutacao.",
            scope: "workspace",
          },
        },
        {
          id: "safe-trace-file",
          kind: "file.explored",
          title: "Explored file",
          summary: "README.md foi consultado em modo leitura.",
          status: "done",
          target: "README.md",
          chipLabel: "read_file",
          capability: {
            id: "read_file",
            label: "read_file",
            kind: "file",
            risk: "safe",
            requiresApproval: false,
            previewRequired: false,
            allowed: true,
            sideEffect: "read",
            reason: "Leitura permitida pelo perfil seguro de workspace.",
            scope: "README.md",
          },
        },
        {
          id: "safe-trace-receipt",
          kind: "receipt.recorded",
          title: "Recorded receipt",
          summary: "A leitura ficou registrada na timeline do run.",
          status: "done",
          chipLabel: "receipt",
        },
      ],
      transcriptEntries: [
        {
          id: "safe-user",
          role: "user",
          text: "Revise o README e me diga o estado atual.",
          createdAt: "2026-04-26T12:00:00.000Z",
        },
        {
          id: "safe-assistant",
          role: "assistant",
          text: "O README esta alinhado com a entrada Command Center e a jornada inicial.",
          createdAt: "2026-04-26T12:02:00.000Z",
          modelLabel: "gpt-5.2",
          trace: [
            {
              id: "safe-message-trace",
              kind: "thinking.summary",
              title: "Thought summary",
              summary: "Resumo final preparado a partir de leitura segura do workspace.",
              status: "done",
              chipLabel: "summary",
              capability: {
                id: "read_file",
                label: "read_file",
                kind: "file",
                risk: "safe",
                requiresApproval: false,
                previewRequired: false,
                allowed: true,
                sideEffect: "read",
                reason: "A resposta usa somente o resultado de leitura ja governada.",
                scope: "README.md",
              },
            },
          ],
        },
      ],
      sessionEntries: [
        {
          sessionId: "session-safe-run",
          title: "Revisao do README",
          status: "active",
          channel: "web",
          messageCount: 2,
          updatedAt: "2026-04-26T12:02:00.000Z",
        },
      ],
      toolExposureProfile: {
        mode: "safe",
        summary: "Somente leitura de workspace.",
        tools: [
          {
            id: "read_file",
            label: "Ler arquivo",
            risk: "safe",
            requiresApproval: false,
          },
        ],
      },
      budget: {
        status: "ok",
        tokensUsed: 820,
        tokenBudget: 4000,
        estimatedCost: 0.04,
        currency: "USD",
        summary: "Uso baixo para a sessao.",
      },
    }),
  },
  "awaiting-approval": {
    id: "awaiting-approval",
    label: "Approval pendente",
    description: "Um pedido sensivel parado antes de shell/escrita.",
    input: withBase({
      runtimeStatus: "degraded",
      effectiveSessionId: "session-approval",
      agentRun: {
        runId: "run-approval-001",
        status: "waiting_approval",
        goal: "Corrigir o arquivo e rodar testes",
        sessionId: "session-approval",
        summary: "Aguardando confirmacao antes de alterar arquivos.",
        updatedAt: "2026-04-26T12:10:00.000Z",
        events: [
          {
            id: "approval-event",
            kind: "approval",
            title: "Approval gate",
            detail: "write_file e shell.exec exigem confirmacao.",
            status: "pending",
          },
        ],
      },
      approvals: [
        {
          id: "approval-write-001",
          runId: "run-approval-001",
          title: "Permitir escrita e teste local",
          reason: "O pedido precisa editar arquivo e executar teste.",
          risk: "danger",
          status: "pending",
          command: "approve approval-write-001",
          scope: "workspace",
          createdAt: "2026-04-26T12:10:00.000Z",
        },
      ],
      traceEvents: [
        {
          id: "approval-trace-skill",
          kind: "skill.selected",
          title: "Selected skill",
          summary: "O runtime escolheu workspace-edit porque o pedido exige alteracao controlada.",
          status: "done",
          skillName: "workspace-edit",
          capability: {
            id: "workspace-edit",
            label: "workspace-edit",
            kind: "skill",
            risk: "attention",
            requiresApproval: true,
            previewRequired: true,
            allowed: false,
            sideEffect: "write",
            reason: "Selecionado para preparar uma edicao, mas ainda depende de approval.",
            scope: "workspace",
          },
        },
        {
          id: "approval-trace-tool",
          kind: "tool.awaiting_approval",
          title: "Waiting for approval",
          summary: "apply_patch esta preparado, mas nao executa antes de preview e confirmacao.",
          status: "pending",
          chipLabel: "apply_patch",
          target: "src/runtime/parser.ts",
          capability: {
            id: "apply_patch",
            label: "apply_patch",
            kind: "tool",
            risk: "attention",
            requiresApproval: true,
            previewRequired: true,
            allowed: false,
            sideEffect: "write",
            reason: "O patch altera arquivo do workspace e precisa de confirmacao.",
            scope: "src/runtime/parser.ts",
          },
        },
      ],
      toolExposureProfile: {
        mode: "restricted",
        summary: "Ferramentas sensiveis bloqueadas ate approval.",
        tools: [
          {
            id: "write_file",
            label: "Editar arquivo",
            risk: "danger",
            requiresApproval: true,
          },
          {
            id: "shell.exec",
            label: "Executar shell",
            risk: "danger",
            requiresApproval: true,
          },
        ],
      },
    }),
  },
  "remote-mesh-mcp-approval": {
    id: "remote-mesh-mcp-approval",
    label: "Remote Mesh MCP",
    description: "Approval real do notebook MCP pronto para o botao do Command Center.",
    input: withBase({
      runtimeStatus: "degraded",
      effectiveSessionId: "session-remote-mesh-mcp",
      agentRun: {
        runId: "run-remote-mesh-mcp-001",
        status: "waiting_approval",
        goal: "Reiniciar container allowlisted no notebook",
        sessionId: "session-remote-mesh-mcp",
        summary: "Remote Mesh gerou um preview governado e aguarda apply via proxy MCP server-side.",
        updatedAt: "2026-05-06T12:00:00.000Z",
        events: [
          {
            id: "remote-mesh-preview-event",
            kind: "approval",
            title: "Notebook MCP preview",
            detail: "Docker control preview aguardando apply single-use.",
            status: "pending",
          },
        ],
        traceEvents: [
          {
            id: "remote-mesh-trace-logs",
            kind: "tool.executed",
            title: "Ran tool",
            summary: "notebook.docker.logs consultou logs allowlisted sem controlar o container.",
            status: "done",
            chipLabel: "notebook.docker.logs",
            target: "zavorth-demo",
            capability: {
              id: "notebook.docker.logs",
              label: "notebook.docker.logs",
              kind: "docker",
              risk: "safe",
              requiresApproval: false,
              previewRequired: false,
              allowed: true,
              sideEffect: "read",
              reason: "Leitura de logs de container allowlisted no notebook.",
              scope: "container:zavorth-demo",
            },
          },
          {
            id: "remote-mesh-trace-apply",
            kind: "tool.awaiting_approval",
            title: "Waiting for approval",
            summary: "notebook.docker.apply_control aguarda approval single-use antes de reiniciar o container.",
            status: "pending",
            chipLabel: "notebook.docker.apply_control",
            target: "zavorth-demo",
            capability: {
              id: "notebook.docker.apply_control",
              label: "notebook.docker.apply_control",
              kind: "docker",
              risk: "danger",
              requiresApproval: true,
              previewRequired: true,
              allowed: false,
              sideEffect: "container",
              reason: "Controle de lifecycle de container remoto so pode aplicar depois do preview MCP.",
              scope: "container:zavorth-demo",
            },
          },
        ],
        metadata: {
          remoteMeshApprovalUx: {
            generatedAt: "2026-05-06T12:00:00.000Z",
            contractVersion: "2026-05-05.remote-mesh-r11-mobile-command-center-approval-ux",
            phase: "R11",
            status: "ready",
            summary: {
              cards: 1,
              approvalCards: 1,
              receiptCards: 0,
              mobileReady: true,
              commandCenterReady: true,
              rawJsonRequiredFromUser: false,
              rawCommandSerialized: false,
              secretValuesSerialized: false,
            },
            cards: [
              {
                generatedAt: "2026-05-06T12:00:00.000Z",
                contractVersion: "2026-05-05.remote-mesh-r11-mobile-command-center-approval-ux",
                phase: "R11",
                surface: "command-center",
                state: "approval-required",
                sourceToolName: "notebook.docker.preview_control",
                title: "Approve Docker restart",
                body: "Restart allowlisted Docker container zavorth-demo through the notebook MCP proxy.",
                targetKind: "docker-container",
                targetLabel: "zavorth-demo",
                riskLabel: "medium",
                approval: {
                  approvalId: "zavorth-demo-remote-mesh-approval",
                  approvalPhrase: "APPROVE DOCKER RESTART zavorth-demo",
                  expiresAt: "2026-05-06T12:10:00.000Z",
                  exactPhraseRequired: true,
                  applyToolName: "notebook.docker.apply_control",
                  applyArguments: {
                    approvalId: "zavorth-demo-remote-mesh-approval",
                    approvalPhrase: "APPROVE DOCKER RESTART zavorth-demo",
                  },
                  rawJsonRequiredFromUser: false,
                },
                receipt: null,
                commandCenter: {
                  queue: "approvals",
                  badge: "Needs approval",
                  primaryActionLabel: "Aplicar no MCP",
                  secondaryActionLabel: "Rejeitar",
                  timelineLabel: "Docker lifecycle approval",
                },
                mobile: {
                  title: "Approve Docker restart",
                  body: "zavorth-demo no notebook",
                  primaryActionLabel: "Aplicar",
                  secondaryActionLabel: "Recusar",
                },
                safety: {
                  previewBeforeApply: true,
                  singleUseApproval: true,
                  exactPhraseRequired: true,
                  noRawShell: true,
                  noRawJsonCopyRequired: true,
                  noRawCommandSerialized: true,
                  noSecretSerialized: true,
                  noFilesystemMutation: true,
                  noProjectFileWrite: true,
                  noDockerRawControl: true,
                },
              },
            ],
            fixtures: {
              dockerPreview: true,
              dockerReceipt: false,
              projectFilePreview: false,
              projectFileReceipt: false,
            },
            commands: {
              previewRequiredBeforeApply: true,
              commandCenterProxyPath: "/api/web/remote-mesh/notebook/mcp",
              browserReceivesToken: false,
            },
          },
        },
      },
      approvals: [
        {
          id: "remote-mesh-mcp-approval-card",
          runId: "run-remote-mesh-mcp-001",
          title: "Aplicar approval MCP do notebook",
          reason: "O preview ja foi gerado; o apply vai pelo proxy server-side e nao expoe token no navegador.",
          risk: "attention",
          status: "pending",
          command: "remote-mesh apply zavorth-demo-remote-mesh-approval",
          scope: "notebook-mcp",
          createdAt: "2026-05-06T12:00:00.000Z",
        },
      ],
      integrations: [
        ...(BASE_INPUT.integrations || []),
        {
          id: "remote-mesh-notebook-mcp",
          label: "Notebook MCP",
          category: "mcp",
          status: "connected",
          detail: "Proxy server-side configurado para endpoint local/tailnet.",
        },
      ],
      toolExposureProfile: {
        mode: "restricted",
        summary: "Remote Mesh expoe apenas apply allowlisted depois de preview.",
        tools: [
          {
            id: "notebook.docker.apply_control",
            label: "Apply Docker control",
            risk: "danger",
            requiresApproval: true,
          },
        ],
      },
    }),
  },
  "failed-run": {
    id: "failed-run",
    label: "Run com erro",
    description: "Uma execucao falhou e o painel precisa mostrar erro, health e log.",
    input: withBase({
      runtimeStatus: "blocked",
      error: "Executor local retornou falha durante a validacao.",
      effectiveSessionId: "session-failed",
      agentRun: {
        runId: "run-failed-001",
        status: "failed",
        goal: "Gerar relatorio da pasta",
        sessionId: "session-failed",
        summary: "Falha ao preparar o relatorio.",
        updatedAt: "2026-04-26T12:20:00.000Z",
        events: [
          {
            id: "failed-event",
            kind: "error",
            title: "Relatorio falhou",
            detail: "O renderer retornou erro antes de produzir artifact.",
            status: "failed",
          },
        ],
      },
      healthChecks: [
        {
          id: "renderer",
          label: "Renderer de artifacts",
          status: "blocked",
          detail: "Falha ao renderizar saida.",
          actionId: "runtime.doctor",
        },
      ],
      logs: [
        {
          id: "log-failed-renderer",
          level: "error",
          source: "artifact-renderer",
          message: "Renderer retornou codigo de erro.",
          createdAt: "2026-04-26T12:20:00.000Z",
          runId: "run-failed-001",
        },
      ],
    }),
  },
  "artifact-ready": {
    id: "artifact-ready",
    label: "Run com artifact",
    description: "Uma entrega real pronta para aparecer no painel lateral.",
    input: withBase({
      effectiveSessionId: "session-artifact",
      agentRun: {
        runId: "run-artifact-001",
        status: "completed",
        goal: "Comparar mudancas do workspace",
        sessionId: "session-artifact",
        summary: "Diff e plano de revisao prontos.",
        updatedAt: "2026-04-26T12:30:00.000Z",
      },
      artifacts: [
        {
          id: "artifact-diff-001",
          title: "Diff consolidado",
          kind: "diff",
          status: "ready",
          createdAt: "2026-04-26T12:30:00.000Z",
          sessionId: "session-artifact",
        },
        {
          id: "artifact-plan-001",
          title: "Plano de revisao",
          kind: "plan",
          status: "ready",
          createdAt: "2026-04-26T12:29:00.000Z",
          sessionId: "session-artifact",
        },
      ],
      toolRuns: [
        {
          id: "tool-workspace-diff",
          name: "workspace_diff",
          status: "done",
          summary: "Mudancas comparadas com sucesso.",
        },
      ],
    }),
  },
  "replay-available": {
    id: "replay-available",
    label: "Run com replay",
    description: "Uma execucao com timeline suficiente para replay/handoff.",
    input: withBase({
      effectiveSessionId: "session-replay",
      agentRun: {
        runId: "run-replay-001",
        status: "completed",
        goal: "Montar handoff do trabalho",
        sessionId: "session-replay",
        summary: "Replay e handoff disponiveis.",
        updatedAt: "2026-04-26T12:40:00.000Z",
        events: [
          {
            id: "replay-event-plan",
            kind: "thinking",
            title: "Plano criado",
            status: "done",
          },
          {
            id: "replay-event-artifact",
            kind: "artifact",
            title: "Handoff salvo",
            status: "done",
          },
        ],
      },
      replay: {
        id: "replay-run-001",
        runId: "run-replay-001",
        title: "Replay do handoff",
        status: "available",
        eventCount: 7,
        artifactCount: 1,
        updatedAt: "2026-04-26T12:40:00.000Z",
        summary: "Timeline pronta para revisitar a execucao.",
      },
      artifacts: [
        {
          id: "artifact-handoff-001",
          title: "Handoff da sessao",
          kind: "handoff",
          status: "ready",
          createdAt: "2026-04-26T12:40:00.000Z",
          sessionId: "session-replay",
        },
      ],
    }),
  },
  "policy-blocked": {
    id: "policy-blocked",
    label: "Run bloqueado por policy",
    description: "Uma policy bloqueou uma acao antes de abrir executor.",
    input: withBase({
      runtimeStatus: "blocked",
      runtimeWarnings: [
        "Policy bloqueou rede externa para este workspace.",
      ],
      effectiveSessionId: "session-policy",
      agentRun: {
        runId: "run-policy-001",
        status: "failed",
        goal: "Pesquisar fontes externas",
        sessionId: "session-policy",
        summary: "Execucao bloqueada pela policy de rede.",
        updatedAt: "2026-04-26T12:50:00.000Z",
        events: [
          {
            id: "policy-event",
            kind: "status",
            title: "Policy aplicada",
            detail: "Rede externa exige allowlist antes da pesquisa.",
            status: "failed",
          },
        ],
      },
      healthChecks: [
        {
          id: "network-policy",
          label: "Policy de rede",
          status: "blocked",
          detail: "Rede externa bloqueada neste contexto.",
          actionId: "settings.open",
        },
      ],
      toolExposureProfile: {
        mode: "restricted",
        summary: "Pesquisa externa bloqueada por policy.",
        tools: [
          {
            id: "web.search",
            label: "Pesquisar web",
            risk: "danger",
            requiresApproval: true,
          },
        ],
      },
    }),
  },
  "budget-exceeded": {
    id: "budget-exceeded",
    label: "Budget excedido",
    description: "Uma execucao estourou tokens/custo e precisa pausar.",
    input: withBase({
      runtimeStatus: "degraded",
      runtimeWarnings: [
        "Budget da execucao foi excedido.",
      ],
      effectiveSessionId: "session-budget",
      agentRun: {
        runId: "run-budget-001",
        status: "queued",
        goal: "Auditar todo o monorepo",
        sessionId: "session-budget",
        summary: "Pausado ate novo budget ser liberado.",
        updatedAt: "2026-04-26T13:00:00.000Z",
      },
      budget: {
        status: "exceeded",
        tokenBudget: 10000,
        tokensUsed: 14200,
        spent: 1.48,
        currency: "USD",
        summary: "Budget excedido; precisa reduzir escopo ou autorizar continuidade.",
      },
      logs: [
        {
          id: "log-budget",
          level: "warn",
          source: "budget-gate",
          message: "Execucao pausada por budget excedido.",
          createdAt: "2026-04-26T13:00:00.000Z",
          runId: "run-budget-001",
        },
      ],
    }),
  },
  "auto-subagents": {
    id: "auto-subagents",
    label: "Auto subagents",
    description: "Decisao automatica de subagentes com roles, gatilhos, policy e proximo passo visiveis.",
    input: withBase({
      effectiveSessionId: "session-auto-subagents",
      agentRun: {
        runId: "run-auto-subagents-001",
        traceId: "trace-auto-subagents-001",
        status: "completed",
        goal: "Auditar uma biblioteca grande e sintetizar riscos",
        sessionId: "session-auto-subagents",
        summary: "Subagentes governados revisaram o escopo em modo read-only.",
        startedAt: "2026-05-10T18:00:00.000Z",
        updatedAt: "2026-05-10T18:02:00.000Z",
        events: [
          {
            id: "auto-subagents-event",
            kind: "subagent",
            title: "subagents.spawn",
            detail: "Workers auditor e researcher executados sem mutacao.",
            status: "done",
          },
        ],
      },
      subagentAutoInvocation: {
        contractVersion: "2026-05-10.subagent-auto-invocation",
        generatedAt: "2026-05-10T18:00:00.000Z",
        status: "auto-selected",
        selectedBy: "implicit-complexity",
        action: "invoke_live_subagents",
        mode: "oneshot",
        channel: "web",
        confidence: 0.91,
        live: true,
        roles: [
          {
            roleId: "researcher",
            label: "Researcher",
            whySelected: "Mapeia escopo e evidencias sem escrever no workspace.",
          },
          {
            roleId: "auditor",
            label: "Auditor",
            whySelected: "Revisa risco, policy e sinais de prompt injection.",
          },
        ],
        triggers: ["complex-task", "read-only", "large-scope"],
        riskSignals: ["workspace-mutation-blocked"],
        publicRationale: "Pedido amplo e seguro para leitura; subagentes ajudam sem exigir approval extra.",
        nextSafeAction: "Revisar sintese, receipts e pedir approval apenas se houver mutacao.",
        safety: {
          noRawChainOfThought: true,
          noSecretValuesSerialized: true,
          readOnlyOnly: true,
          approvalsRequiredForMutation: true,
        },
      },
      traceEvents: [
        {
          id: "auto-subagents-trace",
          kind: "subagent.spawned",
          title: "Auto subagents",
          summary: "Decisao automatica registrada com roles e policy read-only.",
          status: "done",
          chipLabel: "subagents",
        },
      ],
    }),
  },
  "first-run-pending": {
    id: "first-run-pending",
    label: "First-run pendente",
    description: "Estado antes da personalizacao inicial terminar.",
    input: withBase({
      runtimeStatus: "degraded",
      runtimeWarnings: [
        "Primeiro uso ainda precisa ser concluido.",
      ],
      effectiveSessionId: null,
      identity: {
        userName: "Operador",
        tone: "a definir",
        initiative: "unknown",
        firstRunStatus: "pending",
        summary: "Falta nome, tom e preferencias iniciais.",
      },
      transcriptEntries: [],
      sessionEntries: [],
    }),
  },
  "doctor-degraded": {
    id: "doctor-degraded",
    label: "Doctor degradado",
    description: "Health parcial com proximo passo visivel.",
    input: withBase({
      runtimeStatus: "degraded",
      runtimeWarnings: [
        "Provider principal indisponivel; fallback local ativo.",
      ],
      health: {
        status: "degraded",
        summary: "Runtime operando com fallback.",
      },
      healthChecks: [
        {
          id: "provider-primary",
          label: "Provider principal",
          status: "degraded",
          detail: "Provider principal nao respondeu no ultimo probe.",
          actionId: "runtime.doctor",
        },
        {
          id: "fallback-model",
          label: "Modelo fallback",
          status: "ready",
          detail: "Fallback local pronto.",
        },
      ],
      integrations: [
        {
          id: "provider-primary",
          label: "Provider principal",
          category: "provider",
          status: "degraded",
          detail: "Probe recente falhou.",
        },
        {
          id: "fallback-local",
          label: "Fallback local",
          category: "provider",
          status: "connected",
          detail: "Disponivel para pedidos simples.",
        },
      ],
    }),
  },
  "release-preview-ready": {
    id: "release-preview-ready",
    label: "Release preview pronto",
    description: "Estado de release pronto para o painel mostrar canal, versao e rollback.",
    input: withBase({
      releaseStatus: {
        status: "preview_ready",
        channel: "preview",
        version: "2026.04.26-preview",
        rollbackAvailable: true,
        updatedAt: "2026-04-26T13:10:00.000Z",
        summary: "Preview local pronto; rollback disponivel antes de promover.",
      },
      logs: [
        {
          id: "log-release-preview",
          level: "info",
          source: "release",
          message: "Preview de release montado com rollback disponivel.",
          createdAt: "2026-04-26T13:10:00.000Z",
        },
      ],
    }),
  },
};

export function getDashboardCommandCenterFixture(
  id: DashboardCommandCenterFixtureId,
): DashboardCommandCenterFixture {
  const fixture = DASHBOARD_COMMAND_CENTER_FIXTURES[id];
  return {
    ...fixture,
    input: cloneInput(fixture.input),
  };
}

export function listDashboardCommandCenterFixtures(): DashboardCommandCenterFixture[] {
  return DASHBOARD_COMMAND_CENTER_FIXTURE_IDS.map(getDashboardCommandCenterFixture);
}

export function buildDashboardCommandCenterFixture(
  id: DashboardCommandCenterFixtureId,
): DashboardCommandCenterViewModel {
  return buildDashboardCommandCenterViewModel(getDashboardCommandCenterFixture(id).input);
}
