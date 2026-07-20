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
    <section ref={rootRef} className="simple-request-tester">
      <div className="simple-section-heading">
        <div>
          <p>Request test</p>
          <h2>Check access before sending a request</h2>
        </div>
        <span>{entityLabel}</span>
      </div>

      <div className="request-test-layout">
        <div className="request-test-form">
          <label>
            <span>API endpoint</span>
            <select
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

          <div className="request-scope-summary">
            <span>Required permission</span>
            <strong>{endpoint.scope}</strong>
            <small className={allowed ? 'is-allowed' : ''}>
              {allowed ? 'Currently allowed' : 'Currently blocked'}
            </small>
          </div>

          <button type="button" onClick={runTest} disabled={running} className="request-test-button">
            <Play className="h-4 w-4" weight="fill" />
            {running ? 'Testing request...' : 'Run test'}
          </button>
          <span data-test-progress className="request-test-progress" aria-hidden="true" />
        </div>

        <div className={`request-test-result ${result ? `is-${result}` : ''}`} aria-live="polite">
          {result === 'allowed' ? (
            <>
              <Check className="h-6 w-6" weight="bold" />
              <p>Request allowed</p>
              <span>This credential can call the selected endpoint.</span>
              <code>200</code>
            </>
          ) : result === 'denied' ? (
            <>
              <X className="h-6 w-6" weight="bold" />
              <p>Request blocked</p>
              <span>Grant {endpoint.scope} before sending this request.</span>
              <code>403</code>
            </>
          ) : (
            <>
              <span className="request-result-placeholder" />
              <p>Ready to test</p>
              <span>No request will be sent.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
