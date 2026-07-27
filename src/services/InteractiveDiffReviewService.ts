import { GlassBoxTraceService } from './GlassBoxTraceService';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applyPatch } from 'diff';
import type {
  ExecutionEngineId,
  GlassBoxTraceEvent,
  InteractiveDiffApplyResult,
  InteractiveDiffAction,
  InteractiveDiffReview,
} from '../contracts/ExecutionEngineContract';

import { TrustedWorkspacePolicyService } from './TrustedWorkspacePolicyService';
import { asErrorLike } from '../utils/errorLike.js';

export type InteractiveDiffReviewInput = {
  action: InteractiveDiffAction;
  targetId: string;
  engineId: ExecutionEngineId;
  targetPath?: string | null;
  diffText?: string | null;
};

export type InteractiveDiffApplyInput = InteractiveDiffReviewInput & {
  dryRun?: boolean;
};

const MAX_DIFF_BYTES = 1024 * 1024;
const MAX_TARGET_BYTES = 2 * 1024 * 1024;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function statusFromReview(review: InteractiveDiffReview): InteractiveDiffApplyResult['status'] {
  if (review.status === 'host-direct-ready') return 'dry-run-ready';
  if (review.status === 'approval-required') return 'approval-required';
  if (review.status === 'sandbox-recompose-required') return 'sandbox-required';
  if (review.status === 'blocked') return 'blocked';
  return 'failed';
}

export class InteractiveDiffReviewService {
  public constructor(
    private readonly trustedWorkspaces: TrustedWorkspacePolicyService,
    private readonly trace: GlassBoxTraceService,
  ) {}

