'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  ArrowRight,
  Bell,
  Check,
  FileCode,
  FloppyDisk,
  MagnifyingGlass,
  Power,
  ShieldWarning,
} from '@phosphor-icons/react';
import { ALL_SCOPES, ENTITIES, INITIAL_GRANTS, SCOPE_GROUPS, getScope, type AccessEntity } from './access-data';
import { CAPABILITIES } from './control-data';
import { PermissionInspector, useInspectorResize, type InspectorEvent } from './permission-inspector';
import { AccessTopology } from './access-topology';
import { CapabilitySurface } from './capability-surface';
import { ScopeViewSwitcher, type ScopeView } from './scope-view-switcher';
import { SimulationLane } from './simulation-lane';

gsap.registerPlugin(useGSAP);

type PendingGrant = { scopeId: string; entityIds: string[] } | null;

const INITIAL_HISTORY: InspectorEvent[] = [
  { id: 'history-1', action: 'Published', detail: 'Production SDK policy v1.4.2', time: '2m ago', tone: 'success' },
  { id: 'history-2', action: 'Modified', detail: 'events:stream granted to Team Alpha', time: '19m ago' },
  { id: 'history-3', action: 'Rotated', detail: 'KEY-001 credential material', time: '2d ago', tone: 'warning' },
  { id: 'history-4', action: 'Created', detail: 'Team Beta access entity', time: '8d ago' },
];

