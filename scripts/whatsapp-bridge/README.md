# Zavorth WhatsApp Baileys Bridge

Processo isolado. Nao e dependencia do `package.json` raiz. O core so fala HTTP.

## Install

```bash
cd scripts/whatsapp-bridge
npm install
```

## Run

```bash
# from repo root
npm run whatsapp-bridge:start
npm run whatsapp-bridge:status
# or
npx tsx scripts/zavorth-whatsapp-bridge.ts start|stop|status|pair
```

## Env

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_BRIDGE_URL` | Core → bridge base URL (default `http://127.0.0.1:3910`) |
| `WHATSAPP_PROVIDER=baileys` | Select experimental path |
| `WHATSAPP_ALLOWED_CHAT_IDS` | Allowlist |
| `WHATSAPP_SESSION_DIR` | Auth session directory |
| `ZAVORTH_WHATSAPP_INBOUND_URL` | Optional push of inbound messages into host webhook |

## Endpoints

- `GET /health`
- `GET /status`
- `GET /qr`
- `GET /messages?timeout=25000` long-poll
- `POST /send` `{ "chatId"|"to", "text"|"message" }`

## Inbound into Zavorth

1. **Long-poll**
   Host: `WhatsAppBridgeInboundPollerService` → `GET /messages` → `WhatsAppGateway`.
   CLI: `npx tsx scripts/zavorth-whatsapp-bridge.ts poll`
   Boot: `WHATSAPP_BRIDGE_POLL=1`

2. **Push webhook**
   `ZAVORTH_WHATSAPP_INBOUND_URL=http://host/api/webhooks/whatsapp`
   Requires a reachable host URL.

## Notes

Protocolo nao oficial. Preferir WhatsApp Cloud API para producao. Queda do bridge nao derruba o processo principal do Zavorth.
