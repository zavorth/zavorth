# Day-to-day product surfaces

Operator and user commands for daily work: intent verbs, cost, deploy, recall, research, gateway.

## Commands

```bash
# Intent path
zavorth connect telegram
zavorth use skills
zavorth fix
zavorth prove list
zavorth prove channels

# Cost
zavorth cost-route
zavorth cost-savings

# Deploy / backends (playbook + local preflight; no SSH)
zavorth deploy vps
zavorth deploy vps --preflight
zavorth deploy preflight
zavorth backends matrix

# Research / trajectory
zavorth trajectory export
zavorth research
zavorth research export
# Opt-in live web only with --live
zavorth research web "topic" --live

# Recall / preferences
zavorth recall "topic"
zavorth preference list
zavorth preference contest <id> <reason>
zavorth preference forget <id> --yes

# Channels / gateway
zavorth channels new <id>
zavorth gateway panel
zavorth channels status --unified
zavorth channels live-matrix --live

# Learning
zavorth learn
# After multi-tool success: /learn promote 1

# Import / link (only day-path verbs)
zavorth import
zavorth import home <path> [--smart]
zavorth import pack <path> --consent
zavorth import skills <link-id> --consent
zavorth link list
zavorth link open <id> [--mirror]
zavorth link use <id> <tool> --approve
zavorth link ask <id> "prompt" --approve
zavorth link sync <id> --mirror --consent

# Approvals
zavorth approval unify --json
zavorth approval seed-demo --with-proof
```

## Control UI

- Next-action strip: primary CTA + Approve / Doctor / Channels matrix / Prove
- Models cost panel: optional hop line when the API provides `cheapHop`

## Desktop UI

- Do-now secondaries: Review / Doctor / Channels / Prove (parity with Control)
- Cost overview card shows cheap hop + last cost route class when the API provides them
- Approval bridge maps channel once/session/always → Trust Loop approve

## Gates

```bash
npm run qa:channel-live
npm run qa:day-surfaces

# Dogfood entry (honesty + full suites)
zavorth surfaces doctor
zavorth surfaces doctor --quick
npm run surfaces:doctor
```
