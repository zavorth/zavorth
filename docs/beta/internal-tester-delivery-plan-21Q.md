# Plan de Entrega Interna Controlada - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

## 1. Objetivo
Definir o plano de homologação e a entrega futura controlada do Zavorth para testers internos. O objetivo é validar a estabilidade e a segurança da interface e CLI do app antes de qualquer liberação em maior escala.

## 2. Público-Alvo (Internal Testers)
- **Quantidade**: Limitado a 1 ou 2 testers internos autorizados.
- **Ambiente de Execução**: Máquinas de desenvolvimento locais, sem exposição de rede externa.

## 3. Pré-requisitos do Tester
- Node.js (v18+) instalado localmente.
- Conhecimento básico de terminal.
- Um diretório de desenvolvimento local para atuar como workspace de teste (preferencialmente não-sensível e sem dados pessoais ou código proprietário).
- Provedor LLM local ou chaves de API restritas para testes (de preferência limites baixos e monitorados).

## 4. Sistemas Operacionais Suportados
- Windows 10/11 (PowerShell/CMD).
- macOS 12+ (zsh).
- Linux (Ubuntu/Debian, bash).

## 5. Janela de Teste Sugerida
- Duração de 48 horas a partir da data de autorização formal da entrega (atualmente não iniciada).

## 6. Canais de Suporte
- Canal privado de chat interno no grupo de desenvolvimento.
- Responsável pela triagem de incidentes: QA Lead.

## 7. Critérios de GO/NO-GO
- **GO**: 100% dos testes de regressão e segurança passando; checksum verificado e correspondente; manifesto documentado e verificado; sem conhecidos bugs P0 ou P1 pendentes.
- **NO-GO**: Qualquer falha em testes de regressão; qualquer detecção de segredo real no build; discrepância de checksum; detecção de bugs P0/P1.

## 8. Verificação de Integridade (SHA256 Checksum)
Antes de descompactar o pacote candidato, o tester deve rodar o seguinte comando para confirmar que o arquivo não foi alterado:

```powershell
Get-FileHash -Path .\zavorth-internal-tester-candidate-21q-2026-06-15.zip -Algorithm SHA256
```

O hash resultante deve bater exatamente com o hash oficial contido no [Manifesto de Artefatos](internal-tester-artifact-manifest-21Q.md).

## 9. Como Reportar Bugs
O tester deve usar o [Template de Feedback](internal-tester-feedback-template-21Q.md) e seguir estritamente as diretrizes de redação contidas no [Guia de Relato Seguro](internal-tester-safe-reporting-guide-21Q.md).

## 10. Remoção e Parada de Emergência
Se qualquer comportamento destrutivo ou incidente de vazamento de segredos for identificado, o teste deve ser interrompido imediatamente e o app removido conforme o [Guia de Rollback](internal-tester-rollback-reset-guide-21Q.md).
