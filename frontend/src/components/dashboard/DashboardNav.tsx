"use client";

import { useState } from "react";

export type DashboardView = "dashboard" | "crops" | "reports" | "add-field";

type Props = {
  active: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onAddField: () => void;
};

const NAV: { id: DashboardView; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "crops", label: "Crop Management" },
  { id: "reports", label: "Crop Report" },
];

export default function DashboardNav({ active, onNavigate, onAddField }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="agro-nav sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 20V10" strokeLinecap="round" />
              <path d="M12 10c0-3.5 2-6 5-7-0.1 3.3-1.2 6.1-5 7Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 13c-0.2-3-1.9-5.2-5-6 0.1 3.1 1.2 5.4 5 6Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Agro<span className="text-emerald-300">AI</span>
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                active === item.id
                  ? "bg-[#1E7A34] text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onAddField}
            className="hidden rounded-full bg-[#1E7A34] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#155C27] sm:inline-flex"
          >
            + Add field
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-500/30 text-xs">
              MM
            </span>
            <span className="text-xs text-white/80">Muhammad Mahdi</span>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-white md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open ? (
                <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setOpen(false);
                }}
                className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors duration-200 ${
                  active === item.id
                    ? "bg-[#1E7A34] text-white"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onAddField();
                setOpen(false);
              }}
              className="mt-2 rounded-xl bg-[#1E7A34] px-4 py-3 text-left text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#155C27]"
            >
              + Add field
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
