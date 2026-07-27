import { createHash } from 'crypto';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService';

export interface PtyInputClassification {
  riskLevel: 'LOW' | 'HIGH' | 'CRITICAL';
  blocked: boolean;
  blockReason?: string;
  strongConfirmationRequired: boolean;
  sanitizedInput: string;
}

export class PtyInputPolicyService {
  private mandateService: WorkspaceTaskMandateService;

  constructor(mandateService: WorkspaceTaskMandateService) {
    this.mandateService = mandateService;
  }

  public classifyInput(workspaceId: string, input: string, isFromAgent: boolean, sessionCwd: string): PtyInputClassification {
    // Basic redaction (not comprehensive, but best-effort to hide obvious secrets in logs)
    const sanitizedInput = this.redactSecrets(input);

    if (!isFromAgent) {
      // Manual user inputs are direct operator actions. We don't block them, but they inherit HIGH/CRITICAL
      // implicitly just to be logged safely if needed. In this design, user input skips policy blocking.
      return {
        riskLevel: 'LOW',
        blocked: false,
        strongConfirmationRequired: false,
        sanitizedInput
      };
    }

    // Agent inputs must be governed.
    const normalizedInput = input.trim().toLowerCase();

    // 1. Hard Blocks (CRITICAL without RUN or just fully blocked)
    const blockPatterns = [
      /\brm\s+-rf\b/,
      /\bdel\s+\/s\b/,
      /\bremove-item\s+-recurse\b/,
      /\bformat\b/,
      /\bdiskpart\b/,
      /\breg\s+delete\b/,
      /\bsudo\b/,
      /\bchmod\s+-r\s+777\b/,
      /\bcurl.*...\|\s*(?:ba)...sh\b/,
      /\bwget.*...\|\s*(?:ba)...sh\b/,
      /\binvoke-webrequest.*...\|\s*iex\b/,
      /\b-encodedcommand\b/,
      /\bbase64\s+-d\b/,
      /\bcat\s+\.env\b/,
      /\btype\s+\.env\b/,
      /\bprintenv\b/,
      /\bget-childitem\s+env:\b/,
      /\bexport\s+.*=/,
      /\bset\s+.*=/
    ];

    for (const pattern of blockPatterns) {
      if (pattern.test(normalizedInput)) {
        // These are extremely dangerous or exfiltration attempts.
        return {
          riskLevel: 'CRITICAL',
          blocked: true,
          blockReason: 'Input matches prohibited high-risk pattern.',
          strongConfirmationRequired: true,
          sanitizedInput
        };
      }
    }

    // 2. High Risk (Needs standard approval)
    const highRiskPatterns = [
      /\bnpm\s+install\b/,
      /\byarn\s+add\b/,
      /\bpnpm\s+add\b/,
      /\bgit\s+push\b/,
      /\bgit\s+commit\b/,
      /\brm\b/,
      /\bdel\b/
    ];

    let riskLevel: 'LOW' | 'HIGH' | 'CRITICAL' = 'LOW';
    for (const pattern of highRiskPatterns) {
      if (pattern.test(normalizedInput)) {
        riskLevel = 'HIGH';
        break;
      }
    }

    // 3. Task Mandate Check
    const activeMandate = this.mandateService.getActiveMandate(workspaceId);
    if (activeMandate) {
      // If we have a mandate, and this is a command that might break out of it, we escalate.
      // Since PTY is a persistent shell, it's hard to statically analyze every command against a mandate scope.
      // By default, any PTY agent write under an active mandate should be at least HIGH to force review,
      // unless it's a very simple low-risk read.
      if (riskLevel === 'LOW') {
        riskLevel = 'HIGH';
      }
    } else {
      // PTY is inherently risky. Even without a mandate, we default agent writes to HIGH unless explicitly safe.
      if (riskLevel === 'LOW') {
         riskLevel = 'HIGH';
      }
    }

    // 4. CRITICAL escalation
    // If the input modifies the system, we make it CRITICAL
    if (normalizedInput.includes('registry') || normalizedInput.includes('firewall') || normalizedInput.includes('defender')) {
      riskLevel = 'CRITICAL';
    }

    return {
      riskLevel,
      blocked: false,
      strongConfirmationRequired: riskLevel === 'CRITICAL',
      sanitizedInput
    };
  }

  public redactSecrets(input: string): string {
    // Best-effort redaction for audit logs
    let redacted = input;
    redacted = redacted.replace(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g, '[REDACTED_JWT]');
    redacted = redacted.replace(/([a-zA-Z0-9]{32,})/g, '[REDACTED_TOKEN_OR_HASH]');
    return redacted;
  }
}
