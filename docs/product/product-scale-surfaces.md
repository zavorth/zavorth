# Product scale surfaces

Ecosystem, elastic ops, eval, long-tail channels, multi-agent UX.

## Commands

```bash
# Plugins / skills / packs
zavorth plugins get "what I need"
zavorth plugins install-intent "what I need"
zavorth skills agentskills-check ./path-to-skill
zavorth packs list
zavorth packs apply personal|developer|business
zavorth persona list

# Elastic / install honesty
zavorth elastic status
zavorth power elastic
zavorth install how
zavorth install status

# Eval / trajectory
zavorth eval scoreboard --json
zavorth agent-eval
zavorth trajectory datagen --help
zavorth trajectory compress
zavorth trajectory stats

# Long-tail / multi-agent
zavorth channels completeness [--smoke]
zavorth subagents list|status --json
zavorth ensemble plan|status --json
```

## Safety defaults

- Plugin free-text path never auto-enables
- Elastic status does not claim $0 host idle without proof
- Installer default is npm; signed standalone is not the default channel
- Subagents/ensemble are preview-first (no free-text auto-spawn)
- Preference forget requires `--yes`
- Skill path checks stay under project root
- Research stays local unless `research web … --live`
- Deploy VPS is playbook + local preflight (never mutates remote hosts)

## Gates

```bash
npm run qa:product-scale
npm run qa:product-surfaces

# Single dogfood entry (honesty + suites)
zavorth surfaces doctor
zavorth surfaces doctor --quick
npm run surfaces:doctor
```
