"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, type GeoPolygon } from "@/lib/api";
import FieldDrawMap from "./FieldDrawMap";

const CROPS = ["wheat", "rice", "cotton", "maize", "other"] as const;

type Props = {
  onCreated?: (
    id: string,
    meta: { name: string; cropType: string; boundary: GeoPolygon },
  ) => void;
  onCancel?: () => void;
};

export default function NewFieldForm({ onCreated, onCancel }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cropType, setCropType] = useState<(typeof CROPS)[number]>("wheat");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boundary = useMemo<GeoPolygon | undefined>(() => {
    if (points.length < 3) return undefined;
    return {
      type: "Polygon",
      coordinates: [[...points, points[0]]],
    };
  }, [points]);

  const canSave = Boolean(boundary && name.trim());

  async function save() {
    if (!boundary || !name.trim()) {
      setError("Name your field and draw at least 3 corners on the map.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { id } = await api.createField({
        name: name.trim(),
        cropType,
        boundary,
      });
      if (onCreated) {
        onCreated(id, {
          name: name.trim(),
          cropType,
          boundary,
        });
      } else {
        router.push(`/fields/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save field");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="agro-form-light space-y-5">
      <div className="rounded-xl border border-[#D9E0DB] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className="font-medium">Field name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Wheat Field"
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="font-medium">Crop type</span>
            <select
              value={cropType}
              onChange={(e) =>
                setCropType(e.target.value as (typeof CROPS)[number])
              }
              className="mt-1 capitalize"
            >
              {CROPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-[#F3C9C9] bg-[#FBE2E2] px-5 py-3 text-sm font-medium text-[#D64545] transition-colors duration-200 hover:bg-[#F7D3D3]"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || !canSave}
              className="agro-save-btn disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save field"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <FieldDrawMap
          points={points}
          onPointsChange={setPoints}
          className="h-[min(72vh,560px)] w-full"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-[#F3C1C1] bg-[#FBE2E2] px-4 py-3 text-sm text-[#D64545]">
          {error}
        </p>
      )}
    </div>
  );
}
