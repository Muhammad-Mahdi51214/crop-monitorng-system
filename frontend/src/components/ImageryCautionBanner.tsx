"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  className?: string;
  variant?: "caution" | "info" | "error";
  onDismiss?: () => void;
};

const VARIANT_STYLES = {
  caution: "border-[#F1CF9B] bg-[#FCEFD9] text-[#A86510]",
  info: "border-[#D8D9E8] bg-[#EDEDF6] text-[#4C506E]",
  error: "border-[#F3C1C1] bg-[#FBE2E2] text-[#D64545]",
};

export default function ImageryCautionBanner({
  message,
  className = "",
  variant = "caution",
  onDismiss,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [message]);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${VARIANT_STYLES[variant]} ${className}`}
      role="status"
    >
      <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M12 9v5" strokeLinecap="round" />
          <path d="M12 17h.01" strokeLinecap="round" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-lg leading-none opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100"
        aria-label="Dismiss message"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
