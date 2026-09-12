/**
 * Demo prompts shown on the dashboard and the empty chat state.
 *
 * `message` is what gets sent to the Store Manager. `title` / `description`
 * are the shorter card copy — the five featured cards are the ones a demo
 * should start from.
 */

export interface DemoPrompt {
  title: string;
  description: string;
  message: string;
}

export const featuredPrompts: DemoPrompt[] = [
  {
    title: "What needs restocking today?",
    description: "Find products that need attention right now.",
    message: "What products do I need to restock today?",
  },
  {
    title: "What will run out next week?",
    description: "Predict upcoming stock-outs before they happen.",
    message: "Which products are likely to run out in the next 7 days?",
  },
  {
    title: "Who should I buy from?",
    description: "Compare vendors on price, reliability and delivery time.",
    message: "Which vendor gives me the best combination of price and reliability?",
  },
  {
    title: "Prepare my next purchase order",
    description: "Turn inventory needs into an actionable procurement plan.",
    message: "Prepare a purchase order for the most urgent stock-outs.",
  },
  {
    title: "Give me my morning briefing",
    description: "Tell me what needs my attention today.",
    message: "Give me my morning store briefing.",
  },
];

/** Secondary chips — the rest of the 15-prompt demo set. */
export const morePrompts = [
  "What should I reorder this week?",
  "Why do you think I need to reorder Tata Salt?",
  "How much Tata Salt should I order?",
  "Who should I buy Tata Salt from?",
  "Find the best vendor for Aashirvaad Atta.",
  "Can I get a cheaper supplier for Fortune Sunflower Oil?",
  "Have any of my suppliers increased their prices recently?",
  "Show me my pending procurement decisions.",
  "Create a purchase recommendation for the products that need urgent restocking.",
  "What inventory is sitting unsold in my store?",
] as const;

/** Messages for the five featured cards, used wherever a flat list is enough. */
export const suggestedPrompts = featuredPrompts.map((prompt) => prompt.message);

export function chatHref(prompt: string): string {
  return `/chat?q=${encodeURIComponent(prompt)}`;
}
