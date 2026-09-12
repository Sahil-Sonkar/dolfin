"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { ChatInventoryCard } from "@/components/chat/inventory-card";
import { Thinking } from "@/components/chat/thinking";
import { Logo } from "@/components/layout/logo";
import { RecommendationCard } from "@/components/procurement/recommendation-card";
import { VendorComparison } from "@/components/vendors/vendor-comparison";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageList({
  messages,
  pending,
  onResolved,
}: {
  messages: ChatMessage[];
  pending: boolean;
  onResolved: () => void;
}) {
  return (
    <div className="space-y-7">
      {messages.map((message) =>
        message.role === "user" ? (
          <UserTurn key={message.id} message={message} />
        ) : (
          <AssistantTurn key={message.id} message={message} onResolved={onResolved} />
        ),
      )}

      {pending ? (
        <div className="flex gap-3">
          <Avatar />
          <div className="pt-1.5">
            <Thinking />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Avatar() {
  return (
    <div
      className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent"
      aria-hidden
    >
      <Logo className="size-4" />
    </div>
  );
}

function UserTurn({ message }: { message: ChatMessage }) {
  return (
    <div className="animate-rise flex justify-end">
      <div className="max-w-[min(34rem,85%)] rounded-2xl rounded-br-md bg-ink px-4 py-2.5">
        <p className="text-[14px] leading-relaxed text-white">{message.content}</p>
        <p className="mt-1 text-right text-[11px] text-white/50">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  onResolved,
}: {
  message: ChatMessage;
  onResolved: () => void;
}) {
  return (
    <div className="animate-rise flex gap-3">
      <Avatar />

      <div className="min-w-0 flex-1 space-y-3.5">
        <p
          className={cn(
            "text-[14.5px] leading-relaxed",
            message.error && "text-critical",
          )}
        >
          {message.error ? (
            <span className="inline-flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {message.content}
            </span>
          ) : (
            message.content
          )}
        </p>

        {message.inventory && message.inventory.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {message.inventory.map((item) => (
              <ChatInventoryCard key={item.productId} item={item} />
            ))}
          </div>
        ) : null}

        {message.vendorRecommendation ? (
          <VendorComparison recommendation={message.vendorRecommendation} />
        ) : null}

        {message.procurementRecommendation ? (
          <div className="max-w-md">
            <RecommendationCard
              recommendation={message.procurementRecommendation}
              onResolved={onResolved}
            />
          </div>
        ) : null}

        {message.vendorRecommendation && !message.procurementRecommendation ? (
          <p className="text-[12.5px] text-ink-subtle">
            Ask Dolfin to prepare a purchase order to approve this supplier.
          </p>
        ) : null}
      </div>
    </div>
  );
}
