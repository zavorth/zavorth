import { z } from 'zod';
import { EchoVisionAnalysisService } from '../../../domain/platform-ecosystem/infrastructure/EchoVisionAnalysisService.js';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool.js';
import { SystemScreenshotTool } from './SystemScreenshotTool.js';

type ScreenshotExecutor = Pick<SystemScreenshotTool, 'execute'>;
type VisionAnalyzer = Pick<EchoVisionAnalysisService, 'analyzeScreenshot'>;

/**
 * Canonical Echo capability for end-to-end desktop vision:
 * capture screenshot -> multimodal provider -> structured response.
 */
export class SystemVisionAnalysisTool implements IZavorthTool {
  public readonly name = 'os_screen_vision';
  public readonly description =
    'Captures the current screen and uses a multimodal provider to describe what is visible, answer UI questions, and suggest the next step. Requires approval.';
  public readonly category = 'OS' as const;
  public readonly dangerLevel = 'moderate' as const;
  public readonly requiresPermission = true;

  public readonly schema = z.object({
    question: z.string().min(3)
      .describe('Question or instruction describing what to analyze on the current screen.'),
    mode: z.enum(['fullscreen', 'active_window']).default('active_window')
      .describe('Screen capture mode.'),
    returnBase64: z.boolean().default(false)
      .describe('When true, includes the screenshot as base64 in the output payload.'),
    savePath: z.string().optional()
      .describe('Optional path where the screenshot should be persisted.'),
  });

  constructor(
    private readonly screenshotTool: ScreenshotExecutor = new SystemScreenshotTool(),
    private readonly visionAnalyzer: VisionAnalyzer = new EchoVisionAnalysisService(),
  ) {}

  public async execute(params: {
    question: string;
    mode?: 'fullscreen' | 'active_window';
    returnBase64?: boolean;
    savePath?: string;
  }, context?: Record<string, any>): Promise<ToolExecutionResult> {
    const mode = params.mode || 'active_window';
    const question = String(params.question || '').trim();
    if (!question) {
      return {
        success: false,
        error: 'Visual analysis question is required.',
      };
    }

    const captured = await this.screenshotTool.execute({
      mode,
      savePath: params.savePath,
      returnBase64: true,
    });
    if (!captured.success) {
      return {
        success: false,
        error: captured.error || captured.message || 'Failed to capture the screen for visual analysis.',
      };
    }

    const base64 = String(captured.data?.base64 || '').trim();
    const mimeType = String(captured.data?.mimeType || 'image/png').trim() || 'image/png';
    if (!base64) {
      return {
        success: false,
        error: 'Screenshot was captured without a base64 payload for the multimodal provider.',
      };
    }

    const analysis = await this.visionAnalyzer.analyzeScreenshot({
      instruction: question,
      base64,
      mimeType,
      sourceLabel: `echo:${this.name}`,
    });
    const artifactId = String(context?.artifactId || `vision:${Date.now()}`).trim();

    return {
      success: analysis.ok,
      message: analysis.responseText || analysis.summary,
      error: analysis.ok ? undefined : analysis.error || analysis.summary,
      data: {
        filePath: captured.data?.filePath || null,
        mode,
        analysis: {
          summary: analysis.summary,
          responseText: analysis.responseText,
          observedTexts: analysis.observedTexts,
          suggestedNextAction: analysis.suggestedNextAction,
          confidence: analysis.confidence,
          providerName: analysis.providerName,
          rawResponse: analysis.rawResponse,
        },
        artifact: {
          id: artifactId,
          kind: 'screenshot',
          source: this.name,
          mimeType,
          filePath: captured.data?.filePath || null,
        },
        lifecycle: {
          mode: 'snapshot-analysis',
          status: analysis.ok ? 'analyzed' : 'degraded',
          captureMode: mode,
          providerName: analysis.providerName,
          confidence: analysis.confidence,
        },
        policy: {
          scope: 'desktop-local',
          captureMode: mode,
          providerRequired: true,
        },
        correlation: this.extractCorrelation(context, artifactId),
        ...(params.returnBase64 ? { base64, mimeType } : {}),
      },
    };
  }

  private extractCorrelation(context: Record<string, any> | undefined, artifactId: string): Record<string, unknown> | null {
    const correlation = {
      traceId: String(context?.traceId || '').trim() || null,
      runId: String(context?.runId || '').trim() || null,
      sessionId: String(context?.sessionId || '').trim() || null,
      approvalId: String(context?.approvalId || '').trim() || null,
      artifactId,
    };
    return Object.values(correlation).some(Boolean) ? correlation : null;
  }
}
