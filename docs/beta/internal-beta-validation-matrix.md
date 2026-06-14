# Zavorth - Internal Beta Validation Matrix

Esta matriz detalha as validações e o estado atual de conformidade do Zavorth para o Release Candidate do Beta Interno.

## Matriz de Validação

| Item de Validação | Status | Observações |
| :--- | :---: | :--- |
| Windows dev machine | **PASS** | Testado e verificado localmente em Windows com Node.js v22+ |
| fresh app state | **PASS** | Safe defaults aplicados na ausência de configuração |
| workspace trusted | **PASS** | Validação de Workspace ID e controle de escopo ativos |
| provider configured | **PASS** | Armazenamento seguro de credenciais via SecretStore ativo |
| provider connection test | **PASS** | Fluxo de teste sanitizado sem vazamento de chaves ou endpoints |
| default model selected | **PASS** | Seleção de modelos padrão ativa e integrada |
| agent runtime ready | **PASS** | ReadinessCard e políticas expostas de forma segura na UI |
| safe task execution | **PASS** | Execuções seguras ocorrem dentro do workspace |
| approval flow | **PASS** | Interceptação e tela de aprovação de comandos HPM/PTY ativa |
| HPM blocked by default | **PASS** | Host Power Mode desativado por padrão nas políticas seguras |
| PTY blocked by default | **PASS** | Subsistema PTY desativado por padrão nas políticas seguras |
| PTY requires HPM | **PASS** | Restrição de segurança impede PTY sem autorização de HPM |
| fallback blocked by default | **PASS** | Fallback de provider desativado por padrão |
| diagnostics local-only | **PASS** | Execução de diagnósticos estritamente local e sem telemetria |
| checklist passive-only | **PASS** | O checklist de onboarding é puramente descritivo e passivo |
| secrets audit | **PASS** | Tokens sk-*, Bearer e Authorization limpos e mascarados |
| console/log audit | **PASS** | Sem logs de chaves brutas ou informações sensíveis de requisições |
| known issues documented | **PASS** | Documento `internal-beta-known-issues.md` criado e atualizado |
| rollback/reset path documented | **PASS** | Procedimento de reset por remoção do banco local documentado |
