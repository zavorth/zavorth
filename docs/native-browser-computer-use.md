# Native Browser + Computer Use

Phase 5 makes browser and computer-use a Zavorth-native governed capability instead of a loose demo surface.

## Native Capabilities

- CDP/Playwright sidecar for isolated browser control.
- Browser actions: navigate, screenshot, click, type and extract.
- Computer-use adapter routed through `ZavorthComputerControlPlaneService`.
- Visual receipts for screenshots, click/type, extraction and computer-use plans.
- Policy by domain or site, with private network blocked by default.

## Safety Rules

- Browser read/extract can run as a public-read action when domain policy allows it.
- Browser click/type always requires approval.
- Private, loopback and internal targets are blocked unless a caller explicitly opts into private egress in a controlled flow.
- Sensitive site categories such as payment, wallet, auth, MFA and password surfaces require approval before mutation.
- Live actions are never faked. If the sidecar is not configured, Zavorth returns preview/needs-configuration state instead of pretending success.

## Commands

```bash
npm run browser:sidecar
npm run zavorth:native-browser-computer-use -- --action browser.extract --url https://example.com
npm run zavorth:native-browser-computer-use -- --action browser.click --url https://example.com --selector "#submit"
npm run zavorth:native-browser-computer-use -- --action computer.plan --target-kind browser-tab --window "Browser"
npm run zavorth:native-browser-computer-use:check
```

## Environment

For live browser control, set:

```bash
ZAVORTH_BROWSER_SIDECAR_URL=http://127.0.0.1:35791
ZAVORTH_BROWSER_SIDECAR_TOKEN=<optional-token>
```

Then start:

```bash
npm run browser:sidecar
```

The sidecar exposes a governed MCP-style browser surface and records sidecar receipts. Mutation remains guarded by approval references.
