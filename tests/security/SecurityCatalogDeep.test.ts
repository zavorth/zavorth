
import fs from 'fs';
import path from 'path';

const SECURITY_DIR = path.resolve(__dirname, '../../src/security');

function readSecurityFile(filename: string): string {
  return fs.readFileSync(path.join(SECURITY_DIR, filename), 'utf-8');
}

const SECURITY_FILES = [
  'AgentSecurityPolicyEngine.ts',
  'AgentToolSecurityCatalog.ts',
  'SafeFetchService.ts',
  'WorkspaceResolver.ts',
  'SecurityPolicyBroker.ts',
  'SecurityOperationalPreset.ts',
  'PolicyEngine.ts',
  'LlmEgressGuard.ts',
  'EffectPolicyRules.ts',
  'EffectPolicyReceiptAdapter.ts',
  'EffectPolicyKernel.ts',
  'EffectPolicyDecision.ts',
  'EffectPolicyContext.ts',
  'EgressGuard.ts',
  'UntrustedContent.ts',
  'TrustedBoundary.ts',
  'SecurityProfile.ts',
  'OperationalSecurityDoctor.ts',
  'ContinuousSecurityMonitor.ts',
  'ApprovalSigningKeyService.ts',
  'DangerousCommandBlocker.ts',
  'ChildProcessEnv.ts',
  'ToolOutputTrust.ts',
  'ToolApprovalEnvelope.ts',
  'SensitiveDataGuard.ts',
  'OperationalMode.ts',
  'AgentSecurityInventory.ts',
];

const SAFE_TOOLS = [
  'get_datetime',
  'web_search',
  'read_file',
  'list_directory',
  'workspace.read',
  'workspace.list',
  'workspace.command.propose',
  'workspace.host_command.propose',
  'workspace.task_mandate.propose',
  'plan_mnemos_scope',
  'zavorth_action',
  'kanban_board',
  'skill_feedback',
  'calendar_event',
  'code_review',
  'zavorth_session_search',
  'zavorth_receipt_search',
  'zavorth_policy_enforcer',
  'zavorth_trajectory_export',
  'zavorth_security_guidance',
  'zavorth_code_intelligence',
  'zavorth_chart_generator',
  'zavorth_file_watcher',
  'zavorth_doc_provider',
  'zavorth_prompt_library',
  'zavorth_token_budget',
  'zavorth_memory_graph',
  'zavorth_workflow_builder',
  'zavorth_agent_governance',
  'zavorth_agent_eval',
  'zavorth_searxng',
];

const REVIEW_TOOLS = [
  'create_file',
  'workspace.write',
  'workspace.edit',
  'workspace.apply_patch',
  'workspace.command.run',
  'workspace.host_command.run',
  'run_sandbox_code',
  'query_external_ai',
  'generate_image',
  'analyze_media',
  'semantic_memory',
  'enable_mnemos',
  'configure_llm_profile',
  'auto_skill_creator',
  'nodes',
  'workspace.pty.propose',
  'workspace.pty.write',
  'workspace.pty.terminate',
  'generate_video',
  'batch_trajectory',
  'terminal_backend',
  'database_query',
  'zavorth_cron_scheduler',
  'zavorth_delegate',
  'zavorth_computer_use',
  'zavorth_voice_mode',
  'zavorth_channel_send',
  'zavorth_document_extractor',
  'zavorth_tts',
  'zavorth_stt',
  'zavorth_api_client',
  'zavorth_novita',
  'zavorth_replicate',
  'zavorth_huggingface',
  'zavorth_firecrawl',
  'zavorth_fal',
  'zavorth_comfyui',
  'zavorth_runway',
  'zavorth_spotify',
  'zavorth_docker_compose',
  'zavorth_ssh_tunnel',
  'zavorth_network',
  'zavorth_webhook_receiver',
  'zavorth_mcp_marketplace',
  'zavorth_rag_builder',
  'zavorth_privacy_vault',
  'zavorth_multi_repo',
  'zavorth_sandbox_cloud',
  'zavorth_edge_computing',
];

const DANGEROUS_TOOLS = [
  'remote_shell',
  'desktop_automation',
  'echo_hands',
  'send_email',
];

const SECURITY_PROFILES = ['personal', 'professional', 'enterprise'];

const OPERATIONAL_MODES = ['READ_ONLY', 'WORKSPACE', 'BUILD', 'PRIVILEGED'];

