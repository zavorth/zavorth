import { createElement } from 'react';

// Premium gradient palette for the minimalist logo
const GRADIENT_COLORS = [
  '#c084fc', // purple/violet
  '#d946ef', // fuchsia
  '#f43f5e', // rose
  '#ff7a18', // orange
  '#fbbf24', // amber
];



import { ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS } from '../ZavorthSetupStudioService.js';
import { buildZavorthSetupStudioSnapshot } from './ZavorthSetupStudioState.js';
import { ZavorthSetupStudioProgressStore } from './ZavorthSetupStudioProgressStore.js';
import { logger } from '../../logger.js';
import type {
ZavorthSetupStudioChannelGuide,
  ZavorthSetupStudioSnapshot,
} from './ZavorthSetupStudioSchema.js';

export type ZavorthSetupStudioInkRenderResult = {
  rendered: boolean;
  output: string;
  action: 'none' | 'apply' | 'doctor' | 'hatch' | 'channel' | 'skills' | 'provider-live' | 'channel-live';
  snapshot: ZavorthSetupStudioSnapshot;
  channelId?: string | null;
};

type InkModule = typeof import('ink');
type ReactModule = typeof import('react');
type InkKey = import('ink').Key;

const COLORS = {
  bg: '#0d0d11',
  text: '#f5f7fb',
  muted: '#7d8597',
  orange: '#ff7a18',
  cyan: '#63e6ff',
  blue: '#7aa2ff',
  green: '#4ade80',
  amber: '#fbbf24',
  red: '#fb7185',
  violet: '#c084fc',
};

const WEB_PROVIDER_OPTIONS = ['local', 'brave', 'google', 'skip'] as const;
const SETUP_PAGES = ['overview', 'provider', 'channels', 'skills', 'hatch'] as const;
type SetupPage = typeof SETUP_PAGES[number];
type SearchMode = 'provider' | 'channel' | null;
type TextField = 'modelId' | null;

const PAGE_LABELS: Record<SetupPage, string> = {
  overview: 'overview',
  provider: 'model',
  channels: 'channels',
  skills: 'skills',
  hatch: 'hatch',
};

const PAGE_TITLES: Record<SetupPage, string> = {
  overview: 'Command Path',
  provider: 'Model Core',
  channels: 'Channel Bridge',
  skills: 'Ability scan',
  hatch: 'First Wake',
};

const PAGE_INTENTS: Record<SetupPage, string> = {
  overview: 'Review the whole setup before anything is written.',
  provider: 'Choose the model brain, edit the exact model, and run a live ping.',
  channels: 'Prepare remote control surfaces without sending messages.',
  skills: 'Verify the local tool surface before the agent starts working.',
  hatch: 'Start the first live conversation once the setup feels right.',
};

const MOTION_FRAMES = ['.  ', '.. ', '...', ' ..', '  .'];
type SecretField =
  | 'providerSecret'
  | 'searchSecret'
  | 'telegramBotToken'
  | 'telegramAllowedUserIds'
  | 'discordBotToken'
  | 'slackBotToken'
  | 'emailSmtpUrl';

type SecretState = Record<SecretField, string>;

const SECRET_FIELD_LABELS: Record<SecretField, string> = {
  providerSecret: 'provider',
  searchSecret: 'search',
  telegramBotToken: 'telegram',
  telegramAllowedUserIds: 'tg users',
  discordBotToken: 'discord',
  slackBotToken: 'slack',
  emailSmtpUrl: 'email smtp',
};

export async function renderZavorthSetupStudioInk(
  snapshot: ZavorthSetupStudioSnapshot,
): Promise<ZavorthSetupStudioInkRenderResult> {
  if (process.env.CI || process.env.ZAVORTH_DISABLE_INK === '1') {
    return { rendered: false, output: '', action: 'none', snapshot };
  }
  try {
    const [ink, react] = await Promise.all([
      import('ink'),
      import('react'),
    ]);
    const interactive = Boolean(process.stdin?.isTTY && process.stdout?.isTTY);
    const actionState: {
      action: ZavorthSetupStudioInkRenderResult['action'];
      snapshot: ZavorthSetupStudioSnapshot;
      channelId?: string | null;
    } = { action: 'none', snapshot };
    const instance = ink.render(
      createElement(SetupStudioInkApp, {
        ink,
        react,
        snapshot,
        interactive,
        actionState,
      }),
      {
        exitOnCtrlC: false,
        patchConsole: false,
      },
    );
    await instance.waitUntilExit();
    return {
      rendered: true,
      output: '',
      action: actionState.action,
      snapshot: actionState.snapshot,
      channelId: actionState.channelId,
    };
  } catch (error: any) { const err = error; const e = error;
    logger.warn('[Zavorth Setup Studio Ink Renderer] filesystem check failed', error);
    return {
      rendered: false,
      output: `Ink setup renderer unavailable: ${error instanceof Error ? error.message : String(error)}\n`,
      action: 'none',
      snapshot,
    };
  }
}

