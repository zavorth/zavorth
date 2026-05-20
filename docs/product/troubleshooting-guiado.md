# Guided Troubleshooting

When Zavorth feels stuck, diagnose in this order.

## 1. Check General State

```bash
zavorth doctor --json
zavorth status --json
```

## 2. Check Web And Channels

```bash
zavorth open
zavorth connectors doctor
```

## 3. Check Critical Regression Gates

```bash
npm run runtime:check
npm run security:ci
```

## 4. Check Transports And Nodes

```bash
zavorth execution-backends --json
zavorth doctor --advanced
```

## Common Symptoms

### The web host does not respond

- run `zavorth start`;
- run `zavorth open`;
- open `.zavorth/open-web-shell.ps1` if the installer created it;
- check whether another process is already using the port.

### A channel is not live

- run `zavorth connectors doctor`;
- confirm required environment variables;
- confirm recipient allowlists;
- confirm webhook or local bridge status.

### A companion does not pair

- review `.zavorth/companion-start.ps1`;
- run `zavorth doctor --json`;
- rerun `zavorth doctor --advanced`.

### The runtime feels slow

- run `zavorth status --json`;
- run `zavorth doctor --json`;
- close unused sidecars and browsers;
- repeat the smallest relevant smoke test.
