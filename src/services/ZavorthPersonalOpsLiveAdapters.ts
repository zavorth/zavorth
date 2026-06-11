import { SecureStorageService } from './SecureStorageService.js';
import {
  ZavorthPersonalOpsOAuthService,
  type ZavorthPersonalOpsOAuthProvider,
} from './ZavorthPersonalOpsOAuthService.js';
import type {
  ZavorthPersonalOpsAdapter,
  ZavorthPersonalOpsAdapterInput,
  ZavorthPersonalOpsAdapterResult,
} from './ZavorthPersonalOpsRuntimeService.js';

type SecureStorageLike = Pick<SecureStorageService, 'readSecret' | 'writeSecret'>;

export type ZavorthPersonalOpsLiveAdapterOptions = {
  secureStorage?: SecureStorageLike;
  fetchImpl?: typeof fetch;
  oauth?: ZavorthPersonalOpsOAuthService;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
  tenantId?: string | null;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

abstract class PersonalOpsRestAdapter {
  protected readonly secureStorage: SecureStorageLike;
  protected readonly fetchImpl: typeof fetch;
  protected readonly oauth: ZavorthPersonalOpsOAuthService;
  protected readonly oauthClientId: string | null;
  protected readonly oauthClientSecret: string | null;
  protected readonly tenantId: string | null;

  protected constructor(options: ZavorthPersonalOpsLiveAdapterOptions = {}) {
    this.secureStorage = options.secureStorage || new SecureStorageService();
    this.fetchImpl = options.fetchImpl || fetch;
    this.oauth = options.oauth || new ZavorthPersonalOpsOAuthService({ fetchImpl: this.fetchImpl });
    this.oauthClientId = clean(options.oauthClientId);
    this.oauthClientSecret = clean(options.oauthClientSecret);
    this.tenantId = clean(options.tenantId);
  }

  protected abstract provider(): ZavorthPersonalOpsOAuthProvider;

  protected async requestJson(
    input: ZavorthPersonalOpsAdapterInput,
    url: string,
    options: RequestOptions = {},
  ): Promise<Record<string, unknown>> {
    const token = this.readAccessToken(input);
    let response = await this.fetchImpl(url, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (response.status === 401) {
      const refreshedToken = await this.tryRefreshToken(input);
      if (refreshedToken) {
        response = await this.fetchImpl(url, {
          method: options.method || (options.body ? 'POST' : 'GET'),
          headers: {
            Authorization: `Bearer ${refreshedToken}`,
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
          },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });
      }
    }
    if (!response.ok) {
      throw new Error(`personal_ops_request_failed:${response.status}`);
    }
    if (response.status === 202 || response.status === 204) {
      return {};
    }
    return readJson(response);
  }

  private readAccessToken(input: ZavorthPersonalOpsAdapterInput): string {
    const accessRef = input.credentialRefs.find((ref) => /\.accessToken$/i.test(ref))
      || input.credentialRefs.find((ref) => /\.oauthToken$/i.test(ref));
    const token = accessRef ? this.secureStorage.readSecret(accessRef) : null;
    if (!token) {
      throw new Error('personal_ops_access_token_missing');
    }
    return token;
  }

  private async tryRefreshToken(input: ZavorthPersonalOpsAdapterInput): Promise<string | null> {
    if (!this.oauthClientId) {
      return null;
    }
    const refreshRef = input.credentialRefs.find((ref) => /\.refreshToken$/i.test(ref));
    const refreshToken = refreshRef ? this.secureStorage.readSecret(refreshRef) : null;
    if (!refreshRef || !refreshToken) {
      return null;
    }
    const result = await this.oauth.refreshAccessToken({
      provider: this.provider(),
      refreshToken,
      clientId: this.oauthClientId,
      clientSecret: this.oauthClientSecret,
      tenantId: this.tenantId,
    });
    const accessRef = input.credentialRefs.find((ref) => /\.accessToken$/i.test(ref));
    if (accessRef) {
      this.secureStorage.writeSecret(accessRef, result.accessToken);
    }
    if (result.refreshToken) {
      this.secureStorage.writeSecret(refreshRef, result.refreshToken);
    }
    return result.accessToken;
  }
}

export class ZavorthPersonalOpsGoogleAdapter extends PersonalOpsRestAdapter implements ZavorthPersonalOpsAdapter {
  public constructor(options: ZavorthPersonalOpsLiveAdapterOptions = {}) {
    super(options);
  }

  protected provider(): ZavorthPersonalOpsOAuthProvider {
    return 'google';
  }

  public async readEmail(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    const maxResults = positiveInt(input.payload.maxResults, 10);
    url.searchParams.set('maxResults', String(maxResults));
    const query = clean(input.payload.query || input.payload.q);
    if (query) {
      url.searchParams.set('q', query);
    }
    const json = await this.requestJson(input, url.toString());
    const messages = Array.isArray(json.messages) ? json.messages : [];
    return {
      messageIds: messages.map((message) => readId(message)).filter(Boolean),
      count: messages.length,
      nextPageToken: clean(json.nextPageToken),
    };
  }

  public async draftEmail(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const json = await this.requestJson(input, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      body: {
        message: {
          raw: buildGmailRaw(input.payload),
        },
      },
    });
    return {
      draftId: clean(json.id),
      messageId: clean(record(json.message)?.id),
    };
  }

  public async sendEmail(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const json = await this.requestJson(input, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: {
        raw: buildGmailRaw(input.payload),
      },
    });
    return {
      messageId: clean(json.id),
      sent: true,
    };
  }

  public async readCalendar(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const calendarId = encodeURIComponent(clean(input.payload.calendarId) || 'primary');
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
    appendUrlParam(url, 'timeMin', input.payload.timeMin);
    appendUrlParam(url, 'timeMax', input.payload.timeMax);
    url.searchParams.set('maxResults', String(positiveInt(input.payload.maxResults, 10)));
    const json = await this.requestJson(input, url.toString());
    const items = Array.isArray(json.items) ? json.items : [];
    return {
      eventIds: items.map((event) => readId(event)).filter(Boolean),
      count: items.length,
      nextPageToken: clean(json.nextPageToken),
    };
  }

  public async createCalendarEvent(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const calendarId = encodeURIComponent(clean(input.payload.calendarId) || 'primary');
    const json = await this.requestJson(input, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: 'POST',
      body: googleCalendarEvent(input.payload),
    });
    return {
      eventId: clean(json.id),
      htmlLink: clean(json.htmlLink),
    };
  }

  public async updateCalendarEvent(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const eventId = required(input.payload.eventId, 'google_calendar_event_id_required');
    const calendarId = encodeURIComponent(clean(input.payload.calendarId) || 'primary');
    const json = await this.requestJson(
      input,
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        body: googleCalendarEvent(input.payload),
      },
    );
    return {
      eventId: clean(json.id) || eventId,
      htmlLink: clean(json.htmlLink),
    };
  }

  public async readTasks(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const taskListId = encodeURIComponent(clean(input.payload.taskListId) || '@default');
    const json = await this.requestJson(input, `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`);
    const items = Array.isArray(json.items) ? json.items : [];
    return {
      taskIds: items.map((task) => readId(task)).filter(Boolean),
      count: items.length,
    };
  }

  public async createTask(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const taskListId = encodeURIComponent(clean(input.payload.taskListId) || '@default');
    const json = await this.requestJson(input, `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
      method: 'POST',
      body: googleTask(input.payload),
    });
    return {
      taskId: clean(json.id),
      status: clean(json.status),
    };
  }

  public async updateTask(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const taskId = required(input.payload.taskId, 'google_task_id_required');
    const taskListId = encodeURIComponent(clean(input.payload.taskListId) || '@default');
    const json = await this.requestJson(
      input,
      `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        body: googleTask(input.payload),
      },
    );
    return {
      taskId: clean(json.id) || taskId,
      status: clean(json.status),
    };
  }
}

