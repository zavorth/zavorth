-- Migration 021: declarative webhook payload filters (Wave residual)
-- Optional JSON filter evaluated by WebhookFilterService.
--
-- SQLite has no "ADD COLUMN IF NOT EXISTS". The migration ledger applies this
-- once; runtime also calls ensureWebhooksFilterColumn() as a safety net for
-- partial upgrades / manually-created tables.

ALTER TABLE webhooks ADD COLUMN filter TEXT;
