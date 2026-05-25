# Zavorth Native Learning Loop

Phase 3 turns Mnemos into the native learning layer for daily use without weakening the harness.

## What It Adds

- Session search through top-k, untrusted Mnemos recall.
- Auto-skill candidate preview after repeated successful workflows.
- Skill improvement candidate routing through the governed skill evolution lane.
- Approval-based nudges for pending learning, skill drafts and memory promotion.
- A reversible user model that stays `suggest-only` until the operator approves behavior changes.
- A security policy firewall: learning can never modify approvals, allowlists, sandbox policy, Effect Boundary, intent safety or other core guardrails.

## Operator Commands

```bash
npm run zavorth:native-learning-loop
npm run zavorth:native-learning-loop:json
npm run zavorth:native-learning-loop -- --query "github review"
npm run zavorth:native-learning-loop -- --observe "summarize a github pr and list changed files"
npm run zavorth:native-learning-loop:check --silent
```

## Contract Guarantees

- `neverLearnsSecurityPolicy`: core safety policy is immutable to learning loops.
- `everyBehaviorChangeRequiresApproval`: learning candidates are drafts until approval.
- `userModelIsReversible`: approved preferences can be revoked.
- `recallIsTopKAndUntrusted`: session search never injects raw memory as trusted instruction.
- `autoSkillsStartAsDrafts`: auto-skill creation begins as a preview, not an install.
- `skillImprovementsUseSandboxAndReceipts`: skill changes stay behind sandbox/eval/receipts.
- `nudgesAreApprovalCandidates`: proactive suggestions are reviewable, not silent behavior changes.

## How It Uses Existing Zavorth Systems

- `ZavorthMemoryLearningLoopService` provides FTS/top-k recall and skill-candidate scoring.
- `ZavorthSkillEvolutionService` provides draft, sandbox, eval, approval and rollback flow for skills.
- `ZavorthReplayLearningService` provides the reversible suggest-only user model.
- `ZavorthMnemosProceduralMemoryService` turns recurring behavior into approval-gated procedures.

This is not a second brain beside the LLM. It is a governed memory and learning control plane that serves the LLM with safer context, better reusable procedures and explicit operator consent.
