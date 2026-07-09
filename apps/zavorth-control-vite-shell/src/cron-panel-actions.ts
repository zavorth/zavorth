import { escapeHtml } from './html-utils';
import { asErrorLike } from '../../../src/utils/errorLike';
import { createShellLogger, surfaceShellError } from './shell-debug';
import { translate } from './locale';

const log = createShellLogger('cron-panel');

// Constants

const API_BASE = '/api/scheduled-tasks';

const DELIVERY_OPTIONS = [
  'app',
  'telegram',
  'discord',
  'slack',
  'email',
  'webhook',
  'whatsapp',
  'signal',
] as const;

// 1. API Functions

export async function fetchScheduledTasks(): Promise<any> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  return res.json();
}

export async function createScheduledTask(input: {
  command: string;
  schedule: string;
  intent?: string;
  delivery?: string;
  deliveryTarget?: string;
}): Promise<any> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
  return res.json();
}

export async function taskLifecycleAction(
  taskId: string,
  action: 'pause' | 'resume' | 'trigger' | 'revoke',
): Promise<any> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`Failed to ${action} task: ${res.status}`);
  return res.json();
}

export async function deleteScheduledTask(taskId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);
  return res.json();
}

// 2. Form Rendering

export function renderCreateRoutineForm(): string {
  const deliveryOpts = DELIVERY_OPTIONS.map(
    (opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`,
  ).join('');

  return `
    <div class="cron-form-panel" id="cron-create-form-wrapper" style="display:none">
      <form id="cron-create-form" autocomplete="off">
        <div class="cron-form-field">
          <label class="cron-form-label" for="cron-field-command">Command</label>
          <input
            class="cron-form-input"
            id="cron-field-command"
            name="command"
            type="text"
            placeholder="Command or prompt to execute"
            required
          />
        </div>

        <div class="cron-form-field">
          <label class="cron-form-label" for="cron-field-schedule">Schedule</label>
          <input
            class="cron-form-input"
            id="cron-field-schedule"
            name="schedule"
            type="text"
            placeholder="e.g. every 1h, daily 09:00, 0 */6 * * *"
            required
          />
        </div>

        <div class="cron-form-field">
          <label class="cron-form-label" for="cron-field-intent">Intent</label>
          <input
            class="cron-form-input"
            id="cron-field-intent"
            name="intent"
            type="text"
            placeholder="Optional: describe the routine purpose"
          />
        </div>

        <div class="cron-form-field">
          <label class="cron-form-label" for="cron-field-delivery">Delivery</label>
          <select class="cron-form-input" id="cron-field-delivery" name="delivery">
            ${deliveryOpts}
          </select>
        </div>

        <div class="cron-form-field">
          <label class="cron-form-label" for="cron-field-deliveryTarget">Delivery Target</label>
          <input
            class="cron-form-input"
            id="cron-field-deliveryTarget"
            name="deliveryTarget"
            type="text"
            placeholder="Channel ID or email (optional)"
          />
        </div>

        <div class="cron-form-actions">
          <button type="submit" class="operator-primary-action">Create Routine</button>
          <button type="button" class="operator-secondary-action" data-cron-cancel-form>Cancel</button>
        </div>
      </form>
    </div>
  `;
}

// 3. Form CSS Styles

export function getCronPanelStyles(): string {
  return `<style>
.cron-form-panel {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
  display: grid;
  gap: 12px;
}
.cron-form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cron-form-label {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cron-form-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 14px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.cron-form-input:focus {
  border-color: rgba(99,102,241,0.6);
}
select.cron-form-input {
  appearance: none;
}
.cron-form-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

/* Action buttons (inline row per task) */
.cron-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.cron-action-btn:hover {
  background: rgba(255,255,255,0.08);
  color: #fff;
}
.cron-action-btn--pause:hover {
  border-color: rgba(251,191,36,0.4);
  color: #fbbf24;
}
.cron-action-btn--resume:hover {
  border-color: rgba(52,211,153,0.4);
  color: #34d399;
}
.cron-action-btn--trigger:hover {
  border-color: rgba(96,165,250,0.4);
  color: #60a5fa;
}
.cron-action-btn--delete:hover {
  border-color: rgba(248,113,113,0.4);
  color: #f87171;
}

/* Status badges */
.cron-status-active { color: #34d399; }
.cron-status-paused { color: #fbbf24; }
.cron-status-failed { color: #f87171; }
</style>`;
}

// 4. Action Buttons Rendering

export function renderTaskActionButtons(taskId: string, status: string): string {
  const id = escapeHtml(taskId);
  const normalized = status?.toLowerCase() ?? '';

  const btn = (
    action: string,
    modifier: string,
    icon: string,
    label: string,
  ) =>
    `<button class="cron-action-btn cron-action-btn--${modifier}"
       data-cron-action="${escapeHtml(action)}"
       data-cron-task-id="${id}"
       type="button"
       title="${escapeHtml(label)}">${icon} ${escapeHtml(label)}</button>`;

  if (normalized === 'active') {
    return [
      btn('pause', 'pause', '⏸️', 'Pause'),
      btn('trigger', 'trigger', '▶▶', 'Trigger'),
      btn('delete', 'delete', '🗑️', 'Delete'),
    ].join(' ');
  }

  if (normalized === 'paused') {
    return [
      btn('resume', 'resume', '▶️', 'Resume'),
      btn('delete', 'delete', '🗑️', 'Delete'),
    ].join(' ');
  }

  return btn('delete', 'delete', '🗑️', 'Delete');
}

// 5. Event Binding

export function bindCronPanelEvents(refreshCallback: () => void): void {
  // Prevent double-binding
  if (document.documentElement.dataset.cronPanelBound === '1') return;
  document.documentElement.dataset.cronPanelBound = '1';

  document.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-cron-action]',
    );
    if (!target) return;

    const action = target.dataset.cronAction as string;
    const taskId = target.dataset.cronTaskId as string;
    if (!action || !taskId) return;

    try {
      if (action === 'delete') {
        await deleteScheduledTask(taskId);
      } else {
        await taskLifecycleAction(
          taskId,
          action as 'pause' | 'resume' | 'trigger' | 'revoke',
        );
      }
      window.emitSignal?.(
        'success',
        translate('Scheduled task updated'),
        translate('Task action completed: {action}').replace('{action}', action),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      log.error(`${action} failed for ${taskId}`, err);
      surfaceShellError(
        translate('Scheduled task failed'),
        message || translate('Could not update the scheduled task.'),
      );
    }

    refreshCallback();
  });

  document.addEventListener('submit', async (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>(
      '#cron-create-form',
    );
    if (!form) return;
    e.preventDefault();

    const data = new FormData(form);
    const command = (data.get('command') as string) ?? '';
    const schedule = (data.get('schedule') as string) ?? '';
    const intent = (data.get('intent') as string) ?? '';
    const delivery = (data.get('delivery') as string) ?? '';
    const deliveryTarget = (data.get('deliveryTarget') as string) ?? '';

    if (!command.trim() || !schedule.trim()) return;

    try {
      await createScheduledTask({
        command: command.trim(),
        schedule: schedule.trim(),
        ...(intent.trim() ? { intent: intent.trim() } : {}),
        ...(delivery ? { delivery } : {}),
        ...(deliveryTarget.trim()
          ? { deliveryTarget: deliveryTarget.trim() }
          : {}),
      });
      form.reset();
      const wrapper = document.getElementById('cron-create-form-wrapper');
      if (wrapper) wrapper.style.display = 'none';
      window.emitSignal?.(
        'success',
        translate('Scheduled task created'),
        translate('The task is on the board.'),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = err instanceof Error ? err.message : String(err);
      log.error('create task failed', err);
      surfaceShellError(
        translate('Scheduled task failed'),
        message || translate('Could not create the scheduled task.'),
      );
    }

    refreshCallback();
  });

  document.addEventListener('click', (e) => {
    const cancel = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-cron-cancel-form]',
    );
    if (!cancel) return;

    const wrapper = document.getElementById('cron-create-form-wrapper');
    if (wrapper) wrapper.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    const toggle = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-cron-show-form]',
    );
    if (!toggle) return;

    const wrapper = document.getElementById('cron-create-form-wrapper');
    if (!wrapper) return;

    wrapper.style.display =
      wrapper.style.display === 'none' ? '' : 'none';
  });
}
