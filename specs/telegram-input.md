# Spec: Telegram Input Handler

> Status: documento histÃ³rico de exploraÃ§Ã£o. O caminho ativo do Telegram hoje passa por `src/telegram/BotGateway.ts` e pelos controllers da pasta `src/telegram/controllers`.

**VersÃ£o:** 1.1
**Status:** Em RevisÃ£o
**Autor:** Zavorth Agent
**Data:** 2026-03-08

---

## 1. Resumo

O mÃ³dulo Telegram Input recebe eventos brutos advindos das APIs do Telegram via biblioteca grammy (Long Polling), faz a filtragem de seguranÃ§a por whitelist de ID, converte anexos (documentos PDF e arquivos/mensagens de voz de Ã¡udio) em texto viÃ¡vel, e injeta na memÃ³ria do ciclo de agente para resoluÃ§Ã£o AI.

---

## 2. Contexto e MotivaÃ§Ã£o

**Problema:**
Um LLM nativo e as APIs de LLMs cruas (DeepSeek e Gemini) consomem texto e mÃ­dias num array fixo de History. Eles nÃ£o sabem por ondem vÃªm, nem descompactam pacotes PDF ou Ã¡udios em texto nativamente no formato esperado do chat.
Frequentemente Ã© muito mais prÃ¡tico para o usuÃ¡rio enviar um Ã¡udio (Voice Note) no Telegram explicando o que ele deseja, ao invÃ©s de digitar textos longos no teclado do celular.

**EvidÃªncias:**
UsuÃ¡rios frequentemente alimentam "Agentes" com PDFs via chat para analises (Academic Skills). AlÃ©m disso, usuÃ¡rios mÃ³veis preferem interagir via Ã¡udio (Voice) pela comodidade.

**Por que agora:**
A lib Grammy suporta streaming de arquivos anexos por `getFile()`. O Nodejs lida com a ponte em RAM para extraÃ§Ã£o usando o `pdf-parse`, e a integraÃ§Ã£o com um modelo Whisper local permite extrair o texto de qualquer Ã¡udio enviado no chat de forma privada e sem custos de API externa.

---

## 3. Goals (Objetivos)

- [ ] G-01: Receber mensagens puras de texto (`message:text`) dos usuÃ¡rios em whitelist e encaminhar de forma crua ao Pipeline AI (`skill -> agent -> output`).
- [ ] G-02: Receber envios de anexo (`message:document`) que sejam do tipo `.pdf` ou `.md`, salvando temporariamente no disco para leitura (via pdf-parse ou leitura de texto puro).
- [ ] G-03: Receber mensagens de voz (`message:voice`) e arquivos de Ã¡udio (`message:audio`) de qualquer formato suportado, baixar temporariamente e realizar a transcriÃ§Ã£o para texto utilizando processamento STT (Speech-to-Text) com Whisper local. O texto transcrito Ã© encaminhado ao Pipeline AI como se fosse texto digitado.
- [ ] G-04: Informar instantaneamente ao usuÃ¡rio "Typing..." ou "Recording voice..." via API Telegram pra que o usuÃ¡rio saiba que a string de download/anÃ¡lise pesada estÃ¡ de fato sob carga de processamento e nÃ£o engasgou.
- [ ] G-05: Injetar metadados no Agent Loop quando o input do usuÃ¡rio for originado de um Ã¡udio (Voice Note), sugerindo ao LLM ou ao Output Handler que responda em voz (TTS via `en-US-JennyNeural`) na saÃ­da, a depender das regras globais do bot.

**MÃ©tricas de sucesso:**
| MÃ©trica | Baseline atual | Target | Prazo |
|---------|---------------|--------|-------|
| Arquivo Fantasma Residual TMP | Infinito | 0 bytes deixados (PDF, MD e Audio) | Always |
| Rate de Parseamento Texto | Text Only | 90% PDFs e 100% MDs lidos | MVP |
| Rate de TranscriÃ§Ã£o STT | 0% | Modelos locais lidando com Ã¡udios curtos/mÃ©dios sem CRASH de RAM | MVP |

