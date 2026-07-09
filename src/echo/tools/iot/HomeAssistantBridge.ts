import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import WebSocket from 'ws';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool.js';
import { isLocalNetworkHostname } from '../../security/WhitelistConfig.js';
import { MemoryService } from '../../../services/MemoryService.js';
import { config } from '../../../config/index.js';
import {
    DEFAULT_ECHO_GEMINI_TTS_MODEL,
    EchoSpeechSynthesisService,
} from '../../../domain/surface/application/EchoSpeechSynthesisService.js';
import {
    EchoVoiceAssetStoreService,
    getDefaultEchoVoiceAssetStore,
} from '../../../domain/surface/infrastructure/EchoVoiceAssetStoreService.js';
import { logger } from '../../../logger.js';
import type {
HomeAssistantBridgeRuntime,
    HomeAssistantBridgeState,
    HomeAssistantEndpointPolicy,
    HomeAssistantLifecycleStatus,
    HomeAssistantPhysicalEvent,
} from './HomeAssistantBridgeTypes.js';
import { asErrorLike } from '../../../utils/errorLike';

interface HomeAssistantEntityState {
    state: string;
    [key: string]: unknown;
}

interface HomeAssistantStateChangedData {
    entity_id: string;
    new_state: HomeAssistantEntityState | null;
    old_state: HomeAssistantEntityState | null;
    [key: string]: unknown;
}

export class HomeAssistantBridge implements IZavorthTool {
    name = 'iot_home_assistant';
    description = 'Controls smart devices through Home Assistant. Can turn lights, switches, and fans on or off, and adjust temperature, humidity, HVAC mode, fan mode, brightness, covers, media players, scenes, scripts, alarms, and voice playback.';
    category = 'IOT' as const;
    dangerLevel = 'moderate' as const;
    requiresPermission = false;

    schema = z.object({
        entity_id: z.string()
            .describe('Home Assistant entity ID, for example light.living_room, switch.fan, or climate.bedroom'),
        action: z.enum([
            'turn_on', 'turn_off', 'toggle',
            'set_brightness', 'set_temperature', 'set_humidity', 'set_hvac_mode', 'set_fan_mode', 'set_preset_mode',
            'lock', 'unlock',
            'open_cover', 'close_cover', 'stop_cover', 'set_position',
            'media_play', 'media_pause', 'media_stop', 'media_next_track', 'media_previous_track',
            'speak_text',
            'vacuum_start', 'vacuum_pause', 'vacuum_stop', 'vacuum_return_to_base',
            'press', 'select_option', 'set_value',
            'activate_scene', 'run_script',
            'arm_away', 'arm_home', 'disarm',
        ])
            .describe('Action to execute on the device'),
        attributes: z.record(z.string(), z.unknown()).optional()
            .describe('Extra attributes such as { brightness: 80 } or { temperature: 22 }'),
    });

    private ws: WebSocket | null = null;
    private messageId = 1;
    private reconnectAttempts = 0;
    private listening = false;
    private readonly bridgeId = `ha-bridge:${randomUUID().slice(0, 8)}`;
    private readonly memoryService = new MemoryService();
    private readonly recentPhysicalEvents: HomeAssistantPhysicalEvent[] = [];
    private readonly fetchImpl: typeof fetch;
    private readonly speechService: Pick<EchoSpeechSynthesisService, 'synthesize'>;
    private readonly voiceAssetStore: EchoVoiceAssetStoreService;
    private readonly publicBaseUrl: string | null;
    private state: HomeAssistantBridgeState = {
        status: 'idle',
        endpointUrl: null,
        listening: false,
        connected: false,
        reconnectAttempts: 0,
        lastConnectedAt: null,
        lastDisconnectedAt: null,
        lastEventAt: null,
        lastActionAt: null,
        lastEntityId: null,
        lastAction: null,
        lastMessageType: null,
        lastError: null,
        lastPhysicalFeedback: null,
        lastPhysicalSeverity: null,
    };

