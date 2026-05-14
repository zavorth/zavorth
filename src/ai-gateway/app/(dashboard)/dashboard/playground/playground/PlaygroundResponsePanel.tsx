import dynamic from "next/dynamic";
import { Badge, Card } from "@/shared/components";
import { PlaygroundImageResults } from "./PlaygroundImageResults";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type PlaygroundResponsePanelProps = {
  audioUrl: string | null;
  handleCopy: (text: string) => Promise<void>;
  imageData: any;
  loading: boolean;
  responseBody: string;
  responseDuration: number | null;
  responseStatus: number | null;
  transcriptionText: string | null;
};

export function PlaygroundResponsePanel(props: PlaygroundResponsePanelProps) {
  return (
    <Card>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-muted">download</span>
            <h3 className="text-sm font-semibold text-text-main">Response</h3>
            {props.responseStatus !== null && (
              <Badge
                variant={
                  props.responseStatus >= 200 && props.responseStatus < 300 ? "success" : "error"
                }
                size="sm"
              >
                {props.responseStatus}
              </Badge>
            )}
            {props.responseDuration !== null && (
              <span className="text-xs text-text-muted">{props.responseDuration}ms</span>
            )}
            {props.loading && (
              <span className="material-symbols-outlined text-[14px] text-primary animate-spin">
                progress_activity
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => props.handleCopy(props.responseBody)}
              className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-text-main transition-colors"
              title="Copy"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          {props.audioUrl ? (
            <div className="p-4 space-y-3">
              <audio controls src={props.audioUrl} className="w-full rounded-lg" autoPlay />
              <a
                href={props.audioUrl}
                download="speech.mp3"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download audio
              </a>
            </div>
          ) : props.imageData ? (
            <PlaygroundImageResults data={props.imageData} />
          ) : props.transcriptionText !== null ? (
            <div className="p-4 space-y-2">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
                Transcription
              </p>
              <div className="bg-surface/50 rounded p-3 text-sm text-text-main leading-relaxed whitespace-pre-wrap">
                {props.transcriptionText}
              </div>
              <button
                onClick={() => props.handleCopy(props.transcriptionText || "")}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[12px]">content_copy</span>
                Copy text
              </button>
            </div>
          ) : (
            <Editor
              height="400px"
              defaultLanguage="json"
              value={props.responseBody}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                readOnly: true,
              }}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
