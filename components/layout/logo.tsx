import { cn } from "@/lib/utils";

/**
 * A dolphin arc over a waterline — a mark rather than a robot, so the product
 * reads as a store tool that happens to be intelligent.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-6", className)}
    >
      <path
        d="M3.2 15.4c2.1 0 2.1 1.5 4.2 1.5s2.1-1.5 4.2-1.5 2.1 1.5 4.2 1.5 2.1-1.5 4.2-1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M5.6 12.6c1.4-5 5-7.4 9.6-7.4-.9 1.5-1.2 2.6-1 3.6 2.3.3 3.6 1.6 4.2 3.4-1.6-.6-2.7-.5-3.4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