function SetupStudioInkApp(props: {
  ink: InkModule;
  react: ReactModule;
  snapshot: ZavorthSetupStudioSnapshot;
  interactive: boolean;
  actionState: {
    action: ZavorthSetupStudioInkRenderResult['action'];
    snapshot: ZavorthSetupStudioSnapshot;
    channelId?: string | null;
  };
}) {
  const { ink, react, snapshot, interactive, actionState } = props;
  const { Box, Text, useApp, useInput, useStdin } = ink;
  const { useEffect, useMemo, useState } = react;
  const app = useApp();
  const stdin = useStdin();
  const canUseInput = interactive && stdin.isRawModeSupported;
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>(null);
  const [searchBuffer, setSearchBuffer] = useState('');
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [activeTextField, setActiveTextField] = useState<TextField>(null);
  const [textBuffer, setTextBuffer] = useState('');
  const [motionIndex, setMotionIndex] = useState(0);
  const initialProviderIndex = Math.max(
    0,
    ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.findIndex((provider) => provider.id === (
      new ZavorthSetupStudioProgressStore(snapshot.projectRoot).read()?.providerId || snapshot.plan.provider.id
    )),
  );
  const initialWebIndex = Math.max(
    0,
    WEB_PROVIDER_OPTIONS.findIndex((provider) => provider === (
      new ZavorthSetupStudioProgressStore(snapshot.projectRoot).read()?.webSearchProvider || snapshot.plan.webSearch.provider
    )),
  );
  const progress = new ZavorthSetupStudioProgressStore(snapshot.projectRoot).read();
  const [providerIndex, setProviderIndex] = useState(initialProviderIndex);
  const [webIndex, setWebIndex] = useState(initialWebIndex);
  const [modelId, setModelId] = useState(progress?.modelId || snapshot.plan.provider.modelId);
  const [hooksEnabled, setHooksEnabled] = useState(progress?.hooksEnabled ?? snapshot.plan.hooks.enabled);
  const [channelIndex, setChannelIndex] = useState(0);
  const [secrets, setSecrets] = useState<SecretState>({
    providerSecret: '',
    searchSecret: '',
    telegramBotToken: '',
    telegramAllowedUserIds: '',
    discordBotToken: '',
    slackBotToken: '',
    emailSmtpUrl: '',
  });
  const [activeSecretField, setActiveSecretField] = useState<SecretField | null>(null);
  const [secretBuffer, setSecretBuffer] = useState('');
  const [hint, setHint] = useState(canUseInput
    ? 'Tab pages | arrows move | f search | ? keys | a apply'
    : 'Single preview. Interaction requires raw mode.');
  const compactLayout = Number(process.stdout?.columns || 80) < 110;
  const reducedMotion = process.env.NO_COLOR === '1' || process.env.ZAVORTH_REDUCED_MOTION === '1';
  const motionFrame = !canUseInput ? 'ready' : reducedMotion ? 'ready' : MOTION_FRAMES[motionIndex % MOTION_FRAMES.length];
  const currentProvider = ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS[providerIndex]
    || ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS[0];
  const currentWebProvider = WEB_PROVIDER_OPTIONS[webIndex] || 'local';
  const currentSnapshot = useMemo(() => buildZavorthSetupStudioSnapshot({
    projectRoot: snapshot.projectRoot,
    providerId: currentProvider.id,
    modelId: modelId || currentProvider.defaultModel,
    providerSecret: secrets.providerSecret,
    telegramBotToken: secrets.telegramBotToken,
    telegramAllowedUserIds: secrets.telegramAllowedUserIds,
    discordBotToken: secrets.discordBotToken,
    slackBotToken: secrets.slackBotToken,
    emailSmtpUrl: secrets.emailSmtpUrl,
    searchProvider: currentWebProvider,
    searchSecret: secrets.searchSecret,
    memoryMode: snapshot.plan.memory.mode,
    vaultScope: snapshot.plan.memory.vaultScope,
    scanDirs: snapshot.plan.memory.scanDirs,
    enableHooks: hooksEnabled,
    dryRun: snapshot.safety.dryRun,
    mode: snapshot.mode,
    configHandling: snapshot.configHandling,
    now: () => new Date(snapshot.generatedAt),
  }), [
    currentProvider.id,
    currentProvider.defaultModel,
    modelId,
    currentWebProvider,
    secrets,
    hooksEnabled,
    snapshot.projectRoot,
    snapshot.plan.memory.mode,
    snapshot.plan.memory.vaultScope,
    snapshot.plan.memory.scanDirs,
    snapshot.safety.dryRun,
    snapshot.mode,
    snapshot.configHandling,
    snapshot.generatedAt,
  ]);

  useEffect(() => {
    actionState.snapshot = currentSnapshot;
  }, [actionState, currentSnapshot]);

  useEffect(() => {
    if (!canUseInput || reducedMotion) {
      return undefined;
    }
    const timer = setInterval(() => {
      setMotionIndex((value: number) => (value + 1) % MOTION_FRAMES.length);
    }, 420);
    return () => clearInterval(timer);
  }, [canUseInput, reducedMotion]);

  useInput((input: string, key: InkKey) => {
    if (!canUseInput) {
      return;
    }
    if (searchMode) {
      if (key.escape) {
        setSearchMode(null);
        setSearchBuffer('');
        setSearchSelectedIndex(0);
        setHint('Search cancelled.');
        return;
      }
      if (key.upArrow) {
        setSearchSelectedIndex((value: number) => Math.max(0, value - 1));
        return;
      }
      if (key.downArrow) {
        const count = countSearchMatches(currentSnapshot, searchMode, searchBuffer);
        setSearchSelectedIndex((value: number) => Math.min(Math.max(0, count - 1), value + 1));
        return;
      }
      if (key.return) {
        if (searchMode === 'provider') {
          const match = findProviderIndex(searchBuffer, searchSelectedIndex);
          if (match >= 0) {
            setProviderIndex(match);
            setHint(`Provider selected: ${ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS[match].label}.`);
          } else {
            setHint(`No provider matched "${searchBuffer}".`);
          }
        } else {
          const match = findChannelIndex(currentSnapshot.channelGuide, searchBuffer, searchSelectedIndex);
          if (match >= 0) {
            setChannelIndex(match);
            setPageIndex(SETUP_PAGES.indexOf('channels'));
            setHint(`Channel selected: ${currentSnapshot.channelGuide[match].label}. Enter opens setup.`);
          } else {
            setHint(`No channel matched "${searchBuffer}".`);
          }
        }
        setSearchMode(null);
        setSearchBuffer('');
        setSearchSelectedIndex(0);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchBuffer((value: string) => value.slice(0, -1));
        setSearchSelectedIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchBuffer((value: string) => `${value}${input}`);
        setSearchSelectedIndex(0);
      }
      return;
    }
    if (activeTextField) {
      if (key.escape) {
        setActiveTextField(null);
        setTextBuffer('');
        setHint('Model edit cancelled.');
        return;
      }
      if (key.return) {
        const nextModel = textBuffer.trim();
        if (nextModel) {
          setModelId(nextModel);
          setHint(`Model set to ${nextModel}. Press l to live-test or a to apply.`);
        } else {
          setHint('Model cannot be empty.');
        }
        setActiveTextField(null);
        setTextBuffer('');
        return;
      }
      if (key.backspace || key.delete) {
        setTextBuffer((value: string) => value.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setTextBuffer((value: string) => `${value}${input}`);
      }
      return;
    }
    if (activeSecretField) {
      if (key.escape) {
        setActiveSecretField(null);
        setSecretBuffer('');
        setHint('Credential input cancelled. Nothing was stored.');
        return;
      }
      if (key.return) {
    const field = activeSecretField;
        setSecrets((current: SecretState) => ({
          ...current,
          [field]: secretBuffer,
        }));
        setActiveSecretField(null);
        setSecretBuffer('');
        setHint(`${SECRET_FIELD_LABELS[field]} captured in memory. Press a to apply.`);
        return;
      }
      if (key.backspace || key.delete) {
        setSecretBuffer((value: string) => value.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSecretBuffer((value: string) => `${value}${input}`);
      }
      return;
    }
    if (input === 'q' || key.escape) {
      app.exit();
      return;
    }
    if (key.tab) {
      setPageIndex((value: number) => (value + 1) % SETUP_PAGES.length);
      setHint('Page changed. Use f to search on model/channels pages.');
      return;
    }
    if (key.upArrow) {
      if (SETUP_PAGES[pageIndex] === 'channels') {
        setChannelIndex((value: number) => Math.max(0, value - 1));
      } else {
        setSelectedStepIndex((value: number) => Math.max(0, value - 1));
      }
      return;
    }
    if (key.downArrow) {
      if (SETUP_PAGES[pageIndex] === 'channels') {
        setChannelIndex((value: number) => Math.min(currentSnapshot.channelGuide.length - 1, value + 1));
      } else {
        setSelectedStepIndex((value: number) => Math.min(currentSnapshot.steps.length - 1, value + 1));
      }
      return;
    }
    if (input === 'f') {
      const page = SETUP_PAGES[pageIndex];
      if (page === 'provider' || page === 'overview') {
        setSearchMode('provider');
        setSearchBuffer('');
        setSearchSelectedIndex(0);
        setHint('Search providers by name/model. Enter selects, Esc cancels.');
      } else if (page === 'channels') {
        setSearchMode('channel');
        setSearchBuffer('');
        setSearchSelectedIndex(0);
        setHint('Search channels by name/status. Enter selects, Esc cancels.');
      } else {
        setHint('Search is available on model and channels pages.');
      }
      return;
    }
    if (input === 'p') {
      setProviderIndex((value: number) => {
        const nextIndex = (value + 1) % ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.length;
        setModelId(ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS[nextIndex].defaultModel);
        return nextIndex;
      });
      setHint('Provider changed in preview. Press a to apply.');
      return;
    }
    if (input === 'o') {
      setActiveTextField('modelId');
      setTextBuffer(currentSnapshot.plan.provider.modelId);
      setHint('Editing model. Enter saves, Esc cancels.');
      return;
    }
    if (input === 'w') {
      setWebIndex((value: number) => (value + 1) % WEB_PROVIDER_OPTIONS.length);
      setHint('Web/search changed in preview. Press a to apply.');
      return;
    }
    if (input === 'h') {
      setHooksEnabled((value: boolean) => !value);
      setHint('Automation templates toggled. They stay disabled until reviewed. Press a to apply.');
      return;
    }
    if (input === 'c') {
      setChannelIndex((value: number) => (value + 1) % currentSnapshot.channelGuide.length);
      setHint('Channel selected. Enter opens its setup command.');
      return;
    }
    if (input === 'k') {
      beginSecretCapture('providerSecret', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (input === '/') {
      beginSecretCapture('searchSecret', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (input === 't') {
      beginSecretCapture('telegramBotToken', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (input === 'u') {
      beginSecretCapture('telegramAllowedUserIds', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (input === 'r') {
      beginSecretCapture('discordBotToken', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (input === 's') {
      beginSecretCapture('slackBotToken', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (input === 'e') {
      beginSecretCapture('emailSmtpUrl', setActiveSecretField, setSecretBuffer, setHint);
      return;
    }
    if (key.return) {
      const channel = currentSnapshot.channelGuide[channelIndex];
      actionState.action = 'channel';
      actionState.channelId = channel?.id || null;
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === 'a') {
      actionState.action = 'apply';
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === 'd') {
      actionState.action = 'doctor';
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === 'l') {
      actionState.action = 'provider-live';
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === 'm') {
      const channel = currentSnapshot.channelGuide[channelIndex];
      actionState.action = 'channel-live';
      actionState.channelId = channel?.id || null;
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === 'v') {
      actionState.action = 'skills';
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === 'x') {
      actionState.action = 'hatch';
      actionState.snapshot = currentSnapshot;
      app.exit();
      return;
    }
    if (input === '?') {
      setHint('Keys: Tab pages, f search, o model, l provider live, m channel live, v skills, x hatch.');
    }
  }, { isActive: canUseInput });

  useEffect(() => {
    if (canUseInput) {
      return undefined;
    }
    const handle = setTimeout(() => app.exit(), 40);
    return () => clearTimeout(handle);
  }, [app, canUseInput]);

  useEffect(() => {
    new ZavorthSetupStudioProgressStore(currentSnapshot.projectRoot).write({
      providerId: currentSnapshot.plan.provider.id,
      modelId: currentSnapshot.plan.provider.modelId,
      webSearchProvider: currentSnapshot.plan.webSearch.provider,
      hooksEnabled: currentSnapshot.plan.hooks.enabled,
      lastPage: SETUP_PAGES[pageIndex],
      lastChannelId: currentSnapshot.channelGuide[channelIndex]?.id || null,
    });
  }, [currentSnapshot, pageIndex, channelIndex]);

  return createElement(
    Box,
    { flexDirection: 'column', paddingX: 1 },
    createElement(Header, { Box, Text, snapshot: currentSnapshot, page: SETUP_PAGES[pageIndex], pageIndex, motionFrame }),
    compactLayout
      ? createElement(
        Box,
        { flexDirection: 'column', marginTop: 1 },
        createElement(
          Box,
          { gap: 1 },
          createElement(CenterPanel, { Box, Text, snapshot: currentSnapshot, selectedStepIndex, channelIndex, page: SETUP_PAGES[pageIndex], searchMode, searchBuffer, searchSelectedIndex, compactLayout }),
          createElement(RightRail, { Box, Text, snapshot: currentSnapshot, secrets, activeSecretField, secretBuffer, activeTextField, textBuffer, compactLayout, motionFrame }),
        ),
        createElement(LeftRail, { Box, Text, snapshot: currentSnapshot, selectedStepIndex, page: SETUP_PAGES[pageIndex], compactLayout }),
      )
      : createElement(
        Box,
        { marginTop: 1, gap: 1 },
        createElement(LeftRail, { Box, Text, snapshot: currentSnapshot, selectedStepIndex, page: SETUP_PAGES[pageIndex], compactLayout }),
        createElement(CenterPanel, { Box, Text, snapshot: currentSnapshot, selectedStepIndex, channelIndex, page: SETUP_PAGES[pageIndex], searchMode, searchBuffer, searchSelectedIndex, compactLayout }),
        createElement(RightRail, { Box, Text, snapshot: currentSnapshot, secrets, activeSecretField, secretBuffer, activeTextField, textBuffer, compactLayout, motionFrame }),
      ),
    createElement(Footer, { Box, Text, snapshot: currentSnapshot, hint, interactive, activeSecretField, secretBuffer, searchMode, searchBuffer, activeTextField, textBuffer, motionFrame }),
  );
}

function Header({ Box, Text, snapshot, page, pageIndex, motionFrame }: any) {
  const ready = snapshot.steps.filter((step: any) => step.status === 'ready').length;
  const total = snapshot.steps.length;
  const pageNumber = Number(pageIndex) + 1;

  const logoText = "Z A V O R T H";
  const charArray = logoText.split('');
  let colorCounter = 0;
  const charElements = charArray.map((char, index) => {
    if (char === ' ') return char;
    const color = GRADIENT_COLORS[Math.floor((colorCounter / 6) * (GRADIENT_COLORS.length - 1))] || GRADIENT_COLORS[GRADIENT_COLORS.length - 1];
    colorCounter++;
    return createElement(Text, { key: `char-${index}`, color, bold: true }, char);
  });

  return createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'none', paddingX: 2, paddingY: 1, marginBottom: 1 },
    createElement(
      Box,
      { flexDirection: 'row', marginBottom: 1 },
      ...charElements
    ),
    createElement(Text, { color: COLORS.muted, dimColor: true }, 'Natural language in. Governed action out.'),
    createElement(Text, { color: '#565f73', dimColor: true }, 'Local-first agent OS · evidence · approvals · native integrations'),
    createElement(Box, { marginY: 1 }, createElement(Text, { color: '#313540' }, '────────────────────────────────────────────────────────────')),
    createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between', width: 62 },
      createElement(
        Text,
        { color: COLORS.cyan },
        `${PAGE_TITLES[page as SetupPage] || page} - ${PAGE_INTENTS[page as SetupPage] || 'Prepare Zavorth safely.'}`
      ),
      createElement(
        Text,
        { color: COLORS.text, dimColor: true },
        `${ready}/${total} checks`
      )
    ),
    createElement(
      Box,
      { marginTop: 1 },
      createElement(Text, { color: COLORS.violet }, progressBar(pageNumber, SETUP_PAGES.length, 62))
    )
  );
}

function LeftRail({ Box, Text, snapshot, selectedStepIndex, page, compactLayout }: any) {
  const checklist = compactLayout ? snapshot.steps.slice(0, 8) : snapshot.steps;
  return createElement(
    Box,
    { flexDirection: 'column', width: compactLayout ? 76 : 28, borderStyle: 'round', borderColor: COLORS.blue, paddingX: 1, marginTop: compactLayout ? 1 : 0 },
    createElement(Text, { color: COLORS.amber, bold: true }, 'Journey Map'),
    ...(compactLayout ? [
      createElement(Text, { key: 'pages:compact', color: COLORS.text }, SETUP_PAGES.map((entry) => `${entry === page ? '>' : ' '} ${PAGE_LABELS[entry]}`).join('  ')),
    ] : SETUP_PAGES.map((entry) => createElement(
      Text,
      { key: `page:${entry}`, color: entry === page ? COLORS.cyan : COLORS.muted },
      `${entry === page ? '>' : ' '} ${PAGE_LABELS[entry].padEnd(9)} ${entry === page ? 'active' : ''}`,
    ))),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.amber, bold: true }, 'Checklist'),
    ...checklist.map((step: any, index: number) => createElement(
      Text,
      { key: `step:${step.id}`, color: colorForStatus(step.status) },
      `${index === selectedStepIndex ? '>' : ' '} ${symbolForStatus(step.status)} ${truncate(step.title, compactLayout ? 24 : 12)}`,
    )),
    ...(compactLayout && snapshot.steps.length > checklist.length ? [
      createElement(Text, { key: 'checklist-more', color: COLORS.muted }, `  ... ${snapshot.steps.length - checklist.length} more checks in full-width terminals`),
    ] : []),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.amber, bold: true }, 'Workspace'),
    createElement(Text, { color: COLORS.text }, truncateMiddle(snapshot.projectRoot, 22)),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.green }, 'Progress saved'),
    createElement(Text, { color: COLORS.orange }, 'Vortex-orange safety rail'),
  );
}

function CenterPanel({ Box, Text, snapshot, selectedStepIndex, channelIndex, page, searchMode, searchBuffer, searchSelectedIndex, compactLayout }: any) {
  const selectedStep = snapshot.steps[selectedStepIndex] || snapshot.steps[0];
  const pageLines = renderPageLines(snapshot, page, channelIndex);
  const searchMatches = renderSearchMatches(snapshot, searchMode, searchBuffer, searchSelectedIndex);
  const searchCount = countSearchMatches(snapshot, searchMode, searchBuffer);
  return createElement(
    Box,
    { flexDirection: 'column', width: compactLayout ? 45 : 54, borderStyle: 'round', borderColor: COLORS.cyan, paddingX: 1 },
    createElement(Text, { color: COLORS.cyan, bold: true }, PAGE_TITLES[page as SetupPage] || 'Plan'),
    createElement(Text, { color: COLORS.muted }, truncate(PAGE_INTENTS[page as SetupPage] || '', 46)),
    createElement(Text, { color: COLORS.muted }, ''),
    ...(searchMode ? [
      createElement(Text, { key: 'search', color: COLORS.orange, bold: true }, `Filter ${searchMode}: ${searchBuffer || '_'}`),
      createElement(Text, { key: 'search-hint', color: COLORS.muted }, `${searchCount} match(es). Arrows move, Enter selects, Esc cancels.`),
      ...searchMatches.map((line) => createElement(
        Text,
        { key: line.key, color: line.color },
        line.text,
      )),
      createElement(Text, { key: 'search-space', color: COLORS.muted }, ''),
    ] : []),
    ...pageLines.map((line: { key: string; text: string; color: string }) => createElement(
      Text,
      { key: line.key, color: line.color },
      line.text,
    )),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.amber, bold: true }, 'Current Focus'),
    createElement(Text, { color: COLORS.text }, truncate(`${selectedStep.title}: ${selectedStep.detail || selectedStep.status}`, 46)),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.green }, 'Safe by default: secrets redacted, no persistent runtime start.'),
  );
}

function renderPageLines(
  snapshot: ZavorthSetupStudioSnapshot,
  page: SetupPage,
  channelIndex: number,
): Array<{ key: string; text: string; color: string }> {
  if (page === 'provider') {
    return [
      { key: 'provider', text: `Provider  ${snapshot.plan.provider.id}/${truncate(snapshot.plan.provider.modelId, 24)}`, color: COLORS.text },
      { key: 'provider-key', text: `Key       ${snapshot.plan.provider.secretStored ? 'captured' : 'empty'}`, color: snapshot.plan.provider.secretStored ? COLORS.green : COLORS.muted },
      { key: 'web', text: `Web       ${snapshot.plan.webSearch.provider}`, color: COLORS.text },
      { key: 'web-key', text: `Search    ${snapshot.plan.webSearch.secretStored ? 'captured' : 'empty'}`, color: snapshot.plan.webSearch.secretStored ? COLORS.green : COLORS.muted },
      { key: 'provider-gap', text: '', color: COLORS.muted },
      { key: 'provider-help', text: 'p provider | o model | k key | l live test', color: COLORS.cyan },
      { key: 'web-help', text: 'w web/search | / search key | f searchable list', color: COLORS.muted },
    ];
  }
  if (page === 'channels') {
    return [
      { key: 'channels-title', text: 'Channels', color: COLORS.amber },
      ...snapshot.channelGuide.map((channel, index) => ({
        key: channel.id,
        text: `${index === channelIndex ? '>' : ' '} ${truncate(channel.label, 12).padEnd(13)} ${shortStatus(channel.status)}`,
        color: colorForChannel(channel.status),
      })),
      { key: 'channels-gap', text: '', color: COLORS.muted },
      { key: 'channels-help', text: 'c/arrows select | m live | Enter setup', color: COLORS.cyan },
      { key: 'channels-credentials', text: 't/u Telegram | r Discord | s Slack | e Email', color: COLORS.muted },
    ];
  }
  if (page === 'skills') {
    return [
      { key: 'skills', text: `Eligible ${snapshot.skills.eligible}`, color: COLORS.text },
      { key: 'missing', text: `Missing  ${snapshot.skills.missingRequirements}`, color: snapshot.skills.missingRequirements > 0 ? COLORS.amber : COLORS.green },
      { key: 'os', text: `OS gaps   ${snapshot.skills.unsupportedOnThisOs}`, color: snapshot.skills.unsupportedOnThisOs > 0 ? COLORS.amber : COLORS.green },
      { key: 'blocked', text: `Policy    ${snapshot.skills.blockedByPolicy} blocked`, color: snapshot.skills.blockedByPolicy > 0 ? COLORS.red : COLORS.green },
      { key: 'skills-gap', text: '', color: COLORS.muted },
      { key: 'verify', text: 'v runs verification/doctor now', color: COLORS.cyan },
      { key: 'skills-note', text: 'No install is attempted from this screen without action.', color: COLORS.muted },
    ];
  }
  if (page === 'hatch') {
    return [
      { key: 'hatch-mode', text: `Mode      ${snapshot.hatch.recommendedMode}`, color: COLORS.text },
      { key: 'prompt', text: `Prompt    ${truncate(snapshot.hatch.bootstrapPrompt, 38)}`, color: COLORS.text },
      ...snapshot.hatch.commands.map((command) => ({ key: command, text: `> ${truncate(command, 42)}`, color: COLORS.text })),
      { key: 'hatch-gap', text: '', color: COLORS.muted },
      { key: 'hatch-help', text: 'x starts a live LLM hatch when credentials are available', color: COLORS.cyan },
      { key: 'hatch-note', text: 'If live hatch cannot run, Zavorth falls back safely.', color: COLORS.muted },
    ];
  }
  return [
    { key: 'provider', text: `Provider  ${snapshot.plan.provider.id}/${truncate(snapshot.plan.provider.modelId, 24)}`, color: COLORS.text },
    { key: 'web', text: `Web       ${snapshot.plan.webSearch.provider}`, color: COLORS.text },
    { key: 'memory', text: `Mnemos   ${snapshot.plan.memory.mode}/${snapshot.plan.memory.vaultScope}`, color: COLORS.text },
    { key: 'hooks', text: `Automation ${snapshot.plan.hooks.enabled ? `${snapshot.plan.hooks.templates.length} templates` : 'skip'}`, color: COLORS.text },
    { key: 'overview-gap', text: '', color: COLORS.muted },
    { key: 'overview-help', text: 'Tab pages | f search | a apply | d doctor | x hatch', color: COLORS.cyan },
    { key: 'overview-note', text: 'This screen previews. Nothing is written until apply.', color: COLORS.muted },
  ];
}

function RightRail({ Box, Text, snapshot, secrets, activeSecretField, secretBuffer, activeTextField, textBuffer, compactLayout, motionFrame }: any) {
  const providerConfigured = snapshot.plan.provider.id !== 'deferred';
  const channelCount = Object.values(snapshot.plan.channels).filter((value) => value !== 'skip').length;
  return createElement(
    Box,
    { flexDirection: 'column', width: compactLayout ? 30 : 42, borderStyle: 'round', borderColor: COLORS.violet, paddingX: 1 },
    createElement(Text, { color: COLORS.orange, bold: true }, 'Live Preview'),
    createElement(Text, { color: COLORS.orange }, `Pulse   ${motionFrame}`),
    createElement(Text, { color: providerConfigured ? COLORS.green : COLORS.amber }, `Brain   ${providerConfigured ? snapshot.plan.provider.id : 'configure later'}`),
    createElement(Text, { color: channelCount > 0 ? COLORS.green : COLORS.muted }, `Channels ${channelCount > 0 ? `${channelCount} prepared` : 'local only'}`),
    createElement(Text, { color: COLORS.text }, `Mnemos  ${snapshot.plan.memory.mode}/${snapshot.plan.memory.vaultScope}`),
    createElement(Text, { color: snapshot.hooks.available ? COLORS.green : COLORS.muted }, `Automation templates   ${snapshot.plan.hooks.enabled ? 'prepared' : 'optional'}`),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.violet, bold: true }, 'Readiness'),
    createElement(Text, { color: COLORS.text }, `Skills  ${snapshot.skills.eligible}`),
    createElement(Text, { color: snapshot.skills.missingRequirements > 0 ? COLORS.amber : COLORS.green }, `Missing ${snapshot.skills.missingRequirements}`),
    createElement(Text, { color: snapshot.gateway.installed ? COLORS.green : COLORS.amber }, `Gateway ${snapshot.gateway.installed ? 'ok' : 'build'}`),
    createElement(Text, { color: snapshot.capabilityActions.status === 'attention' ? COLORS.amber : COLORS.green }, `Actions ${snapshot.capabilityActions.exposed} verified`),
    createElement(Text, { color: COLORS.text }, `Control ${truncate(snapshot.controlUi.url, 24)}`),
    createElement(Text, { color: activeTextField === 'modelId' ? COLORS.cyan : COLORS.text }, `Model   ${truncate(activeTextField === 'modelId' ? textBuffer : snapshot.plan.provider.modelId, 24)}`),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.amber, bold: true }, 'Credential Vault'),
    ...([
      'providerSecret',
      'searchSecret',
      'telegramBotToken',
      'telegramAllowedUserIds',
      'discordBotToken',
      'slackBotToken',
      'emailSmtpUrl',
    ] as SecretField[]).map((field) => createElement(
      Text,
      { key: field, color: activeSecretField === field ? COLORS.cyan : secrets[field] ? COLORS.green : COLORS.muted },
      `${activeSecretField === field ? '>' : ' '} ${truncate(SECRET_FIELD_LABELS[field], 10).padEnd(11)} ${activeSecretField === field ? maskSecret(secretBuffer) : secrets[field] ? 'ok' : '-'}`,
    )),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.amber, bold: true }, 'Action Keys'),
    createElement(Text, { color: COLORS.text }, 'a apply       d doctor'),
    createElement(Text, { color: COLORS.text }, 'l provider    m channel'),
    createElement(Text, { color: COLORS.text }, 'v skills      x hatch'),
    createElement(Text, { color: COLORS.text }, '? keymap      q exit'),
    createElement(Text, { color: COLORS.muted }, ''),
    createElement(Text, { color: COLORS.amber, bold: true }, 'Launch Deck'),
    ...snapshot.hatch.commands.map((command: string) => createElement(
      Text,
      { key: command, color: COLORS.text },
      `> ${truncate(command, 30)}`,
    )),
  );
}

