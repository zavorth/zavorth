author:	coderabbitai
association:	none
edited:	true
status:	none
--
<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- This is an auto-generated comment: skip review by coderabbit.ai -->

> [!IMPORTANT]
> ## Review skipped
> 
> Too many files!
> 
> This PR contains 298 files, which is 148 over the limit of 150.
> 
> To get a review, narrow the scope:
>   ÔÇó coderabbit review --type committed     # exclude uncommitted changes
>   ÔÇó coderabbit review --dir <path>         # limit to a subdirectory
>   ÔÇó coderabbit review --base <branch>      # compare against a closer base
> 
> Upgrade to a paid plan to raise the limit.
> 
> <details>
> <summary>ÔÜÖ´©Å Run configuration</summary>
> 
> **Configuration used**: defaults
> 
> **Review profile**: CHILL
> 
> **Plan**: Free
> 
> **Run ID**: `7e69136b-93b5-4854-9c5b-67e42a135377`
> 
> </details>
> 
> <details>
> <summary>­ƒôÑ Commits</summary>
> 
> Reviewing files that changed from the base of the PR and between d9c15b23a523c54d1dd226600b10673c3741236c and 53be7862f94f363e707a6d8f9708dc37480a0d58.
> 
> </details>
> 
> <details>
> <summary>Ôøö Files ignored due to path filters (2)</summary>
> 
> * `agent/package-lock.json` is excluded by `!**/package-lock.json`
> * `package-lock.json` is excluded by `!**/package-lock.json`
> 
> </details>
> 
> <details>
> <summary>­ƒôÆ Files selected for processing (298)</summary>
> 
> * `.eslintrc.json`
> * `.github/workflows/capabilities.yml`
> * `.gitignore`
> * `.gitleaks.toml`
> * `.prettierrc.json`
> * `.zavorth/mutation-plans/capability-agents-external-invoke-mqkleucy-b03832a1ca.json`
> * `.zavorth/mutation-plans/capability-agents-external-invoke-mqklgfah-b03832a1ca.json`
> * `.zavorth/mutation-plans/capability-agents-external-invoke-mqklii3s-b03832a1ca.json`
> * `.zavorth/mutation-plans/capability-agents-external-invoke-mql508qf-b03832a1ca.json`
> * `.zavorth/mutation-plans/capability-browser-click-mqkleu78-b1b3e64385.json`
> * `.zavorth/mutation-plans/capability-browser-click-mqklgf77-b1b3e64385.json`
> * `.zavorth/mutation-plans/capability-browser-click-mqklihxt-b1b3e64385.json`
> * `.zavorth/mutation-plans/capability-browser-click-mql508ls-b1b3e64385.json`
> * `.zavorth/mutation-plans/capability-canvas-render-mqkleufb-eb239a9469.json`
> * `.zavorth/mutation-plans/capability-canvas-render-mqklgfd4-eb239a9469.json`
> * `.zavorth/mutation-plans/capability-canvas-render-mqklii72-eb239a9469.json`
> * `.zavorth/mutation-plans/capability-canvas-render-mql508tn-eb239a9469.json`
> * `.zavorth/mutation-plans/capability-capabilities-hidden-expose-mqkleubt-e643683ffd.json`
> * `.zavorth/mutation-plans/capability-capabilities-hidden-expose-mqklgf9d-e643683ffd.json`
> * `.zavorth/mutation-plans/capability-capabilities-hidden-expose-mqklii1z-e643683ffd.json`
> * `.zavorth/mutation-plans/capability-capabilities-hidden-expose-mql508op-e643683ffd.json`
> * `.zavorth/mutation-plans/capability-channels-send-approved-mqkleu80-20624dca32.json`
> * `.zavorth/mutation-plans/capability-channels-send-approved-mqklgf7y-20624dca32.json`
> * `.zavorth/mutation-plans/capability-channels-send-approved-mqklihz6-20624dca32.json`
> * `.zavorth/mutation-plans/capability-channels-send-approved-mql508mv-20624dca32.json`
> * `.zavorth/mutation-plans/capability-computer-vision-mqkleufx-e7c20468d3.json`
> * `.zavorth/mutation-plans/capability-computer-vision-mqklgfdq-e7c20468d3.json`
> * `.zavorth/mutation-plans/capability-computer-vision-mqklii83-e7c20468d3.json`
> * `.zavorth/mutation-plans/capability-computer-vision-mql508ur-e7c20468d3.json`
> * `.zavorth/mutation-plans/capability-database-sqlite-query-mqkleuib-5beef32ee2.json`
> * `.zavorth/mutation-plans/capability-database-sqlite-query-mqklgfg5-5beef32ee2.json`
> * `.zavorth/mutation-plans/capability-database-sqlite-query-mqkliidg-5beef32ee2.json`
> * `.zavorth/mutation-plans/capability-database-sqlite-query-mql508yo-5beef32ee2.json`
> * `.zavorth/mutation-plans/capability-devices-iot-mqtt-publish-mqkleugm-0963639682.json`
> * `.zavorth/mutation-plans/capability-devices-iot-mqtt-publish-mqklgfeh-0963639682.json`
> * `.zavorth/mutation-plans/capability-devices-iot-mqtt-publish-mqkliial-0963639682.json`
> * `.zavorth/mutation-plans/capability-devices-iot-mqtt-publish-mql508vt-0963639682.json`
> * `.zavorth/mutation-plans/capability-email-smtp-send-mqkleuhs-281401e8ad.json`
> * `.zavorth/mutation-plans/capability-email-smtp-send-mqklgffk-281401e8ad.json`
> * `.zavorth/mutation-plans/capability-email-smtp-send-mqkliicp-281401e8ad.json`
> * `.zavorth/mutation-plans/capability-email-smtp-send-mql508y1-281401e8ad.json`
> * `.zavorth/mutation-plans/capability-gmail-search-mqkleue1-fc2465ee23.json`
> * `.zavorth/mutation-plans/capability-gmail-search-mqklgfc5-fc2465ee23.json`
> * `.zavorth/mutation-plans/capability-gmail-search-mqklii5g-fc2465ee23.json`
> * `.zavorth/mutation-plans/capability-gmail-search-mql508s1-fc2465ee23.json`
> * `.zavorth/mutation-plans/capability-mcp-execute-quarantined-mqkleubb-2a0e964c96.json`
> * `.zavorth/mutation-plans/capability-mcp-execute-quarantined-mqklgf8s-2a0e964c96.json`
> * `.zavorth/mutation-plans/capability-mcp-execute-quarantined-mqklii0a-2a0e964c96.json`
> * `.zavorth/mutation-plans/capability-mcp-execute-quarantined-mql508nt-2a0e964c96.json`
> * `.zavorth/mutation-plans/capability-media-image-generate-mqkleuej-fdddf322ea.json`
> * `.zavorth/mutation-plans/capability-media-image-generate-mqklgfcm-fdddf322ea.json`
> * `.zavorth/mutation-plans/capability-media-image-generate-mqklii69-fdddf322ea.json`
> * `.zavorth/mutation-plans/capability-media-image-generate-mql508sz-fdddf322ea.json`
> * `.zavorth/mutation-plans/capability-skills-absorb-mqkleucd-9498cd5bd6.json`
> * `.zavorth/mutation-plans/capability-skills-absorb-mqklgf9y-9498cd5bd6.json`
> * `.zavorth/mutation-plans/capability-skills-absorb-mqklii2s-9498cd5bd6.json`
> * `.zavorth/mutation-plans/capability-skills-absorb-mql508pv-9498cd5bd6.json`
> * `.zavorth/mutation-plans/capability-video-generate-mqkleuh4-b07539e4df.json`
> * `.zavorth/mutation-plans/capability-video-generate-mqklgff0-b07539e4df.json`
> * `.zavorth/mutation-plans/capability-video-generate-mqkliibm-b07539e4df.json`
> * `.zavorth/mutation-plans/capability-video-generate-mql508x0-b07539e4df.json`
> * `.zavorth/mutation-plans/sandbox-shell-run-allowlisted-mqkleu5q-39485e7c63.json`
> * `.zavorth/mutation-plans/sandbox-shell-run-allowlisted-mqklgf5n-39485e7c63.json`
> * `.zavorth/mutation-plans/sandbox-shell-run-allowlisted-mqklihv1-39485e7c63.json`
> * `.zavorth/mutation-plans/sandbox-shell-run-allowlisted-mql508ja-39485e7c63.json`
> * `.zavorth/mutation-plans/sandbox-workflows-run-mqkleudj-5ce777bdd2.json`
> * `.zavorth/mutation-plans/sandbox-workflows-run-mqklgfbg-5ce777bdd2.json`
> * `.zavorth/mutation-plans/sandbox-workflows-run-mqklii4j-5ce777bdd2.json`
> * `.zavorth/mutation-plans/sandbox-workflows-run-mql508rd-5ce777bdd2.json`
> * `AUDIT_LOG.md`
> * `LICENSE`
> * `Procfile`
> * `README.md`
> * `agent/package.json`
> * `agent/src/SystrayService.ts`
> * `apps/zavorth-desktop/src/App.tsx`
> * `apps/zavorth-desktop/src/apiClient.ts`
> * `apps/zavorth-desktop/src/components/CockpitDashboard.tsx`
> * `apps/zavorth-desktop/src/components/FileExplorer.tsx`
> * `apps/zavorth-desktop/src/components/HostCommandApprovalModal.tsx`
> * `apps/zavorth-desktop/src/components/HostPowerModeControl.tsx`
> * `apps/zavorth-desktop/src/components/ProductPolishComponents.tsx`
> * `apps/zavorth-desktop/src/components/ProviderRuntimeStatus.tsx`
> * `apps/zavorth-desktop/src/components/ProviderSecretInput.tsx`
> * `apps/zavorth-desktop/src/components/ProviderSetupModal.tsx`
> * `apps/zavorth-desktop/src/components/TemporaryDirectoryTrustModal.tsx`
> * `apps/zavorth-desktop/src/components/TemporaryDirectoryTrustStatus.tsx`
> * `apps/zavorth-desktop/src/components/WorkspaceCommandApprovalModal.tsx`
> * `apps/zavorth-desktop/src/components/WorkspacePolicyPreview.tsx`
> * `apps/zavorth-desktop/src/components/WorkspaceRuntimeReadinessCard.tsx`
> * `apps/zavorth-desktop/src/components/WorkspaceTaskMandateModal.tsx`
> * `apps/zavorth-desktop/src/components/WorkspaceTaskMandateStatus.tsx`
> * `apps/zavorth-desktop/src/components/WorkspaceTrustControl.tsx`
> * `apps/zavorth-desktop/src/components/WorkspaceWriteApprovalModal.tsx`
> * `apps/zavorth-desktop/src/desktopInput.ts`
> * `apps/zavorth-desktop/src/hub-skin/HubCommandPalette.tsx`
> * `apps/zavorth-desktop/src/hub-skin/HubWorkspaceView.tsx`
> * `apps/zavorth-desktop/src/navigation/DesktopSidebar.tsx`
> * `apps/zavorth-desktop/src/panels/AgentWorkspaceSettingsPanel.tsx`
> * `apps/zavorth-desktop/src/panels/InternalBetaDiagnosticsPanel.tsx`
> * `apps/zavorth-desktop/src/panels/ProviderSettingsPanel.tsx`
> * `apps/zavorth-desktop/src/primitives/Pane.tsx`
> * `apps/zavorth-desktop/src/shell/DesktopPreviewRail.tsx`
> * `apps/zavorth-desktop/src/shell/DesktopShell.tsx`
> * `apps/zavorth-desktop/src/shell/PtyTerminalPanel.tsx`
> * `apps/zavorth-desktop/src/shell/ZavorthPaneShell.tsx`
> * `apps/zavorth-desktop/src/styles.css`
> * `apps/zavorth-desktop/src/themePresets.ts`
> * `apps/zavorth-desktop/src/views/DesktopWorkspaceView.tsx`
> * `apps/zavorth-desktop/src/views/panels/ApprovalsPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/AutomationsPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/ChannelsPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/MemoryPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/PersonalizationPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/SettingsPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/SkillsPanel.tsx`
> * `apps/zavorth-desktop/src/views/panels/panelPrimitives.tsx`
> * `apps/zavorth-desktop/src/views/workspaceTypes.ts`
> * `config/capability-manifests/capability-spine.json`
> * `config/capability-manifests/governed-ops.json`
> * `config/capability-manifests/native-extended-tools.json`
> * `config/capability-manifests/native-power-packs.json`
> * `config/capability-manifests/productization-packs.json`
> * `config/capability-manifests/web-browser.json`
> * `config/capability-manifests/workspace-files.json`
> * `config/deploy/com.zavorth.agent.plist`
> * `config/mcp-tool-policy.json`
> * `config/runtime-profiles/desktop.json`
> * `config/runtime-profiles/safe-8gb.json`
> * `config/security-continuous-baseline.json`
> * `config/security-operational-preset.json`
> * `config/skill-allowlist.json`
> * `config/skill-sources.json`
> * `deploy/fly.Dockerfile`
> * `deploy/fly.toml`
> * `deploy/helm/zavorth/Chart.yaml`
> * `deploy/helm/zavorth/templates/_helpers.tpl`
> * `deploy/helm/zavorth/templates/deployment.yaml`
> * `deploy/helm/zavorth/templates/service.yaml`
> * `deploy/helm/zavorth/values.yaml`
> * `deploy/homebrew/zavorth.rb`
> * `deploy/k8s/configmap.yaml`
> * `deploy/k8s/deployment.yaml`
> * `deploy/k8s/ingress.yaml`
> * `deploy/k8s/secret.yaml`
> * `deploy/k8s/service.yaml`
> * `deploy/nix/flake.nix`
> * `deploy/nix/nixos-module.nix`
> * `deploy/render.yaml`
> * `deploy/serverless/handler.ts`
> * `deploy/serverless/template.yaml`
> * `deploy/termux/install.sh`
> * `docs.json`
> * `docs/capabilities.md`
> * `docs/desktop-terminal-deferred.md`
> * `docs/internal/architecture/extensibility-architecture.md`
> * `docs/internal/architecture/extension-facade-design.md`
> * `docs/internal/architecture/headless-serverless-architecture.md`
> * `docs/internal/architecture/personal-approval-lease-architecture.md`
> * `docs/internal/architecture/remote-database-adapter-design.md`
> * `docs/internal/architecture/service-composition-foundation.md`
> * `docs/internal/architecture/service-composition-options.md`
> * `docs/internal/archive/personal-approval-lease-threat-model.md`
> * `docs/internal/repo-hygiene-and-test-strategy.md`
> * `docs/mcp-security.md`
> * `docs/product-direction.md`
> * `docs/product/changelog.md`
> * `docs/product/changelog.mdx`
> * `docs/product/channels/discord.md`
> * `docs/product/channels/email.md`
> * `docs/product/channels/index.md`
> * `docs/product/channels/signal.md`
> * `docs/product/channels/slack.md`
> * `docs/product/channels/telegram.md`
> * `docs/product/channels/whatsapp.md`
> * `docs/product/concepts/approvals.md`
> * `docs/product/concepts/features.md`
> * `docs/product/concepts/identity.md`
> * `docs/product/concepts/memory.md`
> * `docs/product/guided-troubleshooting.md`
> * `docs/product/help/faq.md`
> * `docs/product/help/glossary.md`
> * `docs/product/help/troubleshooting.md`
> * `docs/product/index.md`
> * `docs/product/interfaces/cli.md`
> * `docs/product/interfaces/zavorthcontrol.md`
> * `docs/product/providers/anthropic.md`
> * `docs/product/providers/custom.md`
> * `docs/product/providers/gemini.md`
> * `docs/product/providers/index.md`
> * `docs/product/providers/local.md`
> * `docs/product/skills/create.md`
> * `docs/product/skills/index.md`
> * `docs/product/skills/install.md`
> * `docs/product/start/first-use.md`
> * `docs/product/start/getting-started.md`
> * `docs/product/start/onboarding.md`
> * `docs/product/start/showcase.md`
> * `docs/product/start/what-is-zavorth.md`
> * `docs/product/zavorth-product-experience-principles.md`
> * `docs/productization-packs.md`
> * `docs/produto/start/getting_started.md`
> * `docs/produto/start/primeiro-uso.md`
> * `docs/public-release-checklist.md`
> * `docs/quickstart.md`
> * `docs/security.md`
> * `docs/security/extension-tool-threat-model.md`
> * `docs/security/remote-memory-sync-threat-model.md`
> * `docs/security/serverless-cloud-threat-model.md`
> * `docs/self-modification.md`
> * `docs/superpowers/plans/2026-06-19-production-readiness.md`
> * `docs/workspace-mcp.md`
> * `jest.config.js`
> * `package.json`
> * `scripts/ai-gateway-native-convergence-check.mjs`
> * `scripts/apply-professional-preset.ts`
> * `scripts/architecture-hardening-check.ts`
> * `scripts/check-surface-syntax.mjs`
> * `scripts/complexity-analysis-check.ts`
> * `scripts/coverage-gates-check.ts`
> * `scripts/dead-code-check.ts`
> * `scripts/dependency-audit-check.ts`
> * `scripts/docs-public-repo-audit.mjs`
> * `scripts/eslint-config-check.ts`
> * `scripts/hygiene/check-public-docs-hygiene.mjs`
> * `scripts/hygiene/check-repo-hygiene.mjs`
> * `scripts/import-graph-check.ts`
> * `scripts/intelligence-fabric-check.mjs`
> * `scripts/intelligence-fabric-release-snapshot.mjs`
> * `scripts/intelligence-fabric-surface-default-gate.ts`
> * `scripts/loc-limits-per-module-check.ts`
> * `scripts/mcp-fixture-server.ts`
> * `scripts/ops-diagnostics-export.ts`
> * `scripts/ops-doctor-repair-helper.ts`
> * `scripts/ops-doctor.ts`
> * `scripts/prettier-config-check.ts`
> * `scripts/provider-mesh-convergence-check.mjs`
> * `scripts/secret-guard-check.mjs`
> * `scripts/smoke-llm-tool-calling.mjs`
> * `scripts/smoke-web-browser-actions.mjs`
> * `scripts/zavorth-channel-connection-playbook-check.mjs`
> * `scripts/zavorth-cli-surface-check.mjs`
> * `scripts/zavorth-e2e-smoke-9f.ts`
> * `scripts/zavorth-language-boundary-check.mjs`
> * `scripts/zavorth-mcp-install.ts`
> * `scripts/zavorth-provider-channel-wizard.ts`
> * `scripts/zavorth-universal-skill-bridge-activation-check.mjs`
> * `scripts/zavorth-universal-skill-bridge-check.mjs`
> * `scripts/zavorth-universal-skill-bridge-registry-check.mjs`
> * `scripts/zavorth-universal-skill-expansion-check.mjs`
> * `scripts/zavorth-universal-skill-expansion-qa-check.mjs`
> * `scripts/zavorth-universal-skill-real-source-onboarding-check.mjs`
> * `skill-library/native/zavorth-academic-scholar/SKILL.md`
> * `skill-library/native/zavorth-academic-scholar/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-aesthetic-style-factory/SKILL.md`
> * `skill-library/native/zavorth-aesthetic-style-factory/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-algorithmic-svg-designer/SKILL.md`
> * `skill-library/native/zavorth-algorithmic-svg-designer/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-api-ledger-control/SKILL.md`
> * `skill-library/native/zavorth-api-ledger-control/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-app-launcher/SKILL.md`
> * `skill-library/native/zavorth-app-launcher/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-audio-signal-editor/SKILL.md`
> * `skill-library/native/zavorth-audio-signal-editor/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-audio-whisper-transcribe/SKILL.md`
> * `skill-library/native/zavorth-audio-whisper-transcribe/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-better-auth-engineer/SKILL.md`
> * `skill-library/native/zavorth-better-auth-engineer/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-blockchain-auditor/SKILL.md`
> * `skill-library/native/zavorth-blockchain-auditor/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-brand-kit-compiler/SKILL.md`
> * `skill-library/native/zavorth-brand-kit-compiler/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-clickhouse-analytics/SKILL.md`
> * `skill-library/native/zavorth-clickhouse-analytics/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-cloudflare-workers/SKILL.md`
> * `skill-library/native/zavorth-cloudflare-workers/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-cognitive-prompt-optimizer/SKILL.md`
> * `skill-library/native/zavorth-cognitive-prompt-optimizer/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-credential-vault-bridge/SKILL.md`
> * `skill-library/native/zavorth-credential-vault-bridge/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-data-science-plot/SKILL.md`
> * `skill-library/native/zavorth-data-science-plot/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-design-system-manager/SKILL.md`
> * `skill-library/native/zavorth-design-system-manager/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-devops-docker-manager/SKILL.md`
> * `skill-library/native/zavorth-devops-docker-manager/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-diagram-generator/SKILL.md`
> * `skill-library/native/zavorth-diagram-generator/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-documentation-coauthor/SKILL.md`
> * `skill-library/native/zavorth-documentation-coauthor/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-email-client-manager/SKILL.md`
> * `skill-library/native/zavorth-email-client-manager/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-flutter-app-builder/SKILL.md`
> * `skill-library/native/zavorth-flutter-app-builder/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-git-workflow-governor/SKILL.md`
> * `skill-library/native/zavorth-git-workflow-governor/ZAVORTH_NATIVE_SKILL.json`
> * `skill-library/native/zavorth-interactive-debugging/SKILL.md`
> * `skill-library/native/zavorth-interactive-debugging/ZAVORTH_NATIVE_SKILL.json`
> 
> </details>
> 
> You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file.
> 
> Use the checkbox below for a quick retry:
> - [ ] <!-- {"checkboxId": "e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> ­ƒöì Trigger review

<!-- end of auto-generated comment: skip review by coderabbit.ai -->

<!-- tips_start -->

---

> [!NOTE]
> <details>
> <summary>­ƒÄü Summarized by CodeRabbit Free</summary>
> 
> Your organization is on the Free plan. CodeRabbit will generate a high-level summary and a walkthrough for each pull request. For a comprehensive line-by-line review, please upgrade your subscription to CodeRabbit Pro by visiting <https://app.coderabbit.ai/login>.
> 
> </details>


<sub>Comment `@coderabbitai help` to get the list of available commands and usage tips.</sub>

<!-- tips_end -->
--
author:	zavorth
association:	owner
edited:	false
status:	none
--
@coderabbitai review
--
author:	coderabbitai
association:	none
edited:	true
status:	none
--
<!-- This is an auto-generated reply by CodeRabbit -->
<!-- CodeRabbit review command invocation: 1bd77489-6899-4680-999f-c6ca7a395cd8 -->
<details>
<summary>Ô£à Action performed</summary>

Review finished.

> Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.

</details>
--
author:	zavorth
association:	owner
edited:	false
status:	none
--
@coderabbitai review
--
author:	coderabbitai
association:	none
edited:	true
status:	none
--
<!-- This is an auto-generated reply by CodeRabbit -->
<!-- CodeRabbit review command invocation: 61e505c2-0364-4e4e-be53-776fc5cf8c43 -->
<details>
<summary>Ô£à Action performed</summary>

Review finished.

> Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.

</details>
--
author:	zavorth
association:	owner
edited:	false
status:	none
--
@coderabbitai review --type committed
--
author:	coderabbitai
association:	none
edited:	true
status:	none
--
<!-- This is an auto-generated reply by CodeRabbit -->
<!-- CodeRabbit review command invocation: 49173265-ea3c-44b2-a2b1-bff13cd88cde -->
`@zavorth` Sure! I'll perform a full review of all committed changes in this PR.

<details>
<summary>Ô£à Action performed</summary>

Full review finished.

</details>
--
author:	zavorth
association:	owner
edited:	false
status:	none
--
@coderabbitai review
--
author:	coderabbitai
association:	none
edited:	true
status:	none
--
<!-- This is an auto-generated reply by CodeRabbit -->
<!-- CodeRabbit review command invocation: 30b554f8-2806-49a6-abef-8b623b96cffa -->
<details>
<summary>Ô£à Action performed</summary>

Review finished.

> Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.

</details>
--
author:	zavorth
association:	owner
edited:	false
status:	none
--
@coderabbitai review --dir src/config/sections/
--
author:	coderabbitai
association:	none
edited:	false
status:	none
--
<!-- This is an auto-generated reply by CodeRabbit -->
The author of this PR is on the CodeRabbit Free Plan. In order to use the Chat feature, please upgrade the PR author to CodeRabbit Pro by visiting <https://app.coderabbit.ai/login>.
--
