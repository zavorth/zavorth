# Zavorth Capabilities

Capabilities are the things Zavorth can use when a request needs more than a plain chat reply: tools, adapters, skills, channels, provider routes or other runtime abilities.

A capability becoming visible does not mean it can act silently. Anything that can change files, call tools, send data, activate a connector or touch external state still goes through preview, approval and receipts.

## Where To See Capabilities

- Dashboard: open `Ferramentas` and look for verified capabilities.
- Terminal: run `zavorth tui` and open the Capability actions panel.
- Setup: run `zavorth setup` to see what is available during First Light.
- CLI: use `zavorth actions lookup capabilities` for a compact list.

## How To Use One

1. Ask Zavorth naturally for the task you want.
2. If a first-class capability exists, Zavorth routes the request through the Action Harness.
3. Review the preview before anything important happens.
4. Approve only the scoped action you actually want.
5. Read the receipt after the action finishes.

## Useful Commands

- List capabilities: `zavorth actions lookup capabilities`
- Find a route: `zavorth actions lookup <what you want to do>`
- Preview an action: `zavorth actions preview <action-id>`
- Approve a request: `zavorth approve <approval-id>`
- Read receipts: `zavorth actions receipts --action <action-id>`
- Review local usage signals: `zavorth actions usage`
- Review lifecycle decisions: `zavorth actions lifecycle`

## Current Verified Actions

### Absorb skill source

- Action id: `skills.absorb`
- Status: `available`
- Preview: `zavorth actions preview skills.absorb`
- Receipts: `zavorth actions receipts --id skills.absorb`
- Next safe step: Preview the action before approval. Accepts local path or HTTPS URL.

### Absorb plugin pack

- Action id: `plugins.absorb`
- Status: `available`
- Preview: `zavorth actions preview plugins.absorb`
- Next safe step: Preview first. Executable packs stay held until higher-trust enable.

### Intake MCP pack

- Action id: `mcp.intake`
- Status: `available`
- Preview: `zavorth actions preview mcp.intake`
- Next safe step: Packs materialize disabled; enable requires a separate approval.

### Absorb any capability source

- Action id: `capabilities.absorb`
- Status: `available`
- Preview: `zavorth actions preview capabilities.absorb`
- Next safe step: Auto-classifies skill / plugin / MCP from path or URL.

### Import workspace home

- Action id: `workspace.import`
- Status: `available`
- Preview: `zavorth actions preview workspace.import`
- Next safe step: Structural import from any local workspace home (brand-agnostic).

### Reach inventory

- Action id: `reach.inventory`
- Status: `available`
- Next safe step: Inspect channel tiers and node readiness (`zavorth reach`).

### Synthesize channel pack

- Action id: `reach.synthesize`
- Status: `available`
- Preview: `zavorth actions preview reach.synthesize`
- Next safe step: Generate Tier C pack; never live until doctor + proof.

### Node pairing draft

- Action id: `reach.pair`
- Status: `available`
- Next safe step: Create pairing draft, then bootstrap companion.

### Power inventory

- Action id: `power.inventory`
- Status: `available`
- Next safe step: Inspect elastic backends, trusted operator, yellow learning candidates (`zavorth power`).

### Trusted Operator Mode

- Action id: `power.trusted.toggle`
- Status: `available`
- Next safe step: Preview, then enable for single-user green friction reduction (red lane intact).

### Promote yellow learning

- Action id: `power.learn.promote`
- Status: `available`
- Next safe step: Promote staged shadow skill/procedure with explicit consent.

### Product readiness

- Action id: `product.inventory`
- Status: `available`
- Next safe step: `zavorth product` for first-run + public commands.

### Hermetic product certification

- Action id: `product.certify`
- Status: `available`
- Next safe step: `zavorth product certify` — capability/reach/power matrix without live IO.


### ACP/Codex packaging status