function Footer({
  Box,
  Text,
  snapshot,
  hint,
  interactive,
  activeSecretField,
  secretBuffer,
  searchMode,
  searchBuffer,
  activeTextField,
  textBuffer,
  motionFrame,
}: {
  Box: any;
  Text: any;
  snapshot: ZavorthSetupStudioSnapshot;
  hint: string;
  interactive: boolean;
  activeSecretField: SecretField | null;
  secretBuffer: string;
  searchMode: SearchMode;
  searchBuffer: string;
  activeTextField: TextField;
  textBuffer: string;
  motionFrame: string;
}) {
  return createElement(
    Box,
    { marginTop: 1, borderStyle: 'round', borderColor: activeSecretField || activeTextField || searchMode ? COLORS.cyan : COLORS.orange, paddingX: 1 },
    createElement(
      Text,
      { color: activeSecretField || activeTextField || searchMode ? COLORS.cyan : COLORS.muted },
      activeSecretField
        ? `Typing ${SECRET_FIELD_LABELS[activeSecretField]}: ${maskSecret(secretBuffer)}  Enter saves, Esc cancels.`
        : activeTextField
          ? `Editing model: ${textBuffer || '_'}  Enter saves, Esc cancels.`
        : searchMode
          ? `Searching ${searchMode}: ${searchBuffer || '_'}  Enter selects, Esc cancels.`
        : snapshot.safety.dryRun
        ? `${interactive ? hint : 'Single preview.'} ${motionFrame} Command bar: Tab pages | f filter | o model | a apply | d doctor | x hatch | q exit.`
        : 'Applied with governance. Run zavorth ready.',
    ),
  );
}

