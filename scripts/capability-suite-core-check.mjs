import { spawnSync } from 'child_process';

const commandFor = (binary) => (process.platform === 'win32' ? `${binary}.cmd` : binary);
const quoteWindowsArg = (value) => {
  const normalized = String(value ?? '');
  if (!normalized || /[\s"]/u.test(normalized)) {
    return `"${normalized.replace(/"/g, '\\"')}"`;
  }
  return normalized;
};

const steps = [
  {
    label: 'Build do runtime',
    command: commandFor('npm'),
    args: ['run', 'build'],
  },
  {
    label: 'Etapa 1 - Contrato publico canonico',
    command: commandFor('npx'),
    args: ['jest', 'tests/contracts/PublicContractsCompatibility.test.ts', '--runInBand'],
  },
  {
    label: 'Etapa 2 - Gateway core canonico',
    command: commandFor('npx'),
    args: ['jest', 'tests/gateway/GatewayHostService.test.ts', '--runInBand'],
  },
  {
    label: 'Etapa 3 - Reorganizacao por dominio',
    command: commandFor('npx'),
    args: ['jest', 'tests/domain/DomainRegistry.test.ts', '--runInBand'],
  },
  {
    label: 'Etapa 4 - Platform ecosystem real',
    command: commandFor('npx'),
    args: [
      'jest',
      'tests/platform/ZavorthRegistryClient.test.ts',
      'tests/platform/ZavorthPackagePublisher.test.ts',
      'tests/platform/ZavorthTrustPolicy.test.ts',
      'tests/platform/CollectionInstaller.test.ts',
      '--runInBand',
    ],
  },
  {
    label: 'Data readiness - Node Mesh 2.0 e companions',
    command: commandFor('npx'),
    args: [
      'jest',
      'tests/nodes/CompanionBootstrapper.test.ts',
      'tests/nodes/CompanionCli.test.ts',
      'tests/nodes/CompanionDistributionService.test.ts',
      'tests/nodes/DeviceCapabilityPolicy.test.ts',
      'tests/nodes/NodeCapabilities.test.ts',
      'tests/nodes/NodePairingManager.test.ts',
      '--runInBand',
    ],
  },
  {
    label: 'Etapa 6 - Channel Mesh 2.0',
    command: commandFor('npx'),
    args: [
      'jest',
      'tests/channels/ChannelMessageContract.test.ts',
      'tests/channels/ChannelMeshAdapters.test.ts',
      'tests/channels/ChannelPolicyManager.test.ts',
      'tests/services/ZavorthChannelMeshService.test.ts',
      'tests/integration/ChannelAdapterParity.test.ts',
      '--runInBand',
    ],
  },
];

for (const step of steps) {
  console.log(`\n[phases-1-6-check] ${step.label}`);
  const result = process.platform === 'win32'
    ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `${quoteWindowsArg(step.command)} ${step.args.map(quoteWindowsArg).join(' ')}`],
      { stdio: 'inherit' },
    )
    : spawnSync(step.command, step.args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`[phases-1-6-check] Falha ao executar ${step.label}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\n[phases-1-6-check] As etapas 1 a 6 passaram na validacao oficial.');
