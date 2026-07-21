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
    <section ref={rootRef} className="w-full bg-transparent p-5 sm:p-6">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-6 border-b border-white/[0.07] pb-[18px]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Access topology</p>
          <h2 className="mt-[5px] font-sans text-[26px] font-semibold leading-[1.08] tracking-[-0.015em] text-white/90">See what this identity can reach</h2>
        </div>
        <span className="whitespace-nowrap font-mono text-[9px] text-white/40">{activeEndpointCount} of {ENDPOINTS.length} routes open</span>
      </div>

      <div className="access-scroll w-full max-w-full overflow-y-hidden overflow-x-auto rounded-[22px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4">
        <div
          className="relative h-[590px] w-full min-w-[920px] overflow-hidden rounded-[18px] !bg-black/[0.18]"
        >
          <div className="absolute z-[2] font-mono text-[9px] uppercase tracking-[0.16em] !text-white/40" style={{ left: `${(ENTITY.x / STAGE.width) * 100}%`, top: 16 }}>Identity</div>
          <div className="absolute z-[2] font-mono text-[9px] uppercase tracking-[0.16em] !text-white/40" style={{ left: `${(GROUP.x / STAGE.width) * 100}%`, top: 16 }}>Permission groups</div>
          <div className="absolute z-[2] font-mono text-[9px] uppercase tracking-[0.16em] !text-white/40" style={{ left: `${(ENDPOINT.x / STAGE.width) * 100}%`, top: 16 }}>API routes</div>

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
            className="absolute z-[3] flex flex-col justify-center rounded-[18px] !bg-[#95040956] p-4 text-white border !border-[#A01016]/40 backdrop-blur-[3px] transition-[background-color] duration-200"
            style={frameStyle(ENTITY)}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/70">Simulating</span>
            <div className="my-[7px] flex items-center gap-[10px]">
              <UsersThree weight="duotone" className="h-5 w-5" />
              <strong className="text-[17px] leading-none">{entity.label}</strong>
            </div>
            <small className="font-mono text-[9px] text-white/80">{entity.type}</small>
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
                  'absolute z-[3] grid items-center gap-3 overflow-hidden rounded-[18px] border border-transparent px-[15px] py-[11px] text-left transition-[background-color,border-color,color] duration-200',
                  'hover:bg-black/55 hover:text-white !border-[#46030563]',
                  isSelected
                    ? '!border-[#A01016] !bg-[#2a0202c6] !text-white'
                    : isActive
                      ? 'bg-[#000000] !text-white/85'
                      : '!bg-[#000000] !text-white/45',
                ].join(' ')}
                style={{
                  gridTemplateColumns: '28px 1fr',
                  ...frameStyle({ x: GROUP.x, y: group.top, width: GROUP.width, height: GROUP.height }),
                }}
              >
                <span className={['font-mono text-[10px]', isSelected ? 'text-white/70' : 'text-white/40'].join(' ')}>{group.id}</span>
                <div>
                  <strong className={['block text-[14px]', isSelected ? 'text-white' : 'text-white/80'].join(' ')}>{group.label}</strong>
                  <small className={['mt-[3px] block text-[10px]', isSelected ? 'text-white/65' : 'text-white/40'].join(' ')}>
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
                  'absolute z-[3] flex items-center justify-between rounded-[18px] border border-transparent px-[16px] transition-[background-color,border-color,color] duration-200',
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
                  <strong className="truncate text-[13px] text-white/80">{endpoint.path.split('/').pop()}</strong>
                  <small className="mt-[2px] truncate font-mono text-[9px] text-white/40">{endpoint.method} {endpoint.path}</small>
                </div>
                <i className={['ml-3 flex-shrink-0 text-white/25', isAllowed ? '!text-[#A01016]' : ''].join(' ')}>
                  <Key weight={isAllowed ? 'fill' : 'regular'} className="h-[18px] w-[18px]" />
                </i>
              </div>
            );
          })}

          <Graph className="pointer-events-none absolute bottom-4 left-4 h-24 w-24 text-white/[0.03]" weight="thin" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-6 px-[10px]">
        <div className="flex items-center gap-2">
          <span className="block h-0.5 w-6 bg-[#A01016]/70" />
          <strong className="font-sans text-[11px] font-medium text-white/40">Allowed route</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="block h-0.5 w-6 bg-white/10" />
          <span className="font-sans text-[11px] font-medium text-white/40">Blocked route</span>
        </div>
      </div>
    </section>
  );
}
