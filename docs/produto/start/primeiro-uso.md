---
title: "Primeiro uso"
description: "Um caminho simples para instalar, conversar, conectar um modelo e entender o que o Zavorth faz antes de mudar algo importante."
---

# Primeiro uso

Esta pagina e para quem quer sair do zero e usar o Zavorth sem aprender a arquitetura interna.

## O caminho feliz

<Steps>
  <Step title="Instale">
    ```bash
    npm install -g zavorth@latest
    ```

    Depois confirme:

    ```bash
    zavorth --version
    ```
  </Step>

  <Step title="Configure o basico">
    ```bash
    zavorth setup
    ```

    O setup pede o minimo necessario: modelo de IA, chave do provedor, idioma, perfil de uso e como o Zavorth deve agir quando uma tarefa parecer sensivel.
  </Step>

  <Step title="Abra o dashboard">
    ```bash
    zavorth start
    zavorth open
    ```

    O dashboard abre direto no chat. As areas de configuracao, memoria, skills, recibos e canais ficam ao redor, mas nao precisam interromper sua conversa.
  </Step>

  <Step title="Envie uma mensagem real">
    Comece com algo simples:

    ```text
    Revise esta pasta e me diga o que este projeto faz. Nao altere arquivos.
    ```

    Para uma primeira automacao:

    ```text
    Organize minhas tarefas de hoje e me diga o que voce precisa que eu aprove.
    ```
  </Step>
</Steps>

## O que esperar da primeira conversa

Zavorth pode responder de tres formas:

- **Resposta direta**: quando so precisa conversar, resumir ou explicar.
- **Preview**: quando ele quer mostrar o plano antes de agir.
- **Aprovacao**: quando a acao envolve arquivo, comando, envio externo, segredo, canal, provedor ou mudanca de seguranca.

Se ele pedir aprovacao, isso nao e um erro. E o momento em que voce ve o que vai acontecer antes de permitir.

## Conectar um modelo

Se o setup ainda nao tiver um modelo pronto:

```bash
zavorth readiness
```

Abra a secao de providers no dashboard e siga o proximo passo mostrado. Normalmente voce so precisa colar a chave do provedor escolhido e testar a conexao.

Guias uteis:

- [Providers](/docs/produto/providers)
- [Gemini](/docs/produto/providers/gemini)
- [Anthropic](/docs/produto/providers/anthropic)
- [Modelo local](/docs/produto/providers/local)

## Conectar um canal

Voce pode usar o Zavorth so pelo dashboard. Canais como Telegram, Slack, WhatsApp, Signal, Email e Discord sao opcionais.

Comece por um canal, teste, e so depois conecte outros:

- [Telegram](/docs/produto/canais/telegram)
- [Slack](/docs/produto/canais/slack)
- [WhatsApp](/docs/produto/canais/whatsapp)
- [Discord](/docs/produto/canais/discord)
- [Email](/docs/produto/canais/email)

Cada canal deve mostrar se esta pronto, em preview ou apenas aguardando credencial. Se nao estiver pronto, o Zavorth deve dizer o motivo e o proximo passo.

## Memoria sem caixa preta

Quando o Zavorth aprende algo util, voce deve conseguir ver:

- o que foi aprendido;
- de onde veio;
- qual a confianca;
- quando expira;
- como editar ou esquecer.

Preferencias simples podem ser aplicadas em silencio. Coisas sensiveis precisam de revisao.

## Se algo nao funcionar

Rode:

```bash
zavorth readiness
```

Depois veja:

- [Troubleshooting guiado](/docs/produto/ajuda/troubleshooting)
- [ZavorthControl](/docs/produto/interfaces/zavorthcontrol)
- [Como aprovacoes funcionam](/docs/produto/conceitos/aprovacoes)

## Regra pratica

Use o Zavorth como um assistente normal. Quando algo precisar de cuidado, ele deve mostrar um preview claro, pedir sua decisao e deixar um recibo para voce revisar depois.
