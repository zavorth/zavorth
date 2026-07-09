import { useCallback, useEffect, useRef, useState } from "react";
"use client";


import { motion, AnimatePresence } from "framer-motion";

/*  Types                                                              */

interface ExpressivePromptBarProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  agentState?: "idle" | "thinking" | "streaming";
}

/*  Expand‑popover action definitions                                  */

const EXPAND_ACTIONS = [
  { icon: "upload_file", label: "Upload File" },
  { icon: "image", label: "Upload Image" },
  { icon: "photo_camera", label: "Camera" },
  { icon: "mic", label: "Voice" },
] as const;

/*  Animated gradient border (cyan → emerald cycling)                  */

function GradientBorder() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        padding: "1px",
        /* The gradient mask trick: the border is a pseudo via background‑clip */
        background:
          "linear-gradient(var(--angle, 0deg), #22d3ee, #10b981, #22d3ee)",
        WebkitMask:
          "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    >
      {/* CSS animation for rotating the gradient angle */}
      <style>{`
        @property --angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes epb-rotate-gradient {
          to { --angle: 360deg; }
        }
      `}</style>
      <span
        className="block h-full w-full rounded-full"
        style={{
          animation: "epb-rotate-gradient 3s linear infinite",
        }}
      />
    </motion.span>
  );
}

/*  Component                                                          */

export function ExpressivePromptBar({
  onSubmit,
  disabled = false,
  placeholder = "Ask anything…",
  agentState = "idle",
}: ExpressivePromptBarProps) {
  const [text, setText] = useState("");
  const [expandOpen, setExpandOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isActive = agentState === "thinking" || agentState === "streaming";

  /* ── Auto‑resize textarea ── */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    /* lineHeight 24px x 4 rows = 96px cap */
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  /* ── Submit handler ── */
  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
    /* Reset textarea height after clear */
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [text, disabled, onSubmit]);

  /* ── Keyboard ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  /* ── Close popover on outside click ── */
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expandOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setExpandOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [expandOpen]);

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 16 }}
    >
      <div className="relative w-full max-w-[720px] px-4 pointer-events-auto">
        {/* ── Expand popover ── */}
        <AnimatePresence>
          {expandOpen && (
            <motion.div
              key="expand-popover"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="absolute bottom-full left-4 right-4 mb-3 grid grid-cols-2 gap-2 rounded-2xl p-3"
              style={{
                background: "rgba(10,10,10,0.65)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.45)",
              }}
            >
              {EXPAND_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm text-white/80 transition-colors hover:bg-white/[0.07] active:bg-white/[0.12]"
                  onClick={() => setExpandOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px] text-white/50">
                    {action.icon}
                  </span>
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Prompt bar ── */}
        <div
          className="relative flex items-end gap-2 rounded-full px-2 py-2"
          style={{
            background: "rgba(10,10,10,0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Animated gradient border overlay when active */}
          <AnimatePresence>
            {isActive && <GradientBorder />}
          </AnimatePresence>

          {/* Expand / collapse button (+/X) */}
          <motion.button
            type="button"
            aria-label={expandOpen ? "Close actions" : "Open actions"}
            onClick={() => setExpandOpen((o) => !o)}
            className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.08] active:bg-white/[0.14]"
            animate={{ rotate: expandOpen ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="material-symbols-outlined text-[22px]">add</span>
          </motion.button>

          {/* ── Textarea ── */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="relative z-10 min-h-[36px] flex-1 resize-none bg-transparent py-[6px] text-sm leading-6 text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ maxHeight: 96 }}
          />

          {/* ── Submit / stop button ── */}
          <button
            type="button"
            aria-label={isActive ? "Stop generation" : "Send message"}
            onClick={isActive ? () => onSubmit("__stop__") : handleSubmit}
            disabled={disabled || (!isActive && text.trim().length === 0)}
            className={`
              relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
              transition-all duration-200
              disabled:opacity-30 disabled:cursor-not-allowed
              ${
                isActive
                  ? "bg-red-500/20 text-red-400 shadow-[0_0_14px_rgba(239,68,68,0.35)] hover:bg-red-500/30"
                  : "bg-white/10 text-white hover:bg-white/[0.18] active:bg-white/[0.24]"
              }
            `}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isActive ? "stop_circle" : "arrow_upward"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
