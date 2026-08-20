import type { EchoSpeechSynthesisService } from '../../../domain/surface/application/EchoSpeechSynthesisService.js';
import type { EchoVoiceAssetStoreService } from '../../../domain/surface/infrastructure/EchoVoiceAssetStoreService.js';

export type HomeAssistantLifecycleStatus =
    | 'idle'
    | 'disabled'
    | 'connecting'
    | 'listening'
    | 'degraded'
    | 'blocked';

export type HomeAssistantEndpointPolicy = {
    scope: 'loopback' | 'private-network' | 'blocked';
    normalizedUrl: string;
    hostname: string | null;
    transport: 'rest+websocket';
};

export type HomeAssistantBridgeState = {
    status: HomeAssistantLifecycleStatus;
    endpointUrl: string | null;
    listening: boolean;
    connected: boolean;
    reconnectAttempts: number;
    lastConnectedAt: string | null;
    lastDisconnectedAt: string | null;
    lastEventAt: string | null;
    lastActionAt: string | null;
    lastEntityId: string | null;
    lastAction: string | null;
    lastMessageType: string | null;
    lastError: string | null;
    lastPhysicalFeedback: string | null;
    lastPhysicalSeverity: 'info' | 'warn' | 'critical' | null;
};

export type HomeAssistantPhysicalEvent = {
    id: string;
    source: 'iot_home_assistant';
    timestamp: string;
    entityId: string;
    oldState: string | null;
    newState: string;
    feedback: string;
    severity: 'info' | 'warn' | 'critical';
};

export type HomeAssistantBridgeRuntime = {
    fetchImpl?: typeof fetch;
    speechService?: Pick<EchoSpeechSynthesisService, 'synthesize'>;
    voiceAssetStore?: EchoVoiceAssetStoreService;
    publicBaseUrl?: string;
};
