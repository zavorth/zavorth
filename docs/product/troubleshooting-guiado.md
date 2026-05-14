# Guided Troubleshooting

When Zavorth feels stuck, diagnose in this order.

## 1. Check General State

```bash
npm run doctor -- --json
npm run status -- --json
```

## 2. Check Web And Channels

```bash
npm run test:web:smoke -- --base-url http://127.0.0.1:33333
npm run test:channels:smoke
```

## 3. Check Critical Regression Gates

```bash
npm run runtime:check
npm run security:secrets
```

## 4. Check Transports And Nodes

```bash
npm run test:transports:smoke -- --json
npm run test:nodes:smoke
```

## Common Symptoms

### The web host does not respond

- run `npm run go`;
- run the web smoke against the expected base URL;
- open `.zavorth/open-web-shell.ps1` if the installer created it;
- check whether another process is already using the port.

### A channel is not live

- run `npm run test:channels:smoke`;
- confirm required environment variables;
- confirm recipient allowlists;
- confirm webhook or local bridge status.

### A companion does not pair

- review `.zavorth/companion-start.ps1`;
- run `npm run doctor -- --json`;
- rerun `npm run test:nodes:smoke`.

### The runtime feels slow

- run `npm run status -- --json`;
- run `npm run doctor -- --json`;
- close unused sidecars and browsers;
- repeat the smallest relevant smoke test.