function findProviderIndex(query: string, selectedIndex = 0): number {
  const matches = findProviderMatches(query);
  const match = matches[Math.max(0, Math.min(matches.length - 1, selectedIndex))];
  return match ? ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.findIndex((provider) => provider.id === match.id) : -1;
}

function renderSearchMatches(
  snapshot: ZavorthSetupStudioSnapshot,
  mode: SearchMode,
  query: string,
  selectedIndex = 0,
): Array<{ key: string; text: string; color: string }> {
  if (!mode) {
    return [];
  }
  if (mode === 'provider') {
    const matches = findProviderMatches(query).slice(0, 9);
    return matches.map((provider, index) => ({
      key: `provider-match:${provider.id}`,
      text: `${index === selectedIndex ? '>' : ' '} ${String(index + 1).padStart(2, '0')} ${truncate(provider.label, 18).padEnd(19)} ${truncate(provider.defaultModel, 20)}`,
      color: index === selectedIndex ? COLORS.orange : index === 0 ? COLORS.cyan : COLORS.muted,
    }));
  }
  const matches = findChannelMatches(snapshot.channelGuide, query).slice(0, 9);
  return matches.map((channel, index) => ({
    key: `channel-match:${channel.id}`,
    text: `${index === selectedIndex ? '>' : ' '} ${String(index + 1).padStart(2, '0')} ${truncate(channel.label, 18).padEnd(19)} ${channel.status}`,
    color: index === selectedIndex ? COLORS.orange : index === 0 ? COLORS.cyan : COLORS.muted,
  }));
}

