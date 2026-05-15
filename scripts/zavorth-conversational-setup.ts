import { ZavorthConversationalSetupService } from '../src/services/ZavorthConversationalSetupService.js';

const args = process.argv.slice(2);

function readFlag(name: string): string | null {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : null;
}

const positionalIntent = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
const service = new ZavorthConversationalSetupService();
const snapshot = service.buildSnapshot({
  agentName: readFlag('agent-name'),
  userName: readFlag('user-name'),
  preferredAddress: readFlag('call-me') || readFlag('preferred-address'),
  language: readFlag('language') || readFlag('lang'),
  primaryUse: readFlag('primary-use') || readFlag('use-case') || readFlag('intent') || positionalIntent,
  intent: readFlag('intent') || positionalIntent,
  experienceProfile: readFlag('profile') || readFlag('experience-profile'),
  detailLevel: readFlag('detail') || readFlag('detail-level'),
  approvalChannel: readFlag('approval-channel') || readFlag('approvals'),
  firstSafeMission: readFlag('first-mission') || readFlag('mission'),
  preferredTone: readFlag('tone'),
  apply: args.includes('--apply'),
  confirmLocalProfile: args.includes('--confirm-local-profile') || args.includes('--yes'),
  completeBootstrap: args.includes('--complete-bootstrap'),
});

if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

process.exit(snapshot.status === 'blocked' ? 2 : 0);
