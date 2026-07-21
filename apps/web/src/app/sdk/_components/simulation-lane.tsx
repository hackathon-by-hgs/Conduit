'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { Check, Play, X } from '@phosphor-icons/react';
import { ENDPOINTS } from './control-data';

gsap.registerPlugin(useGSAP);

type SimulationLaneProps = {
  entityLabel: string;
  grants: string[];
};

export function SimulationLane({ entityLabel, grants }: SimulationLaneProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [endpointIndex, setEndpointIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<'allowed' | 'denied' | null>(null);
  const endpoint = ENDPOINTS[endpointIndex];
  const allowed = grants.includes(endpoint.scope);
  const { contextSafe } = useGSAP({ scope: rootRef });

  const runTest = contextSafe(() => {
    setRunning(true);
    setResult(null);
    gsap.killTweensOf('[data-test-progress]');
    gsap.fromTo(
      '[data-test-progress]',
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1,
        duration: 0.65,
        ease: 'power2.inOut',
        onComplete: () => {
          setResult(allowed ? 'allowed' : 'denied');
          setRunning(false);
        },
      },
    );
  });

  return (
    <section ref={rootRef} className="simple-request-tester bg-transparent p-0">
      <div className="simple-section-heading mb-[16px] flex flex-wrap items-end justify-between gap-6 border-b border-[#d5ecde]/10 pb-[16px]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e2f0e7]/30">Request test</p>
          <h2 className="mt-[5px] font-sans text-[26px] font-semibold leading-[1.08] tracking-[-0.015em] text-[#f8fcf9]/90">Check access before sending a request</h2>
        </div>
        <span className="whitespace-nowrap font-mono text-[9px] text-[#e2f0e7]/30">{entityLabel}</span>
      </div>

      <div className="request-test-layout grid min-h-[390px] border-t border-[#d5ecde]/10 bg-[#080c09]/22" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 0.72fr)' }}>
        <div className="request-test-form relative border-r border-[#d5ecde]/10 p-6">
          <label>
            <span className="block font-mono text-[8px] uppercase tracking-[0.12em] text-[#e2f0e7]/38">API endpoint</span>
            <select
              className="mt-[9px] h-[48px] w-full border border-[#d5ecde]/10 bg-[#060907]/52 px-[12px] font-mono text-[10px] text-[#f5faf7]/75 outline-none"
              value={endpointIndex}
              onChange={(event) => {
                setEndpointIndex(Number(event.target.value));
                setResult(null);
              }}
            >
              {ENDPOINTS.map((item, index) => (
                <option key={`${item.method}-${item.path}`} value={index}>
                  {item.method} {item.path}
                </option>
              ))}
            </select>
          </label>

          <div className="request-scope-summary mt-[24px] border-y border-[#d5ecde]/10 py-[18px]">
            <span className="block font-mono text-[8px] uppercase tracking-[0.12em] text-[#e2f0e7]/38">Required permission</span>
            <strong className="mt-[10px] block font-mono text-[12px] font-medium text-[#f5faf7]/80">{endpoint.scope}</strong>
            <small className={`mt-[7px] block text-[10px] ${allowed ? 'is-allowed text-[#00ff94]/65' : 'text-red-400/68'}`}>
              {allowed ? 'Currently allowed' : 'Currently blocked'}
            </small>
          </div>

          <button type="button" onClick={runTest} disabled={running} className="request-test-button mt-6 flex h-[44px] w-full items-center justify-center gap-2 bg-[#f4f4f4] font-sans text-[11px] font-semibold text-[#080808] transition-colors duration-160 hover:bg-[#a01016] hover:text-white disabled:opacity-55">
            <Play className="h-4 w-4" weight="fill" />
            {running ? 'Testing request...' : 'Run test'}
          </button>
          <span data-test-progress className="request-test-progress absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#A01016]" aria-hidden="true" />
        </div>

        <div className={`request-test-result flex flex-col items-center justify-center p-[28px] text-center text-white/35 ${result ? `is-${result}` : ''} ${result === 'allowed' ? 'text-[var(--app-accent)]' : result === 'denied' ? 'text-red-400' : ''}`} aria-live="polite">
          {result === 'allowed' ? (
            <>
              <Check className="h-6 w-6" weight="bold" />
              <p className="mt-[14px] font-sans text-[23px] font-semibold text-[#f8fcf9]/90">Request allowed</p>
              <span className="mt-[7px] max-w-[230px] text-[11px] leading-[1.55] text-[#e2f0e7]/38">This credential can call the selected endpoint.</span>
              <code className="mt-[20px] font-mono text-[10px] text-[#e2f0e7]/38">200</code>
            </>
          ) : result === 'denied' ? (
            <>
              <X className="h-6 w-6" weight="bold" />
              <p className="mt-[14px] font-sans text-[23px] font-semibold text-[#f8fcf9]/90">Request blocked</p>
              <span className="mt-[7px] max-w-[230px] text-[11px] leading-[1.55] text-[#e2f0e7]/38">Grant {endpoint.scope} before sending this request.</span>
              <code className="mt-[20px] font-mono text-[10px] text-[#e2f0e7]/38">403</code>
            </>
          ) : (
            <>
              <span className="request-result-placeholder h-[24px] w-[24px] border border-white/20" />
              <p className="mt-[14px] font-sans text-[23px] font-semibold text-[#f8fcf9]/90">Ready to test</p>
              <span className="mt-[7px] max-w-[230px] text-[11px] leading-[1.55] text-[#e2f0e7]/38">No request will be sent.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
