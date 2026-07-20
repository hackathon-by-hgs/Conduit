import type { AttemptDto } from '@conduit/contracts';

export function DeliveryTimeline({ attempts }: { attempts: AttemptDto[] }) {
  if (!attempts.length) {
    return <p className="telemetry-timeline-empty">No delivery attempts recorded.</p>;
  }

  return (
    <ol className="telemetry-delivery-timeline">
      {attempts.map((attempt) => {
        const failed = Boolean(attempt.error);
        return (
          <li key={attempt.id} className={failed ? 'is-failed' : 'is-complete'}>
            <span className="telemetry-attempt-node">{String(attempt.attemptNo).padStart(2, '0')}</span>
            <div className="telemetry-attempt-copy">
              <span>{failed ? 'DELIVERY FAULT' : 'DELIVERY ACKNOWLEDGED'}</span>
              <strong>{attempt.statusCode ?? 'NO RESPONSE'}</strong>
              {attempt.error ? <p>{attempt.error}</p> : <p>Endpoint accepted the delivery.</p>}
            </div>
            <div className="telemetry-attempt-readout">
              <span>LATENCY</span>
              <strong>{attempt.durationMs}<small>ms</small></strong>
              <time dateTime={attempt.at}>{new Date(attempt.at).toLocaleTimeString()}</time>
            </div>
            {attempt.nextRetryAt ? (
              <div className="telemetry-retry-marker">
                RETRY {new Date(attempt.nextRetryAt).toLocaleTimeString()}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
