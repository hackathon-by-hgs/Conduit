'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { Key, UsersThree } from '@phosphor-icons/react';
import {
  SCOPE_GROUPS,
  type AccessEntity,
  type RiskLevel,
} from './access-data';

gsap.registerPlugin(useGSAP);

type PermissionEditorProps = {
  entities: AccessEntity[];
  focusedEntity: AccessEntity;
  grants: string[];
  selectedGroup: string;
  selectedScope: string;
  connected: boolean;
  onFocus: (entityId: string) => void;
  onGroupChange: (groupId: string) => void;
  onSelectScope: (scopeId: string) => void;
  onToggle: (scopeId: string) => void;
  onConnectionChange: (connected: boolean) => void;
};

const GROUP_DESCRIPTIONS: Record<string, string> = {
  events: 'Read event records, filter history, and subscribe to live updates.',
  sends: 'Inspect delivery attempts and control replay operations.',
  reconciliation: 'Review consistency reports, gaps, and audit exports.',
  stats: 'Read aggregate reliability metrics and export snapshots.',
  admin: 'Manage ingestion, SDK policy, and production credentials.',
};

export function PermissionEditor(props: PermissionEditorProps) {
  const {
    entities,
    focusedEntity,
    grants,
    selectedGroup,
    selectedScope,
    connected,
    onFocus,
    onGroupChange,
    onSelectScope,
    onToggle,
    onConnectionChange,
  } = props;
  const rootRef = useRef<HTMLElement>(null);
  const group = SCOPE_GROUPS.find((item) => item.id === selectedGroup) ?? SCOPE_GROUPS[0];
  const activeInGroup = group.scopes.filter((scope) => grants.includes(scope.id)).length;

  useGSAP(
    () => {
      gsap.fromTo(
        '[data-permission-row]',
        { y: 6, opacity: 0.72 },
        { y: 0, opacity: 1, duration: 0.28, stagger: 0.04, ease: 'power2.out' },
      );
    },
    { scope: rootRef, dependencies: [selectedGroup] },
  );

  return (
    <section ref={rootRef} className="simple-permission-editor">
      <div className="simple-section-heading">
        <div>
          <p>Permissions</p>
          <h2>Access for {focusedEntity.label}</h2>
        </div>
        <span>{grants.length} of 18 allowed</span>
      </div>

      <div className="entity-picker">
        <div className="entity-picker-label">
          <span>Access entity</span>
          <strong>{focusedEntity.type === 'team' ? 'Team' : 'API key'}</strong>
        </div>

        <div className="access-scroll entity-picker-options">
          {entities.map((entity) => {
            const Icon = entity.type === 'team' ? UsersThree : Key;
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => onFocus(entity.id)}
                className={focusedEntity.id === entity.id ? 'is-active' : ''}
              >
                <Icon className="h-4 w-4" weight="duotone" />
                {entity.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={connected}
          onClick={() => onConnectionChange(!connected)}
          className={`access-master-switch ${connected ? 'is-active' : ''}`}
        >
          <span aria-hidden="true"><i /></span>
          <strong>{connected ? 'Access enabled' : 'Access paused'}</strong>
        </button>
      </div>

      <div className="permission-editor-body">
        <nav className="permission-categories" aria-label="Permission categories">
          {SCOPE_GROUPS.map((item) => {
            const active = item.scopes.filter((scope) => grants.includes(scope.id)).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onGroupChange(item.id)}
                className={item.id === group.id ? 'is-active' : ''}
              >
                <span>{item.label}</span>
                <small>{active}/{item.scopes.length}</small>
              </button>
            );
          })}
        </nav>

        <div className="permission-list-panel">
          <header>
            <div>
              <h3>{group.label}</h3>
              <p>{GROUP_DESCRIPTIONS[group.id]}</p>
            </div>
            <span>{activeInGroup} allowed</span>
          </header>

          <div className="permission-list">
            {group.scopes.map((scope) => {
              const granted = grants.includes(scope.id);
              const selected = scope.id === selectedScope;
              return (
                <div
                  key={scope.id}
                  data-permission-row
                  className={`permission-list-row ${selected ? 'is-selected' : ''}`}
                  onClick={() => onSelectScope(scope.id)}
                >
                  <div className="permission-copy">
                    <div>
                      <strong>{scope.label}</strong>
                      <RiskLabel risk={scope.risk} />
                    </div>
                    <p>{scope.description}</p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={granted}
                    aria-label={`${granted ? 'Block' : 'Allow'} ${scope.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectScope(scope.id);
                      onToggle(scope.id);
                    }}
                    className={`permission-toggle ${granted ? 'is-active' : ''}`}
                  >
                    <span aria-hidden="true"><i /></span>
                    {granted ? 'Allowed' : 'Blocked'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function RiskLabel({ risk }: { risk: RiskLevel }) {
  if (risk === 'low') return null;

  return <span className={`permission-risk is-${risk}`}>{risk} risk</span>;
}