function countSearchMatches(
  snapshot: ZavorthSetupStudioSnapshot,
  mode: SearchMode,
  query: string,
): number {
  if (mode === 'provider') {
    return findProviderMatches(query).length;
  }
  if (mode === 'channel') {
    return findChannelMatches(snapshot.channelGuide, query).length;
  }
  return 0;
}

function findProviderMatches(query: string): typeof ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS {
  const normalized = query.trim().toLowerCase();
  return ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS
    .filter((provider) => !normalized
      || provider.id.includes(normalized)
      || provider.label.toLowerCase().includes(normalized)
      || provider.defaultModel.toLowerCase().includes(normalized))
    .sort((left, right) => rankProvider(left, normalized) - rankProvider(right, normalized) || left.label.localeCompare(right.label));
}

function rankProvider(provider: typeof ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS[number], query: string): number {
  if (!query) return 5;
  if (provider.id === query) return 0;
  if (provider.id.startsWith(query)) return 1;
  if (provider.label.toLowerCase().startsWith(query)) return 2;
  if (provider.defaultModel.toLowerCase().startsWith(query)) return 3;
  return 4;
}

function progressBar(current: number, total: number, width: number): string {
  const safeTotal = Math.max(1, total);
  const filled = Math.max(1, Math.min(width, Math.round((current / safeTotal) * width)));
  return `[${'#'.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}]`;
}