export class ZavorthPersonalOpsMicrosoftGraphAdapter extends PersonalOpsRestAdapter implements ZavorthPersonalOpsAdapter {
  public constructor(options: ZavorthPersonalOpsLiveAdapterOptions = {}) {
    super(options);
  }

  protected provider(): ZavorthPersonalOpsOAuthProvider {
    return 'microsoft';
  }

  public async readEmail(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const url = new URL('https://graph.microsoft.com/v1.0/me/messages');
    url.searchParams.set('$top', String(positiveInt(input.payload.maxResults, 10)));
    appendUrlParam(url, '$search', input.payload.search);
    const json = await this.requestJson(input, url.toString());
    const items = Array.isArray(json.value) ? json.value : [];
    return {
      messageIds: items.map((message) => readId(message)).filter(Boolean),
      count: items.length,
    };
  }

  public async draftEmail(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const json = await this.requestJson(input, 'https://graph.microsoft.com/v1.0/me/messages', {
      method: 'POST',
      body: microsoftMailMessage(input.payload),
    });
    return {
      draftId: clean(json.id),
      messageId: clean(json.id),
    };
  }

  public async sendEmail(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const json = await this.requestJson(input, 'https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      body: {
        message: microsoftMailMessage(input.payload),
        saveToSentItems: input.payload.saveToSentItems !== false,
      },
    });
    return {
      messageId: clean(json.id),
      sent: true,
    };
  }

  public async readCalendar(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const url = new URL('https://graph.microsoft.com/v1.0/me/events');
    url.searchParams.set('$top', String(positiveInt(input.payload.maxResults, 10)));
    const json = await this.requestJson(input, url.toString());
    const items = Array.isArray(json.value) ? json.value : [];
    return {
      eventIds: items.map((event) => readId(event)).filter(Boolean),
      count: items.length,
    };
  }

  public async createCalendarEvent(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const json = await this.requestJson(input, 'https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      body: microsoftCalendarEvent(input.payload),
    });
    return {
      eventId: clean(json.id),
      webLink: clean(json.webLink),
    };
  }

  public async updateCalendarEvent(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const eventId = required(input.payload.eventId, 'microsoft_calendar_event_id_required');
    const json = await this.requestJson(
      input,
      `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        body: microsoftCalendarEvent(input.payload),
      },
    );
    return {
      eventId: clean(json.id) || eventId,
      webLink: clean(json.webLink),
    };
  }

  public async readTasks(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const listId = clean(input.payload.taskListId);
    const url = listId
      ? `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks`
      : 'https://graph.microsoft.com/v1.0/me/todo/lists';
    const json = await this.requestJson(input, url);
    const items = Array.isArray(json.value) ? json.value : [];
    return {
      taskIds: items.map((task) => readId(task)).filter(Boolean),
      count: items.length,
    };
  }

  public async createTask(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const listId = required(input.payload.taskListId, 'microsoft_task_list_id_required');
    const json = await this.requestJson(
      input,
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
      {
        method: 'POST',
        body: microsoftTask(input.payload),
      },
    );
    return {
      taskId: clean(json.id),
      status: clean(json.status),
    };
  }

  public async updateTask(input: ZavorthPersonalOpsAdapterInput): Promise<ZavorthPersonalOpsAdapterResult> {
    const listId = required(input.payload.taskListId, 'microsoft_task_list_id_required');
    const taskId = required(input.payload.taskId, 'microsoft_task_id_required');
    const json = await this.requestJson(
      input,
      `https://graph.microsoft.com/v1.0/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        body: microsoftTask(input.payload),
      },
    );
    return {
      taskId: clean(json.id) || taskId,
      status: clean(json.status),
    };
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const text = await response.text();
    if (!text) {
      return {};
    }
    const parsed = JSON.parse(text) as unknown;
    return record(parsed) || {};
  } catch {
    return {};
  }
}

