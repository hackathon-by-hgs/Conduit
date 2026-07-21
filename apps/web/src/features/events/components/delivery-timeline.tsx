import type { AttemptDto } from '@conduit/contracts';

export function DeliveryTimeline({ attempts }: { attempts: AttemptDto[] }) {
  if (!attempts.length) {
    return (
      <p className="px-5 py-7 font-mono text-[10px] uppercase tracking-[0.13em] text-[#666]">
        No delivery attempts recorded.
      </p>
    );
  }

  return (
    <ol className="px-4 pb-[18px] pt-2 sm:px-5">
      {attempts.map((attempt) => {
        const failed = Boolean(attempt.error);
        return (
          <li
            key={attempt.id}
            className="relative grid min-h-[100px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[#262626] py-[14px] last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-[18px]"
          >
            {/* Attempt number node */}
            <span
              className={`flex h-[38px] w-[38px] items-center justify-center rounded-full border font-mono text-[10px] text-[#f5f5f5]
                ${failed ? 'border-[#a01016] text-[#d15a5f]' : 'border-[#444]'}`}
            >
              {String(attempt.attemptNo).padStart(2, '0')}
            </span>

            {/* Attempt copy */}
            <div className="min-w-0">
              <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#666]">
                {failed ? 'DELIVERY FAULT' : 'DELIVERY ACKNOWLEDGED'}
              </span>
              <strong className="mt-[6px] block font-mono text-[18px] text-[#f5f5f5]">
                {attempt.statusCode ?? 'NO RESPONSE'}
              </strong>
              {attempt.error
                ? <p className="mt-[5px] text-[11px] text-[#a3a3a3]">{attempt.error}</p>
                : <p className="mt-[5px] text-[11px] text-[#a3a3a3]">Endpoint accepted the delivery.</p>
              }
            </div>

            {/* Readout: latency + time */}
            <div className="col-start-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-auto sm:flex-col sm:items-end sm:gap-0">
              <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#666]">LATENCY</span>
              <strong className="mt-[5px] font-mono text-[22px] text-[#f5f5f5]">
                {attempt.durationMs}<small className="text-[9px] text-[#666]">ms</small>
              </strong>
              <time dateTime={attempt.at} className="text-[9px] text-[#666]">
                {new Date(attempt.at).toLocaleTimeString()}
              </time>
            </div>

            {/* Retry marker */}
            {attempt.nextRetryAt ? (
              <div className="absolute bottom-2 right-0 font-mono text-[8px] text-[#a01016]">
                RETRY {new Date(attempt.nextRetryAt).toLocaleTimeString()}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
