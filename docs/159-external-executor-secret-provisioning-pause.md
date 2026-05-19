# External Executor Secret Provisioning

Zavorth does not migrate or expose raw secrets for external executors.

External execution can only use secrets through governed `SecretRef` references.
The runtime must preserve these rules:

- no raw secret values in prompts, logs, receipts, screenshots, or docs;
- no automatic secret migration from external tools;
- no live external executor without explicit profile approval;
- no shell interpolation for external executor commands;
- no credential access outside the declared allowlist;
- every live invocation produces a receipt.

If an external executor needs credentials, configure them through the Zavorth
secret/reference flow and verify readiness before enabling live use.
