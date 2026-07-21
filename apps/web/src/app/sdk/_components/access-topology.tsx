'use client';

import { useRef } from 'react';
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

const STAGE = { width: 1040, height: 590 };
const ENTITY = { x: 24, y: 242, width: 180, height: 106 };
const GROUP = { x: 342, width: 210, height: 72 };
const GROUP_TOPS = [58, 160, 262, 364, 466];
const ENDPOINT = { x: 720, width: 240, height: 56 };
const ENDPOINT_TOPS = [52, 128, 204, 280, 356, 432, 508];

const ENDPOINT_GROUPS = ENDPOINTS.map((endpoint) => (
  SCOPE_GROUPS.find((group) => group.scopes.some((scope) => scope.id === endpoint.scope))?.id
  ?? SCOPE_GROUPS[0].id
));

function frameStyle(frame: { x: number; y: number; width: number; height: number }) {
  return {
    left: `${(frame.x / STAGE.width) * 100}%`,
    top: `${(frame.y / STAGE.height) * 100}%`,
    width: `${(frame.width / STAGE.width) * 100}%`,
    height: `${(frame.height / STAGE.height) * 100}%`,
  };
}

function connectionClass(active: boolean, selected: boolean) {
  return [
    'fill-none transition-[stroke,opacity] duration-200 [stroke-linecap:round] [stroke-width:2] [vector-effect:non-scaling-stroke]',
    selected ? 'stroke-[#A01016]/85 [stroke-dasharray:9_10]' : active ? 'stroke-[#A01016]/50 [stroke-dasharray:7_12]' : 'stroke-white/10',
  ].join(' ');
}

