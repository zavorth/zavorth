const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const draftsDir = path.join(workspace, '.zavorth', 'gmail', 'drafts');

  function ensureDraftsDir() {
    if (!fs.existsSync(draftsDir)) {
      fs.mkdirSync(draftsDir, { recursive: true });
    }
  }

  function tokenPresent() {
    return Boolean(
      String(process.env.GMAIL_ACCESS_TOKEN || process.env.GOOGLE_ACCESS_TOKEN || '').trim(),
    );
  }

  function accessToken() {
    return String(process.env.GMAIL_ACCESS_TOKEN || process.env.GOOGLE_ACCESS_TOKEN || '').trim();
  }

  ctx.bindCapability('gmail.status', async () => {
    try {
      const present = tokenPresent();
      return {
        output: {
          ok: present,
          tokenPresent: present,
          message: present
            ? 'Gmail/Google access token is present.'
            : 'No GMAIL_ACCESS_TOKEN or GOOGLE_ACCESS_TOKEN configured.',
          setup: setupTips(),
        },
      };
    } catch (error) {
      logger.warn('gmail.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('gmail.list', async ({ input }) => {
    try {
      const max = Math.max(1, Math.min(50, Number((input && input.max) || 10) || 10));
      if (!tokenPresent()) {
        return {
          output: {
            ok: false,
            messages: [],
            reason: 'no_token',
            setup: setupTips(),
          },
        };
      }
      try {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken()}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          return {
            output: {
              ok: false,
              messages: [],
              reason: 'api_error',
              status: response.status,
              setup: setupTips(),
            },
          };
        }
        const data = await response.json();
        const messages = Array.isArray(data.messages) ? data.messages : [];
        return {
          output: {
            ok: true,
            messages,
            count: messages.length,
          },
        };
      } catch (error) {
        return {
          output: {
            ok: false,
            messages: [],
            reason: 'fetch_failed',
            message: error instanceof Error ? error.message : String(error),
            setup: setupTips(),
          },
        };
      }
    } catch (error) {
      logger.warn('gmail.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          messages: [],
          message: error instanceof Error ? error.message : String(error),
          setup: setupTips(),
        },
      };
    }
  });

  ctx.bindCapability('gmail.draft', async ({ input }) => {
    try {
      const to = String((input && (input.to || input.recipient)) || '').trim();
      const subject = String((input && input.subject) || '').trim();
      const body = String((input && (input.body || input.text || input.content)) || '').trim();
      if (!to || !subject) {
        return {
          output: {
            ok: false,
            reason: 'to and subject are required',
          },
        };
      }
      ensureDraftsDir();
      const draftId = `draft-${randomUUID()}`;
      const record = {
        draftId,
        to,
        subject,
        body,
        status: 'draft',
        createdAt: new Date().toISOString(),
        sentAt: null,
      };
      const filePath = path.join(draftsDir, `${draftId}.json`);
      fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      return {
        output: {
          ok: true,
          draftId,
          path: filePath,
          status: 'draft',
          message: 'Draft stored locally. Never auto-sends. Use gmail.send with approved=true.',
        },
        artifacts: [filePath],
      };
    } catch (error) {
      logger.warn('gmail.draft failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('gmail.send', async ({ input }) => {
    try {
      const draftId = String((input && (input.draftId || input.id)) || '').trim();
      if (!draftId) {
        return { output: { ok: false, reason: 'draftId is required' } };
      }

      let approved = input && input.approved === true;
      if (!approved && typeof ctx.requestPermission === 'function') {
        approved = await ctx.requestPermission(
          'network.external',
          `Send Gmail draft ${draftId}`,
        );
      }
      if (!approved) {
        return {
          output: {
            ok: false,
            reason: 'needs_approval',
            draftId,
            message: 'gmail.send requires approved===true or requestPermission grant. Never auto-sends.',
          },
        };
      }

      const filePath = path.join(draftsDir, `${draftId}.json`);
      if (!fs.existsSync(filePath)) {
        return {
          output: {
            ok: false,
            reason: 'draft_not_found',
            draftId,
          },
        };
      }

      const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!tokenPresent()) {
        record.status = 'send_blocked_no_token';
        record.updatedAt = new Date().toISOString();
        fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
        return {
          output: {
            ok: false,
            reason: 'no_token',
            draftId,
            setup: setupTips(),
            message: 'Approved, but no access token is configured. Draft was not sent.',
          },
        };
      }

      try {
        const raw = [
          `To: ${record.to}`,
          `Subject: ${record.subject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          String(record.body || ''),
        ].join('\r\n');
        const encoded = Buffer.from(raw)
          .toString('base64')
          .replace(/\+/gu, '-')
          .replace(/\//gu, '_')
          .replace(/=+$/u, '');

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken()}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ raw: encoded }),
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          return {
            output: {
              ok: false,
              reason: 'api_error',
              status: response.status,
              draftId,
              setup: setupTips(),
            },
          };
        }

        const data = await response.json();
        record.status = 'sent';
        record.sentAt = new Date().toISOString();
        record.gmailMessageId = data.id || null;
        fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
        return {
          output: {
            ok: true,
            draftId,
            messageId: data.id || null,
            status: 'sent',
          },
        };
      } catch (error) {
        return {
          output: {
            ok: false,
            reason: 'send_failed',
            draftId,
            message: error instanceof Error ? error.message : String(error),
            setup: setupTips(),
          },
        };
      }
    } catch (error) {
      logger.warn('gmail.send failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
}

function setupTips() {
  return [
    'Set GMAIL_ACCESS_TOKEN or GOOGLE_ACCESS_TOKEN with gmail.readonly / gmail.send scopes.',
    'Drafts are always local under .zavorth/gmail/drafts/.',
    'Send requires approved=true — never auto-sends.',
  ];
}

module.exports = { register };
