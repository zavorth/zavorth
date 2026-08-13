import {
  CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION,
  type CapabilitySetupAudience,
  type CapabilitySetupConversationInput,
  type CapabilitySetupConversationSnapshot,
  type CapabilitySetupConversationStatus,
  type CapabilitySetupExplanationCard,
  type CapabilitySetupSecureRequest,
  type CapabilitySetupTask,
} from '../contracts/CapabilitySetupConversationContract.js';
import type {
  CapabilityActivationFlowSnapshot,
  CapabilityActivationFlowStatus,
} from '../contracts/CapabilityActivationFlowContract.js';
import type {
  CapabilityPackReadinessCheck,
  CapabilityPackReadinessCheckKind,
} from '../contracts/CapabilityPackReadinessContract.js';
import {
  ZavorthCapabilityActivationFlowService,
  type ZavorthCapabilityActivationFlowRuntime,
} from './ZavorthCapabilityActivationFlowService.js';

export type ZavorthCapabilitySetupConversationRuntime =
  ZavorthCapabilityActivationFlowRuntime
  & {
    now?: () => Date;
  };

const SECRET_PATTERNS: RegExp[] = [
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{12,}\b/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:token|api[_ -]?key|secret|password)\s*[:=]\s*([^\s,;]+)/gi,
];

export class ZavorthCapabilitySetupConversationService {
  private readonly now: () => Date;
  private readonly activationFlow: ZavorthCapabilityActivationFlowService;

  constructor(runtime: ZavorthCapabilitySetupConversationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.activationFlow = new ZavorthCapabilityActivationFlowService(runtime);
  }

  public buildSnapshot(input: CapabilitySetupConversationInput = {}): CapabilitySetupConversationSnapshot {
    const redactedText = input.text ? this.redact(input.text) : null;
    const flowSnapshot = this.activationFlow.buildSnapshot({
      ...input,
      text: redactedText || input.text || null,
    });
    const audience = input.audience || 'everyday';
    const status = this.toConversationStatus(flowSnapshot.status);
    const secureRequests = this.buildSecureRequests(flowSnapshot);
    const tasks = this.buildTasks(flowSnapshot, status);
    const explanationCards = this.buildExplanationCards(flowSnapshot, audience);

    return {
      contractVersion: CAPABILITY_SETUP_CONVERSATION_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      audience,
      status,
      request: {
        redactedText,
        packId: input.packId || null,
        targetItemId: input.targetItemId || null,
      },
      reply: this.buildReply(flowSnapshot, status, secureRequests, audience),
      tasks,
      secureRequests,
      explanationCards,
      flowSnapshot,
      safety: {
        noJargonByDefault: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        approvalStillRequired: flowSnapshot.status === 'waiting_approval',
        receiptsAvailable: flowSnapshot.receipts.length > 0,
      },
    };
  }

  public renderReply(input: CapabilitySetupConversationInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      snapshot.reply.headline,
      '',
      snapshot.reply.body,
      '',
      snapshot.reply.nextQuestion,
    ];

    if (snapshot.tasks.length > 0) {
      lines.push('', 'Now:');
      for (const task of snapshot.tasks.slice(0, 5)) {
        lines.push(`- ${this.statusLabel(task.status)}: ${task.label} - ${task.plainSummary}`);
      }
    }

    if (snapshot.secureRequests.length > 0) {
      lines.push('', 'Secure entries:');
      for (const request of snapshot.secureRequests) {
        lines.push(`- ${request.label}: ${request.plainPrompt}`);
      }
    }

