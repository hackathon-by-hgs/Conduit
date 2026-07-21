import { Pulse } from '@phosphor-icons/react/dist/ssr';

type TelemetryMetric = {
  label: string;
  value: string | number;
};

type TelemetryPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  metric?: TelemetryMetric;
};

export function TelemetryPageHeader(props: TelemetryPageHeaderProps) {
  const { eyebrow, title, description, status, metric } = props;

  return (
    <header className="telemetry-page-header relative grid min-h-[230px] grid-cols-1 overflow-hidden rounded-[18px] border border-[#262626] bg-[#0c0c0c] before:absolute before:left-[28px] before:top-0 before:h-[3px] before:w-[88px] before:bg-[#a01016] sm:rounded-[24px] md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <div className="telemetry-page-title flex min-w-0 flex-col justify-center px-[24px] py-[30px] md:px-[38px] md:py-[34px]">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#666]">{eyebrow}</p>
        <h1 className="mt-[16px] max-w-[920px] break-words font-sans text-[clamp(34px,11vw,52px)] font-[650] leading-[0.98] tracking-[-0.045em] text-[#f5f5f5] md:text-[clamp(38px,5vw,68px)]">{title}</h1>
        <span className="mt-[20px] max-w-[680px] text-[15px] leading-[1.65] text-[#a3a3a3]">{description}</span>
      </div>

      <div className="telemetry-header-instrument relative grid min-w-0 grid-cols-1 border-t border-[#262626] bg-[#111] md:grid-cols-1 md:border-l md:border-t-0 lg:grid-cols-2">
        <div className="telemetry-header-status flex min-w-0 flex-col justify-center px-[24px] pb-[38px] pt-[22px] md:border-b md:border-[#262626] md:p-[28px] lg:border-b-0 lg:border-r">
          <Pulse weight="bold" className="mb-[12px] h-[30px] w-[30px] text-[#a01016] md:mb-[24px]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#666]">System mode</span>
          <strong className="mt-[8px] font-sans text-[17px] font-semibold capitalize text-[#f5f5f5]">{status}</strong>
        </div>
        {metric ? (
          <div className="telemetry-header-metric hidden min-w-0 flex-col justify-center p-[28px] lg:flex">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#666]">{metric.label}</span>
            <strong className="mt-[12px] font-mono text-[clamp(34px,4vw,56px)] font-medium tracking-[-0.05em] text-[#f5f5f5]">{metric.value}</strong>
          </div>
        ) : null}
        <div className="telemetry-segment-line absolute bottom-[22px] left-[28px] right-[28px] flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} className="block h-[3px] w-full -skew-x-[18deg] bg-[#2e2e2e] [&:nth-child(-n+7)]:bg-[#a01016]" />)}
        </div>
      </div>
    </header>
  );
}
