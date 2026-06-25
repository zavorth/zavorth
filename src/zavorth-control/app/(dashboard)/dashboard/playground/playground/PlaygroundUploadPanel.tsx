import type { ChangeEvent } from "react";
import { Badge, Card } from "@/shared/components";

type PlaygroundUploadPanelProps = {
  clearUploadedImages: () => void;
  handleAudioFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleImageFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  isTranscriptionEndpoint: boolean;
  removeUploadedImage: (index: number) => void;
  supportsVision: boolean;
  uploadedFile: File | null;
  uploadedImages: string[];
};

export function PlaygroundUploadPanel(props: PlaygroundUploadPanelProps) {
  if (!props.isTranscriptionEndpoint && !props.supportsVision) {
    return null;
  }

  return (
    <Card>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-text-muted">
            attach_file
          </span>
          <h3 className="text-sm font-semibold text-text-main">
            {props.isTranscriptionEndpoint ? "Audio File" : "Attach Images (Vision)"}
          </h3>
          {props.isTranscriptionEndpoint && (
            <Badge variant="info" size="sm">
              multipart/form-data
            </Badge>
          )}
          {props.supportsVision && (
            <Badge variant="info" size="sm">
              up to 4 images
            </Badge>
          )}
        </div>

        {props.isTranscriptionEndpoint && (
          <div>
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={props.handleAudioFileChange}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-sm"
            />
            {props.uploadedFile && (
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-green-500">
                  check_circle
                </span>
                {props.uploadedFile.name} ({(props.uploadedFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
            {!props.uploadedFile && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">info</span>
                Select an audio file to transcribe (mp3, wav, m4a, ogg, flac...)
              </p>
            )}
          </div>
        )}

        {props.supportsVision && (
          <div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={props.handleImageFileChange}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-sm"
            />
            {props.uploadedImages.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {props.uploadedImages.map((src, index) => (
                  <div
                    key={index}
                    className="relative group size-16 rounded overflow-hidden border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Attached ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => props.removeUploadedImage(index)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={props.clearUploadedImages}
                  className="text-xs text-text-muted hover:text-red-500 self-center ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
