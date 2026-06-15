---
title: "Email"
description: "Connect Zavorth to email for notifications, approval requests, and summaries."
---

Email is a fallback channel for notifications and approvals — not the primary way to chat with Zavorth, but useful for receiving summaries, getting notified about pending approvals, and integrating with workflows that use email.

## What you can do with email

- Receive notifications when Zavorth needs your approval
- Get daily summaries and receipts by email
- Trigger Zavorth by sending an email to a monitored address (via IMAP)
- Integrate with email-based workflows

## Setup

<Steps>
  <Step title="Configure SMTP (sending)">
    ```env
    EMAIL_ENABLED=true
    EMAIL_TRANSPORT=smtp-imap
    EMAIL_SMTP_HOST=smtp.gmail.com
    EMAIL_SMTP_PORT=587
    EMAIL_SMTP_USER=your@email.com
    EMAIL_SMTP_PASS=your_app_password
    ```

    <Tip>
    For Gmail, use an App Password (not your regular password). Enable 2FA first, then go to **Google Account → Security → App passwords**.
    For other providers: Outlook uses `smtp.office365.com:587`, iCloud uses `smtp.mail.me.com:587`.
    </Tip>
  </Step>

  <Step title="Configure IMAP (receiving, optional)">
    To let Zavorth read incoming emails:

    ```env
    EMAIL_IMAP_HOST=imap.gmail.com
    EMAIL_ALLOWED_RECIPIENTS=trusted@email.com
    ```

    Only emails from `EMAIL_ALLOWED_RECIPIENTS` are processed.
  </Step>

  <Step title="Verify">
    ```bash
    zavorth connectors doctor email
    ```

    Send a test email:
    ```bash
    zavorth channels email --send-test
    ```
  </Step>
</Steps>

## What emails look like

Zavorth sends structured emails with clear subjects and actionable content:

```
Subject: [Zavorth] Approval needed: update project settings

Zavorth wants to write the following file:

  Target: project settings
  Change: Add timeout configuration (3 lines)

To approve: reply with "approve" or click the link below.
To reject: reply with "reject".

[Approve] [Reject] [View details]
```

## Approval by email

You can approve or reject pending actions by replying to the email. Zavorth reads the reply via IMAP and acts accordingly.

This requires IMAP to be configured. The `EMAIL_ALLOWED_RECIPIENTS` list must include the email address you reply from.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `EMAIL_ENABLED` | Yes | Set to `true` |
| `EMAIL_TRANSPORT` | No | `smtp-imap` (default) |
| `EMAIL_SMTP_HOST` | Yes | SMTP server hostname |
| `EMAIL_SMTP_PORT` | No | Default: `587` |
| `EMAIL_SMTP_USER` | Yes | Your email address |
| `EMAIL_SMTP_PASS` | Yes | App password or SMTP password |
| `EMAIL_IMAP_HOST` | No | IMAP server (for reading incoming mail) |
| `EMAIL_ALLOWED_RECIPIENTS` | Recommended | Only process emails from these addresses |

## Troubleshooting

**Emails not sending**
Run `zavorth connectors doctor email`. Check SMTP credentials — most providers require an app password, not your login password.

**IMAP not working**
Make sure IMAP is enabled in your email provider settings. Gmail: **Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP**.

## Related

- [All channels](/docs/product/channels)
- [Approvals](/docs/product/concepts/approvals)
- [Telegram](/docs/product/channels/telegram)