describe('Security file catalog', () => {
  it('security directory exists', () => {
    expect(fs.existsSync(SECURITY_DIR)).toBe(true);
  });

  it(`has exactly ${SECURITY_FILES.length} security files`, () => {
    const files = fs.readdirSync(SECURITY_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBe(SECURITY_FILES.length);
  });

  SECURITY_FILES.forEach((filename) => {
    it(`security file exists: ${filename}`, () => {
      expect(fs.existsSync(path.join(SECURITY_DIR, filename))).toBe(true);
    });
  });
});

describe('AgentSecurityPolicyEngine structure', () => {
  const content = readSecurityFile('AgentSecurityPolicyEngine.ts');

  it('exports AgentSecurityPolicyEngine class', () => {
    expect(content).toMatch(/export\s+class\s+AgentSecurityPolicyEngine/);
  });

  it('exports AgentToolSecurityDefinition type', () => {
    expect(content).toMatch(/export\s+type\s+AgentToolSecurityDefinition/);
  });

  it('exports AgentToolInvocation type', () => {
    expect(content).toMatch(/export\s+type\s+AgentToolInvocation/);
  });

  it('exports AgentPolicyDecision type', () => {
    expect(content).toMatch(/export\s+type\s+AgentPolicyDecision/);
  });

  it('exports AgentToolCapability type', () => {
    expect(content).toMatch(/export\s+type\s+AgentToolCapability/);
  });

  it('exports AgentSecuritySurface type', () => {
    expect(content).toMatch(/export\s+type\s+AgentSecuritySurface/);
  });

  it('exports AgentRiskLevel type', () => {
    expect(content).toMatch(/export\s+type\s+AgentRiskLevel/);
  });

  it('exports AgentPolicyAction type', () => {
    expect(content).toMatch(/export\s+type\s+AgentPolicyAction/);
  });

  it('exports AgentInputTrust type', () => {
    expect(content).toMatch(/export\s+type\s+AgentInputTrust/);
  });

  it('exports AGENT_SECURITY_DECISION_MATRIX', () => {
    expect(content).toMatch(/export\s+const\s+AGENT_SECURITY_DECISION_MATRIX/);
  });

  it('exports normalizeAgentToolSecurityDefinition function', () => {
    expect(content).toMatch(/export\s+function\s+normalizeAgentToolSecurityDefinition/);
  });

  it('exports inferAgentToolCanExfiltrateData function', () => {
    expect(content).toMatch(/export\s+function\s+inferAgentToolCanExfiltrateData/);
  });

  it('exports inferAgentToolCanExecuteCode function', () => {
    expect(content).toMatch(/export\s+function\s+inferAgentToolCanExecuteCode/);
  });

  it('exports inferAgentToolCanMutateHost function', () => {
    expect(content).toMatch(/export\s+function\s+inferAgentToolCanMutateHost/);
  });

  it('has registerTool method', () => {
    expect(content).toMatch(/registerTool\s*\(/);
  });

  it('has getToolDefinition method', () => {
    expect(content).toMatch(/getToolDefinition\s*\(/);
  });

  it('has listToolDefinitions method', () => {
    expect(content).toMatch(/listToolDefinitions\s*\(/);
  });

  it('has evaluateToolInvocation method', () => {
    expect(content).toMatch(/evaluateToolInvocation\s*\(/);
  });

  it('has fromDefinitions static method', () => {
    expect(content).toMatch(/static\s+fromDefinitions\s*\(/);
  });

  it('decision matrix maps safe to allow', () => {
    expect(content).toMatch(/safe:\s*'allow'/);
  });

  it('decision matrix maps review to require_confirmation', () => {
    expect(content).toMatch(/review:\s*'require_confirmation'/);
  });

  it('decision matrix maps dangerous to require_confirmation', () => {
    expect(content).toMatch(/dangerous:\s*'require_confirmation'/);
  });

  it('decision matrix maps forbidden to deny', () => {
    expect(content).toMatch(/forbidden:\s*'deny'/);
  });

  it('AgentRiskLevel includes safe', () => {
    expect(content).toMatch(/'safe'/);
  });

  it('AgentRiskLevel includes review', () => {
    expect(content).toMatch(/'review'/);
  });

  it('AgentRiskLevel includes dangerous', () => {
    expect(content).toMatch(/'dangerous'/);
  });

  it('AgentRiskLevel includes forbidden', () => {
    expect(content).toMatch(/'forbidden'/);
  });
});

describe('AgentToolSecurityCatalog structure', () => {
  const content = readSecurityFile('AgentToolSecurityCatalog.ts');

  it('exports NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS', () => {
    expect(content).toMatch(/export\s+const\s+NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS/);
  });

  it('exports BOOTSTRAP_NATIVE_TOOL_SECURITY_MANIFEST', () => {
    expect(content).toMatch(/export\s+const\s+BOOTSTRAP_NATIVE_TOOL_SECURITY_MANIFEST/);
  });

  it('exports listExplicitNativeToolSecurityNames function', () => {
    expect(content).toMatch(/export\s+function\s+listExplicitNativeToolSecurityNames/);
  });

  it('exports findMissingExplicitNativeToolSecurityDefinitions function', () => {
    expect(content).toMatch(/export\s+function\s+findMissingExplicitNativeToolSecurityDefinitions/);
  });

  it('exports assertExplicitNativeToolSecurityDefinitions function', () => {
    expect(content).toMatch(/export\s+function\s+assertExplicitNativeToolSecurityDefinitions/);
  });

  it('exports createMcpAgentToolSecurityDefinition function', () => {
    expect(content).toMatch(/export\s+function\s+createMcpAgentToolSecurityDefinition/);
  });

  it('exports createFallbackAgentToolSecurityDefinition function', () => {
    expect(content).toMatch(/export\s+function\s+createFallbackAgentToolSecurityDefinition/);
  });

  it('exports resolveDefaultAgentToolSecurityDefinition function', () => {
    expect(content).toMatch(/export\s+function\s+resolveDefaultAgentToolSecurityDefinition/);
  });

  SAFE_TOOLS.forEach((toolName) => {
    it(`defines safe tool: ${toolName}`, () => {
      expect(content).toContain(`'${toolName}'`);
    });
  });

  DANGEROUS_TOOLS.forEach((toolName) => {
    it(`defines dangerous tool: ${toolName}`, () => {
      expect(content).toContain(`'${toolName}'`);
    });
  });

  it('all definitions have surface field', () => {
    const matches = content.match(/surface:\s*'native-tool'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(50);
  });

  it('all definitions have capabilities field', () => {
    const matches = content.match(/capabilities:\s*\[/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(50);
  });

  it('all definitions have defaultRisk field', () => {
    const matches = content.match(/defaultRisk:\s*'(safe|review|dangerous)'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(50);
  });

  it('all definitions have requiresConfirmation field', () => {
    const matches = content.match(/requiresConfirmation:\s*(true|false)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(50);
  });

  it('all definitions have description field', () => {
    const matches = content.match(/description:\s*'/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(50);
  });
});

describe('SecurityProfile structure', () => {
  const content = readSecurityFile('SecurityProfile.ts');

  it('exports SecurityProfileId type', () => {
    expect(content).toMatch(/export\s+type\s+SecurityProfileId/);
  });

  it('exports SecurityProfilePolicy type', () => {
    expect(content).toMatch(/export\s+type\s+SecurityProfilePolicy/);
  });

  it('exports SecurityProfileResolution type', () => {
    expect(content).toMatch(/export\s+type\s+SecurityProfileResolution/);
  });

  it('exports getSecurityProfilePolicy function', () => {
    expect(content).toMatch(/export\s+function\s+getSecurityProfilePolicy/);
  });

  it('exports listSecurityProfilePolicies function', () => {
    expect(content).toMatch(/export\s+function\s+listSecurityProfilePolicies/);
  });

  it('exports resolveSecurityProfile function', () => {
    expect(content).toMatch(/export\s+function\s+resolveSecurityProfile/);
  });

  it('exports normalizeSecurityProfileId function', () => {
    expect(content).toMatch(/export\s+function\s+normalizeSecurityProfileId/);
  });

  it('exports inspectSecurityProfileConfiguration function', () => {
    expect(content).toMatch(/export\s+function\s+inspectSecurityProfileConfiguration/);
  });

  it('exports resolveSecurityProfileConfirmationRequirement function', () => {
    expect(content).toMatch(/export\s+function\s+resolveSecurityProfileConfirmationRequirement/);
  });

  it('exports resolveSecurityProfileDeniedCapabilities function', () => {
    expect(content).toMatch(/export\s+function\s+resolveSecurityProfileDeniedCapabilities/);
  });

  it('exports formatUserFacingSecurityApprovalMessage function', () => {
    expect(content).toMatch(/export\s+function\s+formatUserFacingSecurityApprovalMessage/);
  });

  SECURITY_PROFILES.forEach((profile) => {
    it(`defines profile: ${profile}`, () => {
      expect(content).toContain(`'${profile}'`);
    });
  });

  it('personal profile has minimal confirmation style', () => {
    expect(content).toMatch(/confirmationStyle:\s*'minimal'/);
  });

  it('professional profile has balanced confirmation style', () => {
    expect(content).toMatch(/confirmationStyle:\s*'balanced'/);
  });

  it('enterprise profile has strict confirmation style', () => {
    expect(content).toMatch(/confirmationStyle:\s*'strict'/);
  });

  it('all profiles deny unknown capability', () => {
    const matches = content.match(/denyCapabilities:\s*\[.*'unknown'.*\]/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  it('has Portuguese aliases for profiles', () => {
    expect(content).toContain("'pessoal'");
    expect(content).toContain("'profissional'");
    expect(content).toContain("'corporativo'");
  });
});

describe('PolicyEngine structure', () => {
  const content = readSecurityFile('PolicyEngine.ts');

  it('exports PolicyEngine class', () => {
    expect(content).toMatch(/export\s+class\s+PolicyEngine/);
  });

  it('exports PolicyViolation interface', () => {
    expect(content).toMatch(/export\s+interface\s+PolicyViolation/);
  });

  it('exports PolicyEvaluation interface', () => {
    expect(content).toMatch(/export\s+interface\s+PolicyEvaluation/);
  });

  it('exports SecurityPolicy interface', () => {
    expect(content).toMatch(/export\s+interface\s+SecurityPolicy/);
  });

  it('has evaluate method', () => {
    expect(content).toMatch(/evaluate\s*\(/);
  });

  it('has isPathBlocked method', () => {
    expect(content).toMatch(/isPathBlocked\s*\(/);
  });

  it('has isSensitivePath method', () => {
    expect(content).toMatch(/isSensitivePath\s*\(/);
  });

  it('has isCommandBlocked method', () => {
    expect(content).toMatch(/isCommandBlocked\s*\(/);
  });

  it('has isWorkspaceAllowed method', () => {
    expect(content).toMatch(/isWorkspaceAllowed\s*\(/);
  });

  it('has isRawTextExecutionBlocked method', () => {
    expect(content).toMatch(/isRawTextExecutionBlocked\s*\(/);
  });

  it('has isUntrustedContentExecutionBlocked method', () => {
    expect(content).toMatch(/isUntrustedContentExecutionBlocked\s*\(/);
  });

  it('has getMaxCommandTimeout method', () => {
    expect(content).toMatch(/getMaxCommandTimeout\s*\(/);
  });

  it('has getPolicy method', () => {
    expect(content).toMatch(/getPolicy\s*\(/);
  });

  it('SecurityPolicy has blocked_paths field', () => {
    expect(content).toMatch(/blocked_paths:\s*string\[\]/);
  });

  it('SecurityPolicy has blocked_commands field', () => {
    expect(content).toMatch(/blocked_commands:\s*string\[\]/);
  });

  it('SecurityPolicy has allowed_workspaces field', () => {
    expect(content).toMatch(/allowed_workspaces:\s*string\[\]/);
  });

  it('PolicyViolation has severity field', () => {
    expect(content).toMatch(/severity:\s*'BLOCK'\s*\|\s*'WARN'/);
  });
});

describe('EgressGuard structure', () => {
  const content = readSecurityFile('EgressGuard.ts');

  it('exports EgressGuardOptions interface', () => {
    expect(content).toMatch(/export\s+interface\s+EgressGuardOptions/);
  });

  it('exports isPrivateNetworkAddress function', () => {
    expect(content).toMatch(/export\s+function\s+isPrivateNetworkAddress/);
  });

  it('exports assertPublicHttpTargetAllowed function', () => {
    expect(content).toMatch(/export\s+function\s+assertPublicHttpTargetAllowed/);
  });

  it('exports assertProviderValidationTargetAllowed function', () => {
    expect(content).toMatch(/export\s+function\s+assertProviderValidationTargetAllowed/);
  });

  it('exports assertProviderRequestTargetAllowed function', () => {
    expect(content).toMatch(/export\s+function\s+assertProviderRequestTargetAllowed/);
  });

  it('checks for private IPv4 addresses', () => {
    expect(content).toMatch(/isPrivateIPv4/);
  });

  it('checks for private IPv6 addresses', () => {
    expect(content).toMatch(/isPrivateIPv6/);
  });

  it('blocks localhost', () => {
    expect(content).toMatch(/localhost/);
  });
});

describe('LlmEgressGuard structure', () => {
  const content = readSecurityFile('LlmEgressGuard.ts');

  it('exports LlmEgressGuardReport type', () => {
    expect(content).toMatch(/export\s+type\s+LlmEgressGuardReport/);
  });

  it('exports LlmEgressPayload type', () => {
    expect(content).toMatch(/export\s+type\s+LlmEgressPayload/);
  });

  it('exports sanitizeLlmEgressPayload function', () => {
    expect(content).toMatch(/export\s+function\s+sanitizeLlmEgressPayload/);
  });

  it('exports buildLlmEgressGuardMetadata function', () => {
    expect(content).toMatch(/export\s+function\s+buildLlmEgressGuardMetadata/);
  });

  it('exports wrapLlmProviderWithEgressGuard function', () => {
    expect(content).toMatch(/export\s+function\s+wrapLlmProviderWithEgressGuard/);
  });

  it('imports detectSensitiveData', () => {
    expect(content).toMatch(/import.*detectSensitiveData/);
  });

  it('imports redactSensitiveData', () => {
    expect(content).toMatch(/import.*redactSensitiveData/);
  });

  it('imports decideSecurityPolicy', () => {
    expect(content).toMatch(/import.*decideSecurityPolicy/);
  });

  it('uses Symbol for secure provider marking', () => {
    expect(content).toMatch(/Symbol\.for\s*\(\s*'zavorth\.secureLlmProvider'\s*\)/);
  });
});

describe('SensitiveDataGuard structure', () => {
  const content = readSecurityFile('SensitiveDataGuard.ts');

  it('exports SensitiveDataFinding type', () => {
    expect(content).toMatch(/export\s+type\s+SensitiveDataFinding/);
  });

  it('exports requiresSensitiveDataEgressGuard function', () => {
    expect(content).toMatch(/export\s+function\s+requiresSensitiveDataEgressGuard/);
  });

  it('exports detectSensitiveData function', () => {
    expect(content).toMatch(/export\s+function\s+detectSensitiveData/);
  });

  it('exports redactSensitiveText function', () => {
    expect(content).toMatch(/export\s+function\s+redactSensitiveText/);
  });

  it('exports redactSensitiveData function', () => {
    expect(content).toMatch(/export\s+function\s+redactSensitiveData/);
  });

  it('has SENSITIVE_KEY_PATTERN', () => {
    expect(content).toMatch(/SENSITIVE_KEY_PATTERN/);
  });

  it('has SECRET_VALUE_PATTERNS array', () => {
    expect(content).toMatch(/SECRET_VALUE_PATTERNS/);
  });

  it('detects private keys', () => {
    expect(content).toMatch(/PRIVATE\s+KEY/);
  });

  it('detects OpenAI-style tokens (sk-)', () => {
    expect(content).toMatch(/sk-\[A-Za-z0-9_-\]/);
  });

  it('detects GitHub tokens (ghp_, gho_, ghs_, ghu_, ghr_)', () => {
    expect(content).toMatch(/gh\[pousr\]_/);
  });

  it('detects Slack tokens (xoxb-, xoxa-, etc.)', () => {
    expect(content).toMatch(/xox\[baprs\]-/);
  });

  it('detects Google API keys (AIza)', () => {
    expect(content).toMatch(/AIza\[A-Za-z0-9_-\]/);
  });

  it('detects AWS access keys (AKIA/ASIA)', () => {
    expect(content).toMatch(/A\(KIA\|SIA\)/);
  });

  it('detects Bearer tokens', () => {
    expect(content).toMatch(/Bearer\s+/);
  });

  it('detects JWT tokens (eyJ)', () => {
    expect(content).toMatch(/eyJ\[A-Za-z0-9_-\]/);
  });

  it('detects credential URLs', () => {
    expect(content).toMatch(/credential-url/);
  });

  it('detects secret assignments', () => {
    expect(content).toMatch(/secret-assignment/);
  });

  it('has EXFILTRATION_CAPABILITIES set', () => {
    expect(content).toMatch(/EXFILTRATION_CAPABILITIES/);
  });

  it('has SECRET_REF_PATTERN for allowed references', () => {
    expect(content).toMatch(/SECRET_REF_PATTERN/);
  });

  it('has REDACTED_PATTERN for already redacted values', () => {
    expect(content).toMatch(/REDACTED_PATTERN/);
  });
});

describe('ApprovalSigningKeyService structure', () => {
  const content = readSecurityFile('ApprovalSigningKeyService.ts');

  it('exports ApprovalSigningKeyResolution type', () => {
    expect(content).toMatch(/export\s+type\s+ApprovalSigningKeyResolution/);
  });

  it('exports ApprovalSigningKeyInspection type', () => {
    expect(content).toMatch(/export\s+type\s+ApprovalSigningKeyInspection/);
  });

  it('exports resolveToolApprovalSigningKey function', () => {
    expect(content).toMatch(/export\s+function\s+resolveToolApprovalSigningKey/);
  });

  it('exports resolveToolApprovalSigningKeyDetails function', () => {
    expect(content).toMatch(/export\s+function\s+resolveToolApprovalSigningKeyDetails/);
  });

  it('exports resolveToolApprovalSigningKeyFilePath function', () => {
    expect(content).toMatch(/export\s+function\s+resolveToolApprovalSigningKeyFilePath/);
  });

  it('exports inspectToolApprovalSigningKeyState function', () => {
    expect(content).toMatch(/export\s+function\s+inspectToolApprovalSigningKeyState/);
  });

  it('exports resetApprovalSigningKeyCacheForTests function', () => {
    expect(content).toMatch(/export\s+function\s+resetApprovalSigningKeyCacheForTests/);
  });

  it('uses ZAVORTH_TOOL_APPROVAL_SIGNING_KEY env var', () => {
    expect(content).toMatch(/ZAVORTH_TOOL_APPROVAL_SIGNING_KEY/);
  });

  it('uses ZAVORTH_SECURITY_APPROVAL_SIGNING_KEY as fallback', () => {
    expect(content).toMatch(/ZAVORTH_SECURITY_APPROVAL_SIGNING_KEY/);
  });

  it('has generated key pattern validation', () => {
    expect(content).toMatch(/GENERATED_KEY_PATTERN/);
  });

  it('inspection has status field', () => {
    expect(content).toMatch(/status:\s*'ready'\s*\|\s*'ready-on-demand'\s*\|\s*'attention'\s*\|\s*'blocked'/);
  });

  it('inspection has source field', () => {
    expect(content).toMatch(/source:\s*'env'\s*\|\s*'local-file'/);
  });

  it('inspection has persistent field', () => {
    expect(content).toMatch(/persistent:\s*boolean/);
  });

  it('inspection has willAutoCreateOnUse field', () => {
    expect(content).toMatch(/willAutoCreateOnUse:\s*boolean/);
  });

  it('uses randomBytes for key generation', () => {
    expect(content).toMatch(/randomBytes/);
  });
});

describe('AgentSecurityInventory structure', () => {
  const content = readSecurityFile('AgentSecurityInventory.ts');

  it('exports NODE_HOST_CAPABILITY_SECURITY_INVENTORY', () => {
    expect(content).toMatch(/export\s+const\s+NODE_HOST_CAPABILITY_SECURITY_INVENTORY/);
  });

  it('exports CROSS_SURFACE_SECURITY_INVENTORY', () => {
    expect(content).toMatch(/export\s+const\s+CROSS_SURFACE_SECURITY_INVENTORY/);
  });

  it('exports buildAgentSecurityInventory function', () => {
    expect(content).toMatch(/export\s+function\s+buildAgentSecurityInventory/);
  });

  it('exports validateAgentSecurityInventory function', () => {
    expect(content).toMatch(/export\s+function\s+validateAgentSecurityInventory/);
  });

  it('exports AgentSecurityInventoryEntry type', () => {
    expect(content).toMatch(/export\s+type\s+AgentSecurityInventoryEntry/);
  });

  it('exports AgentSecurityInventoryFinding type', () => {
    expect(content).toMatch(/export\s+type\s+AgentSecurityInventoryFinding/);
  });

  it('has system.run capability', () => {
    expect(content).toMatch(/id:\s*'system\.run'/);
  });

  it('has device.info capability', () => {
    expect(content).toMatch(/id:\s*'device\.info'/);
  });

  it('has mcp.dynamic_tools cross-surface entry', () => {
    expect(content).toMatch(/id:\s*'mcp\.dynamic_tools'/);
  });

  it('has webhooks.dispatch cross-surface entry', () => {
    expect(content).toMatch(/id:\s*'webhooks\.dispatch'/);
  });

  it('has admin.api cross-surface entry', () => {
    expect(content).toMatch(/id:\s*'admin\.api'/);
  });

  it('validation checks for duplicate entries', () => {
    expect(content).toMatch(/Duplicate security inventory entry/);
  });

  it('validation checks for missing id', () => {
    expect(content).toMatch(/missing id/);
  });

  it('validation checks for unknown capabilities', () => {
    expect(content).toMatch(/concrete non-unknown capabilities/);
  });

  it('validation checks for missing description', () => {
    expect(content).toMatch(/describe the protected surface/);
  });

  it('validation checks risk vs confirmation', () => {
    expect(content).toMatch(/Risk.*requires confirmation/);
  });

  it('validation checks for fallback entries', () => {
    expect(content).toMatch(/Fallback security inventory entries are denied/);
  });
});

describe('OperationalMode structure', () => {
  const content = readSecurityFile('OperationalMode.ts');

  it('exports OperationalMode enum', () => {
    expect(content).toMatch(/export\s+enum\s+OperationalMode/);
  });

  it('exports ModePermissions interface', () => {
    expect(content).toMatch(/export\s+interface\s+ModePermissions/);
  });

  it('exports ModeManager class', () => {
    expect(content).toMatch(/export\s+class\s+ModeManager/);
  });

  OPERATIONAL_MODES.forEach((mode) => {
    it(`defines mode: ${mode}`, () => {
      expect(content).toContain(mode);
    });
  });

  it('ModeManager has getMode method', () => {
    expect(content).toMatch(/getMode\s*\(/);
  });

  it('ModeManager has setMode method', () => {
    expect(content).toMatch(/setMode\s*\(/);
  });

  it('ModeManager has getPermissions method', () => {
    expect(content).toMatch(/getPermissions\s*\(/);
  });

  it('ModeManager has isAllowed method', () => {
    expect(content).toMatch(/isAllowed\s*\(/);
  });

  it('ModeManager has static minimumModeFor method', () => {
    expect(content).toMatch(/static\s+minimumModeFor\s*\(/);
  });

  it('ModeManager has isSufficientFor method', () => {
    expect(content).toMatch(/isSufficientFor\s*\(/);
  });

  it('ModePermissions has canRead field', () => {
    expect(content).toMatch(/canRead:\s*boolean/);
  });

  it('ModePermissions has canWrite field', () => {
    expect(content).toMatch(/canWrite:\s*boolean/);
  });

  it('ModePermissions has canExecuteCommands field', () => {
    expect(content).toMatch(/canExecuteCommands:\s*boolean/);
  });

  it('ModePermissions has canDelete field', () => {
    expect(content).toMatch(/canDelete:\s*boolean/);
  });

  it('ModePermissions has canAccessNetwork field', () => {
    expect(content).toMatch(/canAccessNetwork:\s*boolean/);
  });

  it('ModePermissions has canUseSudo field', () => {
    expect(content).toMatch(/canUseSudo:\s*boolean/);
  });

  it('READ_ONLY has no write permission', () => {
    expect(content).toMatch(/READ_ONLY[\s\S]{0,200}canWrite:\s*false/);
  });

  it('PRIVILEGED has all permissions', () => {
    expect(content).toMatch(/PRIVILEGED[\s\S]{0,200}canUseSudo:\s*true/);
  });
});

describe('TrustedBoundary structure', () => {
  const content = readSecurityFile('TrustedBoundary.ts');

  it('exports TrustLevel type', () => {
    expect(content).toMatch(/export\s+type\s+TrustLevel/);
  });

  it('exports TrustClassification interface', () => {
    expect(content).toMatch(/export\s+interface\s+TrustClassification/);
  });

  it('exports TrustedBoundary class', () => {
    expect(content).toMatch(/export\s+class\s+TrustedBoundary/);
  });

  it('has URL_PATTERN', () => {
    expect(content).toMatch(/URL_PATTERN/);
  });

  it('has UNTRUSTED_FILE_EXTENSIONS', () => {
    expect(content).toMatch(/UNTRUSTED_FILE_EXTENSIONS/);
  });
});

describe('UntrustedContent structure', () => {
  const content = readSecurityFile('UntrustedContent.ts');

  it('exports escapeXmlText function', () => {
    expect(content).toMatch(/export\s+function\s+escapeXmlText/);
  });

  it('exports escapeXmlAttribute function', () => {
    expect(content).toMatch(/export\s+function\s+escapeXmlAttribute/);
  });

  it('exports UNTRUSTED_CONTENT_TAGS', () => {
    expect(content).toMatch(/export\s+const\s+UNTRUSTED_CONTENT_TAGS/);
  });

  it('defines untrusted_web_evidence tag', () => {
    expect(content).toMatch(/untrusted_web_evidence/);
  });

  it('defines untrusted_document_content tag', () => {
    expect(content).toMatch(/untrusted_document_content/);
  });

  it('defines untrusted_tool_output tag', () => {
    expect(content).toMatch(/untrusted_tool_output/);
  });

  it('defines untrusted_mcp_resource tag', () => {
    expect(content).toMatch(/untrusted_mcp_resource/);
  });

  it('exports PromptInjectionFinding type', () => {
    expect(content).toMatch(/export\s+type\s+PromptInjectionFinding/);
  });
});

describe('ToolOutputTrust structure', () => {
  const content = readSecurityFile('ToolOutputTrust.ts');

  it('exports ToolOutputTrustInput type', () => {
    expect(content).toMatch(/export\s+type\s+ToolOutputTrustInput/);
  });

  it('has UNTRUSTED_OUTPUT_CAPABILITIES set', () => {
    expect(content).toMatch(/UNTRUSTED_OUTPUT_CAPABILITIES/);
  });
});

describe('Supporting security files', () => {
  it('WorkspaceResolver.ts exports resolver functions', () => {
    const content = readSecurityFile('WorkspaceResolver.ts');
    expect(content).toMatch(/export/);
  });

  it('WorkspaceResolver.ts exports resolver class', () => {
    const content = readSecurityFile('WorkspaceResolver.ts');
    expect(content).toMatch(/export\s+class\s+WorkspaceResolver/);
  });

  it('SecurityPolicyBroker.ts exports broker functions', () => {
    const content = readSecurityFile('SecurityPolicyBroker.ts');
    expect(content).toMatch(/export/);
  });

  it('SecurityOperationalPreset.ts exports preset functions', () => {
    const content = readSecurityFile('SecurityOperationalPreset.ts');
    expect(content).toMatch(/export/);
  });

  it('DangerousCommandBlocker.ts exports blocker class', () => {
    const content = readSecurityFile('DangerousCommandBlocker.ts');
    expect(content).toMatch(/export\s+class\s+DangerousCommandBlocker/);
  });

  it('WorkspaceResolver.ts exports resolver', () => {
    const content = readSecurityFile('WorkspaceResolver.ts');
    expect(content).toMatch(/export/);
  });

  it('SafeFetchService.ts exports fetch service', () => {
    const content = readSecurityFile('SafeFetchService.ts');
    expect(content).toMatch(/export/);
  });

  it('ChildProcessEnv.ts exports env utilities', () => {
    const content = readSecurityFile('ChildProcessEnv.ts');
    expect(content).toMatch(/export/);
  });

  it('ToolApprovalEnvelope.ts exports envelope types', () => {
    const content = readSecurityFile('ToolApprovalEnvelope.ts');
    expect(content).toMatch(/export/);
  });

  it('OperationalSecurityDoctor.ts exports doctor class or function', () => {
    const content = readSecurityFile('OperationalSecurityDoctor.ts');
    expect(content).toMatch(/export/);
  });

  it('ContinuousSecurityMonitor.ts exports monitor class or function', () => {
    const content = readSecurityFile('ContinuousSecurityMonitor.ts');
    expect(content).toMatch(/export/);
  });

  it('EffectPolicyRules.ts exports policy rules', () => {
    const content = readSecurityFile('EffectPolicyRules.ts');
    expect(content).toMatch(/export/);
  });

  it('EffectPolicyReceiptAdapter.ts exports adapter', () => {
    const content = readSecurityFile('EffectPolicyReceiptAdapter.ts');
    expect(content).toMatch(/export/);
  });

  it('EffectPolicyKernel.ts exports kernel', () => {
    const content = readSecurityFile('EffectPolicyKernel.ts');
    expect(content).toMatch(/export/);
  });

  it('EffectPolicyDecision.ts exports decision types', () => {
    const content = readSecurityFile('EffectPolicyDecision.ts');
    expect(content).toMatch(/export/);
  });

  it('EffectPolicyContext.ts exports context types', () => {
    const content = readSecurityFile('EffectPolicyContext.ts');
    expect(content).toMatch(/export/);
  });
});
