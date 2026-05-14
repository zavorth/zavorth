import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PlaywrightActionTool } from '../src/nexus/tools/browser/PlaywrightActionTool.js';

async function main(): Promise<void> {
  const fixturePath = path.join(os.tmpdir(), `zavorth-qa-browser-agent-${process.pid}-${Date.now()}.html`);
  const sessionId = `qa-browser-agent-${process.pid}-${Date.now()}`;
  fs.writeFileSync(fixturePath, buildFixtureHtml(), 'utf8');

  const tool = new PlaywrightActionTool();
  const context = { sessionId, traceId: 'qa-browser-agent-trace' };
  try {
    const navigate = await tool.execute({
      action: 'navigate',
      url: pathToFileURL(fixturePath).toString(),
    }, context);
    assert.equal(navigate.success, true);
    assertBase64Screenshot(navigate.data);
    assert.equal(navigate.data?.policy?.scope, 'local-file');
    assert.equal(navigate.data?.lifecycle?.sessionId, sessionId);

    const initialExtract = await tool.execute({ action: 'extract', selector: '#headline' }, context);
    assert.equal(initialExtract.success, true);
    assert.match(String(initialExtract.data?.extractedText || ''), /Zavorth Browser QA/);
    assert.equal(initialExtract.data?.artifact?.kind, 'screenshot');
    assert.equal(initialExtract.data?.lifecycle?.mode, 'session');

    const typed = await tool.execute({
      action: 'type',
      selector: '#memo',
      text: 'browser-agent-ok',
    }, context);
    assert.equal(typed.success, true);

    const clicked = await tool.execute({ action: 'click', selector: '#commit' }, context);
    assert.equal(clicked.success, true);
    assertBase64Screenshot(clicked.data);

    const result = await tool.execute({ action: 'extract', selector: '#result' }, context);
    assert.equal(result.success, true);
    assert.equal(String(result.data?.extractedText || '').trim(), 'browser-agent-ok clicked');

    const selfHealedClick = await tool.execute({
      action: 'click',
      selector: '[data-testid="submit-order"]',
    }, context);
    assert.equal(selfHealedClick.success, true);
    assert.equal(selfHealedClick.data?.selfHealing?.healed, true);
    assert.equal(selfHealedClick.data?.selfHealing?.strategy, 'heuristic');

    const repairResult = await tool.execute({ action: 'extract', selector: '#repair-result' }, context);
    assert.equal(repairResult.success, true);
    assert.equal(String(repairResult.data?.extractedText || '').trim(), 'repair-clicked');

    console.log(JSON.stringify({
      ok: true,
      suite: 'qa:browser-agent',
      sessionId,
      extractedText: result.data?.extractedText,
      screenshotBytes: String(clicked.data?.base64 || '').length,
      policyScope: navigate.data?.policy?.scope,
      artifactKind: clicked.data?.artifact?.kind,
      lifecycleStatus: clicked.data?.lifecycle?.status,
      selfHealing: selfHealedClick.data?.selfHealing,
    }, null, 2));
  } finally {
    await tool.execute({ action: 'close' }, context).catch(() => undefined);
    if (fs.existsSync(fixturePath)) {
      fs.unlinkSync(fixturePath);
    }
  }
}

function buildFixtureHtml(): string {
  return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8">
    <title>Zavorth Browser QA</title>
    <style>
      body { font-family: sans-serif; padding: 32px; background: #f4efe6; color: #17201a; }
      button { padding: 10px 16px; border: 0; border-radius: 10px; background: #17452f; color: white; }
      input { padding: 10px; width: 260px; border-radius: 10px; border: 1px solid #8aa28f; }
    </style>
  </head>
  <body>
    <h1 id="headline">Zavorth Browser QA</h1>
    <label for="memo">Memo</label>
    <input id="memo" value="">
    <button id="commit" onclick="document.querySelector('#result').innerText = document.querySelector('#memo').value + ' clicked'">Commit</button>
    <p id="result">waiting</p>
    <button id="finalize-order" aria-label="submit order" onclick="document.querySelector('#repair-result').innerText = 'repair-clicked'">Submit order</button>
    <p id="repair-result">pending</p>
  </body>
</html>`;
}

function assertBase64Screenshot(data: any): void {
  assert.equal(data?.mimeType, 'image/png');
  assert(String(data?.base64 || '').length > 100, 'browser action should return a base64 screenshot');
}

main().catch((error) => {
  console.error('[qa:browser-agent] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
