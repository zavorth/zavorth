import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('ZavorthControlComposerAffordancesQa', () => {
  it.skip('guards attachments, skills and voice as real composer affordances', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const app = readFileSync(
      join(rootDir, 'apps/zavorth-control-vite-shell/src/app.ts'),
      'utf8',
    );
    const experienceProfileUi = readFileSync(
      join(rootDir, 'apps/zavorth-control-vite-shell/src/experience-profile-ui.ts'),
      'utf8',
    );
    const signalTransmitter = readFileSync(
      join(rootDir, 'apps/zavorth-control-vite-shell/src/signal-transmitter.ts'),
      'utf8',
    );
    const runtimeBridge = readFileSync(
      join(rootDir, 'apps/zavorth-control-vite-shell/src/runtime-bridge.ts'),
      'utf8',
    );
    const css = readFileSync(
      join(rootDir, 'apps/zavorth-control-vite-shell/public/styles/chat.css'),
      'utf8',
    );
    const inbox = readFileSync(
      join(rootDir, 'src/zavorth-control/app/(zavorthControl)/control/TerminalInboxSector.tsx'),
      'utf8',
    );
    const qa = readFileSync(
      join(rootDir, 'scripts/dashboard-composer-affordances-qa.ts'),
      'utf8',
    );
    const liveQa = readFileSync(
      join(rootDir, 'scripts/dashboard-live-composer-affordances-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/product-direction.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:zavorthControl-composer-affordances']).toBe(
      'npm run zavorth-control:check --silent',
    );
    expect(packageJson.scripts['qa:zavorthControl-live-composer']).toBe(
      'npx tsx scripts/dashboard-live-composer-affordances-qa.ts --allow-send --require-live --require-pass',
    );
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-composer-affordances');
    expect(packageJson.scripts['qa:zavorthControl']).not.toContain('qa:zavorthControl-live-composer');

    expect(app).toContain("const composeDock = document.querySelector");
    expect(app).toContain('(composeDock || composeFrame).appendChild(skillPopover)');
    expect(app).toContain('setSelectedExperienceProfile(selectedExperienceProfile ||');
    expect(app).toContain('renderExperienceProfilePanel');
    expect(app).toContain('applyNaturalExperienceProfileSwitch');
    expect(app).toContain('getExperienceProfilePayload');
    expect(app).toContain('Nothing sensitive is written to memory until you confirm it.');
    expect(experienceProfileUi).toContain('EXPERIENCE_PROFILE_CATALOG');
    expect(experienceProfileUi).toContain("id: 'personal'");
    expect(experienceProfileUi).toContain("id: 'creator'");
    expect(experienceProfileUi).toContain("id: 'developer'");
    expect(experienceProfileUi).toContain("id: 'business'");
    expect(experienceProfileUi).toContain("id: 'power'");
    expect(experienceProfileUi).toContain('buildExperienceProfilePayload');
    expect(css).toContain('.compose-skill-popover');
    expect(css).toContain('.experience-profile-panel');
    expect(css).toContain('z-index: 70');
    expect(css).toContain('.chat-attachment-card');
    expect(signalTransmitter).toContain('buildSentAttachmentCards(outboundAttachments)');
    expect(signalTransmitter).toContain('experienceProfile: outboundExperienceProfile');
    expect(runtimeBridge).toContain('const experienceProfile = composerPayload.experienceProfile');
    expect(runtimeBridge).toContain('experienceProfile,');
    expect(inbox).toContain('id="stop-run-trigger"');
    expect(inbox).toContain('data-runtime-progress-pill');
    expect(inbox).toContain('In progress');
    expect(inbox).toContain('data-first-run-setup-message');
    expect(inbox).toContain('Nothing is written to memory until you confirm it.');
    expect(app).toContain('stopRunTrigger.addEventListener');
    expect(app).toContain('cancelActiveRun');
    expect(signalTransmitter).toContain('setComposerRunState?.("running"');
    expect(signalTransmitter).toContain('setComposerRunState?.("idle"');
    expect(runtimeBridge).toContain('async function cancelActiveRun');
    expect(runtimeBridge).toContain("action: 'mission.cancel'");

    expect(qa).toContain('attachment-payload-has-text-preview');
    expect(qa).toContain('attachment-message-does-not-leak-context');
    expect(qa).toContain('attachment-card-is-visual-not-raw-html');
    expect(qa).toContain('attachment-card-does-not-render-code-block');
    expect(qa).toContain('selected-skill-payload-preserved');
    expect(qa).toContain('voice-payload-preserved');
    expect(qa).toContain('binary-attachment-is-honest-metadata');
    expect(qa).toContain('binary-attachment-does-not-create-fake-artifact');
    expect(qa).toContain('voice-unsupported-shows-honest-notice');
    expect(qa).toContain('web.search');
    expect(qa).toContain('SpeechRecognition');

    expect(liveQa).toContain('ZAVORTH_WEB_AUTH_TOKEN');
    expect(liveQa).toContain('data", "runtime", "web-api-token.txt');
    expect(liveQa).toContain('--allow-send');
    expect(liveQa).toContain('--allow-skill-send');
    expect(liveQa).toContain('attachment-chip-visible-live');
    expect(liveQa).toContain('skills-popover-opens-live');
    expect(liveQa).toContain('voice-transcript-live-enters-composer');

    expect(docs).toContain('qa:zavorthControl-composer-affordances');
    expect(docs).toContain('qa:zavorthControl-live-composer');
    expect(docs).toContain('must not create artifact cards for simple chat');
    expect(docs).toContain('overflow: hidden');
  });
});
