"use client";

import { ApiCatalogPanel } from "./api-endpoints/ApiCatalogPanel";
import { ApiEndpointTabs } from "./api-endpoints/ApiEndpointTabs";
import { ApiEndpointsHeader } from "./api-endpoints/ApiEndpointsHeader";
import { ApiEndpointsLoading } from "./api-endpoints/ApiEndpointsLoading";
import { useApiEndpointsTab } from "./api-endpoints/useApiEndpointsTab";
import { WebhooksPanel } from "./api-endpoints/WebhooksPanel";

export default function ApiEndpointsTab() {
  const state = useApiEndpointsTab();

  if (state.loading) {
    return <ApiEndpointsLoading />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {state.catalog && <ApiEndpointsHeader catalog={state.catalog} tagCount={state.allTags.length} />}

      <ApiEndpointTabs section={state.section} onSectionChange={state.setSection} />

      {state.section === "catalog" && state.catalog && (
        <ApiCatalogPanel
          catalog={state.catalog}
          allTags={state.allTags}
          search={state.search}
          onSearchChange={state.setSearch}
          selectedTag={state.selectedTag}
          onSelectedTagChange={state.setSelectedTag}
          groupedEndpoints={state.groupedEndpoints}
          filteredEndpoints={state.filteredEndpoints}
          expandedEndpoint={state.expandedEndpoint}
          onExpandedEndpointChange={state.setExpandedEndpoint}
          tryingEndpoint={state.tryingEndpoint}
          tryBody={state.tryBody}
          onTryBodyChange={state.setTryBody}
          tryResult={state.tryResult}
          trying={state.trying}
          onTryIt={state.handleTryIt}
          onExecuteTryIt={state.executeTryIt}
        />
      )}

      {state.section === "webhooks" && (
        <WebhooksPanel
          webhooks={state.webhooks}
          webhooksLoading={state.webhooksLoading}
          showAddWebhook={state.showAddWebhook}
          onShowAddWebhookChange={state.setShowAddWebhook}
          webhookUrl={state.whUrl}
          onWebhookUrlChange={state.setWhUrl}
          webhookEvents={state.whEvents}
          webhookDescription={state.whDesc}
          onWebhookDescriptionChange={state.setWhDesc}
          testingWebhookId={state.testingWebhookId}
          onSelectAllEvents={state.selectAllWebhookEvents}
          onToggleEvent={state.toggleWebhookEvent}
          onAddWebhook={state.addWebhook}
          onToggleWebhook={state.toggleWebhook}
          onDeleteWebhook={state.deleteWebhook}
          onTestWebhook={state.testWebhook}
        />
      )}
    </div>
  );
}
