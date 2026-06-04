---
title: "Getting started"
description: "Install Zavorth, run setup, and send your first message in about 5 minutes."
---

Install Zavorth, set it up for yourself, and send your first message — all in about 5 minutes.

## What you need

- **Node.js 18 or newer** — check with `node --version`
- **An API key** from any model provider (Google Gemini, Anthropic, OpenAI, etc.) — the setup wizard will ask for it

<Tip>
**Windows users:** Zavorth works on native Windows and WSL2. Both are supported.
Need Node? [nodejs.org](https://nodejs.org) has installers for every platform.
</Tip>

## Setup

<Steps>
  <Step title="Install Zavorth">
    <Tabs>
      <Tab title="macOS / Linux">
        ```bash
        curl -fsSL https://zavorth.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        irm https://zavorth.ai/install.ps1 | iex
        ```
      </Tab>
      <Tab title="npm (any platform)">
        ```bash
        npm install -g zavorth@latest
        ```
      </Tab>
    </Tabs>

    Verify the install worked:
    ```bash
    zavorth --version
    ```
  </Step>

  <Step title="Run setup">
    ```bash
    zavorth setup
    ```

    The setup wizard walks you through:
    - **Choosing a model** — Gemini, Claude, GPT-4o, DeepSeek, or a local model
    - **Entering your API key** — stored locally, never sent anywhere except your chosen provider
    - **Calibrating Zavorth** — what to call it, what to call you, what language to use, how cautious it should be

    This takes about 3 minutes. You can change everything later.
  </Step>

  <Step title="Start the runtime">
    ```bash
    zavorth start
    ```

    Zavorth starts a local runtime process that handles requests, channels, and approvals.
  </Step>

  <Step title="Open the dashboard">
    ```bash
    zavorth open
    ```

    This opens **ZavorthControl** in your browser — the main interface where you chat, approve tasks, and see what Zavorth is doing.
  </Step>

  <Step title="Send your first message">
    Type anything in the chat. Try:

    ```
    What can you do?
    ```

    Or something real:

    ```
    Summarize the files in this folder and tell me what the project does.
    ```

    Want to chat from your phone instead? Connect [Telegram](/docs/produto/canais/telegram) — it only takes a bot token.
  </Step>
</Steps>

## Check everything is working

```bash
zavorth ready
```

This tells you if your provider, channels, and runtime are all set up correctly. If something is missing, it tells you exactly what to fix.

## What to do next

<Columns>
  <Card title="Connect a channel" href="/docs/produto/canais" icon="message-square">
    Chat with Zavorth from Telegram, Discord, WhatsApp, Slack, and more.
  </Card>
  <Card title="Customize Zavorth" href="/docs/produto/start/onboarding" icon="sparkles">
    Change its name, personality, language, and what needs your approval.
  </Card>
  <Card title="Switch AI models" href="/docs/produto/providers" icon="cpu">
    Try a different provider or add a local model.
  </Card>
  <Card title="Install skills" href="/docs/produto/skills" icon="package">
    Give Zavorth new abilities with ready-made skills.
  </Card>
</Columns>

## Related

- [What is Zavorth?](/docs/produto/start/what-is-zavorth)
- [Channels](/docs/produto/canais)
- [ZavorthControl dashboard](/docs/produto/interfaces/zavorthcontrol)
