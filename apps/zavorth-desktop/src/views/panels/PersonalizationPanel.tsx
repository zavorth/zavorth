import { effortLabels, profileLabels } from '../../primitives/desktopPrimitives';
import { DetailRows, PageFrame } from './panelPrimitives';

export function PersonalizationPanel(props: {
  accent: 'orange' | 'purple' | 'navy';
  effort: string;
  profile: string;
  theme: 'light' | 'dark' | 'system';
  onAccent(value: 'orange' | 'purple' | 'navy'): void;
  onEffort(value: string): void;
  onProfile(value: string): void;
  onTheme(value: 'light' | 'dark' | 'system'): void;
}) {
  const rows = [
    {
      id: 'experience-profile',
      title: 'Experience profile',
      description: 'Controls tone, detail, and the kind of help Zavorth suggests first.',
      meta: props.profile,
      tone: 'muted' as const,
      actions: (
        <select className="zvd-inline-select" value={props.profile} onChange={event => props.onProfile(event.target.value)} aria-label="Experience profile">
          {profileLabels.map(profile => (
            <option key={profile} value={profile}>{profile}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'reasoning-effort',
      title: 'Reasoning effort',
      description: 'Balances speed and depth for everyday chat and guided work.',
      meta: props.effort,
      tone: 'muted' as const,
      actions: (
        <select className="zvd-inline-select" value={props.effort} onChange={event => props.onEffort(event.target.value)} aria-label="Reasoning effort">
          {effortLabels.map(effort => (
            <option key={effort} value={effort}>{effort}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Keeps the desktop comfortable across dark rooms, bright rooms, and system theme changes.',
      meta: props.theme,
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.theme}
          onChange={event => props.onTheme(event.target.value as 'light' | 'dark' | 'system')}
          aria-label="Theme"
        >
          <option value="system">system</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      ),
    },
    {
      id: 'accent',
      title: 'Accent',
      description: 'Changes the active seed color without changing runtime behavior.',
      meta: props.accent,
      tone: 'muted' as const,
      actions: (
        <select
          className="zvd-inline-select"
          value={props.accent}
          onChange={event => props.onAccent(event.target.value as 'orange' | 'purple' | 'navy')}
          aria-label="Accent"
        >
          <option value="orange">orange</option>
          <option value="purple">purple</option>
          <option value="navy">navy</option>
        </select>
      ),
    },
  ];

  return (
    <PageFrame
      eyebrow="Personalizacao"
      description="Perfil, esforco, tema e cor da experiencia desktop."
      meta="native preferences"
      title="Personalizacao"
    >
      <DetailRows rows={rows} empty="No personalization controls are available." />
    </PageFrame>
  );
}
