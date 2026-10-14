"use client";

import { useEffect, useState } from "react";
import type { ChatStatus, UIMessage } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Spinner } from "@/components/ui/spinner";

// Show while busy until assistant text is actually streaming. Tool parts don't
// count: many render nothing, and the agent is still working after a tool call.
export function isAgentWaiting(
  status: ChatStatus,
  messages: UIMessage[],
): boolean {
  if (status === "submitted") return true;
  if (status !== "streaming") return false;
  const last = messages.at(-1);
  const lastPart = last?.role === "assistant" ? last.parts.at(-1) : undefined;
  return !(lastPart?.type === "text" && lastPart.text.trim().length > 0);
}

const PHRASES = [
  "Thinking",
  "Looking into it",
  "Checking the details",
  "Crunching the numbers",
  "Rummaging through the catalog",
  "Double-checking",
  "Connecting the dots",
  "Shipping it",
  "Almost there",
  "Putting it together",
  "Counting the inventory",
  "Checking the stockroom",
  "Reading the receipts",
  "Tallying up the orders",
  "Sorting through returns",
  "Peeking at the sales charts",
  "Asking the warehouse",
  "Dusting off the ledgers",
  "Folding the t-shirts",
  "Restocking the shelves",
  "Scanning the barcodes",
  "Wrapping it up",
  "Polishing the answer",
  "Doing the math",
  "Following the paper trail",
];

function randomIndex(exclude?: number) {
  let i = Math.floor(Math.random() * PHRASES.length);
  if (i === exclude) i = (i + 1) % PHRASES.length;
  return i;
}

export function AgentThinking() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(() => randomIndex());

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setIndex((i) => randomIndex(i)), 2400);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div
      className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <div className="relative h-5 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            className="block bg-[linear-gradient(90deg,var(--muted-foreground)_30%,var(--foreground)_50%,var(--muted-foreground)_70%)] bg-[length:200%_100%] bg-clip-text text-transparent"
            initial={{ y: 10, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              backgroundPosition: reduceMotion ? "0% 0" : ["100% 0", "-100% 0"],
            }}
            exit={{ y: -10, opacity: 0 }}
            transition={{
              duration: 0.25,
              backgroundPosition: { duration: 1.8, repeat: Infinity, ease: "linear" },
            }}
          >
            {PHRASES[index]}…
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
