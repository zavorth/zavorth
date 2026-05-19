"use client";

import { SparkIndicator } from "@/shared/components/expressive/SparkIndicator";
import { ExpressivePromptBar } from "@/shared/components/expressive/ExpressivePromptBar";
import { ExpressiveResponseRenderer } from "@/shared/components/expressive/ExpressiveResponseRenderer";
import { useAgentStream } from "@/shared/components/expressive/useAgentStream";

/**
 * ExpressiveChatPage — the Neural Expressive premium chat interface.
 *
 * Full-screen dark canvas with:
 *  - A geometric Spark indicator that reacts to agent lifecycle
 *  - Modular, glassmorphic response blocks
 *  - A floating pill-shaped prompt bar at the bottom
 */
export default function ExpressiveChatPage() {
  const { messages, agentState, sendMessage, stopGeneration } = useAgentStream();

  const hasMessages = messages.length > 0;

  return (
    <div className="expressive-canvas flex flex-col">
      {/* ─── Content area ─── */}
      <div className="relative z-10 flex flex-1 flex-col items-center">
        {/* Empty state — centered spark with welcome */}
        {!hasMessages && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
            <SparkIndicator state={agentState} size={120} />

            <div className="text-center max-w-md">
              <h1
                className="text-3xl font-semibold tracking-tight"
                style={{ color: "var(--expressive-text)" }}
              >
                Zavorth
              </h1>
              <p
                className="mt-3 text-sm leading-6"
                style={{ color: "var(--expressive-text-muted)" }}
              >
                Ask naturally. I'll show a preview, reason through it, and leave
                a receipt you can inspect later.
              </p>
            </div>

            {/* Quick action chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "Organize my day",
                "Review a repository",
                "What is ready?",
                "Connect a channel",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="glass-panel-sm px-4 py-2 text-xs font-medium transition-all hover:border-[rgba(255,255,255,0.12)] hover:scale-[1.02]"
                  style={{ color: "var(--expressive-text-muted)" }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation view */}
        {hasMessages && (
          <div className="flex w-full flex-1 flex-col">
            {/* Compact spark in header when chatting */}
            <div className="sticky top-0 z-20 flex items-center justify-center py-4">
              <SparkIndicator state={agentState} size={40} />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pb-32 custom-scrollbar">
              <div className="mx-auto max-w-3xl">
                <ExpressiveResponseRenderer
                  messages={messages}
                  isStreaming={agentState === "streaming"}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Floating prompt bar (self-positioning) ─── */}
      <ExpressivePromptBar
        onSubmit={agentState === "idle" ? sendMessage : stopGeneration}
        disabled={false}
        agentState={agentState}
        placeholder={
          agentState === "thinking"
            ? "Zavorth is reasoning..."
            : agentState === "streaming"
              ? "Zavorth is responding..."
              : "Ask Zavorth anything..."
        }
      />
    </div>
  );
}
