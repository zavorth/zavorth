import { z } from 'zod';
import { createRequire } from 'module';
import { IZavorthTool, ToolExecutionResult } from '../../types/IZavorthTool.js';
import { isLocalNetworkHostname } from '../../security/WhitelistConfig.js';
import { logger } from '../../../logger.js';
import { asErrorLike } from '../../../utils/errorLike.js';

const requireFromHere = createRequire(__filename);

type MqttLifecycleStatus =
    | 'idle'
    | 'connecting'
    | 'publishing'
    | 'delivered'
    | 'blocked'
    | 'failed';

type MqttBrokerPolicy = {
    scope: 'loopback' | 'private-network' | 'blocked';
    normalizedBroker: string;
    hostname: string | null;
    port: number | null;
    transport: 'mqtt';
};

type MqttPublisherState = {
    status: MqttLifecycleStatus;
    broker: string | null;
    hostname: string | null;
    port: number | null;
    topic: string | null;
    qos: number | null;
    payloadBytes: number;
    lastPublishedAt: string | null;
    lastError: string | null;
};

type MqttClientLike = {
    end: (force?: boolean) => void;
    publish: (topic: string, payload: string, options: { qos: number }, callback: (error: Error | null) => void) => void;
    on: ((event: 'connect', listener: () => void) => void)
        & ((event: 'error', listener: (error: Error) => void) => void);
};

type MqttModuleLike = {
    connect: (broker: string, options: { connectTimeout: number; reconnectPeriod: number }) => MqttClientLike;
};

/**
 * MQTTPublisher publishes messages to local MQTT brokers.
 */
export class MQTTPublisher implements IZavorthTool {
    name = 'iot_mqtt_publish';
    description = 'Publishes messages to local MQTT brokers to control IoT devices such as ESP32, Arduino, or Shelly devices.';
    category = 'IOT' as const;
    dangerLevel = 'moderate' as const;
    requiresPermission = false;

    schema = z.object({
        broker: z.string().default('mqtt://localhost:1883')
            .describe('MQTT broker URL, for example mqtt://localhost:1883 or mqtt://192.168.1.100:1883'),
        topic: z.string()
            .describe('MQTT topic to publish to, for example home/living-room/light or home/bedroom/fan'),
        payload: z.string()
            .describe('Message to send, for example ON, OFF, or {"brightness": 80}'),
        qos: z.number().min(0).max(2).default(0)
            .describe('Quality of Service: 0=fire-and-forget, 1=at-least-once, 2=exactly-once'),
    });

    private state: MqttPublisherState = {
        status: 'idle',
        broker: null,
        hostname: null,
        port: null,
        topic: null,
        qos: null,
        payloadBytes: 0,
        lastPublishedAt: null,
        lastError: null,
    };

    public getLifecycleSnapshot(): Record<string, unknown> {
        return this.buildLifecycleSnapshot(this.state.status);
    }

