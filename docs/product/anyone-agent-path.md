# Agente para o dia a dia

Produto local-first com aprendizado reversivel, setup simples e canais estaveis.

> Aprende com voce, com seguranca e desfazer. Util no chat, sem jargao.

## Capacidades

| Area | O que o usuario sente | Servico |
|------|------------------------|---------|
| Aprendizado | Preferencias e rotinas com recibo e desfazer | `ZavorthLearningRuntimeHubService` |
| First-run | Idioma, onde falar, se pode aprender sozinho | `ZavorthFirstRunHumanOnboardingService` |
| Superpoderes | Capacidades em linguagem humana | `ZavorthHumanSuperpowersService` |
| Alcance | Desktop, Telegram, WhatsApp Cloud; Baileys experimental | `ZavorthHumanReachService` |

## Aprendizado

1. Apos turno bem-sucedido, o runtime pode gravar preferencias se `learning.mode=autonomous`
2. No turno seguinte, preferencias entram no system prompt
3. Experience: card **Esquecer**
4. Telegram: "o que voce aprendeu?", "desfazer aprendizado ..."
5. CLI `anyone digest` / `undo` usa o mesmo hub

```text
turno ok → write → trusted-preferences.json
next turn → formatContextBlock → prompt
desfazer / Esquecer → undo
```

## First-run

Estado: `data/runtime/first-run-human.json`

1. Idioma
2. Onde falar (app / telegram / web / terminal)
3. Aprendizado sim/nao

- Telegram intercepta mensagens ate concluir (ou "pular setup")
- Experience expoe `snapshot.firstRun` e cards de escolha
- Frases: `comecar`, `pular setup`, `refazer setup`

## Superpoderes

Conversar, lembrar preferencias, arquivos, web, rotinas, Telegram, WhatsApp Cloud, itens aprendidos e skills locais.

- Experience: `snapshot.superpowers`
- Telegram: "o que voce sabe fazer?", "me ajude com arquivos"
- Prompt do agente recebe bloco resumido das capacidades prontas

Confianca: `Pode usar agora` / `Aprendido com voce` / `Falta setup` / `Experimental`.

## Alcance

Estaveis: Desktop, Telegram, WhatsApp Cloud API.

Experimental: WhatsApp Baileys (processo isolado).

- Experience: `snapshot.reach`
- Telegram: "onde te acho?", "como configurar telegram", "guia whatsapp"
- Preferencia de superficie vem do first-run quando existir

## CLI de diagnostico

```bash
npm run anyone
npx tsx scripts/zavorth-anyone-agent-path.ts

zavorth anyone
zavorth anyone onboard --lang pt --surface desktop
zavorth anyone digest
zavorth anyone undo <id>
zavorth anyone powers
zavorth anyone reach
zavorth anyone learn-on
zavorth anyone learn-off
```

O CLI apenas projeta os mesmos servicos do runtime.
