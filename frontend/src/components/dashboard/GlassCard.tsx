import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
};

export default function GlassCard({ children, className = "", title, action }: Props) {
  return (
    <section className={`agro-panel rounded-xl p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="agro-panel-title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
