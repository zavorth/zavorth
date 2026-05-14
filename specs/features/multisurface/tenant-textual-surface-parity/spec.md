# Tenant Textual Surface Parity

## Objective
Deixar `/tenants` nas superfícies textuais tão claro quanto o `/app`, expondo contexto operacional do tenant e sinalizando explicitamente quais ações já são `guided`.

## Requirements
- `/tenants` deve mostrar contexto mínimo útil por tenant quando disponível.
- As ações listadas em `/tenants` devem indicar `guided` ou `compose`.
- A saída deve continuar segura para Telegram e Discord owner-only, sem criar mutações novas por padrão.

## Acceptance
- O operador consegue distinguir, lendo `/tenants`, quais ações já rodam de forma guiada.
- O contexto de sessão/origem/runtime aparece quando existir no snapshot do tenant.
