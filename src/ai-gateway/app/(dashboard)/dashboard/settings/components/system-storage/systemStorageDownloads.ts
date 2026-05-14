export const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const fetchAndDownload = async (
  apiUrl: string,
  fallbackFilename: string,
  errorMessage: string
) => {
  const res = await fetch(apiUrl);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || errorMessage);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  triggerDownload(blob, filenameMatch?.[1] || fallbackFilename);
};
