# Critérios de Parada e Plano de Suporte - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Este documento define os procedimentos de triagem, SLA de resposta, regras para solicitação de diagnóstico e os critérios mandatórios de interrupção (Stop Criteria) de testes.

---

## 1. Plano de Suporte e SLA

- **Responsável pela Triagem**: QA Lead / Equipe de Engenharia do Zavorth.
- **Canal de Comunicação**: Chat privado de incidentes.
- **Janela de Resposta (SLA)**:
  - Incidentes de Segurança (P0): Retorno imediato (máximo de 1 hora durante a janela).
  - Bugs Funcionais (P1/P2): Até 4 horas.
  - Ajustes leves (P3): Até 12 horas.

---

## 2. Solicitação de Diagnóstico (Logs)

- **QUANDO pedir logs**: Apenas quando o erro for funcional (P1/P2) e não puder ser reproduzido no ambiente de desenvolvimento local com os passos descritos.
- **QUANDO NÃO pedir logs**: Nunca peça logs brutos quando o tester relatar que o erro ocorreu especificamente em uma chamada de API que utiliza chaves de produção ou que envolve decodificação de senhas, para evitar trânsito de chaves reais.
- **Redação Prévia**: É dever da equipe técnica lembrar o tester de aplicar o [Guia de Relato Seguro](internal-tester-safe-reporting-guide-21Q.md) antes de enviar qualquer arquivo.

---

## 3. Critérios de Parada Mandatórios (Stop Criteria)

O teste deve ser **interrompido imediatamente** por qualquer tester ou pela equipe técnica se qualquer um dos seguintes eventos ocorrer:

1. **Vazamento de Chave Real (Secret Leak)**: Qualquer detecção de chaves de API reais de provedores, senhas ou tokens confidenciais nos arquivos de log, banco de dados local exposto ou tela de interface.
2. **Execução de Ferramenta Não Autorizada (Unauthorized Tool Execution)**: Se o agente conseguir executar comandos no host ou ler/escrever arquivos fora das permissões permitidas pela policy configurada, em especial quando `channelUserIdAllowed` for `false`.
3. **Escrita Destrutiva Inesperada (Destructive Write)**: Qualquer exclusão de arquivos ou pastas fora do escopo do workspace de teste.
4. **Bypass de Workspace Boundary**: Leitura ou escrita de arquivos em pastas do sistema que não estão cadastradas no trust de diretório.
5. **Uso Não Autorizado de PTY/HPM**: Inicialização de sessão de terminal interativo (PTY) ou alteração de consumo de energia do host (HPM) sem autorização prévia por escrito.
6. **Vazamento do Artefato (Build Leak)**: Se o link de download candidato ou arquivo ZIP for compartilhado com qualquer pessoa fora do grupo estrito de testers autorizados.
7. **Crash na Abertura (Fatal Startup Crash)**: Se o app falhar ao inicializar, impedindo o carregamento da tela principal ou CLI devido a erros catastróficos de build.

---

## 4. Revogação e Bloqueio de Entrega
Se um Critério de Parada for acionado:
- A equipe de desenvolvimento suspenderá imediatamente o teste de todos os testers participantes.
- O build candidato atual será marcado como **NO-GO / REVOGADO**.
- Novas distribuições locais serão terminantemente bloqueadas até que o patch de correção passe por completo pelo gate de segurança da Fase 21P e um novo manifesto seja homologado.
