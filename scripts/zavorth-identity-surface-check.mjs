import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  {
    path: 'src/zavorth-control/shared/components/ZavorthGatewayLogo.tsx',
    includes: [
      'Zavorth brand mark',
      'protective eye',
      'routing intelligence',
    ],
  },
  {
    path: 'src/zavorth-control/app/layout.tsx',
    includes: [
      'Zavorth',
      'Control Plane',
      'operator control plane',
    ],
  },
  {
    path: 'src/zavorth-control/app/loading.tsx',
    includes: [
      'Zavorth Control Plane',
      'Rehydrating operator surfaces',
      'Booting Zavorth runtime',
    ],
  },
  {
    path: 'src/zavorth-control/app/(zavorthControl)/control/page.tsx',
    includes: [
      'ControlPageClient',
      'LegacyDashboardShell',
      'ControlPageAssets',
    ],
  },
  {
    path: 'src/zavorth-control/app/(zavorthControl)/control/ZavorthControlBridge.tsx',
    includes: [
      'Zavorth Home',
      'Zavorth',
      'Ready',
      'Search',
    ],
  },
  {
    path: 'src/zavorth-control/shared/constants/config.ts',
    includes: [
      'name: "Zavorth"',
      'Operator control plane for multi-provider AI runtime management',
    ],
  },
];

const visibleIdentityFiles = [
  ...requiredFiles.map((entry) => entry.path),
  'src/zavorth-control/app/login/page.tsx',
  'src/zavorth-control/app/offline/page.tsx',
  'src/zavorth-control/app/status/page.tsx',
  'src/zavorth-control/app/privacy/page.tsx',
  'src/zavorth-control/app/terms/page.tsx',
  'src/zavorth-control/app/docs/page.tsx',
  'src/zavorth-control/app/landing/page.tsx',
  'src/zavorth-control/shared/components/Footer.tsx',
  'src/zavorth-control/shared/components/ConsoleLogViewer.tsx',
  'src/zavorth-control/shared/components/oauth-modal/OAuthModalProviderHint.tsx',
];

const englishIdentityValuePaths = [
  'header.homeDescription',
  'landing.brandName',
  'landing.howItWorks',
  'landing.howItWorksStep2Title',
  'landing.getStartedDescription',
  'landing.installZavorthGateway',
  'landing.startingZavorthGateway',
  'landing.copyright',
  'landing.ctaDescription',
  'docs.protocolsDescription',
  'docs.protocolMcpDesc',
  'docs.protocolMcpStep1',
  'auth.nodeIncompatibleDesc',
  'auth.nodeIncompatibleHint',
  'legal.privacyMetadataTitle',
  'legal.privacyMetadataDescription',
  'legal.privacySection1Text',
  'legal.privacySection3Text',
  'legal.privacySection4Text',
  'legal.termsMetadataTitle',
  'legal.termsMetadataDescription',
  'legal.termsSection1Text',
  'legal.termsResponsibilityCompliance',
  'legal.termsResponsibilitySecurity',
  'legal.termsSection3Text',
  'legal.termsNoTransmission',
  'legal.termsSection5Text',
  'legal.termsSection6Text',
];

const forbiddenVisiblePatterns = [
  { label: 'ZavorthGateway product string', pattern: /ZavorthGateway/ },
  { label: 'AI Gateway product phrase', pattern: /\bAI Gateway\b/i },
  { label: 'legacy route visible lineage', pattern: new RegExp(`\\b${['Omni', 'Route'].join('')}\\b`, 'i') },
  { label: '9router visible lineage', pattern: /\b9router\b/i },
  { label: 'OpenRouter Gateway lineage', pattern: /OpenRouter Gateway/i },
];

const failures = [];

for (const entry of requiredFiles) {
  const absolutePath = path.join(root, entry.path);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${entry.path}: missing`);
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const expected of entry.includes) {
    if (!content.includes(expected)) {
      failures.push(`${entry.path}: missing Track 1 identity marker "${expected}"`);
    }
  }
}

for (const relativePath of visibleIdentityFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: missing visible identity file`);
    continue;
  }

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isAllowedTechnicalIdentityLine(line)) {
      return;
    }

    for (const forbidden of forbiddenVisiblePatterns) {
      if (forbidden.pattern.test(line)) {
        failures.push(`${relativePath}:${index + 1}: ${forbidden.label} must not appear in visible identity copy`);
      }
    }
  });
}

checkLocaleIdentityValues();

if (failures.length > 0) {
  console.error('[identity-surface] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[identity-surface] ok: visible identity surfaces are Zavorth-native and critical shell markers are present.');

function isAllowedTechnicalIdentityLine(line) {
  return [
    /ZavorthGatewayLogo/,
    /t\("[^"]*ZavorthGateway[^"]*"\)/,
    /NEXT_PUBLIC_ZavorthGateway_E2E_MODE/,
    /ZavorthGateway_login_time/,
  ].some((pattern) => pattern.test(line));
}

function checkLocaleIdentityValues() {
  const messagesRoot = path.join(root, 'src/zavorth-control/i18n/messages');
  if (!fs.existsSync(messagesRoot)) {
    failures.push('src/zavorth-control/i18n/messages: missing');
    return;
  }

  const localeFiles = fs.readdirSync(messagesRoot)
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  for (const localeFile of localeFiles) {
    const relativePath = `src/zavorth-control/i18n/messages/${localeFile}`;
    const messages = JSON.parse(fs.readFileSync(path.join(messagesRoot, localeFile), 'utf8'));
    for (const valuePath of englishIdentityValuePaths) {
      const value = readValuePath(messages, valuePath);
      if (typeof value !== 'string') {
        if (localeFile === 'en.json') {
          failures.push(`${relativePath}:${valuePath}: missing string value`);
        }
        continue;
      }

      for (const forbidden of forbiddenVisiblePatterns) {
        if (forbidden.pattern.test(value)) {
          failures.push(`${relativePath}:${valuePath}: ${forbidden.label} in locale value`);
        }
      }
    }
  }
}

function readValuePath(source, valuePath) {
  return valuePath.split('.').reduce((current, segment) => current?.[segment], source);
}
