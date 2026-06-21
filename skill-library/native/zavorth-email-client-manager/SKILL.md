---
name: Email SMTP/IMAP Manager
description: Manage client communications by drafting, sending, and triaging emails safely.
license: Zavorth-Internal
---

# Email SMTP/IMAP Manager

Use this native skill when:
- The task requires operations in the 'productivity' domain.
- Performing actions matching: manage client communications by drafting, sending, and triaging emails safely.

## Operating Rules

- Enforce user authorization lease before executing email sends.
- Sanitize email text body and strip local system absolute paths.
- Parse email headers safely to prevent header injection vulnerability.

## Output

Return SMTP delivery confirmations and IMAP inbox summary checklists.