- Action id: `interop.acp_codex.status`
- Status: `available`
- Preview: `zavorth actions preview interop.acp_codex.status`
- Receipts: `zavorth actions receipts --id interop.acp_codex.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Analyze image

- Action id: `media.image.analyze`
- Status: `available`
- Preview: `zavorth actions preview media.image.analyze`
- Receipts: `zavorth actions receipts --id media.image.analyze`
- Next safe step: Preview the action before approval.

### Batch trajectories

- Action id: `trajectories.batch`
- Status: `available`
- Preview: `zavorth actions preview trajectories.batch`
- Receipts: `zavorth actions receipts --id trajectories.batch`
- Next safe step: Preview the action before approval.

### Browser click

- Action id: `browser.click`
- Status: `available`
- Preview: `zavorth actions preview browser.click`
- Receipts: `zavorth actions receipts --id browser.click`
- Next safe step: Preview the action before approval.

### Browser extract text

- Action id: `browser.extract`
- Status: `available`
- Preview: `zavorth actions preview browser.extract`
- Receipts: `zavorth actions receipts --id browser.extract`
- Next safe step: Preview the action before approval.

### Browser form submit

- Action id: `browser.form.submit`
- Status: `available`
- Preview: `zavorth actions preview browser.form.submit`
- Receipts: `zavorth actions receipts --id browser.form.submit`
- Next safe step: Preview the action before approval.

### Browser navigate

- Action id: `browser.open`
- Status: `available`
- Preview: `zavorth actions preview browser.open`
- Receipts: `zavorth actions receipts --id browser.open`
- Next safe step: Preview the action before approval.

### Browser screenshot

- Action id: `browser.screenshot`
- Status: `available`
- Preview: `zavorth actions preview browser.screenshot`
- Receipts: `zavorth actions receipts --id browser.screenshot`
- Next safe step: Preview the action before approval.

### Browser type

- Action id: `browser.type`
- Status: `available`
- Preview: `zavorth actions preview browser.type`
- Receipts: `zavorth actions receipts --id browser.type`
- Next safe step: Preview the action before approval.

### Channel status

- Action id: `channels.status`
- Status: `available`
- Preview: `zavorth actions preview channels.status`
- Receipts: `zavorth actions receipts --id channels.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Code review

- Action id: `code.review`
- Status: `available`
- Preview: `zavorth actions preview code.review`
- Receipts: `zavorth actions receipts --id code.review`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Computer media control

- Action id: `computer.media_control`
- Status: `available`
- Preview: `zavorth actions preview computer.media_control`
- Receipts: `zavorth actions receipts --id computer.media_control`
- Next safe step: Preview the action before approval.

### Computer screenshot

- Action id: `computer.screenshot`
- Status: `available`
- Preview: `zavorth actions preview computer.screenshot`
- Receipts: `zavorth actions receipts --id computer.screenshot`
- Next safe step: Preview the action before approval.

### Computer vision

- Action id: `computer.vision`
- Status: `available`
- Preview: `zavorth actions preview computer.vision`
- Receipts: `zavorth actions receipts --id computer.vision`
- Next safe step: Preview the action before approval.

### Correct deep memory

- Action id: `memory.deep.correct`
- Status: `available`
- Preview: `zavorth actions preview memory.deep.correct`
- Receipts: `zavorth actions receipts --id memory.deep.correct`
- Next safe step: Preview the action before approval.

### Create workspace output file

- Action id: `workspace.create_file`
- Status: `available`
- Preview: `zavorth actions preview workspace.create_file`
- Receipts: `zavorth actions receipts --id workspace.create_file`
- Next safe step: Preview the action before approval.

### Deep memory review

- Action id: `memory.deep.review`
- Status: `available`
- Preview: `zavorth actions preview memory.deep.review`
- Receipts: `zavorth actions receipts --id memory.deep.review`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Device IoT status

