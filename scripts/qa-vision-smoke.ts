import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ComputerUseWatchModeService } from '../src/services/ComputerUseWatchModeService.js';
import { SystemScreenshotTool } from '../src/nexus/tools/os/SystemScreenshotTool.js';
import { SystemVisionAnalysisTool } from '../src/nexus/tools/os/SystemVisionAnalysisTool.js';

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function main(): Promise<void> {
  const screenshotPaths = [0, 1, 2].map((index) =>
    path.join(os.tmpdir(), `zavorth-qa-vision-${process.pid}-${Date.now()}-${index}.png`),
  );
  screenshotPaths.forEach((entry) => fs.writeFileSync(entry, Buffer.from(tinyPngBase64, 'base64')));

  try {
    const screenshotTool = new SystemScreenshotTool();
    const parsedSchema = screenshotTool.schema.parse({
      mode: 'fullscreen',
      returnBase64: true,
    });
    assert.equal(screenshotTool.name, 'os_screenshot');
    assert.equal(screenshotTool.requiresPermission, true);
    assert.equal(parsedSchema.returnBase64, true);

    const service = new ComputerUseWatchModeService({
      mutationGuardEnabled: false,
      isExecutionAllowed: () => true,
      screenshotThrottleMs: 10_000,
      artifactLimit: 2,
      createAgent: () => ({
        pause: () => undefined,
        resume: () => undefined,
        stop: () => undefined,
        getSnapshot: () => ({
          status: 'running',
          iteration: 0,
          maxIterations: 3,
          objective: 'QA vision smoke',
          targetWindow: 'fixture',
          lastAction: null,
          lastScreenshotPath: null,
          history: [],
          startedAt: null,
          finishedAt: null,
          error: null,
        }),
        run: async (config: any) => {
          for (let index = 0; index < screenshotPaths.length; index += 1) {
            await config.hooks?.onScreenshot?.({
              snapshot: {
                status: 'running',
                iteration: index + 1,
                maxIterations: screenshotPaths.length,
                objective: config.objective,
                targetWindow: config.targetWindow,
                lastAction: null,
                lastScreenshotPath: screenshotPaths[index],
                history: [],
                startedAt: '2026-04-18T12:00:00.000Z',
                finishedAt: null,
                error: null,
              },
              screenshotPath: screenshotPaths[index],
            });
          }

          return {
            status: 'completed',
            iteration: screenshotPaths.length,
            maxIterations: screenshotPaths.length,
            objective: config.objective,
            targetWindow: config.targetWindow,
            lastAction: null,
            lastScreenshotPath: screenshotPaths.at(-1),
            history: [],
            startedAt: '2026-04-18T12:00:00.000Z',
            finishedAt: '2026-04-18T12:00:01.000Z',
            error: null,
          };
        },
      }) as any,
    });

    const started = await service.startRun({
      targetWindow: 'fixture',
      objective: 'QA vision smoke',
      requestedBy: 'qa:vision-smoke',
    });
    await flushAsync();

    const finalRun = service.getRun(started.runId);
    const snapshot = service.buildSnapshot();
    const resolvedPath = service.resolveScreenshotPath(started.runId);
    assert(finalRun, 'watch mode run should be recorded');
    assert.equal(finalRun.status, 'completed');
    assert.equal(finalRun.buffers.artifactEntries, 2);
    assert.equal(finalRun.buffers.persistedArtifacts, 3);
    assert(finalRun.buffers.throttledScreenshots >= 2, 'noisy screenshots should be throttled');
    assert.equal(snapshot.summary.artifactEntries, 2);
    assert(resolvedPath && fs.existsSync(resolvedPath), 'latest screenshot artifact should resolve to a local file');

    const artifactBase64 = fs.readFileSync(resolvedPath).toString('base64');
    assert(artifactBase64.length > 20, 'vision artifact should be convertible to base64');

    const visionTool = new SystemVisionAnalysisTool(
      {
        execute: async () => ({
          success: true,
          message: 'fixture screenshot ready',
          data: {
            filePath: screenshotPaths[0],
            base64: artifactBase64,
            mimeType: 'image/png',
          },
        }),
      } as any,
      {
        analyzeScreenshot: async () => ({
          ok: true,
          providerName: 'qa-vision-provider',
          summary: 'Screen shows the supervised Zavorth flow.',
          responseText: 'I see the supervised Zavorth flow on screen.',
          observedTexts: ['Zavorth', 'QA vision'],
          suggestedNextAction: 'seguir com a validation',
          confidence: 0.91,
          rawResponse: '{"ok":true}',
          error: null,
        }),
      } as any,
    );
    const visionResult = await visionTool.execute({
      question: 'What is visible on screen...',
      mode: 'active_window',
      returnBase64: false,
    }, {
      traceId: 'qa-vision-trace',
      runId: 'qa-vision-run',
      sessionId: 'qa-vision-session',
      artifactId: 'qa-vision-artifact',
    });
    assert.equal(visionResult.success, true);
    assert.equal(visionResult.data?.analysis?.providerName, 'qa-vision-provider');
    assert.equal(visionResult.data?.lifecycle?.status, 'analyzed');
    assert.equal(visionResult.data?.policy?.scope, 'desktop-local');
    assert.equal(visionResult.data?.artifact?.id, 'qa-vision-artifact');

    console.log(JSON.stringify({
      ok: true,
      suite: 'qa:vision-smoke',
      runId: started.runId,
      artifactEntries: finalRun.buffers.artifactEntries,
      throttledScreenshots: finalRun.buffers.throttledScreenshots,
      base64Bytes: artifactBase64.length,
      multimodalProvider: visionResult.data?.analysis?.providerName,
      visionStatus: visionResult.data?.lifecycle?.status,
    }, null, 2));
  } finally {
    screenshotPaths.forEach((entry) => {
      if (fs.existsSync(entry)) {
        fs.unlinkSync(entry);
      }
    });
  }
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

main().catch((error) => {
  console.error('[qa:vision-smoke] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