    constructor(runtime: HomeAssistantBridgeRuntime = {}) {
        this.fetchImpl = runtime.fetchImpl || fetch;
        this.speechService = runtime.speechService || new EchoSpeechSynthesisService();
        this.voiceAssetStore = runtime.voiceAssetStore || getDefaultEchoVoiceAssetStore();
        this.publicBaseUrl = this.normalizeBaseUrl(
            runtime.publicBaseUrl
            || process.env.ZAVORTH_HOME_ASSISTANT_AUDIO_BASE_URL
            || config.zavorthPublicBaseUrl
            || '',
        );
    }

    /**
     * Listens to Home Assistant physical events with progressive reconnect.
     */
    public startListeningEvents(): void {
        const haUrl = process.env.HOME_ASSISTANT_URL || 'http://localhost:8123';
        const haToken = process.env.HOME_ASSISTANT_TOKEN;

        this.listening = true;
        this.updateState({
            endpointUrl: haUrl,
            listening: true,
            status: 'connecting',
            lastError: null,
        });

        if (!haToken) {
            this.updateState({
                listening: false,
                status: 'disabled',
                lastError: 'HOME_ASSISTANT_TOKEN is not configured.',
            });
            return;
        }

        this.connectWithBackoff(haUrl, haToken);
    }

    public getLifecycleSnapshot(): Record<string, unknown> {
        return this.buildLifecycleSnapshot(this.state.status);
    }

    public getRecentPhysicalEvents(limit = 5): Record<string, unknown>[] {
        const safeLimit = Math.max(1, Math.min(Math.floor(limit), 20));
        return this.recentPhysicalEvents.slice(0, safeLimit).map((entry) => ({ ...entry }));
    }