function findChannelIndex(channels: ZavorthSetupStudioChannelGuide[], query: string, selectedIndex = 0): number {
  const matches = findChannelMatches(channels, query);
  const match = matches[Math.max(0, Math.min(matches.length - 1, selectedIndex))];
  return match ? channels.findIndex((channel) => channel.id === match.id) : -1;
}

function findChannelMatches(channels: ZavorthSetupStudioChannelGuide[], query: string): ZavorthSetupStudioChannelGuide[] {
  const normalized = query.trim().toLowerCase();
  return channels
    .filter((channel) => !normalized
      || channel.id.includes(normalized)
      || channel.label.toLowerCase().includes(normalized)
      || channel.status.toLowerCase().includes(normalized))
    .sort((left, right) => rankChannel(left, normalized) - rankChannel(right, normalized) || left.label.localeCompare(right.label));
}

function rankChannel(channel: ZavorthSetupStudioChannelGuide, query: string): number {
  if (!query) return channel.status === 'recommended' ? 0 : channel.status === 'ready' ? 1 : 2;
  if (channel.id === query) return 0;
  if (channel.id.startsWith(query)) return 1;
  if (channel.label.toLowerCase().startsWith(query)) return 2;
  if (channel.status.toLowerCase().startsWith(query)) return 3;
  return 4;
}

