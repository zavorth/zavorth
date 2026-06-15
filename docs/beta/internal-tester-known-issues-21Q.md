# Conhecidos Problemas e Limitações - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Este documento registra as limitações estruturais e problemas conhecidos no build candidato para teste interno do Zavorth.

---

## 1. Status de Incidentes Graves (P0/P1)

```text
No P0/P1 known issues at the time of this preparation.
```

Não foram detectados bugs P0 (vazamentos de segurança, execução de ferramenta arbitrária, corrupção de arquivos do host) ou bugs P1 (travamento catastrófico na abertura, impossibilidade de configurar provedor LLM local) durante as baterias de testes e auditorias automatizadas desta fase.

---

## 2. Limitações de Escopo e Distribuição

1. **Uso Exclusivo para Testadores Internos (Internal Tester Only)**: Este artefato foi compilado sob política estrita de ambiente controlado. Não possui chaves de produção integradas ou assinatura digital oficial para distribuição pública.
2. **Ambiente Não-Produtivo (Not Production-Ready)**: O app não deve ser utilizado como runtime principal em projetos comerciais ativos de produção. Destina-se apenas a cenários simulados.
3. **Dependência de Setup Local (Local Candidate ZIP)**: O pacote ZIP local exige a presença prévia de um ambiente Node.js v18+ compatível e comandos executados via linha de comando local para iniciar o runtime.
4. **Superfícies de Autoridade Avançadas Desativadas**: Funcionalidades que requerem alteração nas políticas de energia do host (HPM) ou sessões de terminal interativas irrestritas (PTY) estão desativadas por padrão nesta build candidato e não devem ser exercitadas pelo tester sem instruções explícitas por escrito.
5. **Políticas Rígidas de Canal (WhatsApp/Telegram)**: Quando simulados contextos de canais privados onde `channelUserIdAllowed` é falso, a exposição de ferramentas é zerada (`mode = 'unknown'`, zero tools disponíveis). O tester deve estar ciente de que o agente não poderá executar nenhuma ferramenta nesse modo de governança.