    private connectWithBackoff(haUrl: string, haToken: string): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const wsUrl = haUrl.replace(/^http/, 'ws') + '/api/websocket';
        this.updateState({
            endpointUrl: haUrl,
            listening: true,
            status: 'connecting',
            connected: false,
            lastError: null,
        });

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                this.reconnectAttempts = 0;
                this.updateState({
                    connected: true,
                    reconnectAttempts: 0,
                    status: 'connecting',
                    lastError: null,
                });
                console.log('[HomeAssistantBridge] WebSocket connected to the Home Assistant physical hub.');
            });

            this.ws.on('message', async (data: WebSocket.Data) => {
                const message = JSON.parse(data.toString());
                this.updateState({
                    lastMessageType: String(message?.type || '').trim() || null,
                });

                if (message.type === 'auth_required') {
                    this.ws?.send(JSON.stringify({ type: 'auth', access_token: haToken }));
                } else if (message.type === 'auth_ok') {
                    this.updateState({
                        connected: true,
                        status: 'listening',
                        lastConnectedAt: new Date().toISOString(),
                        lastError: null,
                    });
                    console.log('[HomeAssistantBridge] Authenticated successfully. Subscribing to physical state changes...');
                    this.ws?.send(JSON.stringify({
                        id: this.messageId++,
                        type: 'subscribe_events',
                        event_type: 'state_changed',
                    }));
                } else if (message.type === 'event' && message.event?.event_type === 'state_changed') {
                    await this.handlePhysicalEvent(message.event.data);
                }
            });

            this.ws.on('error', (err: Error) => {
                this.updateState({
                    connected: false,
                    status: this.listening ? 'degraded' : 'idle',
                    lastError: String(err?.message || 'unknown error'),
                });
                console.error('[HomeAssistantBridge] Physical event loop error:', err.message);
            });

            this.ws.on('close', () => {
                this.updateState({
                    connected: false,
                    lastDisconnectedAt: new Date().toISOString(),
                    reconnectAttempts: this.reconnectAttempts,
                    status: this.listening ? 'degraded' : 'idle',
                });
                if (!this.listening) {
                    return;
                }

                const timeoutMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 300000);
                this.reconnectAttempts++;
                this.updateState({
                    reconnectAttempts: this.reconnectAttempts,
                    status: 'degraded',
                });
                console.warn(`[HomeAssistantBridge] Physical-world connection lost. Retrying in ${timeoutMs / 1000}s...`);
                setTimeout(() => this.connectWithBackoff(haUrl, haToken), timeoutMs);
            });
        } catch (error: unknown) {
          const err = asErrorLike(error);
          this.updateState({
                connected: false,
                status: this.listening ? 'degraded' : 'idle',
                lastError: String((err as Error)?.message || err || 'unknown error'),
            });
            console.error('[HomeAssistantBridge] System failure while creating WebSocket.', err);
        }
    }

    private async handlePhysicalEvent(data: HomeAssistantStateChangedData): Promise<void> {
        const entityId = data.entity_id;
        const newState = data.new_state?.state;
        const oldState = data.old_state?.state;

        if (newState === oldState || !newState) {
            return;
        }

        this.updateState({
            lastEventAt: new Date().toISOString(),
            lastEntityId: String(entityId || '').trim() || null,
            status: this.listening ? 'listening' : this.state.status,
        });

        const physicalEvent = this.recordPhysicalEvent({
            entityId: String(entityId || '').trim(),
            oldState: oldState ? String(oldState).trim() : null,
            newState: String(newState || '').trim(),
        });

        if (entityId.startsWith('alarm_') || entityId.startsWith('lock.') || entityId.startsWith('climate.') || entityId.includes('presence')) {
            const insightKey = `iot_anomaly_${entityId}`;
            const insightValue = `Physical device ${entityId} changed its state to ${newState} now.`;
            await this.memoryService.remember('system', insightKey, insightValue, 'iot_feedback');
            console.log(`[Physical IoT -> Echo Memory] Recording episodic event: ${insightValue}`);
        }

        if (physicalEvent) {
            console.log(`[Physical IoT -> Echo Surface] ${physicalEvent.feedback}`);
        }
    }

    async execute(params: {
        entity_id: string;
        action: string;
        attributes?: Record<string, unknown>;
    }, context?: Record<string, unknown>): Promise<ToolExecutionResult> {
        const haUrl = process.env.HOME_ASSISTANT_URL || 'http://localhost:8123';
        const haToken = process.env.HOME_ASSISTANT_TOKEN;
        const endpointPolicy = this.resolveEndpointPolicy(haUrl);

        try {
            if (endpointPolicy.scope === 'blocked') {
                return this.fail(
                    'HOME_ASSISTANT_URL must point to localhost or a private/local network.',
                    endpointPolicy,
                    context,
                    'blocked',
                );
            }

            if (!haToken) {
                this.updateState({
                    status: 'disabled',
                    lastError: 'HOME_ASSISTANT_TOKEN is not configured.',
                });
                return this.fail(
                    'HOME_ASSISTANT_TOKEN is not configured.',
                    endpointPolicy,
                    context,
                    'disabled',
                );
            }

            if (params.action === 'speak_text') {
                return await this.executeSpeakText(params, {
                    haUrl,
                    haToken,
                    endpointPolicy,
                    context,
                });
            }

            const serviceInfo = this.resolveService(params.action, params.entity_id);
            if (!serviceInfo) {
                return this.fail(
                    `Unknown action: ${params.action}`,
                    endpointPolicy,
                    context,
                    this.state.status,
                );
            }

            const body: Record<string, unknown> = { entity_id: params.entity_id };
            if (params.attributes) {
                Object.assign(body, params.attributes);
            }
            if (params.action === 'set_brightness' && params.attributes?.brightness) {
                body.brightness = Math.round((Number(params.attributes.brightness) / 100) * 255);
            }

            this.updateState({
                endpointUrl: haUrl,
                lastActionAt: new Date().toISOString(),
                lastEntityId: params.entity_id,
                lastAction: params.action,
                lastError: null,
            });

            const url = `${haUrl}/api/services/${serviceInfo.domain}/${serviceInfo.service}`;
            const response = await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${haToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.updateState({
                    status: this.listening ? 'degraded' : 'idle',
                    lastError: `HTTP ${response.status}`,
                });
                return this.fail(
                    `Home Assistant returned error ${response.status}: ${errorText}`,
                    endpointPolicy,
                    context,
                    this.state.status,
                );
            }

            return {
                success: true,
                message: `Successfully controlled device: ${params.entity_id}.`,
                data: {
                    entity_id: params.entity_id,
                    action: params.action,
                    artifact: this.buildArtifact(params.entity_id, params.action, context),
                    lifecycle: this.buildLifecycleSnapshot(this.listening ? 'listening' : 'idle'),
                    policy: endpointPolicy,
                    correlation: this.extractCorrelation(context),
                },
            };
        } catch (error: unknown) {
          const errMessage = error instanceof Error ? error.message : String(error);
            this.updateState({
                status: this.listening ? 'degraded' : 'idle',
                lastError: errMessage || 'unknown error',
            });
            return this.fail(
                `Failed to communicate with HA REST: ${errMessage}`,
                endpointPolicy,
                context,
                this.state.status,
            );
        }
    }

    private async executeSpeakText(
        params: {
            entity_id: string;
            action: string;
            attributes?: Record<string, unknown>;
        },
        input: {
            haUrl: string;
            haToken: string;
            endpointPolicy: HomeAssistantEndpointPolicy;
            context?: Record<string, unknown>;
        },
    ): Promise<ToolExecutionResult> {
        const entityId = String(params.entity_id || '').trim();
        const text = String(params.attributes?.text || params.attributes?.message || '').trim();
        const publicBaseUrl = this.publicBaseUrl;

        if (!entityId.startsWith('media_player.')) {
            return this.fail(
                'The speak_text action requires a media_player.* entity_id.',
                input.endpointPolicy,
                input.context,
                this.state.status,
            );
        }

        if (!text) {
            return this.fail(
                'The speak_text action requires attributes.text with the text to speak.',
                input.endpointPolicy,
                input.context,
                this.state.status,
            );
        }

        if (!publicBaseUrl) {
            return this.fail(
                'Configure ZAVORTH_PUBLIC_BASE_URL or ZAVORTH_HOME_ASSISTANT_AUDIO_BASE_URL to deliver Echo audio to Home Assistant.',
                input.endpointPolicy,
                input.context,
                this.state.status,
            );
        }

        this.updateState({
            endpointUrl: input.haUrl,
            lastActionAt: new Date().toISOString(),
            lastEntityId: entityId,
            lastAction: params.action,
            lastError: null,
        });

        const synthesis = await this.speechService.synthesize({
            text,
            surface: 'home-assistant',
            requestedBy: `home-assistant:${entityId}`,
            sessionId: String(input.context?.sessionId || '').trim() || entityId,
            model: this.optionalText(params.attributes?.model) || DEFAULT_ECHO_GEMINI_TTS_MODEL,
            voiceName: this.optionalText(params.attributes?.voiceName || params.attributes?.voice) || undefined,
            languageCode: this.optionalText(params.attributes?.languageCode) || undefined,
        });

        if (!synthesis.ok) {
            return this.fail(
                synthesis.error,
                input.endpointPolicy,
                input.context,
                this.listening ? 'degraded' : 'idle',
            );
        }

        const asset = this.voiceAssetStore.publish({
            audio: synthesis.audio,
            mimeType: synthesis.mimeType,
            publicBaseUrl,
            surface: 'home-assistant',
            requestedBy: `home-assistant:${entityId}`,
            sessionId: String(input.context?.sessionId || '').trim() || entityId,
            traceId: synthesis.traceId,
            model: synthesis.model,
            voiceName: synthesis.voiceName,
            languageCode: synthesis.languageCode,
            ttlMs: this.resolveVoiceAssetTtlMs(params.attributes),
        });

        const body: Record<string, unknown> = {
            entity_id: entityId,
            media_content_id: asset.publicUrl,
            media_content_type: this.text(params.attributes?.media_content_type, 'music'),
        };
        const passthroughKeys = ['announce', 'enqueue', 'extra', 'metadata', 'media_info', 'stream_type'];
        for (const key of passthroughKeys) {
            if (params.attributes && Object.prototype.hasOwnProperty.call(params.attributes, key)) {
                body[key] = params.attributes[key];
            }
        }

        const url = `${input.haUrl}/api/services/media_player/play_media`;
        try {
            const response = await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${input.haToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.voiceAssetStore.remove(asset.id);
                this.updateState({
                    status: this.listening ? 'degraded' : 'idle',
                    lastError: `HTTP ${response.status}`,
                });
                return this.fail(
                    `Home Assistant returned error ${response.status}: ${errorText}`,
                    input.endpointPolicy,
                    input.context,
                    this.state.status,
                );
            }

            return {
                success: true,
                message: `Echo audio sent to ${entityId} through Gemini 3.1 Flash TTS.`,
                data: {
                    entity_id: entityId,
                    action: params.action,
                    artifact: this.buildArtifact(entityId, params.action, input.context, {
                        kind: 'iot-voice-command',
                        text,
                        assetId: asset.id,
                    }),
                    voice: {
                        provider: 'gemini',
                        model: synthesis.model,
                        voiceName: synthesis.voiceName,
                        languageCode: synthesis.languageCode,
                        mimeType: synthesis.mimeType,
                        latencyMs: synthesis.latencyMs,
                        outputBytes: synthesis.outputBytes,
                        assetId: asset.id,
                        publicUrl: asset.publicUrl,
                        expiresAt: asset.expiresAt,
                    },
                    lifecycle: this.buildLifecycleSnapshot(this.listening ? 'listening' : 'idle'),
                    policy: input.endpointPolicy,
                    correlation: this.extractCorrelation(input.context),
                },
            };
        } catch (error: unknown) {
          const errMessage = error instanceof Error ? error.message : String(error);
            this.voiceAssetStore.remove(asset.id);
            this.updateState({
                status: this.listening ? 'degraded' : 'idle',
                lastError: errMessage || 'unknown error',
            });
            return this.fail(
                `Failed to communicate with HA REST: ${errMessage}`,
                input.endpointPolicy,
                input.context,
                this.state.status,
            );
        }
    }

    private resolveService(action: string, entityId: string): { domain: string; service: string } | null {
        const entityDomain = this.extractDomain(entityId);
        const sameDomainActions = new Set(['turn_on', 'turn_off', 'toggle']);
        if (sameDomainActions.has(action)) return { domain: entityDomain, service: action };

        const serviceMap: Record<string, { domain: string; service: string }> = {
            set_brightness: { domain: 'light', service: 'turn_on' },
            set_temperature: { domain: 'climate', service: 'set_temperature' },
            set_humidity: { domain: 'humidifier', service: 'set_humidity' },
            set_hvac_mode: { domain: 'climate', service: 'set_hvac_mode' },
            set_fan_mode: { domain: 'climate', service: 'set_fan_mode' },
            set_preset_mode: { domain: 'climate', service: 'set_preset_mode' },
            lock: { domain: 'lock', service: 'lock' },
            unlock: { domain: 'lock', service: 'unlock' },
            open_cover: { domain: 'cover', service: 'open_cover' },
            close_cover: { domain: 'cover', service: 'close_cover' },
            stop_cover: { domain: 'cover', service: 'stop_cover' },
            set_position: { domain: 'cover', service: 'set_cover_position' },
            media_play: { domain: 'media_player', service: 'media_play' },
            media_pause: { domain: 'media_player', service: 'media_pause' },
            media_stop: { domain: 'media_player', service: 'media_stop' },
            media_next_track: { domain: 'media_player', service: 'media_next_track' },
            media_previous_track: { domain: 'media_player', service: 'media_previous_track' },
            vacuum_start: { domain: 'vacuum', service: 'start' },
            vacuum_pause: { domain: 'vacuum', service: 'pause' },
            vacuum_stop: { domain: 'vacuum', service: 'stop' },
            vacuum_return_to_base: { domain: 'vacuum', service: 'return_to_base' },
            press: { domain: 'button', service: 'press' },
            select_option: { domain: 'select', service: 'select_option' },
            set_value: { domain: 'number', service: 'set_value' },
            activate_scene: { domain: 'scene', service: 'turn_on' },
            run_script: { domain: 'script', service: 'turn_on' },
            arm_away: { domain: 'alarm_control_panel', service: 'alarm_arm_away' },
            arm_home: { domain: 'alarm_control_panel', service: 'alarm_arm_home' },
            disarm: { domain: 'alarm_control_panel', service: 'alarm_disarm' },
        };
        return serviceMap[action] || null;
    }

    private extractDomain(entityId: string): string {
        const dot = entityId.indexOf('.');
        return dot > 0 ? entityId.substring(0, dot) : 'homeassistant';
    }

    private resolveEndpointPolicy(rawUrl: string): HomeAssistantEndpointPolicy {
        try {
            const url = new URL(rawUrl);
            const hostname = String(url.hostname || '').trim().toLowerCase();
            if (!hostname || !isLocalNetworkHostname(hostname)) {
                return {
                    scope: 'blocked',
                    normalizedUrl: url.toString(),
                    hostname: hostname || null,
                    transport: 'rest+websocket',
                };
            }
            return {
                scope: hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
                    ? 'loopback'
                    : 'private-network',
                normalizedUrl: url.toString(),
                hostname,
                transport: 'rest+websocket',
            };
        } catch (error: unknown) {logger.warn('[Home Assistant Bridge] string operation failed', error);
    return {
                scope: 'blocked',
                normalizedUrl: String(rawUrl || '').trim(),
                hostname: null,
                transport: 'rest+websocket',
            };
  }
    }

    private buildLifecycleSnapshot(status: HomeAssistantLifecycleStatus): Record<string, unknown> {
        return {
            bridgeId: this.bridgeId,
            mode: 'event-bridge',
            status,
            listening: this.listening || this.state.listening,
            connected: this.state.connected,
            reconnectAttempts: this.reconnectAttempts,
            endpointUrl: this.state.endpointUrl,
            lastConnectedAt: this.state.lastConnectedAt,
            lastDisconnectedAt: this.state.lastDisconnectedAt,
            lastEventAt: this.state.lastEventAt,
            lastActionAt: this.state.lastActionAt,
            lastEntityId: this.state.lastEntityId,
            lastAction: this.state.lastAction,
            lastMessageType: this.state.lastMessageType,
            lastError: this.state.lastError,
            lastPhysicalFeedback: this.state.lastPhysicalFeedback,
            lastPhysicalSeverity: this.state.lastPhysicalSeverity,
            recentPhysicalEvents: this.getRecentPhysicalEvents(5),
        };
    }

    private buildArtifact(
        entityId: string,
        action: string,
        context?: Record<string, unknown>,
        extra?: Record<string, unknown>,
    ): Record<string, unknown> {
        return {
            id: String(context?.artifactId || `ha:${entityId}:${Date.now()}`),
            kind: String(extra?.kind || 'iot-command'),
            source: this.name,
            entityId,
            action,
            ...extra,
        };
    }

    private extractCorrelation(context?: Record<string, unknown>): Record<string, unknown> | null {
        const correlation = {
            traceId: String(context?.traceId || '').trim() || null,
            runId: String(context?.runId || '').trim() || null,
            sessionId: String(context?.sessionId || '').trim() || null,
            approvalId: String(context?.approvalId || '').trim() || null,
            artifactId: String(context?.artifactId || '').trim() || null,
        };
        return Object.values(correlation).some(Boolean) ? correlation : null;
    }

    private fail(
        error: string,
        policy: HomeAssistantEndpointPolicy,
        context?: Record<string, unknown>,
        status: HomeAssistantLifecycleStatus = this.state.status,
    ): ToolExecutionResult {
        return {
            success: false,
            error,
            data: {
                lifecycle: this.buildLifecycleSnapshot(status),
                policy,
                correlation: this.extractCorrelation(context),
            },
        };
    }

    private updateState(patch: Partial<HomeAssistantBridgeState>): void {
        this.state = {
            ...this.state,
            ...patch,
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    private normalizeBaseUrl(value: string): string | null {
        const normalized = String(value || '').trim().replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(normalized)) {
            return null;
        }
        return normalized;
    }

    private optionalText(value: unknown): string | null {
        const normalized = String(value || '').trim();
        return normalized.length > 0 ? normalized : null;
    }

    private text(value: unknown, fallback: string): string {
        const normalized = String(value || '').trim();
        return normalized.length > 0 ? normalized : fallback;
    }

    private resolveVoiceAssetTtlMs(attributes?: Record<string, unknown>): number | undefined {
        const ttlSeconds = Number(attributes?.ttlSeconds);
        if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
            return undefined;
        }
        return Math.floor(ttlSeconds * 1000);
    }

    private recordPhysicalEvent(input: {
        entityId: string;
        oldState: string | null;
        newState: string;
    }): HomeAssistantPhysicalEvent | null {
        const entityId = String(input.entityId || '').trim();
        const newState = String(input.newState || '').trim();
        if (!entityId || !newState) {
            return null;
        }

        const severity = this.resolvePhysicalSeverity(entityId, newState);
        const event: HomeAssistantPhysicalEvent = {
            id: `ha-event:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
            source: 'iot_home_assistant',
            timestamp: new Date().toISOString(),
            entityId,
            oldState: input.oldState,
            newState,
            feedback: this.buildPhysicalFeedback(entityId, newState, severity),
            severity,
        };

        this.recentPhysicalEvents.unshift(event);
        this.recentPhysicalEvents.splice(12);
        this.updateState({
            lastPhysicalFeedback: event.feedback,
            lastPhysicalSeverity: event.severity,
        });
        return event;
    }

    private resolvePhysicalSeverity(
        entityId: string,
        newState: string,
    ): HomeAssistantPhysicalEvent['severity'] {
        const normalizedEntity = entityId.toLowerCase();
        const normalizedState = newState.toLowerCase();
        if (
            normalizedEntity.startsWith('alarm_')
            || normalizedEntity.startsWith('lock.')
            || normalizedState.includes('trigger')
            || normalizedState.includes('alarm')
            || normalizedState.includes('unlocked')
        ) {
            return 'critical';
        }
        if (
            normalizedEntity.startsWith('climate.')
            || normalizedEntity.includes('presence')
            || normalizedEntity.includes('motion')
            || normalizedEntity.includes('door')
        ) {
            return 'warn';
        }
        return 'info';
    }

    private buildPhysicalFeedback(
        entityId: string,
        newState: string,
        severity: HomeAssistantPhysicalEvent['severity'],
    ): string {
        if (severity === 'critical') {
            return `Atencao: ${entityId} mudou para ${newState}.`;
        }
        if (severity === 'warn') {
            return `Evento fisico percebido em ${entityId}: ${newState}.`;
        }
        return `Atualizacao IoT em ${entityId}: ${newState}.`;
    }
}
