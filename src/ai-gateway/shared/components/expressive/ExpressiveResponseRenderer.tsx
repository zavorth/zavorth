import { useState, useEffect, useRef, Fragment } from "react";
"use client";


import { motion, AnimatePresence, type Variants } from "framer-motion";

/*  Types                                                              */

type MessageRole = "user" | "assistant";

type ToolCallBlock = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  summary?: string;
};

type ContentBlock =
  | { type: "text"; content: string }
  | { type: "tool_call"; call: ToolCallBlock }
  | { type: "thinking"; content: string };

type ChatMessage = {
  id: string;
  role: MessageRole;
  blocks: ContentBlock[];
  timestamp?: number;
};

interface ExpressiveResponseRendererProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

/*  Animation variants                                                 */

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.28, ease: "easeOut" },
  }),
};

const toolCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: "easeOut" },
  }),
};

/*  Glassmorphic style tokens                                          */

const glass = {
  base: "bg-[rgba(10,10,10,0.45)] backdrop-blur-xl border border-[rgba(255,255,255,0.05)]",
  user: "bg-[rgba(6,182,212,0.08)] backdrop-blur-xl border border-[rgba(6,182,212,0.12)]",
  thinking:
    "bg-[rgba(10,10,10,0.45)] backdrop-blur-xl border border-[rgba(255,255,255,0.05)] border-l-2 border-l-teal-500/60",
  toolCard:
    "bg-[rgba(10,10,10,0.45)] backdrop-blur-lg border border-[rgba(255,255,255,0.05)]",
};

/*  Inline markdown helpers (bold + code)                              */

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split on **bold** and `code` patterns
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-cyan-300 text-[13px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/*  Sub-components                                                     */

function TextBlock({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[15px] leading-7 text-gray-200">
          {renderInlineMarkdown(p)}
        </p>
      ))}
    </div>
  );
}

function ThinkingBlock({ content, isLast }: { content: string; isLast: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl overflow-hidden ${glass.thinking}`}>
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left group transition-colors hover:bg-white/[0.02]"
      >
        <span
          className={`material-symbols-outlined text-[20px] text-teal-400 ${
            isLast ? "animate-pulse" : ""
          }`}
        >
          psychology
        </span>
        <span className="text-[13px] font-medium text-teal-300/90 tracking-wide">
          Reasoning…
        </span>
        <span
          className={`material-symbols-outlined text-[16px] text-white/30 ml-auto transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 text-[13px] leading-6 text-gray-400/90 whitespace-pre-wrap">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolCallCard({ call, index }: { call: ToolCallBlock; index: number }) {
  const statusIcon = {
    running: (
      <span className="material-symbols-outlined text-[14px] text-cyan-400 animate-spin">
        progress_activity
      </span>
    ),
    done: (
      <span className="material-symbols-outlined text-[14px] text-emerald-400">
        check_circle
      </span>
    ),
    error: (
      <span className="material-symbols-outlined text-[14px] text-red-400">
        error
      </span>
    ),
  };

  const statusBorder = {
    running: "border-cyan-500/20",
    done: "border-emerald-500/20",
    error: "border-red-500/20",
  };

  return (
    <motion.div
      custom={index}
      variants={toolCardVariants}
      initial="hidden"
      animate="visible"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${glass.toolCard} ${statusBorder[call.status]}`}
    >
      <span className="material-symbols-outlined text-[16px] text-white/40">
        build_circle
      </span>
      <span className="text-[13px] font-medium text-gray-300 tracking-tight">
        {call.name}
      </span>
      {call.summary && (
        <span className="text-[11px] text-gray-500 max-w-[200px] truncate">
          — {call.summary}
        </span>
      )}
      {statusIcon[call.status]}
    </motion.div>
  );
}

function StreamingDots() {
  return (
    <div className="flex items-center gap-1 pt-2 pb-1 pl-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-cyan-400/70"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/*  Main component                                                     */

export function ExpressiveResponseRenderer({
  messages,
  isStreaming = false,
}: ExpressiveResponseRendererProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isStreaming]);

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-5 overflow-y-auto scroll-smooth px-2 py-4"
      style={{ maxHeight: "100%", scrollbarGutter: "stable" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {messages.map((msg, msgIdx) => {
          const isUser = msg.role === "user";
          const isLastAssistant = msgIdx === lastAssistantIdx;

          return (
            <motion.div
              key={msg.id}
              custom={msgIdx}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Message container */}
              <div
                className={`flex flex-col gap-2.5 ${
                  isUser ? "max-w-[75%] items-end" : "w-full items-start"
                }`}
              >
                {/* Timestamp */}
                {msg.timestamp && (
                  <span className="text-[10px] text-white/20 font-mono px-1 select-none">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}

                {isUser ? (
                  <div className={`rounded-2xl rounded-br-md px-5 py-3 ${glass.user}`}>
                    {msg.blocks.map((block, blockIdx) => (
                      <motion.div
                        key={blockIdx}
                        custom={blockIdx}
                        variants={blockVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {block.type === "text" && (
                          <p className="text-[15px] leading-7 text-cyan-50/90">
                            {renderInlineMarkdown(block.content)}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 w-full">
                    {msg.blocks.map((block, blockIdx) => {
                      const isLastBlock = blockIdx === msg.blocks.length - 1;

                      return (
                        <motion.div
                          key={blockIdx}
                          custom={blockIdx}
                          variants={blockVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          {block.type === "text" && <TextBlock content={block.content} />}
                          {block.type === "thinking" && (
                            <ThinkingBlock
                              content={block.content}
                              isLast={isLastAssistant && isLastBlock && isStreaming}
                            />
                          )}
                          {block.type === "tool_call" && (
                            <ToolCallCard call={block.call} index={blockIdx} />
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Streaming dots */}
                    {isLastAssistant && isStreaming && <StreamingDots />}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
