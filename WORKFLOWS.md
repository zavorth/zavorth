# WORKFLOWS.md - Standard Workflows

Recurring workflow templates the agent can execute without re-instruction.
Each workflow has clear steps, triggers, and expected outputs.

## Code Review

**Trigger:** User asks for code review or PR review

1. Run tests: `npm test`
2. Check types: `npm run typecheck`
3. Lint: `npm run lint`
4. Review diff for security issues
5. Check performance implications
6. Suggest improvements
7. Approve or request changes

## Bug Investigation

**Trigger:** User reports a bug or unexpected behavior

1. Reproduce the issue
2. Check logs and error traces
3. Identify root cause
4. Propose fix with tests
5. Verify fix resolves issue
6. Document in commit message

## Feature Implementation

**Trigger:** User requests a new feature

1. Understand requirements
2. Design approach (discuss if complex)
3. Implement with tests
4. Run full test suite
5. Update documentation
6. Create PR with description

## Morning Review

**Trigger:** Start of day or first interaction

1. Check calendar for today
2. Summarize unread important emails
3. Review PR comments on active repos
4. Suggest top 3 priorities

## Documentation Update

**Trigger:** User asks to update docs or after major changes

1. Identify affected documents
2. Review current content
3. Update with recent changes
4. Check for broken links
5. Verify formatting

## File boundary

What belongs here:
- step-by-step workflow definitions
- triggers for each workflow
- expected outputs

What does not belong here:
- one-time tasks
- user preferences
- behavioral rules

## Maintenance rule

When you discover a recurring pattern, add it as a workflow.
When a workflow becomes obsolete, remove it.
