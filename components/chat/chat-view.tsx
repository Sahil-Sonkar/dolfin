"use client";

import { ArrowUp } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { MessageList } from "@/components/chat/message-list";
import { featuredPrompts, morePrompts } from "@/components/chat/prompts";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { DolfinApiError, sendAgentMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function ChatView({ merchantId }: { merchantId: string }) {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("q");

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);

  // Phinite returns a session identifier; passing it back keeps the
  // conversation continuous across turns.
  const conversationRef = React.useRef<string | undefined>(undefined);
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      setInput("");
      setPending(true);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "user",
          content: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);

      try {
        const response = await sendAgentMessage({
          message: trimmed,
          merchantId,
          conversationId: conversationRef.current,
        });

        if (response.sessionId) conversationRef.current = response.sessionId;

        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content: response.message,
            inventory: response.inventory,
            vendorRecommendation: response.vendorRecommendation,
            procurementRecommendation: response.procurementRecommendation,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content:
              error instanceof DolfinApiError
                ? error.message
                : "Dolfin couldn't reach the Store Manager. Please try again.",
            error: true,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setPending(false);
      }
    },
    [merchantId, pending],
  );

  // A prompt clicked on the dashboard arrives as ?q= and is sent once.
  const sentInitial = React.useRef(false);
  React.useEffect(() => {
    if (!initialPrompt || sentInitial.current) return;
    sentInitial.current = true;
    void send(initialPrompt);
  }, [initialPrompt, send]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  const empty = messages.length === 0 && !pending;

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col lg:min-h-[calc(100dvh-8rem)]">
      <div className="flex-1 pb-6">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
              <Logo className="size-6" />
            </div>
            <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em]">
              Ask Dolfin anything about your store
            </h2>
            <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-muted">
              What to restock, how much to buy, and who to buy it from.
            </p>

            <div className="mt-8 grid w-full max-w-2xl gap-2.5 text-left sm:grid-cols-2">
              {featuredPrompts.map((prompt) => (
                <button
                  key={prompt.message}
                  type="button"
                  onClick={() => void send(prompt.message)}
                  className="rounded-[--radius-card] border border-line bg-surface px-4 py-3.5 transition-colors hover:border-accent-line hover:bg-accent-soft last:sm:col-span-2"
                >
                  <span className="block text-[14px] font-medium tracking-[-0.01em] text-ink">
                    {prompt.title}
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">
                    {prompt.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {morePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            pending={pending}
            onResolved={() => {
              /* Approval state lives on the server; the card reflects it on reopen. */
            }}
          />
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 -mx-4 border-t border-line bg-canvas/90 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface px-3 py-2 focus-within:border-accent-line">
          <label htmlFor="chat-input" className="sr-only">
            Ask Dolfin anything
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Dolfin anything…"
            className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-relaxed outline-none placeholder:text-ink-subtle"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || pending}
            aria-label="Send message"
            className="rounded-xl"
          >
            <ArrowUp />
          </Button>
        </div>
      </form>
    </div>
  );
}
