'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { MATRIX_ACTIONS, MATRIX_ROWS } from './control-data';
import { SectionHeading } from './capability-surface';

gsap.registerPlugin(useGSAP);

type CapabilityMatrixProps = {
  grants: string[];
  selectedScope: string;
  onSelectScope: (scopeId: string) => void;
  onToggle: (scopeId: string) => void;
};

export function CapabilityMatrix(props: CapabilityMatrixProps) {
  const { grants, selectedScope, onSelectScope, onToggle } = props;
  const rootRef = useRef<HTMLElement>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const mappedCount = MATRIX_ROWS.reduce((total, row) => total + Object.keys(row.actions).length, 0);

  useGSAP(
    () => {
      gsap.from('[data-matrix-row]', {
        clipPath: 'inset(0 0 0 4%)',
        opacity: 0.84,
        duration: 0.38,
        stagger: 0.045,
        ease: 'power3.out',
      });
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} className="control-section">
      <SectionHeading
        index="03"
        label="Capability matrix"
        title="Grant actions at infrastructure scale."
        detail={`${grants.length} effective permissions`}
      />

      <div className="capability-matrix-machine">
        <div className="matrix-machine-rail">
          <span>ACTION PLANE / EFFECTIVE GRANTS</span>
          <span className="text-[var(--app-accent)]/62">SELECTED / {selectedScope}</span>
        </div>

        <div className="access-scroll overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="matrix-ledger-head">
              <div className="px-4 py-3">Capability register</div>
              {MATRIX_ACTIONS.map((action) => (
                <div
                  key={action}
                  onMouseEnter={() => setHoveredColumn(action)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  className={hoveredColumn === action ? 'is-highlighted' : ''}
                >
                  <span>{action}</span>
                  <small>{String(MATRIX_ROWS.filter((row) => row.actions[action]).length).padStart(2, '0')}</small>
                </div>
              ))}
            </div>

            {MATRIX_ROWS.map((row, rowIndex) => (
              <div
                key={row.id}
                data-matrix-row
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
                className={`matrix-ledger-row ${hoveredRow === row.id ? 'is-highlighted' : ''}`}
              >
                <div className="matrix-row-identity">
                  <span className="matrix-row-index" aria-hidden="true">{String(rowIndex + 1).padStart(2, '0')}</span>
                  <span className="relative z-10 font-mono text-[8px] text-white/20">CAP-{String(rowIndex + 1).padStart(2, '0')}</span>
                  <strong className="relative z-10 mt-auto font-display text-sm font-semibold text-white/66">{row.label}</strong>
                </div>

                {MATRIX_ACTIONS.map((action) => {
                  const scopeId = row.actions[action];
                  const granted = scopeId ? grants.includes(scopeId) : false;
                  const selected = scopeId === selectedScope;
                  const highlighted = hoveredColumn === action || hoveredRow === row.id;

                  return (
                    <div
                      key={action}
                      onMouseEnter={() => setHoveredColumn(action)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      className={`matrix-ledger-cell ${highlighted ? 'is-highlighted' : ''}`}
                    >
                      {scopeId ? (
                        <button
                          type="button"
                          aria-label={`${granted ? 'Revoke' : 'Grant'} ${scopeId}`}
                          aria-pressed={granted}
                          onClick={() => {
                            onSelectScope(scopeId);
                            onToggle(scopeId);
                          }}
                          className={`matrix-command ${granted ? 'is-granted' : ''} ${selected ? 'is-selected' : ''}`}
                        >
                          <span className="matrix-command-state" />
                          <span className="matrix-command-copy">{granted ? 'ON' : 'OFF'}</span>
                          <span className="matrix-command-code">{scopeId.split(':').at(-1)}</span>
                        </button>
                      ) : (
                        <span className="matrix-null">N/A</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="matrix-machine-footer">
          <MatrixDatum label="Mapped commands" value={String(mappedCount).padStart(2, '0')} />
          <MatrixDatum label="Effective grants" value={String(grants.length).padStart(2, '0')} accent />
          <MatrixDatum label="Policy target" value={selectedScope} wide />
        </div>
      </div>
    </section>
  );
}

function MatrixDatum({ label, value, accent = false, wide = false }: { label: string; value: string; accent?: boolean; wide?: boolean }) {
  return (
    <div className={`matrix-footer-datum ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      <strong className={accent ? 'text-[var(--app-accent)]/72' : 'text-white/52'}>{value}</strong>
    </div>
  );
}
