export function createHiddenFileInput(options: { directory?: boolean } = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.style.display = 'none';
  if (options.directory) {
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }
  document.body.appendChild(input);
  return input;
}

export function bindComposeInputEvents(options: {
  composeInput: HTMLTextAreaElement | null;
  tokenCount: HTMLElement | null;
  onSubmit: () => void;
  onSendAffordance: () => void;
}) {
  const { composeInput, tokenCount, onSubmit, onSendAffordance } = options;
  if (!composeInput) return;

  composeInput.addEventListener('input', () => {
    composeInput.style.height = 'auto';
    composeInput.style.height = `${Math.min(composeInput.scrollHeight, 150)}px`;
    const text = composeInput.value.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    const tokens = Math.ceil(words * 1.3);
    if (tokenCount) tokenCount.textContent = `${tokens} tokens`;
    onSendAffordance();
  });

  composeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  });
}

export function bindAttachmentTray(options: {
  attachmentTray: HTMLElement | null;
  removeAttachmentAt: (index: number) => void;
}) {
  options.attachmentTray?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const remove = target?.closest?.('[data-attachment-index]');
    if (!remove) return;
    const index = Number(remove.getAttribute('data-attachment-index'));
    if (!Number.isFinite(index)) return;
    options.removeAttachmentAt(index);
  });
}

export function bindComposerContextBar(options: {
  composerContextBar: HTMLElement | null;
  removeSkill: (skillId: string) => void;
}) {
  options.composerContextBar?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const remove = target?.closest?.('[data-compose-remove-skill]');
    if (!remove) return;
    options.removeSkill(remove.getAttribute('data-compose-remove-skill') || '');
  });
}

export function bindFileInputEvents(options: {
  fileInput: HTMLInputElement;
  directoryInput: HTMLInputElement;
  onFiles: (files: FileList | File[]) => Promise<void>;
  onDirectory: (files: FileList) => void;
}) {
  options.fileInput.addEventListener('change', async () => {
    await options.onFiles(options.fileInput.files || []);
    options.fileInput.value = '';
    options.fileInput.removeAttribute('accept');
  });

  options.directoryInput.addEventListener('change', () => {
    const files = options.directoryInput.files || [];
    if (!files.length) return;
    options.onDirectory(files);
  });
}

export function bindComposerFileDrop(options: {
  composeFrame: HTMLElement | null;
  composeInput: HTMLElement | null;
  onFiles: (files: FileList | File[]) => Promise<void>;
}) {
  options.composeFrame?.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    options.composeFrame?.classList.add('is-dragging-files');
  });

  options.composeFrame?.addEventListener('dragleave', () => {
    options.composeFrame?.classList.remove('is-dragging-files');
  });

  options.composeFrame?.addEventListener('drop', async (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    options.composeFrame?.classList.remove('is-dragging-files');
    await options.onFiles(event.dataTransfer.files);
  });

  options.composeInput?.addEventListener('paste', async (event) => {
    const clipboardEvent = event as ClipboardEvent;
    const files = Array.from(clipboardEvent.clipboardData?.files || []);
    if (files.length === 0) return;
    event.preventDefault();
    await options.onFiles(files);
  });
}

export function bindToolSheetActions(options: {
  toolSheetActions: NodeListOf<HTMLElement>;
  closeToolSheet: () => void;
  chooseAttachmentFiles: (accept?: string) => void;
  openSkillPopover: () => void;
  triggerVoice: () => void;
  focusComposeWithPrompt: (prompt: string) => void;
}) {
  options.toolSheetActions.forEach((actionButton) => {
    actionButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = actionButton.getAttribute('data-tool-sheet-action');
      if (action === 'attach') {
        options.closeToolSheet();
        options.chooseAttachmentFiles('');
        return;
      }
      if (action === 'media') {
        options.closeToolSheet();
        options.chooseAttachmentFiles('image/*,video/*,audio/*');
        return;
      }
      if (action === 'skills') {
        options.closeToolSheet();
        options.openSkillPopover();
        return;
      }
      if (action === 'voice') {
        options.closeToolSheet();
        options.triggerVoice();
        return;
      }
      if (action === 'mcp') {
        options.closeToolSheet();
        options.focusComposeWithPrompt('Use the notebook MCP to prepare a safe remote action. Show the target, risk, preview and ask for approval before execution.');
        return;
      }
      if (action === 'docs') {
        options.closeToolSheet();
        options.focusComposeWithPrompt('Use the docs and Zavorth project context to answer this request:');
        return;
      }
      if (action === 'terminal') {
        options.closeToolSheet();
        options.focusComposeWithPrompt('Prepare a governed terminal execution. First show preview, impact, risk, rollback and whether approval is required:');
      }
    });
  });
}