---

## 4. Non-Goals (Fora do Escopo)

- NG-01: MÃ­dias Visuais cruas / ImageVision. Este escopo Ã© de Texto, Documentos e Ãudios. NÃ£o aceitaremos JPGs, PNGs ou OCR de imagens estÃ¡ticas no Input primÃ¡rio nesta especificaÃ§Ã£o (foco em NLP e processamento textual).
- NG-02: Receber envios via Webhook em Servidor Externo. Rodaremos num loop simples interno Long Polling na mÃ¡quina local.
- NG-03: Processamento em tempo real do stream de Ã¡udio. O sistema precisarÃ¡ que o arquivo inteiro seja baixado para iniciar o Whisper.
- NG-04: Gerar o Ã¡udio final (TTS) no prÃ³prio Input Handler. O mÃ³dulo de Input Ã© responsÃ¡vel apenas por **ouvir e sinalizar** que uma resposta em Ã¡udio foi solicitada explÃ­cita ou implicitamente (se o input for Ã¡udio). Quem envia o arquivo `.ogg` falado Ã© o Output Handler, a partir da flag setada por este mÃ³dulo ou pelo Agent Loop.

---

## 5. UsuÃ¡rios e Personas

**Usuario:** Sandeco interagindo do smartphone para a mÃ¡quina desktop local atravÃ©s de uma DM do Bot do Telegram, mandando comandos de voz dirigindo o carro pedindo para o agente agir e exigindo receber a resposta de volta em formato de voz (TTS Thalita) para audiÃ§Ã£o rÃ¡pida sem contato visual no app.

---

## 6. Requisitos Funcionais

### 6.1 Requisitos Principais

| ID | Requisito | Prioridade | CritÃ©rio de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | O sistema deve ouvir eventos `message:text` filtrados. | Must | Bot intercepta Msg ID 123 vÃ¡lida em < 2 segundos e o sistema inicia memory. |
| RF-02 | O sistema deve acionar a extraÃ§Ã£o local quando receber Documentos com mimetype `application/pdf` ou arquivos contendo a extensÃ£o `.md`. | Must | O sistema retorna o conteÃºdo do arquivo transformado em bloco de texto concatenado Ã  Legenda. |
| RF-03 | O sistema deve excluir os documentos baixados da `tmpDir` (`./tmp`) apÃ³s o parse ou em caso de erro. | Must | ExclusÃ£o do rastro na clausula finally da try-catch. Sem memory leaks no FileSystem. |
| RF-04 | O sistema deve ouvir eventos de voz (`message:voice`) e Ã¡udio (`message:audio`). | Must | O sistema reconhece anexo de aÃºdio e o envia para parser do Whisper. |
| RF-05 | O sistema deve usar o Whisper Local para transcrever o Ã¡udio baixado para texto. | Must | Ãudio convertido para STT. O log do bot mostra "Transcript: xyz" e o sistema envia para o Agent Loop. |
| RF-06 | O sistema deve sinalizar a preferÃªncia por Ã¡udio (TTS) caso o input seja originÃ¡rio de voz ou o texto possua keyword explÃ­cita ("responda em Ã¡udio / fale comigo"). | Must | O payload injetado na Memory conterÃ¡ um marcador booleano `requires_audio_reply: true` e a *voice_id* fixada em `en-US-JennyNeural`. |

### 6.2 Fluxo Principal (Happy Path)