- Action id: `devices.iot.status`
- Status: `available`
- Preview: `zavorth actions preview devices.iot.status`
- Receipts: `zavorth actions receipts --id devices.iot.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Diff workspace file

- Action id: `workspace.diff_file`
- Status: `available`
- Preview: `zavorth actions preview workspace.diff_file`
- Receipts: `zavorth actions receipts --id workspace.diff_file`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Draft channel message

- Action id: `channels.draft`
- Status: `available`
- Preview: `zavorth actions preview channels.draft`
- Receipts: `zavorth actions receipts --id channels.draft`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Execute quarantined MCP tool

- Action id: `mcp.execute_quarantined`
- Status: `available`
- Preview: `zavorth actions preview mcp.execute_quarantined`
- Receipts: `zavorth actions receipts --id mcp.execute_quarantined`
- Next safe step: Preview the action before approval.

### Extract document

- Action id: `documents.extract`
- Status: `available`
- Preview: `zavorth actions preview documents.extract`
- Receipts: `zavorth actions receipts --id documents.extract`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Forget deep memory

- Action id: `memory.deep.forget`
- Status: `available`
- Preview: `zavorth actions preview memory.deep.forget`
- Receipts: `zavorth actions receipts --id memory.deep.forget`
- Next safe step: Preview the action before approval.

### Generate image artifact

- Action id: `media.image.generate`
- Status: `available`
- Preview: `zavorth actions preview media.image.generate`
- Receipts: `zavorth actions receipts --id media.image.generate`
- Next safe step: Preview the action before approval.

### Generate video

- Action id: `video.generate`
- Status: `available`
- Preview: `zavorth actions preview video.generate`
- Receipts: `zavorth actions receipts --id video.generate`
- Next safe step: Preview the action before approval.

### Gmail draft

- Action id: `gmail.draft`
- Status: `available`
- Preview: `zavorth actions preview gmail.draft`
- Receipts: `zavorth actions receipts --id gmail.draft`
- Next safe step: Preview the action before approval.

### Gmail search

- Action id: `gmail.search`
- Status: `available`
- Preview: `zavorth actions preview gmail.search`
- Receipts: `zavorth actions receipts --id gmail.search`
- Next safe step: Preview the action before approval.

### Gmail send

- Action id: `gmail.send`
- Status: `available`
- Preview: `zavorth actions preview gmail.send`
- Receipts: `zavorth actions receipts --id gmail.send`
- Next safe step: Preview the action before approval.

### Google Calendar create

- Action id: `google.calendar.create`
- Status: `available`
- Preview: `zavorth actions preview google.calendar.create`
- Receipts: `zavorth actions receipts --id google.calendar.create`
- Next safe step: Preview the action before approval.

### Google Calendar list

- Action id: `google.calendar.list`
- Status: `available`
- Preview: `zavorth actions preview google.calendar.list`
- Receipts: `zavorth actions receipts --id google.calendar.list`
- Next safe step: Preview the action before approval.

### Google Calendar update

- Action id: `google.calendar.update`
- Status: `available`
- Preview: `zavorth actions preview google.calendar.update`
- Receipts: `zavorth actions receipts --id google.calendar.update`
- Next safe step: Preview the action before approval.

### Google Drive read file

- Action id: `google.drive.read_file`
- Status: `available`
- Preview: `zavorth actions preview google.drive.read_file`
- Receipts: `zavorth actions receipts --id google.drive.read_file`
- Next safe step: Preview the action before approval.

### Google Drive search

- Action id: `google.drive.search`
- Status: `available`
- Preview: `zavorth actions preview google.drive.search`
- Receipts: `zavorth actions receipts --id google.drive.search`
- Next safe step: Preview the action before approval.

### Google Tasks create

- Action id: `google.tasks.create`
- Status: `available`
- Preview: `zavorth actions preview google.tasks.create`
- Receipts: `zavorth actions receipts --id google.tasks.create`
- Next safe step: Preview the action before approval.

### Google Tasks list

- Action id: `google.tasks.list`
- Status: `available`
- Preview: `zavorth actions preview google.tasks.list`
- Receipts: `zavorth actions receipts --id google.tasks.list`
- Next safe step: Preview the action before approval.

### Google Tasks update

- Action id: `google.tasks.update`
- Status: `available`
- Preview: `zavorth actions preview google.tasks.update`
- Receipts: `zavorth actions receipts --id google.tasks.update`
- Next safe step: Preview the action before approval.

### Google Workspace status

- Action id: `google.workspace.status`
- Status: `available`
- Preview: `zavorth actions preview google.workspace.status`
- Receipts: `zavorth actions receipts --id google.workspace.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Inspect hidden capability

