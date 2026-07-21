'use client';

import { Graph, Play, ShieldCheck, type Icon } from '@phosphor-icons/react';

export type ScopeView = 'permissions' | 'test' | 'topology';

type ScopeViewSwitcherProps = {
  value: ScopeView;
  onChange: (view: ScopeView) => void;
};

const VIEWS: Array<{ id: ScopeView; label: string; icon: Icon }> = [
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  { id: 'test', label: 'Test request', icon: Play },
  { id: 'topology', label: 'Topology', icon: Graph },
];

export function ScopeViewSwitcher({ value, onChange }: ScopeViewSwitcherProps) {
  const sliderPosition = value === 'permissions'
    ? 'translate-x-0'
    : value === 'test'
      ? 'translate-x-full'
      : 'translate-x-[200%]';

  return (
    <nav aria-label="SDK access views">
      <div className="relative grid w-full min-w-[320px] max-w-[460px] grid-cols-3 gap-0 overflow-hidden rounded-full bg-white/[0.04] p-1" role="tablist">
        <span className={`pointer-events-none absolute bottom-1 left-1 top-1 z-0 w-[calc((100%_-_8px)_/_3)] rounded-full bg-[#a01016] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sliderPosition}`} aria-hidden="true" />
        {VIEWS.map((view) => {
          const Icon = view.icon;
          const active = value === view.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(view.id)}
              className={`relative z-10 flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 bg-transparent px-3.5 py-2.5 font-sans text-[13px] font-semibold transition-colors duration-200 ${active ? 'text-[#f5f5f5]' : 'text-[#e2f0e7]/45 hover:text-[#f5faf7]/90'}`}
            >
              <Icon weight={active ? 'fill' : 'regular'} className="h-4 w-4" />
              <span>{view.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
