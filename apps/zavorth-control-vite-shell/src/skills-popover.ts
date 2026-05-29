import { escapeHtml } from './html-utils';

export type ComposerSkill = {
  id: string;
  title: string;
  status: string;
  prompt: string;
};

export function buildSkillOptions(): ComposerSkill[] {
  const bridge = window.ZavorthRuntimeBridge;
  const runtimeSkills = bridge && typeof bridge.getAvailableSkills === 'function'
    ? bridge.getAvailableSkills()
    : [];
  const defaults = [
    { id: 'read_file', title: 'Review files', prompt: 'Review the files or folder I provide and give me a clear summary.', status: 'local' },
    { id: 'network_fetch', title: 'Search the web', prompt: 'Search recent sources about this topic and bring me a summary with links.', status: 'web' },
    { id: 'pdf.generate', title: 'Generate report', prompt: 'Generate an organized report with the main points.', status: 'report' },
  ];
  const byId = new Map<string, ComposerSkill>();
  [...runtimeSkills, ...defaults].forEach((skill: any) => {
    const id = String(skill?.id || skill?.title || '').trim();
    if (!id || byId.has(id)) return;
    byId.set(id, {
      id,
      title: String(skill.title || skill.name || id).trim(),
      prompt: String(skill.prompt || skill.summary || skill.description || `Use ${id} for this request.`).trim(),
      status: String(skill.status || 'available').trim(),
    });
  });
  return Array.from(byId.values()).slice(0, 8);
}

export function buildSkillPopoverHtml(options: ComposerSkill[], selectedSkills: ComposerSkill[]) {
  return `
    <div class="compose-skill-popover__header">
      <span>Tools</span>
      <button type="button" class="compose-skill-popover__close" aria-label="Close tools">&times;</button>
    </div>
    <div class="compose-skill-popover__list">
      ${options.map((skill) => `
        <button type="button" class="compose-skill-option${selectedSkills.some((selected) => selected.id === skill.id) ? ' is-selected' : ''}" data-skill-id="${escapeHtml(skill.id)}" data-skill-title="${escapeHtml(skill.title)}" data-skill-status="${escapeHtml(skill.status)}" data-skill-prompt="${escapeHtml(skill.prompt)}">
          <span class="compose-skill-option__title">${escapeHtml(skill.title)}</span>
          <span class="compose-skill-option__meta">${escapeHtml(skill.status)}</span>
        </button>
      `).join('')}
    </div>
    <div class="compose-skill-popover__footer">Choose a skill to prepare the request. Nothing runs by itself.</div>
  `;
}

export function skillFromOption(option: Element | null): ComposerSkill | null {
  if (!option) return null;
  const skillId = option.getAttribute('data-skill-id') || '';
  if (!skillId) return null;
  return {
    id: skillId,
    title: option.getAttribute('data-skill-title') || skillId,
    status: option.getAttribute('data-skill-status') || '',
    prompt: option.getAttribute('data-skill-prompt') || '',
  };
}

export function promptForSkill(skill: ComposerSkill) {
  return skill.prompt
    ? `Use ${skill.title}: ${skill.prompt}`
    : `Use ${skill.title} for this request.`;
}