  public review(input: InteractiveDiffReviewInput): InteractiveDiffReview {
    const target = this.trustedWorkspaces.evaluate(input.targetPath);
    const rejectingPartial = input.action === 'reject-hunk' || input.action === 'reject-file';
    const accepting = input.action === 'accept-file' || input.action === 'accept-hunk';

    let status: InteractiveDiffReview['status'] = 'recorded';
    let requiresApproval = false;
    let requiresSandbox = false;
    let summary = 'Diff decision recorded.';

    if (rejectingPartial) {
      status = 'sandbox-recompose-required';
      requiresSandbox = true;
      summary = 'Partial rejection recorded. Zavorth must recompose the plan in sandbox before applying anything.';
    } else if (accepting && input.engineId === 'velocity' && target.allowedForVelocity) {
      status = 'host-direct-ready';
      summary = 'Accepted diff is eligible for Velocity host-direct apply inside the trusted workspace.';
    } else if (accepting && input.engineId === 'shield') {
      status = 'approval-required';
      requiresApproval = true;
      requiresSandbox = true;
      summary = 'Accepted diff requires Shield approval and a receipt before host apply.';
    } else if (accepting) {
      status = 'approval-required';
      requiresApproval = true;
      requiresSandbox = true;
      summary = target.reason;
    }

    const event = this.trace.append({
      kind: 'diff',
      title: 'Interactive diff decision',
      detail: summary,
      engineId: input.engineId,
      status: status === 'host-direct-ready' ? 'success' : 'warning',
      metadata: {
        action: input.action,
        targetId: input.targetId,
        targetPath: target.path,
        workspaceTrust: target.state,
      },
    });

    return {
      id: `diff-review:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      action: input.action,
      targetId: input.targetId,
      engineId: input.engineId,
      targetPath: target.path,
      status,
      summary,
      requiresApproval,
      requiresSandbox,
      events: [event],
    };
  }

  public apply(input: InteractiveDiffApplyInput): InteractiveDiffApplyResult {
    const review = this.review(input);
    const events: GlassBoxTraceEvent[] = [...review.events];
    if (review.status !== 'host-direct-ready') {
      return {
        review,
        applied: false,
        status: statusFromReview(review),
        summary: review.summary,
        targetPath: review.targetPath,
        beforeHash: null,
        afterHash: null,
        events,
      };
    }

    if (input.action !== 'accept-file' && input.action !== 'accept-hunk') {
      return {
        review,
        applied: false,
        status: 'sandbox-required',
        summary: 'Rejected or partial diff decisions must be recomposed in sandbox before applying.',
        targetPath: review.targetPath,
        beforeHash: null,
        afterHash: null,
        events,
      };
    }

    if (!review.targetPath || !input.diffText?.trim()) {
      const event = this.trace.append({
        kind: 'diff',
        title: 'Interactive diff apply failed',
        detail: 'A target path and unified diff are required before applying a Velocity diff.',
        engineId: input.engineId,
        status: 'blocked',
        metadata: { targetId: input.targetId },
      });
      events.push(event);
      return {
        review,
        applied: false,
        status: 'blocked',
        summary: event.detail,
        targetPath: review.targetPath,
        beforeHash: null,
        afterHash: null,
        events,
      };
    }

    if (Buffer.byteLength(input.diffText, 'utf8') > MAX_DIFF_BYTES) {
      const event = this.trace.append({
        kind: 'diff',
        title: 'Interactive diff apply blocked',
        detail: 'The diff is too large for Velocity host-direct apply. Use Shield sandbox review instead.',
        engineId: input.engineId,
        status: 'blocked',
        metadata: { targetId: input.targetId, targetPath: review.targetPath },
      });
      events.push(event);
      return {
        review,
        applied: false,
        status: 'blocked',
        summary: event.detail,
        targetPath: review.targetPath,
        beforeHash: null,
        afterHash: null,
        events,
      };
    }

    try {
      const targetPath = review.targetPath;
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > MAX_TARGET_BYTES) {
        const event = this.trace.append({
          kind: 'diff',
          title: 'Interactive diff apply blocked',
          detail: 'The target file is too large for Velocity host-direct apply. Use Shield sandbox review instead.',
          engineId: input.engineId,
          status: 'blocked',
          metadata: { targetId: input.targetId, targetPath },
        });
        events.push(event);
        return {
          review,
          applied: false,
          status: 'blocked',
          summary: event.detail,
          targetPath,
          beforeHash: null,
          afterHash: null,
          events,
        };
      }
      const before = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
      const next = applyPatch(before, input.diffText);
      if (typeof next !== 'string') {
        const event = this.trace.append({
          kind: 'diff',
          title: 'Interactive diff apply failed',
          detail: 'The unified diff could not be applied cleanly to the current file content.',
          engineId: input.engineId,
          status: 'blocked',
          metadata: { targetId: input.targetId, targetPath },
        });
        events.push(event);
        return {
          review,
          applied: false,
          status: 'failed',
          summary: event.detail,
          targetPath,
          beforeHash: sha256(before),
          afterHash: null,
          events,
        };
      }

      const afterHash = sha256(next);
      const beforeHash = sha256(before);
      if (!input.dryRun) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, next, 'utf8');
      }
      const event = this.trace.append({
        kind: 'diff',
        title: input.dryRun ? 'Interactive diff dry run ready' : 'Interactive diff applied',
        detail: input.dryRun ? 'Velocity verified that the diff can be applied inside the trusted workspace.'
          : 'Velocity applied the accepted diff inside the trusted workspace.',
        engineId: input.engineId,
        status: 'success',
        metadata: {
          targetId: input.targetId,
          targetPath,
          beforeHash,
          afterHash,
          dryRun: input.dryRun === true,
        },
      });
      events.push(event);
      if (!input.dryRun) {
        const receipt = this.trace.append({
          kind: 'receipt',
          title: 'Velocity apply receipt',
          detail: 'Host-direct apply completed inside a trusted workspace and recorded hashes for replay.',
          engineId: input.engineId,
          status: 'success',
          metadata: {
            targetId: input.targetId,
            targetPath,
            beforeHash,
            afterHash,
            policy: 'trusted-workspace-only',
          },
        });
        events.push(receipt);
      }
      return {
        review,
        applied: input.dryRun !== true,
        status: input.dryRun ? 'dry-run-ready' : 'applied',
        summary: event.detail,
        targetPath,
        beforeHash,
        afterHash,
        events,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const event = this.trace.append({
        kind: 'diff',
        title: 'Interactive diff apply failed',
        detail: error instanceof Error ? err.message : 'Unknown diff apply failure.',
        engineId: input.engineId,
        status: 'blocked',
        metadata: { targetId: input.targetId, targetPath: review.targetPath },
      });
      events.push(event);
      return {
        review,
        applied: false,
        status: 'failed',
        summary: event.detail,
        targetPath: review.targetPath,
        beforeHash: null,
        afterHash: null,
        events,
      };
    }
  }
}
