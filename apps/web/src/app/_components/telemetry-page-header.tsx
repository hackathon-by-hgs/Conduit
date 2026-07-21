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
    <header data-route-card className="relative grid min-h-[162px] grid-cols-1 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#080808]/98 via-[#0b0b0b]/96 to-black/98 md:grid-cols-[minmax(0,1fr)_290px] lg:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.58fr)]">
      <span className="absolute left-8 top-0 h-[3px] w-[108px] rounded-b-full bg-[#A01016]" aria-hidden="true" />
      <div className="flex min-w-0 flex-col justify-center px-5 py-7 md:px-9 md:py-8">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.22em] text-white/36">{eyebrow}</p>
        <h1 className="mt-3 max-w-[760px] break-words font-sans text-[clamp(28px,7vw,38px)] font-[650] leading-[0.98] tracking-[-0.055em] text-white md:text-[clamp(32px,3.2vw,46px)]">{title}</h1>
        <span className="mt-3 max-w-[640px] text-[13px] leading-[1.6] text-white/52">{description}</span>
      </div>

      <div className="relative grid min-w-0 grid-cols-1 bg-white/[0.025] md:border-l md:border-white/[0.07] lg:grid-cols-2">
        <div className="flex min-w-0 flex-col justify-center px-5 pb-10 pt-6 md:p-7 lg:border-r lg:border-white/[0.07]">
          <Pulse weight="bold" className="mb-4 h-6 w-6 text-[#A01016] md:mb-5" />
          <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/34">System mode</span>
          <strong className="mt-2 font-sans text-[15px] font-semibold capitalize text-white/92">{status}</strong>
        </div>
        {metric ? (
          <div className="hidden min-w-0 flex-col justify-center p-7 lg:flex">
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/34">{metric.label}</span>
            <strong className="mt-2.5 font-mono text-[clamp(26px,2.8vw,38px)] font-medium tracking-[-0.05em] text-white/92">{metric.value}</strong>
          </div>
        ) : null}
        <div className="absolute bottom-5 left-6 right-6 flex gap-[3px]" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} className={`block h-[2.5px] w-full -skew-x-[18deg] ${index < 7 ? 'bg-[#A01016]' : 'bg-white/[0.09]'}`} />)}
        </div>
      </div>
    </header>
  );
}