export function ScopeManager() {
  const rootRef = useRef<HTMLElement>(null);
  const [entities] = useState<AccessEntity[]>(ENTITIES);
  const [grants, setGrants] = useState<Record<string, string[]>>(() => structuredClone(INITIAL_GRANTS));
  const [selectedGroup, setSelectedGroup] = useState('events');
  const [_selectedScope, setSelectedScope] = useState('events:read');
  const [selectedCapability, setSelectedCapability] = useState('events');
  const [activeView, setActiveView] = useState<ScopeView>('permissions');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedEntity, setFocusedEntity] = useState('team-alpha');
  const [connected, setConnected] = useState(true);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [unpublished, setUnpublished] = useState(false);
  const [lastSaved, setLastSaved] = useState('2m ago');
  const [pendingGrant, setPendingGrant] = useState<PendingGrant>(null);
  const [history, setHistory] = useState<InspectorEvent[]>(INITIAL_HISTORY);
  const [notice, setNotice] = useState<string | null>(null);
  const [generationKey, setGenerationKey] = useState(0);
  const { width: inspectorWidth, startResize } = useInspectorResize();

  const focused = entities.find((entity) => entity.id === focusedEntity) ?? entities[0];
  const focusedGrants = grants[focused.id] ?? [];
  const effectiveGrants = connected ? focusedGrants : [];
  useGSAP(
    () => {
      gsap.from('[data-command-head] > *', {
        y: 8,
        opacity: 0.84,
        stagger: 0.08,
        duration: 0.52,
        ease: 'power3.out',
      });
    },
    { scope: rootRef },
  );

  const focusCapability = (capabilityId: string, scopeId: string) => {
    setSelectedCapability(capabilityId);
    setSelectedScope(scopeId);
    const group = SCOPE_GROUPS.find((item) => item.scopes.some((scope) => scope.id === scopeId));
    if (group) setSelectedGroup(group.id);
    setActiveView('permissions');
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 1800);
  };

  const executeSearch = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    const entity = entities.find((item) => (
      item.label.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    ));
    if (entity) {
      setFocusedEntity(entity.id);
      setSearchQuery('');
      showNotice(`Context switched to ${entity.label}`);
      return;
    }

    const scope = ALL_SCOPES.find((item) => (
      item.id.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
    ));
    const capability = CAPABILITIES.find((item) => (
      item.title.toLowerCase().includes(query)
      || item.id.toLowerCase().includes(query)
      || item.scopes.some((scopeId) => scopeId.includes(query))
      || (scope ? item.scopes.includes(scope.id) : false)
    ));

    if (capability) {
      focusCapability(capability.id, scope?.id ?? capability.scopes[0]);
      setSearchQuery('');
      showNotice(`Focused ${capability.title}`);
      return;
    }

    const group = SCOPE_GROUPS.find((item) => item.label.toLowerCase().includes(query));
    if (group) {
      const mappedCapability = CAPABILITIES.find((item) => item.scopes.includes(group.scopes[0].id));
      focusCapability(mappedCapability?.id ?? selectedCapability, group.scopes[0].id);
      setSearchQuery('');
      showNotice(`Focused ${group.label}`);
      return;
    }

    showNotice(`No SDK capability matched "${searchQuery.trim()}"`);
  };

  const pushHistory = (action: string, detail: string, tone: InspectorEvent['tone'] = 'neutral') => {
    setHistory((current) => [
      { id: `history-${Date.now()}-${Math.random()}`, action, detail, time: 'now', tone },
      ...current,
    ]);
  };

  const registerChange = (scopeId: string, granted: boolean, entityLabel = focused.label) => {
    setLastChanged(scopeId);
    setDirty(true);
    setUnpublished(true);
    pushHistory(granted ? 'Granted' : 'Revoked', `${scopeId} ${granted ? 'granted to' : 'revoked from'} ${entityLabel}`, granted ? 'success' : 'warning');
    window.setTimeout(() => setLastChanged((current) => (current === scopeId ? null : current)), 900);
  };

  const applyGrant = (scopeId: string, entityIds: string[], value = true) => {
    setGrants((current) => {
      const next = { ...current };
      entityIds.forEach((entityId) => {
        const scopes = new Set(next[entityId] ?? []);
        if (value) scopes.add(scopeId);
        else scopes.delete(scopeId);
        next[entityId] = [...scopes];
      });
      return next;
    });
    const targetLabel = entityIds.length === 1
      ? entities.find((entity) => entity.id === entityIds[0])?.label ?? focused.label
      : `${entityIds.length} access entities`;
    registerChange(scopeId, value, targetLabel);
  };

  const toggleScope = (scopeId: string, entityId = focused.id) => {
    setSelectedScope(scopeId);
    const group = SCOPE_GROUPS.find((item) => item.scopes.some((scope) => scope.id === scopeId));
    if (group) setSelectedGroup(group.id);

    const granted = grants[entityId]?.includes(scopeId) ?? false;
    const scope = getScope(scopeId);
    if (!granted && scope.risk === 'critical') {
      setPendingGrant({ scopeId, entityIds: [entityId] });
      return;
    }
    applyGrant(scopeId, [entityId], !granted);
  };

  const updateConnection = (nextConnected: boolean) => {
    setConnected(nextConnected);
    setUnpublished(true);
    setDirty(true);
    pushHistory(nextConnected ? 'Connected' : 'Disconnected', `${focused.label} permission path ${nextConnected ? 'restored' : 'interrupted'}`, nextConnected ? 'success' : 'warning');
  };

  const generatePolicy = async () => {
    const policy = JSON.stringify({ entity: focused.id, connected, permissions: effectiveGrants }, null, 2);
    await navigator.clipboard.writeText(policy);
    setGenerationKey((current) => current + 1);
    showNotice('SDK policy generated and copied');
  };

  const saveChanges = () => {
    setDirty(false);
    setLastSaved('now');
    pushHistory('Saved', `Draft policy saved for ${focused.label}`);
    setNotice('Draft saved');
    window.setTimeout(() => setNotice(null), 1500);
  };

  const publish = () => {
    const sweep = document.querySelector<HTMLElement>('.policy-publish-sweep');
    const statusLabel = rootRef.current?.querySelector<HTMLElement>('[data-status-label]');

    if (sweep) {
      gsap.fromTo(sweep, { width: 0, opacity: 1 }, {
        width: '100%',
        opacity: 1,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: () => { gsap.to(sweep, { opacity: 0, duration: 0.25 }); },
      });
    }
    const commitPublish = () => {
      setDirty(false);
      setUnpublished(false);
      setLastSaved('now');
      pushHistory('Published', `${focused.label} configuration moved to production`, 'success');
      setNotice('Configuration published');
      window.setTimeout(() => setNotice(null), 1800);
      window.requestAnimationFrame(() => {
        if (statusLabel) gsap.fromTo(statusLabel, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out' });
      });
    };

    if (statusLabel) gsap.to(statusLabel, { opacity: 0, duration: 0.15, onComplete: commitPublish });
    else commitPublish();
  };

  const status = dirty ? 'Draft' : unpublished ? 'Saved' : 'Synced';

  return (
    <main ref={rootRef} className="scope-manager flex min-h-[calc(100dvh-48px)] w-full min-w-0 max-w-full flex-col overflow-x-hidden sm:min-h-[calc(100dvh-26px)] xl:h-[calc(100dvh-26px)] xl:flex-row xl:overflow-hidden">
      <section className="scope-primary-pane flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="os-command-chassis command-chassis relative z-20 shrink-0">
          <div data-command-head className="sdk-os-header">
            <div className="os-product-heading">
              <span>Control center</span>
              <h1>SDK Policy Engine</h1>
            </div>

            <form
              className="os-capability-search"
              onSubmit={(event) => {
                event.preventDefault();
                executeSearch();
              }}
            >
              <MagnifyingGlass weight="bold" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search capabilities, scopes, entities..."
                aria-label="Search SDK capabilities"
                list="sdk-capability-options"
              />
              <kbd>Enter</kbd>
              <datalist id="sdk-capability-options">
                {CAPABILITIES.map((capability) => <option key={capability.id} value={capability.title} />)}
                {ALL_SCOPES.map((scope) => <option key={scope.id} value={scope.id} />)}
                {entities.map((entity) => <option key={entity.id} value={entity.label} />)}
              </datalist>
            </form>

            <div className="os-header-context">
              <label className="os-entity-control">
                <span>Entity</span>
                <select value={focused.id} onChange={(event) => setFocusedEntity(event.target.value)}>
                  {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="os-notification-command"
                aria-label="Show policy notifications"
                onClick={() => showNotice(`${history.length} policy events in this session`)}
              >
                <Bell weight="bold" />
                <span>{history.length}</span>
              </button>
            </div>
          </div>

          <div className="os-policy-toolbar">
            <div className="os-policy-readouts access-scroll">
              <Metric label="SDK version" value="v1.4.2" />
              <Metric label="Saved" value={lastSaved} />
              <Metric label="Changes" value={dirty ? '01' : '00'} strong={dirty} />
              <button
                type="button"
                className={`os-live-control ${connected ? 'is-live' : ''}`}
                onClick={() => updateConnection(!connected)}
              >
                <Power weight="bold" /> {connected ? 'Live' : 'Paused'}
              </button>
            </div>

            <div className="command-actions flex flex-wrap items-center gap-2">
              <span data-status-label className={`command-status-chip is-${status.toLowerCase()}`}>
                <span className="command-status-beacon"><Check weight="bold" /></span>
                <span><small>Policy</small><strong>{status}</strong></span>
              </span>

              <div className="command-dock flex flex-wrap items-center">
                <button type="button" onClick={generatePolicy} className="command-button">
                  <span className="command-button-icon"><FileCode weight="bold" /></span>
                  <span className="command-button-copy"><strong>Generate</strong><small>SDK policy</small></span>
                </button>
                <button type="button" onClick={saveChanges} disabled={!dirty} className="command-button">
                  <span className="command-button-icon"><FloppyDisk weight="bold" /></span>
                  <span className="command-button-copy"><strong>Save</strong><small>Draft</small></span>
                </button>
                <button type="button" onClick={publish} disabled={!unpublished} className={`command-button is-primary ${unpublished ? 'publish-ready' : ''}`}>
                  <span className="command-button-icon"><ArrowRight weight="bold" /></span>
                  <span className="command-button-copy"><strong>Publish</strong><small>Move live</small></span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div
          className="sdk-main-surface control-workspace access-scroll relative min-w-0 flex-1 overflow-y-auto"
        >
          <div className="scope-workspace-content relative w-full min-w-0">
            <ScopeViewSwitcher value={activeView} onChange={setActiveView} />

            {activeView === 'permissions' ? (
              <CapabilitySurface
                selectedId={selectedCapability}
                focusedLabel={focused.label}
                grants={focusedGrants}
                editing={dirty}
                onSelect={focusCapability}
                onToggle={toggleScope}
              />
            ) : null}

            {activeView === 'test' ? (
              <SimulationLane entityLabel={focused.label} grants={effectiveGrants} />
            ) : null}

            {activeView === 'topology' ? (
              <AccessTopology
                entity={focused}
                grants={effectiveGrants}
                selectedGroup={selectedGroup}
                onOpenGroup={(groupId) => {
                  const group = SCOPE_GROUPS.find((item) => item.id === groupId);
                  setSelectedGroup(groupId);
                  if (group?.scopes[0]) setSelectedScope(group.scopes[0].id);
                  setActiveView('permissions');
                }}
              />
            ) : null}
          </div>
        </div>
      </section>

      <PermissionInspector
        entity={focused}
        grants={effectiveGrants}
        lastChanged={lastChanged}
        history={history}
        generationKey={generationKey}
        width={inspectorWidth}
        onResizeStart={startResize}
      />

      {notice ? (
        <div className="policy-notice fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 rounded-[14px] border px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] sm:bottom-6">
          {notice}
        </div>
      ) : null}

      {pendingGrant ? (
        <CriticalGrantModal
          scopeId={pendingGrant.scopeId}
          count={pendingGrant.entityIds.length}
          onCancel={() => setPendingGrant(null)}
          onConfirm={() => {
            applyGrant(pendingGrant.scopeId, pendingGrant.entityIds, true);
            setPendingGrant(null);
          }}
        />
      ) : null}
    </main>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <span className="flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-white/10 pr-4"><span>{label}</span><strong className={strong ? 'font-medium text-white' : 'font-medium text-white/55'}>{value}</strong></span>;
}

function CriticalGrantModal({ scopeId, count, onCancel, onConfirm }: { scopeId: string; count: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="critical-grant-backdrop fixed inset-0 z-[110] grid place-items-center p-4" onMouseDown={onCancel}>
      <div className="critical-grant-panel vault-panel w-full max-w-lg p-5 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <ShieldWarning className="h-8 w-8 text-red-300" weight="duotone" />
        <p className="mt-5 font-mono text-[8px] uppercase tracking-[0.24em] text-red-300/65">Critical permission</p>
        <h2 className="mt-2 break-all font-mono text-xl font-semibold text-white">{scopeId}</h2>
        <p className="mt-3 text-sm leading-6 text-white/45">This permission can mutate production policy or credentials. It will be granted to {count} access {count === 1 ? 'entity' : 'entities'}.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="border border-white/15 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/50 hover:border-white/40 hover:text-white">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex items-center gap-2 border border-red-400/70 bg-red-500/15 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-red-200 hover:bg-red-500/25"><Check className="h-3.5 w-3.5" weight="bold" /> Confirm grant</button>
        </div>
      </div>
    </div>
  );
}
