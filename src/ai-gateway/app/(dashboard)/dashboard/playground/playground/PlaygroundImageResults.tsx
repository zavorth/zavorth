import { extractPlaygroundImages } from "./playgroundConfig";

export function PlaygroundImageResults({ data }: { data: any }) {
  const images = extractPlaygroundImages(data);
  if (images.length === 0) return null;

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
        {images.length} image{images.length > 1 ? "s" : ""} generated
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {images.map((img, index) => {
          const src = img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : null);
          if (!src) return null;
          return (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={img.revised_prompt || `Generated image ${index + 1}`}
                className="w-full"
              />
              <a
                href={src}
                download={`image-${index + 1}.png`}
                className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[13px]">download</span>
                Save
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
