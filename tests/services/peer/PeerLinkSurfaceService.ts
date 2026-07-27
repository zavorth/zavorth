export class PeerLinkSurfaceService {
  private gateway: any;

  constructor({ gateway }: { gateway: any }) {
    this.gateway = gateway;
  }

  open(linkId: string) {
    const snapshot = this.gateway.buildRegistrySnapshot();
    const profile = snapshot.profiles.find((p: any) => p.id === linkId);

    if (!profile) {
      return {
        status: 'missing',
        safety: { mediatedFullAccess: true, rawOsTakeover: false },
        findings: ['Link not found'],
        profile: null,
        capabilities: [],
      };
    }

    const caps = this.gateway.listCapabilities();
    return {
      status: 'ready',
      safety: { mediatedFullAccess: true, rawOsTakeover: false },
      findings: [],
      profile,
      capabilities: caps.capabilities,
    };
  }

  async use({ linkId, toolName, approvalGranted }: any) {
    if (!approvalGranted) {
      return { status: 'approval-required', live: false };
    }
    const result = await this.gateway.invoke({ linkId, toolName });
    return { status: result.status, live: true, output: result.outputText };
  }

  renderOpenText(snap: any) {
    const id = snap.profile?.id || 'unknown';
    return [
      `zavorth link use ${id}`,
      `zavorth link ask ${id}`,
      `zavorth import skills ${id}`,
    ].join('\n');
  }
}
