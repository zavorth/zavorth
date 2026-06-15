# Security Readiness Known Issues (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento registra as limitações conhecidas, riscos residuais aceitos e pendências identificadas para fases posteriores do projeto.

---

## 1. Problemas e Riscos Residuais Identificados

### 1.1 Suffixes de Chaves de API
- **Classificação**: **P3** (Low intensity sensitive metadata / Sensível leve)
- **Status**: Monitorado.
- **Detalhamento**: O sufixo da chave de API é classificado como metadado sensível leve. Ele é permitido exclusivamente na interface do usuário (UI) local para ajudar o usuário a identificar a chave configurada. No entanto, é estritamente ocultado de saídas de CLI não confiáveis, respostas de serviços de rede pública, logs e documentações gerais.
- **Mitigação**: Testes automatizados garantem a sua não aparição em fluxos públicos.

### 1.2 Limitações de Simulação TOCTOU
- **Classificação**: **P2**
- **Status**: Mitigado via abstração de teste.
- **Detalhamento**: Simular uma falha de TOCTOU (Time-of-Check to Time-of-Use) no sistema de arquivos do sistema operacional real pode ser não determinístico em ambientes de integração contínua (CI).
- **Mitigação**: O `TemporaryDirectoryTrustService` fornece uma abstração testável que permite injetar uma revalidação imediata do caminho real do symlink antes do uso e simular a mudança de destino do symlink.

### 1.3 Bloqueio de Entrega para Testers Externos
- **Classificação**: **P0** (Mitigado por escopo)
- **Status**: Resolvido.
- **Detalhamento**: Não há entrega para testers externos ou internos nesta fase. A infraestrutura do instalador, publicação de builds e auto-updates não estão ativas ou no escopo.
- **Mitigação**: O veredito da fase é estritamente de preparação e endurecimento de segurança (`GO_FOR_INTERNAL_TESTER_DELIVERY_PREP`), e nenhuma entrega física é permitida.
