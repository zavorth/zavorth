# Zavorth - Internal Beta Delivery Checklist

Este checklist formaliza os critérios obrigatórios a serem verificados antes da entrega do artefato aos testers internos.

## Checklist de Prontidão de Entrega

* [x] **HEAD Confirmado**: O HEAD do repositório bate com o commit do Release Candidate.
* [x] **Tag RC Confirmada**: A tag `zavorth-internal-beta-rc-2026-06-14` está criada localmente.
* [x] **Working Tree Limpa**: `git status` está limpo antes do commit final.
* [x] **Build Gerado com Sucesso**: `surfaces:check`, `runtime:check` e o build Vite do desktop passam sem erros.
* [x] **Checksum SHA256 Gerado**: O checksum do pacote ZIP foi calculado e documentado.
* [x] **Tester Instructions Revisadas**: As instruções em `internal-beta-tester-instructions.md` são claras e adequadas.
* [x] **Rollback Revisado**: Os procedimentos de reset e rollback estão documentados de forma segura em `internal-beta-rollback.md`.
* [x] **Known Issues Revisados**: Os problemas conhecidos P2 foram catalogados em `internal-beta-known-issues.md`.
* [x] **Sem Bloqueadores P0/P1**: Não restam issues críticas de segurança ou estabilidade pendentes.
* [x] **Sem Secrets/Keys em Docs**: Varredura estática de segredos executada com sucesso.
* [x] **Sem Markers de Teste em Docs**: Sem markers de leak em arquivos de documentação.
* [x] **Sem Artefatos Binários Commitados**: Nenhum arquivo `.zip`, `.exe`, `.msi` ou dist de build foi concluído ou commitado no Git.
* [x] **Sem Push Remoto**: Nenhuma alteração foi enviada para servidores git externos ou remotos.
* [x] **Sem Public Release**: Nenhuma divulgação ou publicação pública foi configurada.
