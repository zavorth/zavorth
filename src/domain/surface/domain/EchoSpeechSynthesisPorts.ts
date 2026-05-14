export type EchoVoiceTelemetryInput = {
  surface: string;
  provider: string;
  model?: string | null;
  voiceName?: string | null;
  languageCode?: string | null;
  inputChars: number;
  latencyMs: number;
  mimeType?: string | null;
  outputBytes?: number | null;
  estimatedCostUsd?: number | null;
  fallbackFrom?: string | null;
  requestedBy?: string | null;
  sessionId?: string | null;
  traceId?: string | null;
  error?: string | null;
};

export type EchoVoiceTelemetryRecorder = {
  recordSuccess(input: EchoVoiceTelemetryInput): Promise<void>;
  recordFailure(input: EchoVoiceTelemetryInput): Promise<void>;
};

export type EchoSpeechSynthesisOptions = {
  model?: string;
  voiceName?: string;
  languageCode?: string;
};

export type EchoSpeechSynthesisProviderResult = {
  filePath: string;
  model: string;
  voiceName: string;
  languageCode: string;
  mimeType: string;
  sourceMimeType?: string | null;
  latencyMs: number;
  inputChars: number;
  outputBytes: number;
};

export type EchoSpeechSynthesisProvider = {
  isConfigured(): boolean;
  synthesizeDetailed(
    text: string,
    options?: EchoSpeechSynthesisOptions,
  ): Promise<EchoSpeechSynthesisProviderResult | null>;
  cleanup(filePath: string): void;
};

export type EchoSpeechCostEstimator = (inputChars: number) => number | null;