    async execute(params: {
        broker?: string;
        topic: string;
        payload: string;
        qos?: number;
    }, context?: Record<string, unknown>): Promise<ToolExecutionResult> {
        const broker = params.broker || 'mqtt://localhost:1883';
        const qos = Number.isFinite(Number(params.qos)) ? Number(params.qos) : 0;
        const payloadBytes = Buffer.byteLength(String(params.payload || ''), 'utf8');
        const policy = this.resolveBrokerPolicy(broker);

        this.updateState({
            broker: policy.normalizedBroker,
            hostname: policy.hostname,
            port: policy.port,
            topic: params.topic,
            qos,
            payloadBytes,
            lastError: null,
        });

        if (policy.scope === 'blocked') {
            this.updateState({
                status: 'blocked',
                lastError: `MQTT broker blocked by security: ${broker}. Use localhost or a private network.`,
            });
            return this.fail(
                `MQTT broker blocked by security: ${broker}. Use localhost or a private network.`,
                policy,
                context,
                'blocked',
            );
        }

        try {
            let mqtt: MqttModuleLike;
            try {
                mqtt = this.loadMqttModule();
            } catch (error: unknown) {this.updateState({
                    status: 'failed',
                    lastError: 'Package "mqtt" not found. Run: npm install mqtt',
                });
                return this.fail(
                    'Package "mqtt" not found. Run: npm install mqtt',
                    policy,
                    context,
                    'failed',
                );
            }

            this.updateState({ status: 'connecting' });
            const client = mqtt.connect(broker, {
                connectTimeout: 5000,
                reconnectPeriod: 0,
            });

            return await new Promise<ToolExecutionResult>((resolve) => {
                const finish = (result: ToolExecutionResult) => {
                    clearTimeout(timeout);
                    resolve(result);
                };

                const timeout = setTimeout(() => {
                    client.end(true);
                    this.updateState({
                        status: 'failed',
                        lastError: `Timeout: MQTT broker ${broker} did not respond within 5 seconds.`,
                    });
                    finish(this.fail(
                        `Timeout: MQTT broker ${broker} did not respond within 5 seconds.`,
                        policy,
                        context,
                        'failed',
                    ));
                }, 5000);

                client.on('connect', () => {
                    this.updateState({ status: 'publishing' });
                    client.publish(
                        params.topic,
                        params.payload,
                        { qos },
                        (err) => {
                            client.end();
                            if (err) {
                                this.updateState({
                                    status: 'failed',
                                    lastError: `Failed to publish: ${err.message}`,
                                });
                                finish(this.fail(
                                    `Failed to publish: ${err.message}`,
                                    policy,
                                    context,
                                    'failed',
                                ));
                                return;
                            }

                            const publishedAt = new Date().toISOString();
                            this.updateState({
                                status: 'delivered',
                                lastPublishedAt: publishedAt,
                                lastError: null,
                            });
                            finish({
                                success: true,
                                message: `Published "${params.payload}" to topic "${params.topic}" (QoS ${qos}).`,
                                data: {
                                    broker: policy.normalizedBroker,
                                    topic: params.topic,
                                    payload: params.payload,
                                    qos,
                                    artifact: this.buildArtifact(policy.normalizedBroker, params.topic, context),
                                    lifecycle: this.buildLifecycleSnapshot('delivered'),
                                    policy,
                                    correlation: this.extractCorrelation(context),
                                },
                            });
                        },
                    );
                });

                client.on('error', (err) => {
                    client.end(true);
                    this.updateState({
                        status: 'failed',
                        lastError: `MQTT connection error (${broker}): ${err.message}`,
                    });
                    finish(this.fail(
                        `MQTT connection error (${broker}): ${err.message}`,
                        policy,
                        context,
                        'failed',
                    ));
                });
            });
        } catch (error: unknown) {
          const err = asErrorLike(error);
          this.updateState({
                status: 'failed',
                lastError: `MQTT Publisher failure: ${err.message}`,
            });
            return this.fail(
                `MQTT Publisher failure: ${err.message}`,
                policy,
                context,
                'failed',
            );
        }
    }

    private resolveBrokerPolicy(broker: string): MqttBrokerPolicy {
        try {
            const url = new URL(broker);
            const hostname = String(url.hostname || '').trim().toLowerCase();
            const port = Number.isFinite(Number(url.port)) && String(url.port).trim()
                ? Number(url.port)
                : 1883;

            if (!hostname || !isLocalNetworkHostname(hostname)) {
                return {
                    scope: 'blocked',
                    normalizedBroker: url.toString(),
                    hostname: hostname || null,
                    port,
                    transport: 'mqtt',
                };
            }

            return {
                scope: hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
                    ? 'loopback'
                    : 'private-network',
                normalizedBroker: url.toString(),
                hostname,
                port,
                transport: 'mqtt',
            };
        } catch (error: unknown) {logger.warn('[M Q T T Publisher] string operation failed', error);
    return {
                scope: 'blocked',
                normalizedBroker: String(broker || '').trim(),
                hostname: null,
                port: null,
                transport: 'mqtt',
            };
  }
    }

    private buildLifecycleSnapshot(status: MqttLifecycleStatus): Record<string, unknown> {
        return {
            mode: 'event-bridge',
            status,
            broker: this.state.broker,
            hostname: this.state.hostname,
            port: this.state.port,
            topic: this.state.topic,
            qos: this.state.qos,
            payloadBytes: this.state.payloadBytes,
            lastPublishedAt: this.state.lastPublishedAt,
            lastError: this.state.lastError,
        };
    }

    private buildArtifact(
        broker: string,
        topic: string,
        context?: Record<string, unknown>,
    ): Record<string, unknown> {
        return {
            id: String(context?.artifactId || `mqtt:${topic}:${Date.now()}`),
            kind: 'iot-command',
            source: this.name,
            broker,
            topic,
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
        policy: MqttBrokerPolicy,
        context?: Record<string, unknown>,
        status: MqttLifecycleStatus = this.state.status,
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

    private updateState(patch: Partial<MqttPublisherState>): void {
        this.state = {
            ...this.state,
            ...patch,
        };
    }

    protected loadMqttModule(): MqttModuleLike {
        return requireFromHere('mqtt');
    }
}
