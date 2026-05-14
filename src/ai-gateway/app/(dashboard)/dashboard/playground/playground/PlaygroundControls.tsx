import { Button, Card, Select } from "@/shared/components";
import { ENDPOINT_OPTIONS } from "./playgroundConfig";
import type { ConnectionOption, PlaygroundOption, ProviderOption } from "./playgroundTypes";

type PlaygroundControlsProps = {
  filteredModels: PlaygroundOption[];
  handleCancel: () => void;
  handleEndpointChange: (endpoint: string) => void;
  handleModelChange: (model: string) => void;
  handleProviderChange: (provider: string) => void;
  handleSend: () => void;
  isSearchEndpoint: boolean;
  isTranscriptionEndpoint: boolean;
  loading: boolean;
  providerConnections: ConnectionOption[];
  providers: ProviderOption[];
  requestBody: string;
  selectedConnection: string;
  selectedEndpoint: string;
  selectedModel: string;
  selectedProvider: string;
  setSelectedConnection: (connectionId: string) => void;
};

export function PlaygroundControls(props: PlaygroundControlsProps) {
  return (
    <Card>
      <div className="p-4 flex flex-col sm:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
            Endpoint
          </label>
          <Select
            value={props.selectedEndpoint}
            onChange={(event: any) => props.handleEndpointChange(event.target.value)}
            options={ENDPOINT_OPTIONS}
            className="w-full"
          />
        </div>

        {!props.isSearchEndpoint && (
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              Provider
            </label>
            <Select
              value={props.selectedProvider}
              onChange={(event: any) => props.handleProviderChange(event.target.value)}
              options={props.providers}
              className="w-full"
            />
          </div>
        )}

        {!props.isSearchEndpoint && (
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              Model
            </label>
            <Select
              value={props.selectedModel}
              onChange={(event: any) => props.handleModelChange(event.target.value)}
              options={props.filteredModels}
              className="w-full"
            />
          </div>
        )}

        {!props.isSearchEndpoint && (
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              Account / Key
            </label>
            <Select
              value={props.selectedConnection}
              onChange={(event: any) => props.setSelectedConnection(event.target.value)}
              options={[
                {
                  value: "",
                  label:
                    props.providerConnections.length > 0
                      ? `Auto (${props.providerConnections.length} accounts)`
                      : "No accounts",
                },
                ...props.providerConnections.map((connection) => ({
                  value: connection.id,
                  label: connection.name,
                })),
              ]}
              className="w-full"
            />
          </div>
        )}

        {!props.isSearchEndpoint && (
          <div className="shrink-0">
            {props.loading ? (
              <Button icon="stop" variant="secondary" onClick={props.handleCancel}>
                Cancel
              </Button>
            ) : (
              <Button
                icon="send"
                onClick={props.handleSend}
                disabled={
                  (!props.requestBody.trim() && !props.isTranscriptionEndpoint) ||
                  (!props.selectedModel && !props.isTranscriptionEndpoint)
                }
              >
                Send
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