- Action id: `capabilities.hidden.inspect`
- Status: `available`
- Preview: `zavorth actions preview capabilities.hidden.inspect`
- Receipts: `zavorth actions receipts --id capabilities.hidden.inspect`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Inspect MCP server

- Action id: `mcp.inspect`
- Status: `available`
- Preview: `zavorth actions preview mcp.inspect`
- Receipts: `zavorth actions receipts --id mcp.inspect`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Inspect skill

- Action id: `skills.catalog.inspect`
- Status: `available`
- Preview: `zavorth actions preview skills.catalog.inspect`
- Receipts: `zavorth actions receipts --id skills.catalog.inspect`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Invoke external agent

- Action id: `agents.external.invoke`
- Status: `available`
- Preview: `zavorth actions preview agents.external.invoke`
- Receipts: `zavorth actions receipts --id agents.external.invoke`
- Next safe step: Preview the action before approval.

### Kanban board

- Action id: `kanban.board`
- Status: `available`
- Preview: `zavorth actions preview kanban.board`
- Receipts: `zavorth actions receipts --id kanban.board`
- Next safe step: Preview the action before approval.

### Kanban multi-agent dispatch

- Action id: `kanban.dispatch_multi_agent`
- Status: `available`
- Preview: `zavorth actions preview kanban.dispatch_multi_agent`
- Receipts: `zavorth actions receipts --id kanban.dispatch_multi_agent`
- Next safe step: Preview the action before approval.

### List external agents

- Action id: `agents.external.list`
- Status: `available`
- Preview: `zavorth actions preview agents.external.list`
- Receipts: `zavorth actions receipts --id agents.external.list`
- Next safe step: Inspect the action schema and run with scoped arguments.

### List MCP servers

- Action id: `mcp.list`
- Status: `available`
- Preview: `zavorth actions preview mcp.list`
- Receipts: `zavorth actions receipts --id mcp.list`
- Next safe step: Inspect the action schema and run with scoped arguments.

### List skills

- Action id: `skills.catalog.list`
- Status: `available`
- Preview: `zavorth actions preview skills.catalog.list`
- Receipts: `zavorth actions receipts --id skills.catalog.list`
- Next safe step: Inspect the action schema and run with scoped arguments.

### List workflows

- Action id: `workflows.list`
- Status: `available`
- Preview: `zavorth actions preview workflows.list`
- Receipts: `zavorth actions receipts --id workflows.list`
- Next safe step: Inspect the action schema and run with scoped arguments.

### List workspace directory

- Action id: `workspace.list_directory`
- Status: `available`
- Preview: `zavorth actions preview workspace.list_directory`
- Receipts: `zavorth actions receipts --id workspace.list_directory`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Local calendar event

- Action id: `calendar.local.event`
- Status: `available`
- Preview: `zavorth actions preview calendar.local.event`
- Receipts: `zavorth actions receipts --id calendar.local.event`
- Next safe step: Preview the action before approval.

### Long-tail channel draft

- Action id: `channels.long_tail.draft`
- Status: `available`
- Preview: `zavorth actions preview channels.long_tail.draft`
- Receipts: `zavorth actions receipts --id channels.long_tail.draft`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Long-tail channel status

- Action id: `channels.long_tail.status`
- Status: `available`
- Preview: `zavorth actions preview channels.long_tail.status`
- Receipts: `zavorth actions receipts --id channels.long_tail.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Media status

- Action id: `media.status`
- Status: `available`
- Preview: `zavorth actions preview media.status`
- Receipts: `zavorth actions receipts --id media.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Nix/Termux packaging status

- Action id: `packaging.nix_termux.status`
- Status: `available`
- Preview: `zavorth actions preview packaging.nix_termux.status`
- Receipts: `zavorth actions receipts --id packaging.nix_termux.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Patch workspace output file

- Action id: `workspace.patch_file`
- Status: `available`
- Preview: `zavorth actions preview workspace.patch_file`
- Receipts: `zavorth actions receipts --id workspace.patch_file`
- Next safe step: Preview the action before approval.

### Plugin SDK lifecycle

- Action id: `plugins.sdk.lifecycle`
- Status: `available`
- Preview: `zavorth actions preview plugins.sdk.lifecycle`
- Receipts: `zavorth actions receipts --id plugins.sdk.lifecycle`
- Next safe step: Preview the action before approval.

### Plugin SDK status

- Action id: `plugins.sdk.status`
- Status: `available`
- Preview: `zavorth actions preview plugins.sdk.status`
- Receipts: `zavorth actions receipts --id plugins.sdk.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Preview MCP tool call

