# Gate de Completude do Produto Pré-Tester - Fase 21R-A

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

## 1. Introdução e Objetivo
O objetivo da Fase 21R-A é validar se o estado atual do produto Zavorth (CLI, Desktop UI e documentações do Tester Kit) está maduro, claro e autoexplicativo para que um tester interno consiga operá-lo de forma independente, sem suporte ativo ou explicação externa do desenvolvedor.

A pergunta central que este gate responde é:
> *O Zavorth está suficientemente claro e completo para que uma pessoa o utilize sem ter atritos que exijam suporte direto do desenvolvedor?*

## 2. Escopo do Gate de Revisão
O gate abrange a revisão detalhada das seguintes superfícies e fluxos do produto:
1. **Primeira Inicialização & Onboarding**: Execução e clareza do onboarding inicial.
2. **Workspace Setup & Trust**: Seleção de diretórios, políticas de confiabilidade (Trust) e cockpit.
3. **Provider Setup**: Configuração de chaves de API com mascaramento e checagem de status de conexão.
4. **Cockpit & Diagnostics**: Diagnóstico de prontidão do runtime e avisos de segurança.
5. **Approvals & Safe Execution**: O fluxo de aprovação de comandos perigosos e avisos explicativos.
6. **CLI Comprehension**: Descobrabilidade de comandos (`help`, `status`, `doctor`) e acionabilidade de erros.
7. **Empty/Loading/Error States**: Textos de carregamento, estados vazios ou telas de erro em componentes chave.
8. **Tester Kit Comprehension**: Coerência do Tester Kit da Fase 21Q com o produto real.

## 3. Critérios de Avaliação e Passagem
- **BLOCKER**: Qualquer fluxo confuso, ausência de instruções claras sobre o próximo passo, ou mensagens técnicas cruas (ex: `undefined`, `null`, `[object Object]`) expostas à usabilidade do usuário. Impede a liberação de entrega.
- **SHOULD_FIX**: Fricções que enfraquecem a experiência, mas não impedem a execução básica. Deve ser priorizado para correção rápida.
- **ACCEPTABLE**: Fricções leves ou limitações que podem ser contornadas por instruções no Tester Kit ou descritas como Known Issues.
- **BACKLOG**: Melhorias futuras.

Este gate será aprovado com o veredito `READY_FOR_FIRST_CONTROLLED_TESTER_DELIVERY` apenas se **nenhum BLOCKER** estiver pendente.
