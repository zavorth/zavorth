# Priority Imported Skill Candidates

These are the external skills inspected as source material for Zavorth-native promotion.
They are not trusted or enabled by default. Zavorth uses them as reference material only.

## Promoted into native

- `external/subagent-driven-development`: informed `zavorth-subagent-development`; useful for splitting implementation work into registered lanes with staged review.
- `external/taskflow`: informed `zavorth-taskflow`; useful for durable, resumable work with waits and child tasks.
- `external/taskflow-inbox-triage`: informed the TaskFlow wait/routing pattern; useful as a concrete example, not as a standalone native skill.
- `AIAgentSkills/alinaqi_claude-bootstrap/workspace`: inspired `zavorth-workspace-scope`; useful because the desktop needs real project-folder boundaries.
- `AIAgentSkills/alinaqi_claude-bootstrap/ai-models`: inspired `zavorth-model-routing`; useful for model selection concepts, but not copied because model lists become stale.
- `AIAgentSkills/alinaqi_claude-bootstrap/model-routing`: inspired `zavorth-model-routing`; useful conceptually, but the original is Claude-hook-specific and lacks portable frontmatter.
- `AIAgentSkills/honeydew-ai/conversation-review`: inspired `zavorth-conversation-review`; useful for turning feedback into memory/context/product improvements.

## Kept as reference, not promoted

- `external/browser-automation`: good operational browser discipline, but Zavorth already has `zavorth-browser-operator`; its stable-ref/snapshot ideas should inform runtime/browser implementation.
- `AIAgentSkills/code-review` variants: useful review discipline, but Zavorth already has `code-review` and `zavorth-dev-workbench`; external versions depend on specific engines such as CodeRabbit or ADR gates.
- `AIAgentSkills/deep-research`: useful research pattern, but provider-specific and cost-bearing; Zavorth already has `zavorth-research-synthesis` and `web-research-governed`.
- `AIAgentSkills/research-review`: useful external-review pattern, but depends on unavailable MCP reviewer backends.
- `AIAgentSkills/documentation`: useful Diataxis structure, but broad docs work is already covered by file/document and dev-workbench skills until a Zavorth docs product surface exists.
- `AIAgentSkills/agentic-development`: useful for building agents, but too framework-specific for native runtime behavior.
