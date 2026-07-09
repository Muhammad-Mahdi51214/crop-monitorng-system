import Link from "next/link";
import type { FieldSummary } from "@/lib/api";
import HealthBadge from "./HealthBadge";

type Props = {
  field: FieldSummary;
};

export default function FieldCard({ field }: Props) {
  const status = field.latestStatus;

  return (
    <Link
      href={`/fields/${field.id}`}
      className="block rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-emerald-950">{field.name}</h2>
          <p className="text-sm capitalize text-emerald-700">{field.cropType}</p>
        </div>
        <HealthBadge color={status?.color ?? "gray"} label={status?.label ?? "Not checked"} />
      </div>
      <p className="mt-3 text-sm text-emerald-800">
        {status?.message ?? "Tap to open and check satellite health."}
      </p>
      {status?.analyzedAt && (
        <p className="mt-2 text-xs text-emerald-600">
          Updated {new Date(status.analyzedAt).toLocaleDateString()}
        </p>
      )}
    </Link>
  );
}
