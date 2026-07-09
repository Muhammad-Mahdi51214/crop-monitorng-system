"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Message = { role: "user" | "assistant"; text: string };

type Props = {
  fieldId: string;
  fieldName?: string;
  variant?: "light" | "dark";
  compact?: boolean;
  fullHeight?: boolean;
};

function greeting(fieldName?: string) {
  if (fieldName) {
    return `Hi! Ask me about "${fieldName}" or any of your fields by name (e.g. GIS_02). I'll check real satellite data before I answer.`;
  }
  return "Hi! Name a field (e.g. GIS_02) or ask about a crop — I'll use your real field data.";
}

export default function ChatPanel({
  fieldId,
  fieldName,
  variant = "light",
  compact,
  fullHeight,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: greeting(fieldName) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessages([{ role: "assistant", text: greeting(fieldName) }]);
  }, [fieldId, fieldName]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setLoading(true);

    const history = nextMessages
      .slice(0, -1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const { reply } = await api.chat(text, {
        fieldId,
        activeFieldName: fieldName,
        history,
      });
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong. Try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const isDark = variant === "dark";

  return (
    <div
      className={`flex flex-col gap-3 ${fullHeight ? "min-h-0 flex-1" : ""} ${isDark ? "agro-chat-dark" : ""}`}
    >
      {fieldName && (
        <p className="shrink-0 px-1 text-xs text-slate-500">
          Map focus: <span className="font-medium text-[#1A1F1C]">{fieldName}</span>
          {" · "}
          Ask about any field by name
        </p>
      )}
      <div
        className={`space-y-3 overflow-y-auto rounded-xl p-4 ${
          isDark ? "agro-chat-messages" : "bg-[#F7F9F7]"
        } ${fullHeight ? "min-h-0 flex-1" : compact ? "max-h-40" : "max-h-64"}`}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user"
                ? `ml-8 rounded-2xl rounded-br-sm px-3 py-2 ${
                    isDark ? "agro-chat-user" : "bg-[#1E7A34] text-white"
                  }`
                : `mr-8 rounded-2xl rounded-bl-sm px-3 py-2 ${
                    isDark
                      ? "agro-chat-bot"
                      : "bg-white text-[#1A1F1C] shadow-sm"
                  }`
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <p className={`text-sm ${isDark ? "text-white/60" : "text-[#5C6B63]"}`}>
            Checking your field data...
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={fieldName ? `Ask about ${fieldName} or another field…` : "How's my field doing?"}
          className={`flex-1 rounded-xl border px-4 py-2 text-sm outline-none ${
            isDark
              ? ""
              : "border-[#D9E0DB] text-[#1A1F1C] focus:border-[#2A7D82] focus:ring-2 focus:ring-[#2A7D82]/20"
          }`}
        />
        <button
          type="button"
          onClick={send}
          disabled={loading}
          className={`rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            isDark ? "" : "bg-[#1E7A34] text-white transition-colors duration-200 hover:bg-[#155C27]"
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
