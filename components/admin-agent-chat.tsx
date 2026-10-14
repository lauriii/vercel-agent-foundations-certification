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
