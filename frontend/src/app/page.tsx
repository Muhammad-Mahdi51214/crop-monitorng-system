import { Suspense } from "react";
import AgroDashboard from "@/components/dashboard/AgroDashboard";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-white/70">
          Loading AgroAI...
        </div>
      }
    >
      <AgroDashboard />
    </Suspense>
  );
}
