'use client';

import { useRef, type CSSProperties } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { Graph, Key, UsersThree } from '@phosphor-icons/react';
import { SCOPE_GROUPS, type AccessEntity } from './access-data';
import { ENDPOINTS } from './control-data';

gsap.registerPlugin(useGSAP);

type AccessTopologyProps = {
  entity: AccessEntity;
  grants: string[];
  selectedGroup: string;
  onOpenGroup: (groupId: string) => void;
};

const STAGE = { width: 820, height: 550 };
const ENTITY = { x: 22, y: 222, width: 176, height: 106 };
const GROUP = { x: 300, width: 190, height: 70 };
const GROUP_TOPS = [48, 146, 244, 342, 440];
const ENDPOINT = { x: 600, width: 198, height: 52 };
const ENDPOINT_TOPS = [42, 112, 182, 252, 322, 392, 462];

const ENDPOINT_GROUPS = ENDPOINTS.map((endpoint) => (
  SCOPE_GROUPS.find((group) => group.scopes.some((scope) => scope.id === endpoint.scope))?.id
  ?? SCOPE_GROUPS[0].id
));

export function AccessTopology({ entity, grants, selectedGroup, onOpenGroup }: AccessTopologyProps) {
  const rootRef = useRef<HTMLElement>(null);
  const activeScopes = new Set(grants);
  const grantsKey = grants.join('|');
  const activeEndpointCount = ENDPOINTS.filter((endpoint) => activeScopes.has(endpoint.scope)).length;
  const groupStates = SCOPE_GROUPS.map((group, index) => ({
    ...group,
    top: GROUP_TOPS[index],
    activeCount: group.scopes.filter((scope) => activeScopes.has(scope.id)).length,
  }));

  useGSAP(
    () => {
      const paths = gsap.utils.toArray<SVGPathElement>('[data-topology-path]');
      const nodes = gsap.utils.toArray<HTMLElement>('[data-topology-node]');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set([...paths, ...nodes], { clearProps: 'all' });
        return;
      }

      nodes.forEach((node, index) => {
        gsap.fromTo(
          node,
          { opacity: 0, y: 10, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.42, delay: index * 0.035, ease: 'power3.out' },
        );
      });

      paths.forEach((path, index) => {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length, opacity: 0.25 });
        gsap.to(path, {
          strokeDashoffset: 0,
          opacity: 1,
          duration: 0.7,
          delay: 0.12 + index * 0.028,
          ease: 'power2.inOut',
          onComplete: () => gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' }),
        });
      });
    },
    { scope: rootRef, dependencies: [entity.id, grantsKey] },
  );

  return (
    <section ref={rootRef} className="simple-access-topology">
      <div className="simple-section-heading">
        <div>
          <p>Access topology</p>
          <h2>See what this identity can reach</h2>
        </div>
        <span>{activeEndpointCount} of {ENDPOINTS.length} routes open</span>
      </div>

      <div className="topology-scroll access-scroll">
        <div className="topology-stage" style={{ width: STAGE.width, height: STAGE.height }}>
          <div className="topology-column-label" style={{ left: ENTITY.x, top: 16 }}>Identity</div>
          <div className="topology-column-label" style={{ left: GROUP.x, top: 16 }}>Permission groups</div>
          <div className="topology-column-label" style={{ left: ENDPOINT.x, top: 16 }}>API routes</div>

          <svg
            className="topology-connections"
            viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
            aria-hidden="true"
          >
            {groupStates.map((group) => {
              const targetY = group.top + GROUP.height / 2;
              const isActive = group.activeCount > 0;
              return (
                <path
                  key={`entity-${group.id}`}
                  data-topology-path
                  className={`topology-path ${isActive ? 'is-active' : ''} ${selectedGroup === group.id ? 'is-selected' : ''}`}
                  d={`M ${ENTITY.x + ENTITY.width} ${ENTITY.y + ENTITY.height / 2} C 242 ${ENTITY.y + ENTITY.height / 2}, 250 ${targetY}, ${GROUP.x} ${targetY}`}
                />
              );
            })}

            {ENDPOINTS.map((endpoint, index) => {
              const groupId = ENDPOINT_GROUPS[index];
              const groupIndex = groupStates.findIndex((group) => group.id === groupId);
              const sourceY = groupStates[groupIndex].top + GROUP.height / 2;
              const targetY = ENDPOINT_TOPS[index] + ENDPOINT.height / 2;
              const isActive = activeScopes.has(endpoint.scope);
              return (
                <path
                  key={`${endpoint.method}-${endpoint.path}`}
                  data-topology-path
                  className={`topology-path ${isActive ? 'is-active' : ''} ${selectedGroup === groupId ? 'is-selected' : ''}`}
                  d={`M ${GROUP.x + GROUP.width} ${sourceY} C 536 ${sourceY}, 550 ${targetY}, ${ENDPOINT.x} ${targetY}`}
                />
              );
            })}
          </svg>

          <div
            data-topology-node
            className="topology-origin"
            style={{ left: ENTITY.x, top: ENTITY.y, width: ENTITY.width, height: ENTITY.height }}
          >
            <span>Selected identity</span>
            <div>
              {entity.type === 'team' ? <UsersThree weight="duotone" /> : <Key weight="duotone" />}
              <strong>{entity.label}</strong>
            </div>
            <small>{grants.length} effective permissions</small>
          </div>

          {groupStates.map((group, index) => (
            <button
              key={group.id}
              type="button"
              data-topology-node
              onClick={() => onOpenGroup(group.id)}
              className={`topology-group-node ${group.activeCount ? 'is-active' : ''} ${selectedGroup === group.id ? 'is-selected' : ''}`}
              style={{ left: GROUP.x, top: group.top, width: GROUP.width, height: GROUP.height }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{group.label}</strong>
                <small>{group.activeCount} / {group.scopes.length} permissions</small>
              </div>
              <i style={{ '--topology-fill': `${(group.activeCount / group.scopes.length) * 100}%` } as CSSProperties} />
            </button>
          ))}

          {ENDPOINTS.map((endpoint, index) => {
            const groupId = ENDPOINT_GROUPS[index];
            const isActive = activeScopes.has(endpoint.scope);
            return (
              <button
                key={`${endpoint.method}-${endpoint.path}`}
                type="button"
                data-topology-node
                onClick={() => onOpenGroup(groupId)}
                className={`topology-endpoint-node ${isActive ? 'is-active' : ''}`}
                style={{ left: ENDPOINT.x, top: ENDPOINT_TOPS[index], width: ENDPOINT.width, height: ENDPOINT.height }}
              >
                <span>{endpoint.method}</span>
                <div>
                  <strong>{endpoint.path}</strong>
                  <small>{endpoint.scope}</small>
                </div>
                <i>{isActive ? 'Open' : 'Blocked'}</i>
              </button>
            );
          })}

          <Graph className="topology-watermark" weight="thin" aria-hidden="true" />
        </div>
      </div>

      <footer className="topology-legend">
        <span><i className="is-active" /> Effective access</span>
        <span><i /> Unavailable route</span>
        <strong>Select a node to edit its permissions</strong>
      </footer>
    </section>
  );
}
