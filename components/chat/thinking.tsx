"use client";

import * as React from "react";

/**
 * Progressive loading copy.
 *
 * These are UI states, not agent telemetry. The wording stays deliberately
 * non-committal ("Checking inventory") because the Store Manager does not report
 * step-level progress — claiming a specific agent had finished would be a lie.
 */
const STAGES = [
  "Dolfin is thinking",
  "Checking inventory",
  "Analysing demand",
  "Comparing suppliers",
  "Preparing recommendation",
];

const STAGE_DURATION_MS = 3200;

export function Thinking() {
  const [stage, setStage] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      // Hold on the last stage rather than looping, which would suggest the run
      // had restarted.
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, STAGE_DURATION_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="flex items-center gap-2.5 text-[13.5px] text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="animate-thinking size-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
      </span>
      {STAGES[stage]}…
    </div>
  );
}
