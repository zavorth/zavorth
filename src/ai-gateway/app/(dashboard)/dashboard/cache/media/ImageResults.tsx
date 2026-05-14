export function ImageResults({ data }: { data: any }) {
  const images: Array<{ url?: string; b64_json?: string; revised_prompt?: string }> =
    data?.data || [];
  if (images.length === 0) {
    return (
      <p className="text-sm text-text-muted italic">
        No images returned. The provider might have accepted the request but returned empty data.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {images.map((img, i) => {
        const src = img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : null);
        if (!src) return null;
        return (
          <div
            key={i}
            className="relative group rounded-lg overflow-hidden border border-black/10 dark:border-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={img.revised_prompt || `Generated image ${i + 1}`}
              className="w-full"
            />
            <a
              href={src}
              download={`image-${i + 1}.png`}
              className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">download</span>
              Save
            </a>
            {img.revised_prompt && (
              <p
                className="text-[11px] text-text-muted px-2 py-1 bg-surface/80 truncate"
                title={img.revised_prompt}
              >
                {img.revised_prompt}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