    lines.push('', snapshot.reply.reassurance);
    return lines.join('\n');
  }

  private toConversationStatus(status: CapabilityActivationFlowStatus): CapabilitySetupConversationStatus {
    if (status === 'blocked') {
      return 'blocked';
    }
    if (status === 'waiting_target') {
      return 'needs_choice';
    }
    if (status === 'waiting_secret_input') {
      return 'needs_secret';
    }
    if (status === 'waiting_readiness') {
      return 'needs_readiness';
    }
    if (status === 'waiting_approval') {
      return 'needs_approval';
    }
    return 'ready_for_owner';
  }

  private buildReply(
    flow: CapabilityActivationFlowSnapshot,
    status: CapabilitySetupConversationStatus,
    secureRequests: CapabilitySetupSecureRequest[],
    audience: CapabilitySetupAudience,
  ): CapabilitySetupConversationSnapshot['reply'] {
    const target = flow.target?.label || 'this resource';
    if (status === 'needs_choice') {
      return {
        headline: 'Tell me what you want to set up.',
        body: 'I can prepare channels, models, tools, and skills. I will show what is missing and will not enable anything on my own.',
        nextQuestion: 'Which resource do you want to use...',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'blocked') {
      return {
        headline: `I cannot proceed with ${target} yet.`,
        body: 'I found a security or configuration block. Before trying again, we need to fix the item pointed out in the steps.',
        nextQuestion: 'Do you want me to show only the first block so we can resolve them one at a time...',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'needs_secret') {
      const secretRequestCount = secureRequests.filter((request) => request.inputMode === 'secure-secret-entry').length;
      const missingText = secretRequestCount === 1
        ? 'Missing 1 credential or permission'
        : `Missing ${secretRequestCount || 'some'} credentials or permissions`;
      return {
        headline: `${target} needs a secure entry.`,
        body: `${missingText}. I do not want you to paste sensitive values in regular chat; use secure entry.`,
        nextQuestion: secureRequests[0]?.plainPrompt || 'Can you provide the credential using secure entry...',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'needs_readiness') {
      return {
        headline: `${target} needs to pass a simple verification.`,
        body: 'The credentials and plan are already prepared, but we still need to confirm some local step, permission, or functionality test.',
        nextQuestion: 'Do you want me to list the first pending test in simple language...',
        reassurance: this.reassurance(audience),
      };
    }
    if (status === 'needs_approval') {
      return {
        headline: `${target} is ready for you to approve.`,
        body: 'Everything necessary has been planned and recorded. The next step is an explicit owner approval before any real use.',
        nextQuestion: 'Do you want to review the summary before approving...',
        reassurance: this.reassurance(audience),
      };
    }
    return {
      headline: `${target} is ready for controlled request.`,
      body: 'The flow reached the expected state. However, nothing was activated automatically; the next step is to send the request to the owner control.',
      nextQuestion: 'Do you want me to generate the final controlled activation request...',
      reassurance: this.reassurance(audience),
    };
  }

  private buildTasks(
    flow: CapabilityActivationFlowSnapshot,
    status: CapabilitySetupConversationStatus,
  ): CapabilitySetupTask[] {
    return flow.steps.map((step) => ({
      id: step.id,
      label: this.humanStepLabel(step.id),
      status: step.status === 'done'
        ? 'done'
        : step.status === 'blocked'
          ? 'blocked'
          : step.status === 'next'
            ? 'next'
            : 'later',
      plainSummary: this.humanizeSummary(step.summary),
      whyItMatters: this.whyStepMatters(step.id, status),
    }));
  }

  private buildSecureRequests(flow: CapabilityActivationFlowSnapshot): CapabilitySetupSecureRequest[] {
    const secretRefs = flow.setupSnapshot?.secretPlan.missingRefs || [];
    const readinessChecks = flow.packReadinessSnapshot?.items
      .flatMap((item) => item.checks)
      .filter((check) => check.status !== 'passed') || [];
    const secretRequests = secretRefs.map((ref) => ({
      id: `secret:${ref}`,
      label: this.humanRef(ref),
      inputMode: 'secure-secret-entry' as const,
      rawValueAcceptedInChat: false as const,
      plainPrompt: `Enter ${this.humanRef(ref)} via secure entry. Do not paste the value in regular text.`,
    }));
    const readinessSecretRequests = readinessChecks
      .filter((check) => check.kind === 'secret-ref' || check.kind === 'env-key')
      .map((check) => ({
        id: check.id,
        label: this.checkTitle(check),
        inputMode: 'secure-secret-entry' as const,
        rawValueAcceptedInChat: false as const,
        plainPrompt: `${this.checkExplanation(check, 'everyday')} Use secure entry; do not paste values in regular text.`,
      }));
    const confirmationRequests = readinessChecks
      .filter((check) => check.kind === 'manual-step' || check.kind === 'readiness-check' || check.kind === 'local-route')
      .slice(0, 4)
      .map((check) => ({
        id: check.id,
        label: this.checkTitle(check),
        inputMode: check.kind === 'local-route' ? 'local-check' as const : 'confirmation' as const,
        rawValueAcceptedInChat: false as const,
        plainPrompt: this.checkPrompt(check),
      }));
    return [...secretRequests, ...readinessSecretRequests, ...confirmationRequests];
  }

  private buildExplanationCards(
    flow: CapabilityActivationFlowSnapshot,
    audience: CapabilitySetupAudience,
  ): CapabilitySetupExplanationCard[] {
    const checks = flow.packReadinessSnapshot?.items.flatMap((item) => item.checks) || [];
    const cards: CapabilitySetupExplanationCard[] = checks
      .filter((check) => check.status !== 'passed')
      .slice(0, audience === 'everyday' ? 4 : 8)
      .map((check) => ({
        id: check.id,
        kind: check.kind,
        title: this.checkTitle(check),
        plainText: this.checkExplanation(check, audience),
      }));
    if (flow.status === 'waiting_approval') {
      cards.push({
        id: 'approval',
        kind: 'approval',
        title: 'Final approval',
        plainText: 'This step exists to ensure that Zavorth only uses the resource when the owner confirms.',
      });
    }
    if (!flow.target) {
      cards.push({
        id: 'target',
        kind: 'target',
        title: 'Resource choice',
        plainText: 'First I need to know which channel, model, tool, or skill you want to set up.',
      });
    }
    return cards;
  }

  private checkTitle(check: CapabilityPackReadinessCheck): string {
    const titles: Record<CapabilityPackReadinessCheckKind, string> = {
      'secret-ref': 'Secure credential',
      'env-key': 'System configuration',
      binary: 'Required program',
      'manual-step': 'Manual confirmation',
      'local-route': 'local test',
      'readiness-check': 'Functionality test',
      policy: 'Security rule',
    };
    return titles[check.kind];
  }

  private checkPrompt(check: CapabilityPackReadinessCheck): string {
    if (check.kind === 'local-route') {
      return 'Confirm if the local service is open and responding.';
    }
    if (check.kind === 'manual-step') {
      return 'Confirm when this manual step is completed.';
    }
    return 'Confirm when this test is completed.';
  }

  private checkExplanation(
    check: CapabilityPackReadinessCheck,
    audience: CapabilitySetupAudience,
  ): string {
    if (check.kind === 'secret-ref') {
      return 'It is a key or permission stored in a safe location. I only check if it exists, without reading the value.';
    }
    if (check.kind === 'env-key') {
      return 'It is a configuration the program needs to find in the environment. The value does not appear in the report.';
    }
    if (check.kind === 'local-route') {
      return 'It is a test to check if a local service is accessible on this machine.';
    }
    if (check.kind === 'policy') {
      return 'It is the rule that defines what the resource can or cannot do.';
    }
    if (audience === 'technical') {
      return check.summary;
    }
    return 'It is a simple confirmation before allowing the resource to proceed.';
  }

  private humanStepLabel(id: string): string {
    const labels: Record<string, string> = {
      import: 'Prepare resource',
      target: 'Choose what to use',
      'natural-setup': 'Build simple plan',
      secrets: 'Store access securely',
      governance: 'Apply usage rules',
      'pack-readiness': 'Verify readiness',
      approval: 'Request approval',
      activation: 'Submit final request',
    };
    return labels[id] || id;
  }

  private whyStepMatters(id: string, status: CapabilitySetupConversationStatus): string {
    if (id === 'secrets') {
      return 'Without this, the resource cannot access the correct account.';
    }
    if (id === 'approval') {
      return 'This prevents activation without consent.';
    }
    if (id === 'pack-readiness') {
      return 'This avoids enabling something that has not been tested yet.';
    }
    if (status === 'blocked') {
      return 'Resolving this unblocks the rest.';
    }
    return 'This keeps the setup traceable and secure.';
  }

  private humanizeSummary(summary: string): string {
    return summary
      .replace(/secret ref\(s\)/gi, 'secure entry/entries')
      .replace(/Manifest items were normalized into Capability Hub contract\./gi, 'The resource was prepared in the Zavorth catalog.')
      .replace(/Governance recipe is required before activation\./gi, 'Usage rules must be applied before activation.')
      .replace(/Live activation is not applied by this flow; it only prepares the governed request\./gi, 'Nothing was activated automatically; only the request was prepared.')
      .replace(/No raw secret is serialized by the activation flow\./gi, 'No raw secret was written to text.')
      .replace(/Missing ([0-9]+) entrada\(s\) safe\(s\)\./gi, 'Missing $1 secure entry/entries.')
      .replace(/[a-z0-9-]+ planned with dry-run receipts\./gi, 'Usage rules were planned with audit records.')
      .replace(/^(.+) selected\.$/gi, 'Resource selected: $1.')
      .replace(/Pack readiness status is /gi, 'Verification status: ');
  }

  private statusLabel(status: CapabilitySetupTask['status']): string {
    if (status === 'done') {
      return 'done';
    }
    if (status === 'next') {
      return 'next';
    }
    if (status === 'blocked') {
      return 'blocked';
    }
    return 'later';
  }

  private humanRef(ref: string): string {
    return ref
      .replace(/[_-]/g, ' ')
      .replace(/\./g, ' ')
      .replace(/\boauth\b/gi, 'access')
      .replace(/\btoken\b/gi, 'token')
      .replace(/\bapiKey\b/gi, 'API key');
  }

  private reassurance(audience: CapabilitySetupAudience): string {
    if (audience === 'technical') {
      return 'Security: dry-run, receipts, no raw secrets, and no automatic live activation.';
    }
    return 'I will not store sensitive values in text or activate anything without approval.';
  }

  private redact(text: string): string {
    let redacted = text;
    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match, group) => {
        if (typeof group === 'string' && group.length > 0) {
          return match.replace(group, '[SECRET_REDACTED]');
        }
        return '[SECRET_REDACTED]';
      });
    }
    return redacted;
  }
}