- Action id: `mcp.preview`
- Status: `available`
- Preview: `zavorth actions preview mcp.preview`
- Receipts: `zavorth actions receipts --id mcp.preview`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Preview shell command

- Action id: `shell.preview_command`
- Status: `available`
- Preview: `zavorth actions preview shell.preview_command`
- Receipts: `zavorth actions receipts --id shell.preview_command`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Publish MQTT message

- Action id: `devices.iot.mqtt_publish`
- Status: `available`
- Preview: `zavorth actions preview devices.iot.mqtt_publish`
- Receipts: `zavorth actions receipts --id devices.iot.mqtt_publish`
- Next safe step: Preview the action before approval.

### Queue hidden capability exposure

- Action id: `capabilities.hidden.expose`
- Status: `available`
- Preview: `zavorth actions preview capabilities.hidden.expose`
- Receipts: `zavorth actions receipts --id capabilities.hidden.expose`
- Next safe step: Preview the action before approval.

### Read workspace file

- Action id: `workspace.read_file`
- Status: `available`
- Preview: `zavorth actions preview workspace.read_file`
- Receipts: `zavorth actions receipts --id workspace.read_file`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Render canvas

- Action id: `canvas.render`
- Status: `available`
- Preview: `zavorth actions preview canvas.render`
- Receipts: `zavorth actions receipts --id canvas.render`
- Next safe step: Preview the action before approval.

### Resolve memory follow-up

- Action id: `memory.deep.resolve`
- Status: `available`
- Preview: `zavorth actions preview memory.deep.resolve`
- Receipts: `zavorth actions receipts --id memory.deep.resolve`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Run allowlisted shell command

- Action id: `shell.run_allowlisted`
- Status: `available`
- Preview: `zavorth actions preview shell.run_allowlisted`
- Receipts: `zavorth actions receipts --id shell.run_allowlisted`
- Next safe step: Preview the action before approval.

### Run sandbox tests

- Action id: `sandbox.run_tests`
- Status: `available`
- Preview: `zavorth actions preview sandbox.run_tests`
- Receipts: `zavorth actions receipts --id sandbox.run_tests`
- Next safe step: Preview the action before approval.

### Run sandboxed code

- Action id: `sandbox.run_code`
- Status: `available`
- Preview: `zavorth actions preview sandbox.run_code`
- Receipts: `zavorth actions receipts --id sandbox.run_code`
- Next safe step: Preview the action before approval.

### Run workflow

- Action id: `workflows.run`
- Status: `available`
- Preview: `zavorth actions preview workflows.run`
- Receipts: `zavorth actions receipts --id workflows.run`
- Next safe step: Preview the action before approval.

### Scan hidden capabilities

- Action id: `capabilities.hidden.scan`
- Status: `available`
- Preview: `zavorth actions preview capabilities.hidden.scan`
- Receipts: `zavorth actions receipts --id capabilities.hidden.scan`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Search local wiki

- Action id: `wiki.search`
- Status: `available`
- Preview: `zavorth actions preview wiki.search`
- Receipts: `zavorth actions receipts --id wiki.search`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Search workspace files

- Action id: `workspace.search_files`
- Status: `available`
- Preview: `zavorth actions preview workspace.search_files`
- Receipts: `zavorth actions receipts --id workspace.search_files`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Send approved channel message

- Action id: `channels.send_approved`
- Status: `available`
- Preview: `zavorth actions preview channels.send_approved`
- Receipts: `zavorth actions receipts --id channels.send_approved`
- Next safe step: Preview the action before approval.

### Send SMTP email

- Action id: `email.smtp.send`
- Status: `available`
- Preview: `zavorth actions preview email.smtp.send`
- Receipts: `zavorth actions receipts --id email.smtp.send`
- Next safe step: Preview the action before approval.

