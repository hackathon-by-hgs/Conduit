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
  return (
    <nav className="scope-view-navigation" aria-label="SDK access views">
      <div className="scope-view-tabs" data-active-view={value} role="tablist">
        <span className="scope-view-slider" aria-hidden="true" />
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
              className={active ? 'is-active' : ''}
            >
              <Icon weight={active ? 'fill' : 'regular'} />
              <span>{view.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
