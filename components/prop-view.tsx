export type PropViewProps = {
  label: string;
  value: string;
  normal?: boolean;
  colSpan?: number;
  marginTop?: number;
};

export function PropView({ label, value, normal, colSpan, marginTop }: PropViewProps) {
  const colSpanClass = colSpan ? `col-span-${colSpan}` : '';
  marginTop = marginTop ?? 2
  const marginTopClass = marginTop ? `mt-${marginTop}` : '';
  return (
    <div className={`bg-[#f2f2f2] rounded p-4 ${colSpanClass} ${marginTopClass}`}>
      <div>
        {label}:
      </div>
      <div className={"truncate " + (normal ? "" : "font-semibold")}>
        {value.toString()}
      </div>
    </div>
  );
}
