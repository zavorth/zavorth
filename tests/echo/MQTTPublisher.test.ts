import { MQTTPublisher } from '../../src/echo/tools/iot/MQTTPublisher.js';

class TestableMqttPublisher extends MQTTPublisher {
  constructor(private readonly mqttModule: { connect: jest.Mock }) {
    super();
  }

  protected loadMqttModule(): any {
    return this.mqttModule;
  }
}

describe('MQTTPublisher', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns canonical lifecycle, artifact, policy, and correlation metadata on successful local publish', async () => {
    const mockClient = {
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'connect') {
          setImmediate(() => handler());
        }
        return mockClient;
      }),
      publish: jest.fn((_topic: string, _payload: string, _options: Record<string, unknown>, callback: (err?: Error | null) => void) => {
        setImmediate(() => callback(null));
      }),
      end: jest.fn(),
    };
    const mqttModule = {
      connect: jest.fn(() => mockClient),
    };

    const result = await new TestableMqttPublisher(mqttModule).execute(
      {
        broker: 'mqtt://homeassistant.local:1883',
        topic: 'casa/sala/luz',
        payload: 'ON',
        qos: 1,
      },
      {
        traceId: 'trace-1',
        runId: 'run-1',
        sessionId: 'sess-1',
        approvalId: 'approval-1',
        artifactId: 'artifact-1',
      },
    );

    expect(result.success).toBe(true);
    expect(mqttModule.connect).toHaveBeenCalledWith('mqtt://homeassistant.local:1883', expect.objectContaining({
      connectTimeout: 5000,
      reconnectPeriod: 0,
    }));
    expect(result.data).toEqual(expect.objectContaining({
      broker: 'mqtt://homeassistant.local:1883',
      topic: 'casa/sala/luz',
      payload: 'ON',
      qos: 1,
      artifact: expect.objectContaining({
        id: 'artifact-1',
        kind: 'iot-command',
        source: 'iot_mqtt_publish',
      }),
      lifecycle: expect.objectContaining({
        mode: 'event-bridge',
        status: 'delivered',
        hostname: 'homeassistant.local',
        topic: 'casa/sala/luz',
        qos: 1,
      }),
      policy: expect.objectContaining({
        scope: 'private-network',
        hostname: 'homeassistant.local',
        port: 1883,
        transport: 'mqtt',
      }),
      correlation: expect.objectContaining({
        traceId: 'trace-1',
        runId: 'run-1',
        sessionId: 'sess-1',
        approvalId: 'approval-1',
        artifactId: 'artifact-1',
      }),
    }));
  });

  it('blocks external brokers before opening any MQTT connection', async () => {
    const mqttModule = {
      connect: jest.fn(),
    };

    const result = await new TestableMqttPublisher(mqttModule).execute({
      broker: 'mqtt://broker.hivemq.com:1883',
      topic: 'casa/sala/luz',
      payload: 'ON',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/blocked by security|bloqueado por seguranca/i);
    expect(mqttModule.connect).not.toHaveBeenCalled();
    expect(result.data).toEqual(expect.objectContaining({
      lifecycle: expect.objectContaining({
        mode: 'event-bridge',
        status: 'blocked',
      }),
      policy: expect.objectContaining({
        scope: 'blocked',
        hostname: 'broker.hivemq.com',
        transport: 'mqtt',
      }),
    }));
  });
});
