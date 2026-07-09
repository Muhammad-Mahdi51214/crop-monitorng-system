import type { SpatialStats } from "@/lib/api";

type ZoneRowProps = {
  title: string;
  meaning: string;
  goodLabel: string;
  goodPercent: number;
  goodAreaHa: number;
  lowLabel: string;
  lowPercent: number;
  lowAreaHa: number;
  moderatePercent: number;
};

function ZoneRow({
  title,
  meaning,
  goodLabel,
  goodPercent,
  goodAreaHa,
  lowLabel,
  lowPercent,
  lowAreaHa,
  moderatePercent,
}: ZoneRowProps) {
  return (
    <div className="agro-zone-card">
      <h3>{title}</h3>
      <p>{meaning}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[#1E7A34]">Healthy</dt>
          <dd className="font-semibold text-[#1A1F1C]">
            {goodPercent}% · {goodAreaHa} ha
          </dd>
          <dd className="text-xs text-[#5C6B63]">{goodLabel}</dd>
        </div>
        <div>
          <dt className="text-[#D64545]">Needs attention</dt>
          <dd className="font-semibold text-[#1A1F1C]">
            {lowPercent}% · {lowAreaHa} ha
          </dd>
          <dd className="text-xs text-[#5C6B63]">{lowLabel}</dd>
        </div>
        <div>
          <dt className="text-[#7C7FA6]">In between</dt>
          <dd className="font-semibold text-[#1A1F1C]">{moderatePercent}%</dd>
        </div>
      </dl>
    </div>
  );
}

type Props = {
  stats: SpatialStats | null | undefined;
  cropType: string;
  summary?: string | null;
};

export default function FieldHealthSummary({ stats, cropType, summary }: Props) {
  if (!stats) {
    return (
      <section className="agro-report-panel">
        <div className="agro-report-panel-header">
          <h2 className="agro-report-panel-title">Field health breakdown</h2>
          <p className="agro-report-panel-subtitle">
            Run a satellite check to see how much of your field is healthy vs stressed.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="agro-report-panel">
      <div className="agro-report-panel-header">
        <h2 className="agro-report-panel-title">Field health breakdown</h2>
        <p className="agro-report-panel-subtitle">
          About {stats.fieldAreaHa} ha total · {stats.analyzedAreaHa} ha with clear
          satellite data · {cropType} crop
        </p>
        {summary && <p className="agro-summary-box">{summary}</p>}
      </div>

      <div className="space-y-3 p-5">
        <ZoneRow
          title="Greenness (crop cover)"
          meaning="Shows how lush and green the crop is across your field."
          goodLabel={stats.greenness.goodLabel}
          goodPercent={stats.greenness.goodPercent}
          goodAreaHa={stats.greenness.goodAreaHa}
          lowLabel={stats.greenness.lowLabel}
          lowPercent={stats.greenness.lowPercent}
          lowAreaHa={stats.greenness.lowAreaHa}
          moderatePercent={stats.greenness.moderatePercent}
        />
        <ZoneRow
          title="Chlorophyll (leaf vigor)"
          meaning="Shows how strong the leaves are — linked to nutrients and plant health."
          goodLabel={stats.chlorophyll.goodLabel}
          goodPercent={stats.chlorophyll.goodPercent}
          goodAreaHa={stats.chlorophyll.goodAreaHa}
          lowLabel={stats.chlorophyll.lowLabel}
          lowPercent={stats.chlorophyll.lowPercent}
          lowAreaHa={stats.chlorophyll.lowAreaHa}
          moderatePercent={stats.chlorophyll.moderatePercent}
        />
        <ZoneRow
          title="Water stress"
          meaning="Shows where plants may be short of moisture."
          goodLabel={stats.waterStress.goodLabel}
          goodPercent={stats.waterStress.goodPercent}
          goodAreaHa={stats.waterStress.goodAreaHa}
          lowLabel={stats.waterStress.lowLabel}
          lowPercent={stats.waterStress.lowPercent}
          lowAreaHa={stats.waterStress.lowAreaHa}
          moderatePercent={stats.waterStress.moderatePercent}
        />

        <p className="text-sm text-[#5C6B63]">
          Ask AgroAI: <em>&quot;What should I do for my {cropType} field?&quot;</em>
        </p>
      </div>
    </section>
  );
}
