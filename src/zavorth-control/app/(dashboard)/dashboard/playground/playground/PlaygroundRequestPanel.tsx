import dynamic from "next/dynamic";
import { Badge, Card } from "@/shared/components";
import { ENDPOINT_PATHS } from "./playgroundConfig";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type PlaygroundRequestPanelProps = {
  handleCopy: (text: string) => Promise<void>;
  isTranscriptionEndpoint: boolean;
  requestBody: string;
  resetRequestBody: () => void;
  selectedEndpoint: string;
  setRequestBody: (value: string) => void;
};

export function PlaygroundRequestPanel(props: PlaygroundRequestPanelProps) {
  return (
    <Card>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-muted">upload</span>
            <h3 className="text-sm font-semibold text-text-main">Request</h3>
            <Badge variant="info" size="sm">
              POST {ENDPOINT_PATHS[props.selectedEndpoint]}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => props.handleCopy(props.requestBody)}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
              title="Copy"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
            <button
              onClick={props.resetRequestBody}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
              title="Reset to default"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            </button>
          </div>
        </div>

        {props.isTranscriptionEndpoint && (
          <p className="text-xs text-text-muted bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 flex items-start gap-1">
            <span className="material-symbols-outlined text-[12px] text-amber-500 mt-0.5">
              info
            </span>
            Transcription uses multipart/form-data. Upload the audio file above - JSON below
            controls extra params (model, language).
          </p>
        )}

        <div className="border border-border rounded-lg overflow-hidden">
          <Editor
            height="400px"
            defaultLanguage="json"
            value={props.requestBody}
            onChange={(value: string | undefined) => props.setRequestBody(value || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              formatOnPaste: true,
            }}
          />
        </div>
      </div>
    </Card>
  );
}
