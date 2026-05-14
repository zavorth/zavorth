import type {
  ChannelPatchRiskReceipt,
} from '../../contracts/SourceChannelMeshExpansionContract.js';

export type WhatsAppChannelPackOptions = {
  sourcePatchPresent?: boolean;
  packageInstalledInZavorth?: boolean;
  patchEvidencePath?: string | null;
};

export class WhatsAppChannelPack {
  public buildBaileysPatchRiskReceipt(options: WhatsAppChannelPackOptions = {}): ChannelPatchRiskReceipt {
    return {
      channelId: 'whatsapp-baileys',
      status: 'owner_decision_required',
      packageName: '@whiskeysockets/baileys',
      patchEvidencePath: options.patchEvidencePath || null,
      patchPresentInSource: options.sourcePatchPresent === true,
      packageInstalledInZavorth: options.packageInstalledInZavorth === true,
      ownerDecisionRequired: true,
      reason: 'Baileys is a stateful WhatsApp socket runtime with Source patch evidence; Zavorth requires owner approval before installing or enabling it.',
    };
  }
}