1. Entrada: "Cria um PRD pro meu novo app de finanÃ§as e me responde em Ã¡udio" enviado por Voice Note no Telegram Client pelo usuÃ¡rio.
2. Bot Grammy valida se user ID = `TELEGRAM_ALLOWED_USER_IDS`.
3. Evento classificado como Voz via `on(["message:voice", "message:audio"])`.
4. Bot Controller atualiza status para o usuÃ¡rio do Telegram: `sendChatAction('record_voice')` ou `typing`.
5. API de stream do TG contata URL temporÃ¡ria interna para baixar chunks raw do Ã¡udio (`.ogg`, `.mp3`) no `/tmp/`.
6. Arquivo salvo Ã© encaminhado para o mÃ³dulo de Ã¡udio usando o modelo Whisper local (subprocesso/lib).
7. O sistema devolve o texto transcrito em PT-BR (ou detectado automaticamente pelo Whisper) com uma metatag interna marcando o trigger de TTS de volta, e o sistema exclui o physical temp file na conclusÃ£o do hook.
8. Texto transcrito e a Flag `requires_audio_reply` seguem para o Agent Loop injetados pelo sistema, habilitando o Telegram Output a renderizar a engine `edge_tts` no fim da chain.

### 6.3 Fluxos Alternativos

Falhas - ver seÃ§Ã£o 11.

---

## 7. Requisitos NÃ£o-Funcionais

| ID | Requisito | Valor alvo | ObservaÃ§Ã£o |
|----|-----------|-----------|------------|
| RNF-01 | Async IO | 100% Non-Blocking | O arquivo baixando nao interrompe msgs concorrentes de texto enviadas. |
| RNF-02 | STT Performance | < 2x a duraÃ§Ã£o | O tempo para Whisper processar STT nÃ£o deve exceder significativamente a extraÃ§Ã£o local dependendo da GPU ou CPU usada. |

---

## 8. Design e Interface

Pura estrutura Middleware no App Controller sem vizualizaÃ§Ã£o fora o Client TG nativo do smartphone do usuÃ¡rio. Apenas haverÃ¡ feedback de actions como envio de texto simulando se o bot realmente ouviu em paralelo a extraÃ§Ã£o STT.

---

## 9. Modelo de Dados

NÃ£o gera tabela SQLite (Input apenas intermedeia).
As mensagens se tornam blocos injetados na Memory SQLite com as quebras. 
A pasta `/tmp/` retÃ©m temporariamente `.pdf`, `.md`, `.mp3`, `.ogg`, etc.

---

## 10. IntegraÃ§Ãµes e DependÃªncias

| DependÃªncia | Tipo | Impacto se indisponÃ­vel |
|-------------|------|------------------------|
| GrammyJS | ObrigatÃ³ria | Nenhuma intercepÃ§Ã£o ocorrerÃ¡. |
| Pdf-Parse npm | SecundÃ¡ria | Texto cairÃ¡ no Agent Loop como string vazia de documento ininteligÃ­vel. |
| Whisper Local CLI/Lib | SecundÃ¡ria | Falha a transcriÃ§Ã£o e bot responde: "âš ï¸ NÃ£o consegui inicializar o Whisper local agora." |
| Engine Edge-TTS | SecundÃ¡ria | O Input mapeia a Flag de Ã¡udio. Se o mÃ³dulo Output falhar em processar, ocorre Fall-back para texto no final. O impacto primÃ¡rio de identificar a intenÃ§Ã£o Ã© salvo. |

---

## 11. Edge Cases e Tratamento de Erros