export function AccessTopology({ entity, grants, selectedGroup, onOpenGroup }: AccessTopologyProps) {
  const rootRef = useRef<HTMLElement>(null);
  const activeScopes = new Set(grants);
  const activeEndpointCount = ENDPOINTS.filter((endpoint) => activeScopes.has(endpoint.scope)).length;
  const groupStates = SCOPE_GROUPS.map((group, index) => ({
    ...group,
    top: GROUP_TOPS[index],
    activeCount: group.scopes.filter((scope) => activeScopes.has(scope.id)).length,
  }));
  const grantSignature = grants.slice().sort().join('|');

  useGSAP(
    () => {
      const movingPaths = gsap.utils.toArray<SVGPathElement>('[data-flow="moving"]');
      if (!movingPaths.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      movingPaths.forEach((path) => {
        gsap.killTweensOf(path);
        gsap.set(path, { strokeDashoffset: 0 });
        gsap.to(path, {
          strokeDashoffset: -42,
          duration: path.dataset.selected === 'true' ? 0.85 : 1.35,
          repeat: -1,
          ease: 'none',
        });
      });
    },
    { scope: rootRef, dependencies: [grantSignature, selectedGroup] },
  );

  return (
    <section ref={rootRef} className="w-full bg-transparent p-2 sm:p-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] pb-3 sm:mb-[18px] sm:gap-6 sm:pb-[18px]">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/40 sm:text-[10px] sm:tracking-[0.2em]">Access topology</p>
          <h2 className="mt-1 max-w-[720px] font-sans text-[clamp(18px,5vw,22px)] font-semibold leading-[1.08] tracking-[-0.015em] text-white/90 sm:mt-[5px] sm:text-[clamp(20px,6vw,26px)]">See what this identity can reach</h2>
        </div>
        <span className="whitespace-nowrap font-mono text-[8px] text-white/40 sm:text-[9px]">{activeEndpointCount} of {ENDPOINTS.length} routes open</span>
      </div>

      <div className="access-scroll w-full max-w-full overflow-x-auto overflow-y-hidden rounded-[16px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-2 sm:rounded-[22px] sm:p-4">
        <div
          className="relative h-[420px] w-full min-w-[620px] overflow-hidden rounded-[14px] !bg-black/[0.18] sm:h-[500px] sm:min-w-[760px] sm:rounded-[18px] lg:h-[590px] lg:min-w-[920px]"
        >
          <div className="absolute z-[2] font-mono text-[7px] uppercase tracking-[0.14em] !text-white/40 sm:text-[9px] sm:tracking-[0.16em]" style={{ left: `${(ENTITY.x / STAGE.width) * 100}%`, top: 12 }}>Identity</div>
          <div className="absolute z-[2] font-mono text-[7px] uppercase tracking-[0.14em] !text-white/40 sm:text-[9px] sm:tracking-[0.16em]" style={{ left: `${(GROUP.x / STAGE.width) * 100}%`, top: 12 }}>Permission groups</div>
          <div className="absolute z-[2] font-mono text-[7px] uppercase tracking-[0.14em] !text-white/40 sm:text-[9px] sm:tracking-[0.16em]" style={{ left: `${(ENDPOINT.x / STAGE.width) * 100}%`, top: 12 }}>API routes</div>

          <svg
            className="absolute inset-0 z-[1] h-full w-full"
            viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {groupStates.map((group) => {
              const targetY = group.top + GROUP.height / 2;
              const isActive = group.activeCount > 0;
              return (
                <path
                  key={`entity-${group.id}`}
                  data-topology-path
                  data-flow={isActive || selectedGroup === group.id ? 'moving' : 'idle'}
                  data-selected={selectedGroup === group.id ? 'true' : 'false'}
                  className={connectionClass(isActive, selectedGroup === group.id)}
                  d={`M ${ENTITY.x + ENTITY.width} ${ENTITY.y + ENTITY.height / 2} C ${ENTITY.x + ENTITY.width + 74} ${ENTITY.y + ENTITY.height / 2}, ${GROUP.x - 74} ${targetY}, ${GROUP.x} ${targetY}`}
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
                  data-flow={isActive || selectedGroup === groupId ? 'moving' : 'idle'}
                  data-selected={selectedGroup === groupId ? 'true' : 'false'}
                  className={connectionClass(isActive, selectedGroup === groupId)}
                  d={`M ${GROUP.x + GROUP.width} ${sourceY} C ${GROUP.x + GROUP.width + 88} ${sourceY}, ${ENDPOINT.x - 88} ${targetY}, ${ENDPOINT.x} ${targetY}`}
                />
              );
            })}
          </svg>

          <div
            className="absolute z-[3] flex flex-col justify-center rounded-[14px] border !border-[#A01016]/40 !bg-[#95040956] p-2.5 text-white backdrop-blur-[3px] transition-[background-color] duration-200 sm:rounded-[18px] sm:p-4"
            style={frameStyle(ENTITY)}
          >
            <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-white/70 sm:text-[9px]">Simulating</span>
            <div className="my-1.5 flex items-center gap-2 sm:my-[7px] sm:gap-[10px]">
              <UsersThree weight="duotone" className="h-4 w-4 sm:h-5 sm:w-5" />
              <strong className="text-[12px] leading-none sm:text-[17px]">{entity.label}</strong>
            </div>
            <small className="font-mono text-[7px] text-white/80 sm:text-[9px]">{entity.type}</small>
          </div>

          {groupStates.map((group) => {
            const isActive = group.activeCount > 0;
            const isSelected = group.id === selectedGroup;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onOpenGroup(group.id)}
                className={[
                  'absolute z-[3] grid items-center gap-2 overflow-hidden rounded-[14px] border border-transparent px-2 py-1 text-left transition-[background-color,border-color,color] duration-200 sm:gap-3 sm:rounded-[18px] sm:px-[15px] sm:py-[11px]',
                  'hover:bg-black/55 hover:text-white !border-[#46030563]',
                  isSelected
                    ? '!border-[#A01016] !bg-[#2a0202c6] !text-white'
                    : isActive
                      ? 'bg-[#000000] !text-white/85'
                      : '!bg-[#000000] !text-white/45',
                ].join(' ')}
                style={{
                  gridTemplateColumns: '22px 1fr',
                  ...frameStyle({ x: GROUP.x, y: group.top, width: GROUP.width, height: GROUP.height }),
                }}
              >
                <span className={['font-mono text-[7px] sm:text-[10px]', isSelected ? 'text-white/70' : 'text-white/40'].join(' ')}>{group.id}</span>
                <div>
                  <strong className={['block text-[11px] sm:text-[14px]', isSelected ? 'text-white' : 'text-white/80'].join(' ')}>{group.label}</strong>
                  <small className={['mt-0.5 block text-[7px] sm:mt-[3px] sm:text-[10px]', isSelected ? 'text-white/65' : 'text-white/40'].join(' ')}>
                    {group.activeCount} / {group.scopes.length} allowed
                  </small>
                </div>
                <i className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
                  <span className="block h-full bg-[#A01016] transition-[width] duration-300" style={{ width: `${(group.activeCount / group.scopes.length) * 100}%` }} />
                </i>
              </button>
            );
          })}

          {ENDPOINTS.map((endpoint, index) => {
            const isAllowed = activeScopes.has(endpoint.scope);
            const parentGroup = ENDPOINT_GROUPS[index];
            const isRelatedToSelected = parentGroup === selectedGroup;

            return (
              <div
                key={`${endpoint.method}-${endpoint.path}`}
                className={[
                  'absolute z-[3] flex items-center justify-between rounded-[14px] border border-transparent px-2 transition-[background-color,border-color,color] duration-200 sm:rounded-[18px] sm:px-[16px]',
                  'hover:bg-black/55 hover:text-white !border-[#46030563]',
                  isAllowed
                    ? '!bg-black/45 !text-white/85'
                    : '!bg-black/25 !text-white/45',
                  isRelatedToSelected ? 'ring-1 ring-[#A01016]/70 ring-offset-2 ring-offset-black/80' : '',
                ].join(' ')}
                style={{
                  ...frameStyle({ x: ENDPOINT.x, y: ENDPOINT_TOPS[index], width: ENDPOINT.width, height: ENDPOINT.height }),
                }}
              >
                <div className="flex min-w-0 flex-col">
                  <strong className="truncate text-[10px] text-white/80 sm:text-[13px]">{endpoint.path.split('/').pop()}</strong>
                  <small className="mt-[2px] truncate font-mono text-[7px] text-white/40 sm:text-[9px]">{endpoint.method} {endpoint.path}</small>
                </div>
                <i className={['ml-2 flex-shrink-0 text-white/25 sm:ml-3', isAllowed ? '!text-[#A01016]' : ''].join(' ')}>
                  <Key weight={isAllowed ? 'fill' : 'regular'} className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" />
                </i>
              </div>
            );
          })}

          <Graph className="pointer-events-none absolute bottom-3 left-3 h-16 w-16 text-white/[0.03] sm:bottom-4 sm:left-4 sm:h-24 sm:w-24" weight="thin" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 px-1 sm:mt-4 sm:gap-6 sm:px-[10px]">
        <div className="flex items-center gap-2">
          <span className="block h-0.5 w-6 bg-[#A01016]/70" />
          <strong className="font-sans text-[10px] font-medium text-white/40 sm:text-[11px]">Allowed route</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="block h-0.5 w-6 bg-white/10" />
          <span className="font-sans text-[10px] font-medium text-white/40 sm:text-[11px]">Blocked route</span>
        </div>
      </div>
    </section>
  );
}