function buildGmailRaw(payload: Record<string, unknown>): string {
  const to = normalizeRecipients(payload.to).join(', ');
  const cc = normalizeRecipients(payload.cc).join(', ');
  const bcc = normalizeRecipients(payload.bcc).join(', ');
  const subject = clean(payload.subject) || '';
  const body = clean(payload.body) || '';
  const lines = [
    to ? `To: ${to}` : '',
    cc ? `Cc: ${cc}` : '',
    bcc ? `Bcc: ${bcc}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].filter((line, index) => line || index > 2);
  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function googleCalendarEvent(payload: Record<string, unknown>): Record<string, unknown> {
  const title = clean(payload.title || payload.summary) || 'Zavorth event';
  return {
    summary: title,
    description: clean(payload.description) || undefined,
    start: dateTimeObject(payload.startsAt || payload.start || payload.startDateTime),
    end: dateTimeObject(payload.endsAt || payload.end || payload.endDateTime),
    attendees: normalizeRecipients(payload.attendees).map((email) => ({ email })),
  };
}

function microsoftCalendarEvent(payload: Record<string, unknown>): Record<string, unknown> {
  const title = clean(payload.title || payload.subject) || 'Zavorth event';
  return {
    subject: title,
    body: clean(payload.description)
      ? { contentType: 'Text', content: clean(payload.description) }
      : undefined,
    start: graphDateTime(payload.startsAt || payload.start || payload.startDateTime),
    end: graphDateTime(payload.endsAt || payload.end || payload.endDateTime),
    attendees: normalizeRecipients(payload.attendees).map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
  };
}

function googleTask(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    title: clean(payload.title) || 'Zavorth task',
    notes: clean(payload.notes || payload.body || payload.description) || undefined,
    status: clean(payload.status) || undefined,
    due: clean(payload.due || payload.dueAt) || undefined,
  };
}

function microsoftTask(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    title: clean(payload.title) || 'Zavorth task',
    body: clean(payload.body || payload.notes || payload.description)
      ? { content: clean(payload.body || payload.notes || payload.description), contentType: 'text' }
      : undefined,
    status: clean(payload.status) || undefined,
    dueDateTime: payload.due || payload.dueAt ? graphDateTime(payload.due || payload.dueAt) : undefined,
  };
}

function microsoftMailMessage(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    subject: clean(payload.subject) || '',
    body: {
      contentType: 'Text',
      content: clean(payload.body) || '',
    },
    toRecipients: normalizeRecipients(payload.to).map((address) => ({ emailAddress: { address } })),
    ccRecipients: normalizeRecipients(payload.cc).map((address) => ({ emailAddress: { address } })),
    bccRecipients: normalizeRecipients(payload.bcc).map((address) => ({ emailAddress: { address } })),
  };
}

function dateTimeObject(value: unknown): Record<string, unknown> {
  const dateTime = clean(value) || new Date().toISOString();
  return {
    dateTime,
    timeZone: 'UTC',
  };
}

function graphDateTime(value: unknown): Record<string, unknown> {
  const dateTime = clean(value) || new Date().toISOString();
  return {
    dateTime,
    timeZone: 'UTC',
  };
}

function appendUrlParam(url: URL, key: string, value: unknown): void {
  const normalized = clean(value);
  if (normalized) {
    url.searchParams.set(key, normalized);
  }
}

function normalizeRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => clean(entry)).filter((entry): entry is string => Boolean(entry));
  }
  const single = clean(value);
  return single ? [single] : [];
}

function positiveInt(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.floor(number), 100) : fallback;
}

function required(value: unknown, error: string): string {
  const normalized = clean(value);
  if (!normalized) {
    throw new Error(error);
  }
  return normalized;
}

function readId(value: unknown): string | null {
  return clean(record(value)?.id);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
