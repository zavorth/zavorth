"use client";

import dynamic from "next/dynamic";
import { PlaygroundControls } from "./playground/PlaygroundControls";
import { PlaygroundRequestPanel } from "./playground/PlaygroundRequestPanel";
import { PlaygroundResponsePanel } from "./playground/PlaygroundResponsePanel";
import { PlaygroundUploadPanel } from "./playground/PlaygroundUploadPanel";
import { usePlaygroundPage } from "./playground/usePlaygroundPage";

const SearchPlayground = dynamic(() => import("./SearchPlayground"), {
  ssr: false,
});

export default function PlaygroundPage() {
  const model = usePlaygroundPage();

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-text-muted">
        <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">
          science
        </span>
        <div>
          <p className="font-medium text-text-main mb-0.5">Model Playground</p>
          <p>
            Test any model directly from the dashboard. Pick a provider, model, and endpoint type,
            then send a request to see the raw response.
          </p>
        </div>
      </div>

      <PlaygroundControls
        filteredModels={model.filteredModels}
        handleCancel={model.handleCancel}
        handleEndpointChange={model.handleEndpointChange}
        handleModelChange={model.handleModelChange}
        handleProviderChange={model.handleProviderChange}
        handleSend={model.handleSend}
        isSearchEndpoint={model.isSearchEndpoint}
        isTranscriptionEndpoint={model.isTranscriptionEndpoint}
        loading={model.loading}
        providerConnections={model.providerConnections}
        providers={model.providers}
        requestBody={model.requestBody}
        selectedConnection={model.selectedConnection}
        selectedEndpoint={model.selectedEndpoint}
        selectedModel={model.selectedModel}
        selectedProvider={model.selectedProvider}
        setSelectedConnection={model.setSelectedConnection}
      />

      {model.isSearchEndpoint ? (
        <SearchPlayground />
      ) : (
        <>
          <PlaygroundUploadPanel
            clearUploadedImages={model.clearUploadedImages}
            handleAudioFileChange={model.handleAudioFileChange}
            handleImageFileChange={model.handleImageFileChange}
            isTranscriptionEndpoint={model.isTranscriptionEndpoint}
            removeUploadedImage={model.removeUploadedImage}
            supportsVision={model.supportsVision}
            uploadedFile={model.uploadedFile}
            uploadedImages={model.uploadedImages}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PlaygroundRequestPanel
              handleCopy={model.handleCopy}
              isTranscriptionEndpoint={model.isTranscriptionEndpoint}
              requestBody={model.requestBody}
              resetRequestBody={model.resetRequestBody}
              selectedEndpoint={model.selectedEndpoint}
              setRequestBody={model.setRequestBody}
            />
            <PlaygroundResponsePanel
              audioUrl={model.audioUrl}
              handleCopy={model.handleCopy}
              imageData={model.imageData}
              loading={model.loading}
              responseBody={model.responseBody}
              responseDuration={model.responseDuration}
              responseStatus={model.responseStatus}
              transcriptionText={model.transcriptionText}
            />
          </div>
        </>
      )}
    </div>
  );
}
