"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { logger } from '@/shared/utils/logger';

export type AgentState = "idle" | "thinking" | "streaming";

export interface ToolCallBlock {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  summary?: string;
}

export interface ContentBlock {
  type: "text" | "tool_call" | "thinking";
  content?: string;
  call?: ToolCallBlock;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  blocks: ContentBlock[];
  timestamp?: number;
}

/**
 * useAgentStream — drives the Neural Expressive UI.
 *
 * Sends user prompts to the Zavorth gateway chat/completions endpoint
 * and consumes the SSE stream, mapping lifecycle events to visual states.
 *
 * The hook owns:
 *  - messages[]        — full chat history rendered by ExpressiveResponseRenderer
 *  - agentState        — drives SparkIndicator & PromptBar animations
 *  - sendMessage()     — callable from ExpressivePromptBar.onSubmit
 *  - stopGeneration()  — abort an in-flight stream
 */
export function useAgentStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const idCounter = useRef(0);

  const nextId = () => {
    idCounter.current += 1;
    return `msg-${Date.now()}-${idCounter.current}`;
  };

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAgentState("idle");
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Append user message
      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        blocks: [{ type: "text", content: text }],
        timestamp: Date.now(),
      };

      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setAgentState("thinking");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "auto",
            messages: [
              ...messages.map((m) => ({
                role: m.role,
                content: m.blocks
                  .filter((b) => b.type === "text")
                  .map((b) => b.content)
                  .join("\n"),
              })),
              { role: "user", content: text },
            ],
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = res.ok ? "No response body" : `Error ${res.status}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, blocks: [{ type: "text", content: `⚠ ${errText}` }] }
                : m
            )
          );
          setAgentState("idle");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        setAgentState("streaming");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                fullText += delta.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, blocks: [{ type: "text", content: fullText }] }
                      : m
                  )
                );
              }

              // Map tool_calls from the delta if present
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name) {
                    const toolBlock: ContentBlock = {
                      type: "tool_call",
                      call: {
                        id: tc.id || `tc-${Date.now()}`,
                        name: tc.function.name,
                        status: "running",
                      },
                    };
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, blocks: [...m.blocks, toolBlock] }
                          : m
                      )
                    );
                  }
                }
              }
            } catch (error) { // Ignore malformed SSE chunks logger.warn('[use Agent Stream] operation failed', error); }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled — leave current text in place
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    blocks: [
                      ...m.blocks,
                      { type: "text", content: "\n\n⚠ Connection lost." },
                    ],
                  }
                : m
            )
          );
        }
      } finally {
        abortRef.current = null;
        setAgentState("idle");
      }
    },
    [messages]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    messages,
    agentState,
    sendMessage,
    stopGeneration,
  };
}