### Skill feedback

- Action id: `skills.feedback`
- Status: `available`
- Preview: `zavorth actions preview skills.feedback`
- Receipts: `zavorth actions receipts --id skills.feedback`
- Next safe step: Preview the action before approval.

### SQLite database query

- Action id: `database.sqlite.query`
- Status: `available`
- Preview: `zavorth actions preview database.sqlite.query`
- Receipts: `zavorth actions receipts --id database.sqlite.query`
- Next safe step: Preview the action before approval.

### Synthesize speech artifact

- Action id: `media.speech.synthesize`
- Status: `available`
- Preview: `zavorth actions preview media.speech.synthesize`
- Receipts: `zavorth actions receipts --id media.speech.synthesize`
- Next safe step: Preview the action before approval.

### Terminal backend

- Action id: `terminal.backend`
- Status: `available`
- Preview: `zavorth actions preview terminal.backend`
- Receipts: `zavorth actions receipts --id terminal.backend`
- Next safe step: Preview the action before approval.

### Terminal backend execute

- Action id: `terminal.backends.execute`
- Status: `available`
- Preview: `zavorth actions preview terminal.backends.execute`
- Receipts: `zavorth actions receipts --id terminal.backends.execute`
- Next safe step: Preview the action before approval.

### Terminal backend status

- Action id: `terminal.backends.status`
- Status: `available`
- Preview: `zavorth actions preview terminal.backends.status`
- Receipts: `zavorth actions receipts --id terminal.backends.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Voice backend status

- Action id: `voice.backends.status`
- Status: `available`
- Preview: `zavorth actions preview voice.backends.status`
- Receipts: `zavorth actions receipts --id voice.backends.status`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Voice synthesize live

- Action id: `voice.synthesize_live`
- Status: `available`
- Preview: `zavorth actions preview voice.synthesize_live`
- Receipts: `zavorth actions receipts --id voice.synthesize_live`
- Next safe step: Preview the action before approval.

### Web fetch URL

- Action id: `web.fetch_url`
- Status: `available`
- Preview: `zavorth actions preview web.fetch_url`
- Receipts: `zavorth actions receipts --id web.fetch_url`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Web search

- Action id: `web.search`
- Status: `available`
- Preview: `zavorth actions preview web.search`
- Receipts: `zavorth actions receipts --id web.search`
- Next safe step: Inspect the action schema and run with scoped arguments.

### Write workspace output file

- Action id: `workspace.write_file`
- Status: `available`
- Preview: `zavorth actions preview workspace.write_file`
- Receipts: `zavorth actions receipts --id workspace.write_file`
- Next safe step: Preview the action before approval.

## Safety Rules

- A visible capability is not automatic permission.
- Secrets should stay in local environment configuration or SecretRefs, not in chat.
- New or sensitive abilities start with preview.
- Risky work requires explicit approval.
- Every approved action should leave a receipt.

## Local Usage Signals

Zavorth can keep local usage signals for capabilities: whether a route was shown, previewed, approved, blocked, abandoned or completed successfully.

These signals stay on the machine. They do not include prompt text, raw secrets, message content or external analytics. Zavorth uses the aggregate pattern to decide what should be promoted, kept learning, inspected or archived.

## Lifecycle Decisions

Zavorth can turn local usage signals into lifecycle decisions: promote a capability, keep it learning, inspect it, or archive it from daily suggestions.

Promotion and archive decisions are reversible and approval-aware. They do not delete files, activate a live connector, send data or bypass the Action Harness.

## Troubleshooting

- If the dashboard shows `0 available`, run `zavorth actions lookup capabilities` to confirm the runtime view.
- If a capability is missing, run `zavorth doctor` and check provider, channel or connector setup.
- If a preview is blocked, read the reason before changing policy.

## Related

- [Security](/docs/security.md)
- [Effect Boundary](/docs/effect-boundary.md)
- [Provider Mesh](/docs/provider-mesh.md)
- [Channel Mesh](/docs/channel-mesh.md)
- [CLI](/docs/zavorth-cli.md)
