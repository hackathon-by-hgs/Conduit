'use client';

import { useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import {
  ArrowRight,
  CaretUpDown,
  Check,
  FileCode,
  FloppyDisk,
  IdentificationBadge,
  MagnifyingGlass,
  ShieldWarning,
  UserCircle,
} from '@phosphor-icons/react';
import { ALL_SCOPES, ENTITIES, INITIAL_GRANTS, SCOPE_GROUPS, getScope, type AccessEntity } from './access-data';
import { PermissionInspector, useInspectorResize, type InspectorEvent } from './permission-inspector';
import { AccessTopology } from './access-topology';
import { CapabilitySurface } from './capability-surface';
import { MagneticFillButton } from './magnetic-fill-button';
import { ScopeViewSwitcher, type ScopeView } from './scope-view-switcher';
import { SimulationLane } from './simulation-lane';

type PendingGrant = { scopeId: string; entityIds: string[] } | null;
type SearchSuggestion = {
  id: string;
  label: string;
  kicker: string;
  detail: string;
  onChoose: () => void;
};

const INITIAL_HISTORY: InspectorEvent[] = [
  { id: 'history-1', action: 'Published', detail: 'Production SDK policy v1.4.2', time: '2m ago', tone: 'success' },
  { id: 'history-2', action: 'Modified', detail: 'events:stream granted to Team Alpha', time: '19m ago' },
  { id: 'history-3', action: 'Rotated', detail: 'KEY-001 credential material', time: '2d ago', tone: 'warning' },
  { id: 'history-4', action: 'Created', detail: 'Team Beta access entity', time: '8d ago' },
];
export function ScopeManager() {
  const rootRef = useRef<HTMLElement>(null);
  const viewPanelRef = useRef<HTMLDivElement>(null);
  const [entities] = useState<AccessEntity[]>(ENTITIES);
  const [grants, setGrants] = useState<Record<string, string[]>>(() => structuredClone(INITIAL_GRANTS));
  const [selectedGroup, setSelectedGroup] = useState('events');
  const [_selectedScope, setSelectedScope] = useState('events:read');
  const [selectedCapability, setSelectedCapability] = useState('events');
  const [requestedOpenGroup, setRequestedOpenGroup] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ScopeView>('permissions');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [focusedEntity, setFocusedEntity] = useState('team-alpha');
  const [connected, setConnected] = useState(true);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const entityDropdownRef = useRef<HTMLDivElement>(null);
  const entityMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entityDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (entityDropdownRef.current && !entityDropdownRef.current.contains(e.target as Node)) {
        setEntityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [entityDropdownOpen]);

  useEffect(() => {
    if (!searchFocused || !searchDropdownRef.current) return;

    gsap.fromTo(
      searchDropdownRef.current,
      { autoAlpha: 0, y: -8, scale: 0.98, transformOrigin: 'top center' },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' },
    );
  }, [searchFocused]);

  useEffect(() => {
    if (!entityDropdownOpen || !entityMenuRef.current) return;

    gsap.fromTo(
      entityMenuRef.current,
      { autoAlpha: 0, y: -6, scale: 0.98, transformOrigin: 'top right' },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' },
    );
  }, [entityDropdownOpen]);

  useEffect(() => {
    if (!viewPanelRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.fromTo(
      viewPanelRef.current,
      { autoAlpha: 0.88, y: 8, filter: 'blur(5px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.24, ease: 'power2.out' },
    );
  }, [activeView]);
  const [lastChanged, setLastChanged] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [unpublished, setUnpublished] = useState(false);
  const [_lastSaved, setLastSaved] = useState('2m ago');
  const [pendingGrant, setPendingGrant] = useState<PendingGrant>(null);
  const [history, setHistory] = useState<InspectorEvent[]>(INITIAL_HISTORY);
  const [notice, setNotice] = useState<string | null>(null);
  const [generationKey, setGenerationKey] = useState(0);
  const { width: inspectorWidth, startResize } = useInspectorResize();

  const focused = entities.find((entity) => entity.id === focusedEntity) ?? entities[0];
  const focusedGrants = grants[focused.id] ?? [];
  const effectiveGrants = connected ? focusedGrants : [];

  const focusCapability = (capabilityId: string, scopeId: string) => {
    setSelectedCapability(capabilityId);
    setSelectedScope(scopeId);
    const group = SCOPE_GROUPS.find((item) => item.scopes.some((scope) => scope.id === scopeId));
    if (group) setSelectedGroup(group.id);
    setActiveView('permissions');
  };

  const scrollPermissionGroupIntoView = (groupId: string) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = rootRef.current?.querySelector<HTMLElement>(`[data-policy-group="${groupId}"]`);
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        gsap.fromTo(
          target,
          { backgroundColor: 'rgba(160,16,22,0.08)' },
          { backgroundColor: 'rgba(160,16,22,0)', duration: 0.9, ease: 'power2.out' },
        );
      });
    });
  };

  const requestPermissionGroupOpen = (groupId: string) => {
    setRequestedOpenGroup(null);
    window.requestAnimationFrame(() => setRequestedOpenGroup(groupId));
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
    const group = SCOPE_GROUPS.find((item) => (
      item.label.toLowerCase().includes(query)
      || item.id.toLowerCase().includes(query)
      || item.scopes.some((itemScope) => itemScope.id.includes(query))
      || (scope ? item.scopes.some((itemScope) => itemScope.id === scope.id) : false)
    ));
    if (group) {
      const matchedScope = scope && group.scopes.some((item) => item.id === scope.id)
        ? scope.id
        : group.scopes[0].id;
      focusCapability(group.id, matchedScope);
      requestPermissionGroupOpen(group.id);
      scrollPermissionGroupIntoView(group.id);
      setSearchQuery('');
      showNotice(`Focused ${group.label}`);
      return;
    }

    showNotice(`No SDK capability matched "${searchQuery.trim()}"`);
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const baseSearchSuggestions: SearchSuggestion[] = [
    ...SCOPE_GROUPS.map((group) => ({
      id: `group-${group.id}`,
      label: group.label,
      kicker: 'Permission group',
      detail: `${group.scopes.length} SDK operations`,
        onChoose: () => {
          focusCapability(group.id, group.scopes[0].id);
          requestPermissionGroupOpen(group.id);
          scrollPermissionGroupIntoView(group.id);
          setSearchQuery('');
          setSearchFocused(false);
          showNotice(`Focused ${group.label}`);
      },
    })),
    ...ALL_SCOPES.map((scope) => {
      const group = SCOPE_GROUPS.find((item) => item.scopes.some((itemScope) => itemScope.id === scope.id));

      return {
        id: `scope-${scope.id}`,
        label: scope.id,
        kicker: group?.label ?? 'Scope',
        detail: scope.description,
        onChoose: () => {
          focusCapability(group?.id ?? selectedCapability, scope.id);
          if (group) {
            requestPermissionGroupOpen(group.id);
            scrollPermissionGroupIntoView(group.id);
          }
          setSearchQuery('');
          setSearchFocused(false);
          showNotice(`Focused ${scope.id}`);
        },
      };
    }),
    ...entities.map((entity) => ({
      id: `entity-${entity.id}`,
      label: entity.label,
      kicker: entity.type === 'team' ? 'Team entity' : 'API key entity',
      detail: entity.id,
      onChoose: () => {
        setFocusedEntity(entity.id);
        setSearchQuery('');
        setSearchFocused(false);
        showNotice(`Context switched to ${entity.label}`);
      },
    })),
  ];
  const searchSuggestions = baseSearchSuggestions
    .filter((item) => (
      !normalizedSearchQuery
      || item.label.toLowerCase().includes(normalizedSearchQuery)
      || item.kicker.toLowerCase().includes(normalizedSearchQuery)
      || item.detail.toLowerCase().includes(normalizedSearchQuery)
    ))
    .slice(0, 9);

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

  const _updateConnection = (nextConnected: boolean) => {
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
    <main ref={rootRef} className="relative flex h-[calc(100dvh-118px)] min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-r-[28px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/94 to-black/96 sm:h-[calc(100dvh-24px)] xl:flex-row">
      <section className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-visible xl:rounded-l-[28px]">
        <header className="relative z-[120] shrink-0 overflow-visible border-b border-white/[0.07] bg-gradient-to-r from-[#080808]/96 via-[#0b0b0b]/96 to-black/96">
          <div data-command-head className="relative z-[130] grid min-h-[76px] grid-cols-1 items-center gap-[14px] px-5 py-3.5 md:grid-cols-[auto_minmax(260px,1fr)_auto] md:gap-[18px]">
            <div className="min-w-[190px]">
              {/* <span>Control center</span> */}
              <h1 className="mt-1.5 font-sans text-[19px] font-semibold text-[#f5faf7]">SDK Policy Engine</h1>
            </div>

            <div className="relative z-[170] min-w-0">
              <form
                className={[
                  'group relative grid h-12 items-center gap-2.5 overflow-hidden rounded-2xl border px-3 transition-[background-color,border-color] duration-200 focus-within:border-[#A01016]/75 focus-within:bg-white/[0.045]',
                  searchFocused
                    ? 'border-[#A01016]/75 bg-white/[0.045]'
                    : 'border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.045]',
                ].join(' ')}
                style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}
                onSubmit={(event) => {
                  event.preventDefault();
                  executeSearch();
                  setSearchFocused(false);
                }}
              >
                <MagnifyingGlass weight="bold" className={['h-[17px] w-[17px] transition-colors duration-200', searchFocused ? 'text-[#e2f0e7]/62' : 'text-[#e2f0e7]/50'].join(' ')} />
                <input
                  className="w-full min-w-0 appearance-none border-0 bg-transparent text-[13px] font-sans text-[#f4faf6] outline-none placeholder:text-[#e2f0e7]/30 focus:!outline-none focus-visible:!outline-none focus-visible:!ring-0 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                  placeholder="Search capabilities, scopes, entities..."
                  aria-label="Search SDK capabilities"
                  aria-expanded={searchFocused}
                  aria-controls="sdk-search-panel"
                />
                <kbd className={['font-mono text-[8px] uppercase tracking-[0.08em] transition-colors duration-200', searchFocused ? 'text-white/45' : 'text-[#e2f0e7]/30'].join(' ')}>Enter</kbd>
              </form>

              {searchFocused ? (
                <div
                  ref={searchDropdownRef}
                  id="sdk-search-panel"
                  role="listbox"
                  aria-label="SDK search results"
                  onMouseDown={(event) => event.preventDefault()}
                  className="absolute left-0 right-0 top-[calc(100%+10px)] z-[260] overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#070807]/96 backdrop-blur-2xl"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3.5 py-3">
                    <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                      Search index
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">
                      {searchSuggestions.length} result{searchSuggestions.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="access-scroll max-h-[360px] overflow-y-auto p-1.5">
                    {searchSuggestions.length ? searchSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        onClick={item.onChoose}
                        className="group/search flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition-[background-color,color,transform] duration-150 hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-white/[0.04] text-white/42 transition-colors duration-150 group-hover/search:bg-[#A01016]/15 group-hover/search:text-[#f06b71]">
                          <MagnifyingGlass weight="bold" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-sans text-[13px] font-semibold text-white/84 group-hover/search:text-white">
                            {item.label}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-white/38">
                            {item.detail}
                          </span>
                        </span>
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[7.5px] font-semibold uppercase tracking-[0.12em] text-white/34">
                          {item.kicker}
                        </span>
                      </button>
                    )) : (
                      <div className="px-4 py-8 text-center">
                        <p className="font-sans text-[13px] font-semibold text-white/72">No matching capability</p>
                        <p className="mt-1 text-[11px] text-white/34">Try a group, SDK scope, team, or key name.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {/* ── Custom entity dropdown ─────────────────────── */}
              <div ref={entityDropdownRef} className="relative z-[150]">
                {/* Trigger */}
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={entityDropdownOpen}
                  onClick={() => setEntityDropdownOpen((o) => !o)}
                  className={[
                    'group flex h-[46px] min-w-[168px] items-center gap-2.5 rounded-full border px-3.5',
                    entityDropdownOpen
                      ? 'border-white/[0.09] bg-[#101010]/96'
                      : 'border-transparent bg-white/[0.035] hover:bg-white/[0.055]',
                  ].join(' ')}
                >
                  {/* Entity-type icon badge */}
                  <span className={[
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
                    focused.type === 'team'
                      ? 'bg-[#A01016]/12 text-[#d14a51]'
                      : 'bg-white/[0.045] text-white/55',
                  ].join(' ')}>
                    {focused.type === 'team'
                      ? <UserCircle weight="fill" className="h-[18px] w-[18px]" />
                      : <IdentificationBadge weight="fill" className="h-[18px] w-[18px]" />}
                  </span>

                  {/* Label */}
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="font-mono text-[7.5px] font-bold uppercase tracking-[0.2em] text-white/30">Entity</span>
                    <span className="mt-0.5 truncate font-sans text-[13px] font-bold leading-none text-white">{focused.label}</span>
                  </span>

                  {/* Caret */}
                  <CaretUpDown
                    weight="bold"
                    className={['h-3.5 w-3.5 flex-shrink-0 transition-all duration-200', entityDropdownOpen ? 'text-white/60' : 'text-white/25'].join(' ')}
                  />
                </button>

                {/* Floating panel */}
                {entityDropdownOpen && (
                  <div
                    ref={entityMenuRef}
                    role="listbox"
                    aria-label="Select entity"
                    className="absolute right-0 top-[calc(100%+10px)] z-[260] min-w-[264px] overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#050505]/98 backdrop-blur-2xl"
                  >
                    {/* Panel header */}
                    <div className="border-b border-white/[0.07] bg-white/[0.018] px-4 py-3">
                      <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-white/30">
                        Select access entity
                      </p>
                    </div>

                    {/* Options */}
                    <div className="p-2">
                      {entities.map((entity) => {
                        const active = entity.id === focused.id;
                        return (
                          <button
                            key={entity.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => { setFocusedEntity(entity.id); setEntityDropdownOpen(false); }}
                            className={[
                              'group relative flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left',
                              active
                                ? 'bg-[#A01016]/16 text-white'
                                : 'text-white/58 hover:bg-white/[0.055] hover:text-white',
                            ].join(' ')}
                          >
                            {active ? <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-[#A01016]" aria-hidden="true" /> : null}
                            {/* Icon */}
                            <span className={[
                              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] transition-colors',
                              active
                                ? (entity.type === 'team'
                                    ? 'bg-[#A01016]/22 text-[#ff747b]'
                                    : 'bg-white/[0.06] text-white/70')
                                : 'bg-white/[0.035] text-white/34 group-hover:bg-white/[0.055] group-hover:text-white/62',
                            ].join(' ')}>
                              {entity.type === 'team'
                                ? <UserCircle weight="fill" className="h-[18px] w-[18px]" />
                                : <IdentificationBadge weight="fill" className="h-[18px] w-[18px]" />}
                            </span>

                            {/* Text */}
                            <span className="flex min-w-0 flex-1 flex-col">
                              <strong className="block truncate font-sans text-[13px] font-semibold leading-tight">
                                {entity.label}
                              </strong>
                              <span className="mt-1 font-mono text-[8.5px] text-white/34">
                                {entity.type === 'team' ? 'Team' : 'API Key'}
                              </span>
                            </span>

                            {/* Active checkmark */}
                            {active && (
                              <Check weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-[#a01016]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {/* <button
                type="button"
                className="os-notification-command"
                aria-label="Show policy notifications"
                onClick={() => showNotice(`${history.length} policy events in this session`)}
              >
                <Bell weight="bold" />
                <span>{history.length}</span>
              </button> */}
            </div>
          </div>

          <div className="flex min-h-[58px] flex-col items-stretch justify-center gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between md:py-1.5">
            <ScopeViewSwitcher value={activeView} onChange={setActiveView} />

            <div className="flex w-full flex-col gap-2 md:ml-auto md:w-auto md:flex-row md:flex-nowrap md:items-center">
              <span data-status-label className="flex h-[46px] min-w-[120px] items-center rounded-full bg-[#A01016]/10 p-1.5 pr-4 transition-opacity">
                <span className="mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/5 text-white/50"><Check weight="bold" /></span>
                <span className="flex flex-col justify-center"><small className="font-sans text-[10px] font-semibold text-white/40">Policy</small><strong className="font-sans text-[12px] font-bold text-[#A01016]">{status}</strong></span>
              </span>

              <div className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:flex-wrap md:items-center">
                <MagneticFillButton type="button" onClick={generatePolicy} fillClassName="bg-[#A01016]" contentClassName="h-full w-full justify-start" className="group flex h-[46px] min-w-[150px] items-center rounded-full bg-white/[0.045] p-1.5 pr-4 text-white hover:bg-white/[0.075] md:min-w-[150px]">
                  <span className="mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/[0.07] text-white/54 transition-colors group-hover:text-white/90"><FileCode weight="bold" /></span>
                  <span className="flex flex-col justify-center text-left"><strong className="font-sans text-[11px] font-black uppercase tracking-widest text-white/90">Generate</strong><small className="font-sans text-[8px] font-bold uppercase tracking-widest text-white/40">SDK policy</small></span>
                </MagneticFillButton>
                <MagneticFillButton
                  type="button"
                  onClick={saveChanges}
                  disabled={!dirty}
                  fillClassName="bg-[#A01016]"
                  contentClassName="h-full w-full justify-start"
                  className={[
                    'group flex h-[46px] min-w-[120px] items-center rounded-full p-1.5 pr-4 disabled:pointer-events-none md:min-w-[130px]',
                    dirty
                      ? 'bg-white/[0.075] text-white hover:bg-white/[0.105]'
                      : 'bg-white/[0.018] text-white/34 opacity-55',
                  ].join(' ')}
                >
                  <span className={['mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-full transition-colors', dirty ? 'bg-white/[0.08] text-white/78 group-hover:text-white' : 'bg-white/[0.035] text-white/22'].join(' ')}><FloppyDisk weight="bold" /></span>
                  <span className="flex flex-col justify-center text-left"><strong className={['font-sans text-[11px] font-black uppercase tracking-widest', dirty ? 'text-white/95' : 'text-white/38'].join(' ')}>Save</strong><small className={['font-sans text-[8px] font-bold uppercase tracking-widest', dirty ? 'text-white/48' : 'text-white/22'].join(' ')}>Draft</small></span>
                </MagneticFillButton>
                <MagneticFillButton
                  type="button"
                  onClick={publish}
                  disabled={!unpublished}
                  fillClassName="bg-[#A01016]"
                  contentClassName="h-full w-full justify-start"
                  className={[
                    'group flex h-[46px] min-w-[140px] items-center rounded-full p-1.5 pr-4 disabled:pointer-events-none md:min-w-[140px]',
                    unpublished
                      ? 'bg-[#A01016] text-white hover:bg-[#bd151d]'
                      : 'bg-white/[0.018] text-white/34 opacity-55',
                  ].join(' ')}
                >
                  <span className={['mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-full transition-colors', unpublished ? 'bg-white/12 text-white group-hover:bg-white/18' : 'bg-white/[0.035] text-white/22'].join(' ')}><ArrowRight weight="bold" /></span>
                  <span className="flex flex-col justify-center text-left"><strong className={['font-sans text-[11px] font-black uppercase tracking-widest', unpublished ? 'text-white' : 'text-white/38'].join(' ')}>Publish</strong><small className={['font-sans text-[8px] font-bold uppercase tracking-widest', unpublished ? 'text-white/62' : 'text-white/22'].join(' ')}>Move live</small></span>
                </MagneticFillButton>
              </div>
            </div>
          </div>
        </header>

        <div
          data-permission-scroll
          className="access-scroll relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-transparent"
        >
          <div ref={viewPanelRef} className="relative w-full min-w-0">
            {activeView === 'permissions' ? (
              <CapabilitySurface
                selectedId={selectedCapability}
                focusedLabel={focused.label}
                grants={focusedGrants}
                editing={dirty}
                requestedOpenGroup={requestedOpenGroup}
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
                  if (group?.scopes[0]) focusCapability(group.id, group.scopes[0].id);
                  else {
                    setSelectedGroup(groupId);
                    setActiveView('permissions');
                  }
                  requestPermissionGroupOpen(groupId);
                  scrollPermissionGroupIntoView(groupId);
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


function CriticalGrantModal({ scopeId, count, onCancel, onConfirm }: { scopeId: string; count: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="critical-grant-backdrop fixed inset-0 z-[110] grid place-items-center p-4" onMouseDown={onCancel}>
      <div className="critical-grant-panel vault-panel w-full max-w-lg p-5 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <ShieldWarning className="h-8 w-8 text-red-300" weight="duotone" />
        <p className="mt-5 font-mono text-[8px] uppercase tracking-[0.24em] text-red-300/65">Critical permission</p>
        <h2 className="mt-2 break-all font-mono text-xl font-semibold text-white">{scopeId}</h2>
        <p className="mt-3 text-sm leading-6 text-white/45">This permission can mutate production policy or credentials. It will be granted to {count} access {count === 1 ? 'entity' : 'entities'}.</p>
        <div className="mt-6 flex justify-end gap-2">
          <MagneticFillButton type="button" onClick={onCancel} fillClassName="bg-[#A01016]" className="rounded-[12px] border border-white/15 bg-white/[0.02] px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/60 hover:border-[#A01016]/40 hover:text-white"><span>Cancel</span></MagneticFillButton>
          <MagneticFillButton type="button" onClick={onConfirm} fillClassName="bg-[#A01016]" className="flex items-center gap-2 rounded-[12px] border border-red-400/70 bg-red-500/15 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-red-100 hover:bg-red-500/25"><Check className="h-3.5 w-3.5" weight="bold" /> <span>Confirm grant</span></MagneticFillButton>
        </div>
      </div>
    </div>
  );
}
