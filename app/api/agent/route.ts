import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, handleRouteError, readJson } from "@/lib/api-response";
import { runAgent } from "@/lib/phinite/client";
import type { AgentResponse } from "@/lib/types";

/**
 * The browser's only route to the Store Manager.
 *
 * The Phinite credentials stay on this side of the boundary; the client sends a
 * message and receives a normalized `AgentResponse`.
 */

const AgentRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000),
  merchantId: z.string().min(1, "Merchant is required"),
  conversationId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request): Promise<NextResponse<AgentResponse | unknown>> {
  const body = await readJson(request);
  const parsed = AgentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      "INVALID_REQUEST",
      "That request didn't look right. Please try again.",
      400,
    );
  }

  try {
    return NextResponse.json(await runAgent(parsed.data));
  } catch (error) {
    return handleRouteError("POST /api/agent", error);
  }
}
