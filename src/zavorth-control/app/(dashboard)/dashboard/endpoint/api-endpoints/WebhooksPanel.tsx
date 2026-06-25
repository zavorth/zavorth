import { Card } from "@/shared/components";
import { WEBHOOK_EVENTS } from "./apiEndpointsConfig";
import type { WebhookItem } from "./apiEndpointsTypes";

interface WebhooksPanelProps {
  webhooks: WebhookItem[];
  webhooksLoading: boolean;
  showAddWebhook: boolean;
  onShowAddWebhookChange: (show: boolean) => void;
  webhookUrl: string;
  onWebhookUrlChange: (value: string) => void;
  webhookEvents: string[];
  webhookDescription: string;
  onWebhookDescriptionChange: (value: string) => void;
  testingWebhookId: string | null;
  onSelectAllEvents: () => void;
  onToggleEvent: (event: string) => void;
  onAddWebhook: () => void;
  onToggleWebhook: (webhook: WebhookItem) => void;
  onDeleteWebhook: (id: string) => void;
  onTestWebhook: (id: string) => void;
}

export function WebhooksPanel({
  webhooks,
  webhooksLoading,
  showAddWebhook,
  onShowAddWebhookChange,
  webhookUrl,
  onWebhookUrlChange,
  webhookEvents,
  webhookDescription,
  onWebhookDescriptionChange,
  testingWebhookId,
  onSelectAllEvents,
  onToggleEvent,
  onAddWebhook,
  onToggleWebhook,
  onDeleteWebhook,
  onTestWebhook,
}: WebhooksPanelProps) {
  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">webhook</span>
            <div>
              <h3 className="text-sm font-semibold">Event Webhooks</h3>
              <p className="text-[11px] text-text-muted">
                Receive HTTP callbacks when events occur in ZavorthGateway
              </p>
            </div>
          </div>
          {!showAddWebhook && (
            <button
              onClick={() => onShowAddWebhookChange(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg
                         bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Add Webhook
            </button>
          )}
        </div>

        {showAddWebhook && (
          <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/[0.03] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  Webhook URL
                </label>
                <input
                  value={webhookUrl}
                  onChange={(e) => onWebhookUrlChange(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full mt-0.5 px-2.5 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10
                             bg-white dark:bg-black/20 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                  Description
                </label>
                <input
                  value={webhookDescription}
                  onChange={(e) => onWebhookDescriptionChange(e.target.value)}
                  placeholder="Production monitoring"
                  className="w-full mt-0.5 px-2.5 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10
                             bg-white dark:bg-black/20 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                Events
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button
                  onClick={onSelectAllEvents}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors
                    ${
                      webhookEvents.includes("*")
                        ? "bg-primary/10 text-primary"
                        : "bg-black/5 dark:bg-white/5 text-text-muted"
                    }`}
                >
                  All events
                </button>
                {WEBHOOK_EVENTS.map((event) => (
                  <button
                    key={event}
                    onClick={() => onToggleEvent(event)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors
                      ${
                        webhookEvents.includes(event) || webhookEvents.includes("*")
                          ? "bg-primary/10 text-primary"
                          : "bg-black/5 dark:bg-white/5 text-text-muted"
                      }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onAddWebhook}
                disabled={!webhookUrl.trim()}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-primary text-white
                           hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => onShowAddWebhookChange(false)}
                className="px-3 py-1 text-xs font-medium rounded-lg
                           bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {webhooksLoading ? (
          <div className="text-xs text-text-muted py-4 text-center">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-[32px] text-text-muted">webhook</span>
            <p className="text-xs text-text-muted mt-2">
              No webhooks configured. Add one to receive event notifications.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors
                  ${
                    webhook.enabled
                      ? "border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.02]"
                      : "border-black/5 dark:border-white/5 opacity-50"
                  }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-text-main truncate">{webhook.url}</code>
                    {webhook.failure_count > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-500">
                        {webhook.failure_count} failures
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {webhook.description && (
                      <span className="text-[10px] text-text-muted">{webhook.description}</span>
                    )}
                    <span className="text-[9px] text-text-muted">
                      Events: {webhook.events.join(", ")}
                    </span>
                    {webhook.last_triggered_at && (
                      <span className="text-[9px] text-text-muted">
                        Last: {new Date(webhook.last_triggered_at).toLocaleString()}
                        {webhook.last_status ? ` (${webhook.last_status})` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => onTestWebhook(webhook.id)}
                    disabled={testingWebhookId === webhook.id}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title="Send test event"
                  >
                    <span
                      className={`material-symbols-outlined text-[14px] ${testingWebhookId === webhook.id ? "animate-spin text-primary" : "text-text-muted"}`}
                    >
                      {testingWebhookId === webhook.id ? "sync" : "send"}
                    </span>
                  </button>
                  <button
                    onClick={() => onToggleWebhook(webhook)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title={webhook.enabled ? "Disable" : "Enable"}
                  >
                    <span
                      className={`material-symbols-outlined text-[14px] ${webhook.enabled ? "text-emerald-500" : "text-text-muted"}`}
                    >
                      {webhook.enabled ? "toggle_on" : "toggle_off"}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteWebhook(webhook.id)}
                    className="p-1 rounded hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[14px] text-red-500">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[14px] text-amber-500">vpn_key</span>
          <h3 className="text-xs font-semibold">Webhook Signatures</h3>
        </div>
        <p className="text-[11px] text-text-muted mb-2">
          Each webhook delivery includes an{" "}
          <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/5">
            X-Webhook-Signature
          </code>{" "}
          header signed with HMAC-SHA256 using the webhook secret. Verify the signature to ensure
          the payload is authentic.
        </p>
        <div className="rounded-lg bg-black/5 dark:bg-black/30 p-3">
          <code className="text-[10px] font-mono text-text-main">
            {`const crypto = require('crypto');\nconst sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');\nif (sig !== req.headers['x-webhook-signature']) throw new Error('Invalid signature');`}
          </code>
        </div>
      </Card>
    </>
  );
}
