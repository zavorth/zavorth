import { safeParseInt } from "../../shared/utils/safeParseInt.js";

const DEFAULT_PORT = 20128;

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = safeParseInt(String(value), fallback);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) return fallback;
  return parsed;
}

export type RuntimePorts = {
  port: number;
  apiPort: number;
  zavorthControlPort: number;
  apiPortExplicit: boolean;
  zavorthControlPortExplicit: boolean;
};

export function getRuntimePorts(): RuntimePorts {
  // ZavorthGateway_PORT preserves the user's canonical PORT in wrapped runtimes
  // where Next.js requires process.env.PORT to be the zavorthControl listener port.
  const basePort = parsePort(process.env.ZavorthGateway_PORT || process.env.PORT, DEFAULT_PORT);
  const apiPortExplicit = !!process.env.API_PORT;
  const zavorthControlPortExplicit = !!process.env.ZAVORTH_CONTROL_PORT;

  return {
    port: basePort,
    apiPort: parsePort(process.env.API_PORT, basePort),
    zavorthControlPort: parsePort(process.env.ZAVORTH_CONTROL_PORT, basePort),
    apiPortExplicit,
    zavorthControlPortExplicit,
  };
}
