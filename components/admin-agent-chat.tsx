"use client";

import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "./ai-elements/message";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import { AgentThinking, isAgentWaiting } from "@/components/agent-thinking";

const SUGGESTIONS = [
  "Show me low-stock items",
  "What were yesterday's top sellers?",
  "Summarize this week's revenue",
];

export function AdminAgentChat() {
  const [input, setInput] = useState("");

  const { messages, error, sendMessage, status, stop } = useChat({
    // we need to point to a different API route because this is a different agent
    transport: new WorkflowChatTransport({ api: "/api/admin/chat" }),
  });
  const waiting = isAgentWaiting(status, messages);
  const isBusy = status === "submitted" || status === "streaming";
  const handleSubmit = (message: PromptInputMessage) => {
    sendMessage({ text: input });
    setInput("");
  };
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };
  if (error) return <div>{error.message}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((m) =>
            m.parts.map((p, i) => {
              switch (p.type) {
                case "text":
                  if (!p.text.trim()) return null;
                  return (
                    <Message key={`${m.id}-${i}`} from={m.role}>
                      <MessageContent>
                        <MessageResponse>{p.text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  );
                case "tool-bash": {
                  const input = p.input as
                    | { command?: string; summary?: string }
                    | undefined;
                  const output = p.output as
                    | { stdout?: string; stderr?: string; exitCode?: number }
                    | undefined;
                  const done = p.state === "output-available";
                  const failed = done && !!output?.exitCode;
                  const summary = input?.summary ?? "Working on it";
                  // ponytail: native <details> keeps raw output collapsed for non-technical users
                  return (
                    <details
                      key={`${m.id}-${i}`}
                      className="group my-2 rounded-lg border text-sm"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-muted-foreground">
                        <span className={done ? "" : "animate-pulse"}>
                          {!done ? "⏳" : failed ? "⚠️" : "✓"}
                        </span>
                        <span>
                          {!done ? `${summary}…` : summary}
                          {failed && " (didn't work)"}
                        </span>
                        <span className="ml-auto text-xs underline-offset-2 group-open:hidden hover:underline">
                          Show details
                        </span>
                        <span className="ml-auto hidden text-xs underline-offset-2 group-open:inline hover:underline">
                          Hide details
                        </span>
                      </summary>
                      <div className="max-h-80 overflow-auto border-t bg-neutral-900 px-3 py-2 font-mono text-xs">
                        <div className="font-semibold text-neutral-100">
                          $ {input?.command}
                        </div>
                        {output?.stdout && (
                          <pre className="mt-1 whitespace-pre-wrap text-neutral-300">
                            {output.stdout}
                          </pre>
                        )}
                        {output?.stderr && (
                          <pre className="mt-1 whitespace-pre-wrap text-red-400">
                            {output.stderr}
                          </pre>
                        )}
                      </div>
                    </details>
                  );
                }
                default:
                  return null;
              }
            }),
          )}
          {waiting ? (
            <Message from="assistant">
              <MessageContent>
                <AgentThinking />
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="flex flex-col gap-3 border-t p-3">
        <Suggestions>
          {SUGGESTIONS.map((s) => (
            <Suggestion
              key={s}
              suggestion={s}
              onClick={handleSuggestionClick}
            />
          ))}
        </Suggestions>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Ask the admin agent…"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              status={status}
              onStop={stop}
              disabled={!isBusy && !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
