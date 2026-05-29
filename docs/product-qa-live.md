# Zavorth Product QA Live Matrix

Phase 9 adds a single final product QA matrix for the everyday user journey:

```txt
fresh install -> provider -> Telegram -> mutation approval -> receipt -> zavorthControl -> CLI -> learning -> rollback/sandbox
```

The matrix is intentionally honest. Local and dry-run proof can certify that the
surface, scripts, policies and receipts exist. Real provider and Telegram proof
still requires real credentials, allowlists and operator-owned live receipts.

## Commands

```bash
npm run zavorth:product-qa-live
npm run zavorth:product-qa-live:json
npm run zavorth:product-qa-live -- --require-live
npm run zavorth:product-qa-live:check --silent
npm run zavorth:product-readiness:check --silent
```

## Matrix Rows

| Row | Purpose | Live proof |
| --- | --- | --- |
| `fresh-install` | Installer scripts, launcher and install docs are present. | Optional |
| `real-provider` | A configured LLM provider can answer a real prompt. | Required |
| `real-telegram` | Telegram bot token, allowlist, pairing and delivery receipt exist. | Required |
| `mutation-approval` | Sensitive changes create an approval/action-card flow. | Optional |
| `receipt` | Evidence proof pack and redacted receipts are available. | Not required |
| `control` | `/control` can show chat, approvals, receipts, learning and health. | Optional |
| `cli` | The terminal daily path works from a clean shell. | Not required |
| `learning-candidate` | Mnemos can propose reversible learning after successful work. | Optional |
| `rollback-sandbox` | Sandbox lifecycle and rollback checks exist before host mutation. | Optional |

## Live Credential Signals

Provider live proof accepts signals such as:

```txt
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_API_KEY
GEMINI_API_KEY
OPENROUTER_API_KEY
GROQ_API_KEY
MISTRAL_API_KEY
DEEPSEEK_API_KEY
XAI_API_KEY
ZAVORTH_LLM_PROVIDER
ZAVORTH_PROVIDER_READY
```

Telegram live proof requires both a token and an allowlist signal:

```txt
TELEGRAM_BOT_TOKEN
ZAVORTH_TELEGRAM_BOT_TOKEN
TELEGRAM_ALLOWED_USER_IDS
TELEGRAM_ALLOWED_CHAT_IDS
ZAVORTH_TELEGRAM_ALLOWED_USERS
ZAVORTH_TELEGRAM_ALLOWED_CHATS
```

Secret values are never serialized into the matrix, logs or receipts.

## Manual Product QA Pass

Use this after the local check passes:

1. Run a clean installer dry-run.
2. Configure a real provider through setup.
3. Ask a real prompt in the CLI.
4. Configure Telegram with token and allowlist.
5. Send a Telegram status message and verify the receipt.
6. Ask Zavorth to prepare a tiny safe mutation.
7. Approve or reject it in CLI and `/control`.
8. Confirm the receipt and rollback/sandbox evidence.
9. Complete one successful run and review the generated Mnemos learning candidate.

The product readiness gate includes this matrix, so a release cannot claim final
product QA coverage without it.
