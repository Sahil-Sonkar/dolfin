import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatView } from "@/components/chat/chat-view";
import { Card } from "@/components/ui/card";
import { NotConfiguredState } from "@/components/ui/states";
import { getMerchantId, isPhiniteConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Ask Dolfin" };

export const dynamic = "force-dynamic";

export default function ChatPage() {
  if (!isPhiniteConfigured()) {
    return (
      <Card>
        <NotConfiguredState surface="Ask Dolfin" />
      </Card>
    );
  }

  return (
    // useSearchParams needs a Suspense boundary above it.
    <Suspense fallback={null}>
      <ChatView merchantId={getMerchantId()} />
    </Suspense>
  );
}