| CenÃ¡rio | Trigger | Comportamento esperado |
|---------|---------|----------------------|
| EC-01: Anexo nÃ£o Ã© suportado | UsuÃ¡rio envia DOCX, XLS ou JPG. | O sistema responde via Telegram: "âš ï¸ No momento, sÃ³ consigo processar texto estruturado (.md), Ã¡udio e PDF.", cancela o processamento e aciona a limpeza do TEMP. |
| EC-02: OOM (Out of Memory) no Whisper | Ãudio massivo pesa e Whisper crasha o processo no host. | Timeout de 60s e trycatch do Node envelopa falha. O sistema envia e o usuÃ¡rio recebe: "âš ï¸ Falha ao processar o Ã¡udio: arquivo grande demais ou falha no serviÃ§o." |
| EC-03: Ãudio vazio ou mudo | Arquivo com barulho nulo enviado. | Whisper retorna `""`. O sistema envia a resposta ao usuÃ¡rio: "Ãudio vazio captado. Pode reenviar?" e nÃ£o polui o Agent Loop com string vazia. |
| EC-04: PDF massivo | Upload finalizado e parsing travando estourando local. | Envelopamento de limite de Bytes (ex. 20MB max para text extract). O Catch block captura falha de Memory e o sistema limpa o TEMP no `finally`. O usuÃ¡rio recebe alerta de PDF muito grande. |
| EC-05: Timeout da API do Telegram (Download de MÃ­dia) | A rede falha durante o streaming do arquivo de Ã¡udio ou PDF pelo Telegram. | O downloader dÃ¡ throw de Timeout apÃ³s 15 segundos sem bytes recebidos. O bot envia mensagem ao usuÃ¡rio: "âš ï¸ Falha ao baixar arquivo do Telegram. Tente novamente." e a promise falha limpando qualquer resquÃ­cio de chunk. |
| EC-06: API de LLM Externa indisponÃ­vel para Agent Loop | STT extrai o texto perfeitamente, a LLM do Core cai em seguida | O STT conclui sua parte transcrevendo e injeta o texto na Memory. A falha da LLM subsequente Ã© tratada pelo Handler Generativo. O input Ã© mantido como texto salvo. |
| EC-07: SolicitaÃ§Ã£o explÃ­cita por Ã¡udio ambÃ­gua | UsuÃ¡rio manda "responda isso sem ser em Ã¡udio" | Se nÃ£o for flag por RegEx ou NLP fino, o sistema pode nÃ£o setar "requires_audio_reply". Por design atual, ele apenas injeta `true` se a intenÃ§Ã£o for estritamente confirmada via LLM guardrail e/ou via Ã¡udio nativo (Voice Note que assume default = true). |

---

## 12. SeguranÃ§a e Privacidade

- **Upload e Download Seguro:** Ao nÃ£o salvar links externos nem exibir uploads localmente de forma compartilhada, asseguramos sandboxing.
- **TranscriÃ§Ãµes Locais:** A voz trafega end-to-end do telegram ao storage local e Ã© consumida localmente sem ir para OpenAI Whisper cloud endpoints. Total controle de privacidade.

---

## 13. Plano de Rollout

A estrutura do `AudioHandler` acoplada ao Bot Core ficarÃ£o em produÃ§Ã£o local assim que instancializada no App() init() ou acopladas nas rules do `Composer.on("message:voice")`.

---

## 14. Open Questions

- Como acionar o Whisper local a partir do backend Node.js (se Zavorth ainda for Node). *DecisÃ£o pendente: usar bridge FFI, ou Child Process nativo na mÃ¡quina.*
- Precisaremos de um `ffmpeg` standalone local para converter aÃºdio em formato compatÃ­vel com o whisper ou o prÃ³prio whisper local processa os M4A, OPUS/OGG (nativos do Telegram)? *Assume-se que whisper lida com OGG/OPUS baseados em FFMEPG instalado na mÃ¡quina da Host.*

---

## 15. RelatÃ³rio de AvaliaÃ§Ã£o Final (SDD)
```text
============================================================
  SPEC QUALITY REPORT
  SCORE TOTAL: 94.0/100  â€”  â­ Excelente â€” Pronta para implementaÃ§Ã£o

  BREAKDOWN POR DIMENSÃƒO:
  Completude           100%       30%     30.0/pt
  Testabilidade        100%       25%     25.0/pt
  Clareza               70%       20%     14.0/pt
  Escopo               100%       15%     15.0/pt
  Edge Cases           100%       10%     10.0/pt

  âœ… PONTOS FORTES:
     âœ… SeÃ§Ã£o 1 (Resumo) presente e preenchida
     âœ… SeÃ§Ã£o 2 (Contexto) presente e preenchida
     âœ… SeÃ§Ã£o 3 (Goals) presente e preenchida
     âœ… SeÃ§Ã£o 4 (Non-Goals) presente e preenchida
     âœ… SeÃ§Ã£o 5 (UsuÃ¡rios) presente e preenchida
============================================================
```
