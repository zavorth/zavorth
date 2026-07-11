import * as Clipboard from "./clipboard"

type Toast = {
  show: (input: { message: string; variant: "info" | "success" | "warning" | "error" }) => void
  error: (err: unknown) => void
}

type Renderer = {
  getSelection: () => { getSelectedText: () => string } | null
  clearSelection: () => void
}

/**
 * Copy current terminal selection. Stripping of ZWSP/OSC-8 is centralized in
 * `Clipboard.copy` so every call site stays clean without double-work here.
 */
export function copy(renderer: Renderer, toast: Toast, message: string): boolean {
  const text = renderer.getSelection()?.getSelectedText()
  if (!text) return false

  Clipboard.copy(text)
    .then(() => toast.show({ message, variant: "info" }))
    .catch(toast.error)

  renderer.clearSelection()
  return true
}