function beginSecretCapture(
  field: SecretField,
  setActiveSecretField: (field: SecretField | null) => void,
  setSecretBuffer: (value: string) => void,
  setHint: (value: string) => void,
): void {
  setActiveSecretField(field);
  setSecretBuffer('');
  setHint(`Typing ${SECRET_FIELD_LABELS[field]}. Enter saves, Esc cancels.`);
}

function maskSecret(value: string): string {
  if (!value) {
    return '[empty]';
  }
  return '*'.repeat(Math.min(24, value.length));
}

function symbolForStatus(status: string): string {
  if (status === 'ready') return 'o';
  if (status === 'warning') return '!';
  if (status === 'blocked') return 'x';
  return '*';
}

function colorForStatus(status: string): string {
  if (status === 'ready') return COLORS.green;
  if (status === 'warning') return COLORS.amber;
  if (status === 'blocked') return COLORS.red;
  return COLORS.muted;
}

function colorForChannel(status: string): string {
  if (status === 'ready') return COLORS.green;
  if (status === 'recommended') return COLORS.cyan;
  if (status === 'missing-config') return COLORS.amber;
  return COLORS.muted;
}

function shortStatus(status: string): string {
  if (status === 'missing-config') {
    return 'needs-config';
  }
  if (status === 'recommended') {
    return 'recommended';
  }
  return status;
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 3))}...`;
}

function truncateMiddle(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }
  const side = Math.max(4, Math.floor((length - 3) / 2));
  return `${value.slice(0, side)}...${value.slice(-side)}`;
}
