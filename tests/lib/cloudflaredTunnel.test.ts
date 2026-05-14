jest.mock(
  "@ZavorthGateway/open-sse/utils/proxyFetch.ts",
  () => ({
    __esModule: true,
    default: jest.fn(),
  }),
  { virtual: true }
);

import {
  buildCloudflaredChildEnv,
  extractCloudflaredErrorMessage,
  extractTryCloudflareUrl,
  getCloudflaredAssetSpec,
  getDefaultCloudflaredCertEnv,
} from "../../src/ai-gateway/lib/cloudflaredTunnel";

describe("cloudflaredTunnel helpers", () => {
  it("extracts the public trycloudflare URL from logs", () => {
    const text = `
      2026-04-17T00:00:00Z INF Starting tunnel
      2026-04-17T00:00:01Z INF Your quick Tunnel has been created! Visit it at https://example-name.trycloudflare.com
    `;

    expect(extractTryCloudflareUrl(text)).toBe("https://example-name.trycloudflare.com");
  });

  it("ignores api.trycloudflare.com and returns null", () => {
    const text = "Use https://api.trycloudflare.com for API access";
    expect(extractTryCloudflareUrl(text)).toBeNull();
  });

  it("extracts actionable cloudflared errors while ignoring noisy warnings", () => {
    const text = `
      2026-04-17T00:00:00Z WRN failed to sufficiently increase receive buffer size
      2026-04-17T00:00:01Z ERR x509: certificate signed by unknown authority
    `;

    expect(extractCloudflaredErrorMessage(text)).toBe(
      "x509: certificate signed by unknown authority"
    );
  });

  it("builds a child env with runtime dirs and chosen protocol", () => {
    const runtimeDirs = {
      runtimeRoot: "/tmp/cloudflared/runtime",
      homeDir: "/tmp/cloudflared/runtime/home",
      configDir: "/tmp/cloudflared/runtime/config",
      cacheDir: "/tmp/cloudflared/runtime/cache",
      dataDir: "/tmp/cloudflared/runtime/data",
      tempDir: "/tmp/cloudflared/runtime/tmp",
      userProfileDir: "/tmp/cloudflared/runtime/userprofile",
      appDataDir: "/tmp/cloudflared/runtime/userprofile/AppData/Roaming",
      localAppDataDir: "/tmp/cloudflared/runtime/userprofile/AppData/Local",
    };
    const env = buildCloudflaredChildEnv(
      {
        PATH: "/usr/bin",
        CLOUDFLARED_PROTOCOL: "quic",
      },
      runtimeDirs,
      {
        SSL_CERT_FILE: "/etc/ssl/cert.pem",
      }
    );

    expect(env.PATH).toBe("/usr/bin");
    expect(env.HOME).toBe(runtimeDirs.homeDir);
    expect(env.XDG_CONFIG_HOME).toBe(runtimeDirs.configDir);
    expect(env.TUNNEL_TRANSPORT_PROTOCOL).toBe("quic");
    expect(env.SSL_CERT_FILE).toBe("/etc/ssl/cert.pem");
  });

  it("selects default cert env candidates in priority order", () => {
    const seen: string[] = [];
    const env = getDefaultCloudflaredCertEnv(
      (candidate) => {
        seen.push(candidate);
        return candidate === "/etc/ssl/cert.pem" || candidate === "/etc/ssl/certs";
      },
      ["/missing.pem", "/etc/ssl/cert.pem"],
      ["/etc/ssl/certs", "/another/missing"]
    );

    expect(seen).toEqual(["/missing.pem", "/etc/ssl/cert.pem", "/etc/ssl/certs"]);
    expect(env).toEqual({
      SSL_CERT_FILE: "/etc/ssl/cert.pem",
      SSL_CERT_DIR: "/etc/ssl/certs",
    });
  });

  it("returns asset specs for supported platforms and null otherwise", () => {
    expect(getCloudflaredAssetSpec("win32", "x64")?.assetName).toBe(
      "cloudflared-windows-amd64.exe"
    );
    expect(getCloudflaredAssetSpec("linux", "arm64")?.archive).toBe("none");
    expect(getCloudflaredAssetSpec("sunos", "x64")).toBeNull();
  });
});
