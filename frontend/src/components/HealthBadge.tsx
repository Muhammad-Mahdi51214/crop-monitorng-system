const styles: Record<string, string> = {
  green: "border border-[#BEE1C4] bg-[#E3F2E5] text-[#1E7A34]",
  yellow: "border border-[#F1CF9B] bg-[#FCEFD9] text-[#A86510]",
  red: "border border-[#F3C1C1] bg-[#FBE2E2] text-[#D64545]",
  gray: "border border-[#D8D9E8] bg-[#EDEDF6] text-[#7C7FA6]",
};

type Props = {
  color: string;
  label: string;
  large?: boolean;
};

export default function HealthBadge({ color, label, large }: Props) {
  const tone = styles[color] ?? styles.gray;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${tone} ${
        large ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          color === "green"
            ? "bg-[#1E7A34]"
            : color === "yellow"
              ? "bg-[#E8A33D]"
              : color === "red"
                ? "bg-[#D64545]"
                : "bg-[#7C7FA6]"
        }`}
      />
      {label}
    </span>
  );
}
