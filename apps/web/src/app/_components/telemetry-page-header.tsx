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
    <header className="telemetry-page-header">
      <div className="telemetry-page-title">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>

      <div className="telemetry-header-instrument">
        <div className="telemetry-header-status">
          <Pulse weight="bold" />
          <span>System mode</span>
          <strong>{status}</strong>
        </div>
        {metric ? (
          <div className="telemetry-header-metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ) : null}
        <div className="telemetry-segment-line" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>
      </div>
    </header>
  );
}
