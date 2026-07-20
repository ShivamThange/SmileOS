export function PageHeader({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap">
      <div>
        <h1 className="m-0 text-[18px] font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <div className="text-[12.5px] text-muted mt-0.5">{subtitle}</div>}
      </div>
      {aside}
    </div>
  );
}
