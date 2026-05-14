# LLM Audit Checks

## Confirmed high-risk patterns

Treat as high or critical when clearly evidenced:

- user-controlled content inserted into a privileged system prompt
- model output directly selecting or invoking tools without authorization checks
- sensitive system prompts, tools, or secrets returned to users
- retrieval results or documents treated as trusted instructions

## Likely risk patterns

Treat as high or medium depending on context:

- chat history, file contents, or URLs passed to the model without trust separation
- no sanitization before rendering model-produced HTML or markdown
- no allowlist for tools or actions
- agent actions triggered from natural language without role checks

## Manual review prompts

If evidence is incomplete, recommend verifying:

- whether tool execution is authorized per user role
- whether secrets are redacted from prompts and logs
- whether retrieval content can override system behavior
- whether model output is escaped before rendering
