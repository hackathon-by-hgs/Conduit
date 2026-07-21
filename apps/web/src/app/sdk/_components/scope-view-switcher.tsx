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
    <nav className="w-full md:w-auto" aria-label="SDK access views">
      <div className="relative grid w-full min-w-0 max-w-[430px] grid-cols-3 gap-0 overflow-hidden rounded-full bg-white/[0.04] p-1 md:min-w-[320px]" role="tablist">
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
              className={`relative z-10 flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-transparent px-2 py-2 font-sans text-[11px] font-semibold transition-colors duration-200 sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-[13px] ${active ? 'text-[#f5f5f5]' : 'text-[#e2f0e7]/45 hover:text-[#f5faf7]/90'}`}
            >
              <Icon weight={active ? 'fill' : 'regular'} className="h-4 w-4" />
              <span className="hidden min-[420px]:inline">{view.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
