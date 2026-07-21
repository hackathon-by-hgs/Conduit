'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowsClockwise,
  CaretDown,
  Check,
  Copy,
  Plus,
  ShieldCheck,
  X,
} from '@phosphor-icons/react';
import { ALL_SCOPES, INITIAL_GRANTS } from './access-data';
import { MagneticFillButton, MagneticFillLink } from './magnetic-fill-button';

gsap.registerPlugin(useGSAP);

type KeyRecord = {
  id: string;
  label: string;
  created: string;
  lastUsed: string;
  team: string;
  status: 'Active' | 'Revoked';
  environment: 'Production' | 'Development' | 'Testing' | 'Legacy';
  rotation: string;
  owner: string;
  scopes: string[];
};

type ScopePreset = 'full' | 'read' | 'custom';
const TEAM_OPTIONS = ['Team Alpha', 'Team Beta'];
const PRESET_OPTIONS: ScopePreset[] = ['full', 'read', 'custom'];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const INITIAL_KEYS: KeyRecord[] = [
  {
    id: 'KEY-001',
    label: 'Primary event ingress',
    created: 'Jul 02, 2026',
    lastUsed: '18s ago',
    team: 'Team Alpha',
    status: 'Active',
    environment: 'Production',
    rotation: 'Aug 24, 2026',
    owner: 'Mara Chen',
    scopes: INITIAL_GRANTS['key-001'],
  },
  {
    id: 'KEY-002',
    label: 'Delivery observer',
    created: 'Jun 18, 2026',
    lastUsed: '11m ago',
    team: 'Team Beta',
    status: 'Active',
    environment: 'Development',
    rotation: 'Sep 01, 2026',
    owner: 'Idris Vale',
    scopes: INITIAL_GRANTS['key-002'],
  },
  {
    id: 'KEY-003',
    label: 'Replay verification',
    created: 'Jun 05, 2026',
    lastUsed: '42m ago',
    team: 'Team Alpha',
    status: 'Active',
    environment: 'Testing',
    rotation: 'Jul 28, 2026',
    owner: 'Quality Systems',
    scopes: ['events:read', 'sends:read', 'sends:replay'],
  },
  {
    id: 'KEY-004',
    label: 'Retired worker',
    created: 'May 29, 2026',
    lastUsed: '14d ago',
    team: 'Team Alpha',
    status: 'Revoked',
    environment: 'Legacy',
    rotation: 'Disabled',
    owner: 'Platform Archive',
    scopes: INITIAL_GRANTS['key-003'],
  },
];

export function KeyManager() {
  const [keys, setKeys] = useState(INITIAL_KEYS);
  const [selectedKey, setSelectedKey] = useState<KeyRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [team, setTeam] = useState('Team Alpha');
  const [preset, setPreset] = useState<ScopePreset>('read');
  const [customScopes, setCustomScopes] = useState<string[]>(['events:read']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedScopes = preset === 'full'
    ? ALL_SCOPES.map((scope) => scope.id)
    : preset === 'read'
      ? ALL_SCOPES
          .filter((scope) => scope.id.endsWith(':read') || scope.id === 'events:filter')
          .map((scope) => scope.id)
      : customScopes;

  const openConstructor = (record?: KeyRecord) => {
    setSelectedKey(null);
    setGeneratedKey(null);
    setCopied(false);
    setLabel(record ? `${record.label} rotation` : '');
    setTeam(record?.team ?? 'Team Alpha');
    setPreset(record ? 'custom' : 'read');
    setCustomScopes(record?.scopes ?? ['events:read']);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setGeneratedKey(null);
    setCopied(false);
    setLabel('');
  };

  const generateKey = () => {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const material = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const secret = `cnd_live_${material}`;
    const id = `KEY-${String(keys.length + 1).padStart(3, '0')}`;

    setKeys((current) => [
      ...current,
      {
        id,
        label: label.trim() || 'Untitled key',
        created: 'Just now',
        lastUsed: 'Never',
        team,
        status: 'Active',
        environment: 'Production',
        rotation: 'Oct 17, 2026',
        owner: 'Current operator',
        scopes: selectedScopes,
      },
    ]);
    setGeneratedKey(secret);
  };

  const copyKey = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
  };

  const toggleCustomScope = (scopeId: string) => {
    setCustomScopes((current) => (
      current.includes(scopeId)
        ? current.filter((id) => id !== scopeId)
        : [...current, scopeId]
    ));
  };

  const activeCount = keys.filter((key) => key.status === 'Active').length;

  return (
    <main
      className="relative flex h-[calc(100dvh-118px)] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-none bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 sm:h-[calc(100dvh-24px)] sm:rounded-r-[28px]"
    >
      <header className="shrink-0 border-b border-white/[0.07] bg-gradient-to-r from-[#080808]/96 via-[#0b0b0b]/96 to-black/96">
        <div className="flex min-h-0 flex-wrap items-center gap-3 px-3 py-3 sm:min-h-[96px] sm:gap-5 sm:px-5 sm:py-4 lg:px-7">
          <div className="w-full min-w-0 sm:w-auto">
            <h1 className="font-mono text-[10px] font-medium uppercase tracking-[0.32em] text-white/48 sm:text-[11px]">
              API Keys
            </h1>
            <p className="mt-2 max-w-[620px] font-body text-sm leading-5 text-white/72 sm:mt-3 sm:text-xl sm:leading-7 sm:text-white/78">
              Create and manage credentials for SDK access.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:w-auto sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <MagneticFillLink href="/sdk/scopes" fillClassName="bg-[#A01016]" className="inline-flex h-10 items-center justify-center gap-2 rounded-[15px] bg-white/[0.04] px-3 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-white/62 hover:bg-white/[0.07] hover:text-white sm:h-11 sm:rounded-2xl sm:px-4 sm:text-[9px] sm:tracking-[0.14em]">
              <ArrowLeft className="h-3.5 w-3.5" /> <span>Permissions</span>
            </MagneticFillLink>
            <MagneticFillButton type="button" onClick={() => openConstructor()} fillClassName="bg-[#A01016]" className="inline-flex h-10 items-center justify-center gap-2 rounded-[15px] bg-[#A01016] px-3 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-[#bd151d] sm:h-11 sm:rounded-2xl sm:px-4 sm:text-[9px] sm:tracking-[0.14em]">
              <Plus className="h-3.5 w-3.5" /> <span>Generate key</span>
            </MagneticFillButton>
          </div>
        </div>

        <div className="access-scroll flex h-8 items-center gap-3 overflow-x-auto bg-white/[0.025] px-3 font-mono text-[7.5px] uppercase tracking-[0.15em] text-white/48 sm:h-10 sm:gap-4 sm:px-5 sm:text-[8px] lg:px-7">
          <VaultRailDatum label="Total keys" value={String(keys.length).padStart(2, '0')} />
          <VaultRailDatum label="Active" value={String(activeCount).padStart(2, '0')} accent />
          <VaultRailDatum label="Rotation" value="90 days" />
          <span className="ml-auto hidden items-center gap-2 whitespace-nowrap text-[#d14a51] lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A01016]" /> Vault online
          </span>
        </div>
      </header>

      <div className="access-scroll relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-full min-w-0">
          <div className="flex flex-col gap-2 border-b border-white/[0.07] px-4 py-3 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between sm:gap-3 sm:px-7 sm:py-5">
            <div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/36">Credentials</p>
              <h2 className="mt-1 font-sans text-[24px] font-semibold tracking-[-0.05em] text-white sm:text-[28px]">API keys</h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">{activeCount} active</span>
          </div>

          <section className="access-scroll w-full overflow-x-auto !rounded-none !border-0 !bg-transparent">
            <div className="min-w-0 lg:min-w-[920px]">
              <div className="hidden grid-cols-[minmax(300px,1.8fr)_minmax(130px,0.75fr)_minmax(150px,0.9fr)_80px_minmax(120px,0.7fr)_120px_36px] items-center border-y border-white/[0.06] bg-[#090909]/96 px-5 py-4 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40 backdrop-blur-xl sm:px-7 lg:grid" aria-hidden="true">
                <span>Key</span>
                <span>Environment</span>
                <span>Owner</span>
                <span>Scopes</span>
                <span>Last used</span>
                <span>Status</span>
                <span />
              </div>

              <div>
                {keys.map((record, index) => (
                  <KeyModule
                    key={record.id}
                    record={record}
                    index={index}
                    onClick={() => setSelectedKey(record)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {selectedKey ? (
        <CredentialInspector
          record={selectedKey}
          onClose={() => setSelectedKey(null)}
          onRotate={() => openConstructor(selectedKey)}
          onRevoke={() => {
            setKeys((current) => current.map((key) => (
              key.id === selectedKey.id ? { ...key, status: 'Revoked' } : key
            )));
            setSelectedKey((current) => current ? { ...current, status: 'Revoked' } : current);
          }}
        />
      ) : null}

      {drawerOpen ? (
        <CredentialConstructor
          label={label}
          team={team}
          preset={preset}
          selectedScopes={selectedScopes}
          generatedKey={generatedKey}
          copied={copied}
          onLabelChange={setLabel}
          onTeamChange={setTeam}
          onPresetChange={setPreset}
          onToggleScope={toggleCustomScope}
          onGenerate={generateKey}
          onCopy={copyKey}
          onClose={closeDrawer}
        />
      ) : null}
    </main>
  );
}

function KeyModule({ record, index, onClick }: { record: KeyRecord; index: number; onClick: () => void }) {
  const active = record.status === 'Active';

  return (
    <button
      type="button"
      data-key-module
      onClick={onClick}
      className={[
        'group/key relative grid min-h-[132px] w-full grid-cols-2 items-center gap-x-4 gap-y-3 border-b border-white/[0.055] bg-transparent px-4 py-4 text-left transition-[background-color,color] duration-200 last:border-b-0 hover:bg-white/[0.025] sm:px-7 md:grid-cols-[minmax(280px,1.4fr)_minmax(120px,0.7fr)_minmax(140px,0.8fr)] lg:min-h-[92px] lg:grid-cols-[minmax(300px,1.8fr)_minmax(130px,0.75fr)_minmax(150px,0.9fr)_80px_minmax(120px,0.7fr)_120px_36px] lg:gap-0',
        active ? 'text-white/78' : 'text-white/34',
      ].join(' ')}
    >
      {active ? <span className="absolute left-0 top-1/2 h-[44px] w-[3px] -translate-y-1/2 rounded-r-full bg-[#A01016]" aria-hidden="true" /> : null}

      <div className="col-span-2 grid min-w-0 grid-cols-[34px_minmax(0,1fr)] items-center gap-4 md:col-span-1">
        <span className="font-mono text-[10px] font-medium text-white/38 transition-colors group-hover/key:text-[#d14a51]">
          K-{String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <strong className="block truncate font-sans text-[15px] font-semibold leading-none tracking-[-0.025em] text-white/88">
            {record.label}
          </strong>
          <small className="mt-2 block truncate font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-white/34">
            {record.id} / {record.team}
          </small>
        </div>
      </div>
      <span className="truncate font-sans text-[13px] font-semibold text-white/78">{record.environment}</span>
      <span className="truncate font-sans text-[13px] font-semibold text-white/78">{record.owner}</span>
      <span className="font-mono text-[13px] font-semibold text-white/84">{record.scopes.length}</span>
      <span className="font-mono text-[12px] font-semibold text-white/72">{record.lastUsed}</span>
      <span
        className={[
          'inline-flex h-8 w-fit min-w-[82px] items-center justify-center rounded-full border px-3 font-mono text-[8px] font-semibold uppercase tracking-[0.16em]',
          active ? 'border-[#A01016]/55 bg-[#A01016]/10 text-[#ff7078]' : 'border-white/[0.08] bg-white/[0.025] text-white/30',
        ].join(' ')}
      >
        {record.status}
      </span>
      <ArrowUpRight className="h-4 w-4 justify-self-end text-white/42 transition-[color,transform] duration-200 group-hover/key:translate-x-0.5 group-hover/key:-translate-y-0.5 group-hover/key:text-white/78" />
    </button>
  );
}

function CredentialInspector({
  record,
  onClose,
  onRotate,
  onRevoke,
}: {
  record: KeyRecord;
  onClose: () => void;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closingRef = useRef(false);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power2.out' });
      gsap.fromTo(
        drawerRef.current,
        { autoAlpha: 0, x: 54, scale: 0.985 },
        { autoAlpha: 1, x: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
      );
    },
    { scope: overlayRef },
  );

  const requestClose = (afterClose = onClose) => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (prefersReducedMotion()) {
      afterClose();
      return;
    }

    gsap
      .timeline({ onComplete: afterClose })
      .to(drawerRef.current, { autoAlpha: 0, x: 46, scale: 0.985, duration: 0.22, ease: 'power2.in' })
      .to(overlayRef.current, { autoAlpha: 0, duration: 0.16, ease: 'power2.out' }, '<');
  };

  const panel = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[170] flex h-[100dvh] max-h-[100dvh] justify-end overflow-hidden bg-black/58 p-0 backdrop-blur-[3px] sm:p-3"
      onMouseDown={() => requestClose()}
    >
      <aside
        ref={drawerRef}
        className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-none border border-white/[0.08] bg-[#050505]/96 text-white backdrop-blur-2xl sm:h-full sm:max-h-full sm:rounded-[24px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DrawerHeader index="02" label="Credential inspector" title={record.id} compact onClose={() => requestClose()} />

        <div className="access-scroll min-h-0 flex-1 basis-0 overflow-y-auto pb-4">
          <section className="px-5 py-5 sm:px-6">
            <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.24em] text-white/32">
              {record.environment} / {record.status}
            </span>
            <h2 className="mt-3 font-sans text-[clamp(22px,3.2vw,28px)] font-semibold leading-none tracking-[-0.05em] text-white">
              {record.label}
            </h2>
            <p className="mt-3 font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-white/36">
              {record.team} / {record.owner}
            </p>
          </section>

          <div className="grid border-y border-white/[0.07] sm:grid-cols-2">
            <InspectorMetric label="Created" value={record.created} />
            <InspectorMetric label="Last used" value={record.lastUsed} />
            <InspectorMetric label="Rotation" value={record.rotation} />
            <InspectorMetric label="Scope count" value={String(record.scopes.length).padStart(2, '0')} />
          </div>

          <section className="px-5 py-3.5 sm:px-6">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34">
                Effective scopes
              </span>
              <strong className="font-mono text-[9px] font-semibold text-white/45">{record.scopes.length}/18</strong>
            </div>
            {record.scopes.map((scope, index) => (
              <p key={scope} className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.055] py-2.5">
                <span className="font-mono text-[9px] text-white/36">{String(index + 1).padStart(2, '0')}</span>
                <code className="min-w-0 truncate font-mono text-[11px] font-semibold text-white/84">{scope}</code>
                <small className="font-mono text-[7px] font-semibold uppercase tracking-[0.14em] text-[#d14a51]">Granted</small>
              </p>
            ))}
          </section>
        </div>

        <div className="relative z-20 grid shrink-0 grid-cols-1 gap-2 border-t border-white/[0.07] bg-black/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] pt-2 backdrop-blur-xl min-[380px]:grid-cols-2 sm:bg-black/80">
          <MagneticFillButton
            type="button"
            onClick={() => requestClose(onRotate)}
            fillClassName="bg-[#A01016]"
            className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[14px] border border-[#A01016]/50 bg-[#A01016] font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-white hover:border-[#A01016] min-[390px]:gap-2 min-[390px]:text-[7.5px] sm:h-12 sm:rounded-[16px] sm:rounded-bl-[22px] sm:text-[8px] sm:tracking-[0.14em]"
          >
            <ArrowsClockwise className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" weight="bold" />
            <span className="truncate">Rotate credential</span>
          </MagneticFillButton>
          <MagneticFillButton
            type="button"
            disabled={record.status === 'Revoked'}
            onClick={onRevoke}
            fillClassName="bg-[#A01016]"
            className="inline-flex h-10 min-w-0 items-center justify-center rounded-[14px] border border-white/[0.075] bg-white/[0.035] font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-red-100/58 hover:border-[#A01016]/55 hover:bg-white/[0.045] hover:text-red-100 disabled:pointer-events-none disabled:opacity-35 min-[390px]:text-[7.5px] sm:h-12 sm:rounded-[16px] sm:text-[8px] sm:tracking-[0.14em]"
          >
            <span className="truncate">Revoke access</span>
          </MagneticFillButton>
        </div>
      </aside>
    </div>
  );

  return typeof document === 'undefined' ? panel : createPortal(panel, document.body);
}

type ConstructorProps = {
  label: string;
  team: string;
  preset: ScopePreset;
  selectedScopes: string[];
  generatedKey: string | null;
  copied: boolean;
  onLabelChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onPresetChange: (value: ScopePreset) => void;
  onToggleScope: (scopeId: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
  onClose: () => void;
};

function CredentialConstructor(props: ConstructorProps) {
  const {
    label,
    team,
    preset,
    selectedScopes,
    generatedKey,
    copied,
    onLabelChange,
    onTeamChange,
    onPresetChange,
    onToggleScope,
    onGenerate,
    onCopy,
    onClose,
  } = props;
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const teamMenuRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const presetThumbClass = preset === 'full' ? 'translate-x-0' : preset === 'read' ? 'translate-x-full' : 'translate-x-[200%]';

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power2.out' });
      gsap.fromTo(
        drawerRef.current,
        { autoAlpha: 0, x: 54, scale: 0.985 },
        { autoAlpha: 1, x: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
      );
    },
    { scope: overlayRef },
  );

  useEffect(() => {
    if (!teamOpen || !teamMenuRef.current) return;

    gsap.fromTo(
      teamMenuRef.current,
      { autoAlpha: 0, y: -7, scale: 0.985, transformOrigin: 'top center' },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' },
    );
  }, [teamOpen]);

  useEffect(() => {
    if (!contentRef.current || prefersReducedMotion()) return;

    gsap.fromTo(
      contentRef.current,
      { autoAlpha: 0.86, y: 10, filter: 'blur(5px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.24, ease: 'power2.out' },
    );
  }, [generatedKey]);

  useEffect(() => {
    if (!teamOpen) return;

    const handler = (event: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setTeamOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [teamOpen]);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;

    if (prefersReducedMotion()) {
      onClose();
      return;
    }

    gsap
      .timeline({ onComplete: onClose })
      .to(drawerRef.current, { autoAlpha: 0, x: 46, scale: 0.985, duration: 0.22, ease: 'power2.in' })
      .to(overlayRef.current, { autoAlpha: 0, duration: 0.16, ease: 'power2.out' }, '<');
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[170] flex justify-end bg-black/58 p-0 backdrop-blur-[3px] sm:p-3"
      onMouseDown={requestClose}
    >
      <aside
        ref={drawerRef}
        className="flex h-full w-full max-w-[600px] flex-col overflow-hidden rounded-none border border-white/[0.08] bg-[#050505]/96 text-white backdrop-blur-2xl sm:rounded-[28px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DrawerHeader index="03" label="Credential constructor" title="Generate API key" onClose={requestClose} />

        <div ref={contentRef} className="min-h-0 flex-1 overflow-hidden">
          {generatedKey ? (
            <div className="access-scroll flex h-full flex-col justify-start overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
              <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-[#A01016] text-white sm:h-10 sm:w-10 sm:rounded-[14px]">
                <ShieldCheck className="h-4 w-4" weight="bold" />
              </span>
              <p className="mt-4 font-mono text-[7px] font-semibold uppercase tracking-[0.2em] text-[#d14a51] sm:mt-5 sm:text-[7.5px] sm:tracking-[0.22em]">
                Key material generated
              </p>
              <h2 className="mt-2 max-w-[420px] font-sans text-[clamp(20px,5vw,24px)] font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-[clamp(22px,3.4vw,27px)]">
                This secret appears once.
              </h2>
              <p className="mt-3 max-w-[420px] text-[10px] leading-5 text-white/48">
                Store it in your secret manager before closing this panel. Conduit will not show this value again.
              </p>
              <code className="mt-5 block max-w-full overflow-x-auto rounded-[15px] border border-white/[0.08] bg-white/[0.035] px-3.5 py-3 font-mono text-[9px] font-semibold text-white/90 sm:mt-6 sm:rounded-[16px] sm:px-4 sm:py-3.5 sm:text-[10px]">
                {generatedKey}
              </code>
              <MagneticFillButton
                type="button"
                onClick={onCopy}
                fillClassName="bg-[#A01016]"
                className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-[14px] border border-[#A01016]/50 bg-[#A01016] font-mono text-[7.5px] font-semibold uppercase tracking-[0.12em] text-white hover:border-[#ff5660]/70 hover:bg-[#bd151d] sm:h-11 sm:rounded-[15px] sm:text-[8px] sm:tracking-[0.14em]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Copied to clipboard' : 'Copy secret'}</span>
              </MagneticFillButton>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onGenerate();
              }}
              className="access-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] sm:px-8 sm:py-6"
            >
              <div className="pb-4 pt-2 sm:pb-5 sm:pt-3">
                <FieldLabel>Key label</FieldLabel>
                <input
                  value={label}
                  onChange={(event) => onLabelChange(event.target.value)}
                  placeholder="Production worker"
                  className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.1] bg-white/[0.04] px-3.5 font-sans text-[12px] font-semibold text-white outline-none transition-[background-color,border-color] duration-180 placeholder:text-white/24 hover:bg-white/[0.055] focus:border-white/[0.16] focus:bg-white/[0.06] sm:h-[56px] sm:rounded-[18px] sm:px-5 sm:text-[14px]"
                />
              </div>

              <FieldLabel>Assigned team</FieldLabel>
              <div ref={teamDropdownRef} className="relative mt-2">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={teamOpen}
                  onClick={() => setTeamOpen((open) => !open)}
                  className={[
                    'flex h-11 w-full items-center justify-between rounded-[15px] border px-3.5 font-sans text-[12px] font-semibold outline-none sm:h-[50px] sm:rounded-[17px] sm:px-4 sm:text-[14px]',
                    teamOpen
                      ? 'border-[#A01016]/65 bg-white/[0.065]'
                      : 'border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.05]',
                  ].join(' ')}
                >
                  <span>{team}</span>
                  <CaretDown className={['h-4 w-4 text-white/42 transition-transform duration-200', teamOpen ? 'rotate-180 text-white/70' : ''].join(' ')} weight="bold" />
                </button>

                {teamOpen ? (
                  <div
                    ref={teamMenuRef}
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-[40] overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#090909]/98 p-1.5 backdrop-blur-2xl"
                  >
                    {TEAM_OPTIONS.map((item) => {
                      const active = team === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onTeamChange(item);
                            setTeamOpen(false);
                          }}
                          className={[
                            'flex h-10 w-full items-center justify-between rounded-[13px] px-3.5 font-sans text-[12px] font-semibold sm:h-11 sm:text-[13px]',
                            active ? 'bg-[#A01016]/16 text-white' : 'text-white/56 hover:bg-white/[0.055] hover:text-white',
                          ].join(' ')}
                        >
                          {item}
                          {active ? <Check className="h-4 w-4 text-[#d14a51]" weight="bold" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <FieldLabel className="mt-5 sm:mt-6">Scope preset</FieldLabel>
              <div className="relative mt-2 grid h-8 grid-cols-3 rounded-full bg-black/55 p-1 sm:h-10">
                <span
                  aria-hidden="true"
                  className={['absolute bottom-1 left-1 top-1 w-[calc((100%_-_8px)/3)] rounded-full bg-[#A01016] transition-transform duration-[260ms] ease-[cubic-bezier(.23,1,.32,1)]', presetThumbClass].join(' ')}
                />
                {PRESET_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPresetChange(item)}
                    className={[
                      'relative z-10 rounded-full font-mono text-[6.5px] font-semibold uppercase tracking-[0.12em] sm:text-[7.5px] sm:tracking-[0.14em]',
                      preset === item ? 'text-white' : 'text-white/34 hover:text-white/62',
                    ].join(' ')}
                  >
                    {item === 'read' ? 'Read only' : item}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between sm:mt-6">
                <FieldLabel>Effective scopes</FieldLabel>
                <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-white/38">{selectedScopes.length} / 18</span>
              </div>

              <div className="access-scroll mt-2 max-h-[132px] overflow-y-auto rounded-[16px] border border-white/[0.06] bg-white/[0.025] sm:max-h-[244px] sm:rounded-[20px]">
                {ALL_SCOPES.map((scope, index) => {
                  const checked = selectedScopes.includes(scope.id);
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      disabled={preset !== 'custom'}
                      onClick={() => onToggleScope(scope.id)}
                      className={[
                        'group/scope grid h-10 w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.045] px-3 text-left transition-[background-color,opacity] duration-150 last:border-b-0 sm:h-12 sm:grid-cols-[38px_minmax(0,1fr)_auto] sm:gap-3 sm:px-4',
                        checked ? 'bg-white/[0.035]' : 'bg-transparent',
                        preset === 'custom' ? 'hover:bg-white/[0.055]' : 'cursor-not-allowed opacity-65',
                      ].join(' ')}
                    >
                      <span className={['font-mono text-[8px] font-semibold sm:text-[9px]', checked ? 'text-white/80' : 'text-white/34'].join(' ')}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <code className={['min-w-0 truncate font-mono text-[9px] font-semibold sm:text-[11px]', checked ? 'text-white/90' : 'text-white/48'].join(' ')}>
                        {scope.id}
                      </code>
                      <i className={['not-italic font-mono text-[7px] font-semibold uppercase tracking-[0.12em] sm:text-[8px] sm:tracking-[0.14em]', checked ? 'text-[#d14a51]' : 'text-white/34'].join(' ')}>
                        {checked ? 'On' : 'Off'}
                      </i>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 font-mono text-[7.5px] font-semibold uppercase tracking-[0.14em] text-white/28 sm:mt-5 sm:text-[8px] sm:tracking-[0.16em]">
                Key material cannot be recovered after this panel closes.
              </p>
              <MagneticFillButton
                type="submit"
                fillClassName="bg-[#A01016]"
                className="sticky bottom-0 z-10 mt-4 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-[#A01016]/50 bg-[#A01016] font-mono text-[7px] font-semibold uppercase tracking-[0.12em] text-white hover:border-[#A01016] sm:h-11 sm:rounded-[15px] sm:text-[7.5px] sm:tracking-[0.14em]"
              >
                <Plus className="h-4 w-4" /> <span>Generate credential</span>
              </MagneticFillButton>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}

function DrawerHeader({
  index,
  label,
  title,
  compact = false,
  onClose,
}: {
  index: string;
  label: string;
  title: string;
  compact?: boolean;
  onClose: () => void;
}) {
  return (
    <header className={['flex shrink-0 items-start gap-3 border-b border-white/[0.07] bg-white/[0.012] sm:gap-4', compact ? 'px-4 py-3.5 sm:px-6' : 'px-4 py-3 sm:px-7 sm:py-4'].join(' ')}>
      <span className={['mt-1 font-mono font-semibold text-[#d14a51]/70', compact ? 'text-[9px]' : 'text-[9px] sm:text-[10px]'].join(' ')}>{index}</span>
      <div className="min-w-0 flex-1">
        <p className={['font-mono font-semibold uppercase tracking-[0.24em] text-white/36', compact ? 'text-[8px]' : 'text-[7.5px] sm:text-[9px]'].join(' ')}>{label}</p>
        <h2 className={['mt-1.5 truncate font-sans font-semibold leading-none tracking-[-0.045em] text-white', compact ? 'text-[20px] sm:text-[21px]' : 'text-[20px] sm:text-[23px]'].join(' ')}>{title}</h2>
      </div>
      <MagneticFillButton
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        fillClassName="bg-[#A01016]"
        contentClassName="h-full w-full"
        className={[
          'after:absolute after:bottom-1 after:left-1/2 after:z-10 after:h-px after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-[#A01016]/65 after:transition-[width,background-color] after:duration-300 hover:after:w-5 hover:after:bg-white/80',
          'inline-flex shrink-0 items-center justify-center border border-white/[0.08] bg-white/[0.035] text-white/58 hover:border-[#A01016]/65 hover:bg-white/[0.055] hover:text-white',
          compact ? 'h-10 w-10 rounded-[14px]' : 'h-10 w-10 rounded-[14px] sm:h-11 sm:w-11 sm:rounded-[15px]',
        ].join(' ')}
      >
        <X className={compact ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5'} />
      </MagneticFillButton>
    </header>
  );
}

function VaultRailDatum({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-white/[0.08] pr-4">
      <span className="text-white/44">{label}</span>
      <strong className={accent ? 'font-medium text-[#d14a51]' : 'font-medium text-white/72'}>{value}</strong>
    </span>
  );
}

function InspectorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[66px] border-b border-white/[0.07] px-5 py-3 sm:border-r sm:px-6 [&:nth-child(even)]:sm:border-r-0 [&:nth-last-child(-n+2)]:sm:border-b-0">
      <span className="font-mono text-[7.5px] font-semibold uppercase tracking-[0.18em] text-white/34">{label}</span>
      <strong className="mt-2 block font-mono text-[11px] font-semibold text-white/86">{value}</strong>
    </div>
  );
}

function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <label className={['block font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-white/34 sm:text-[8.5px]', className].join(' ')}>
      {children}
    </label>
  );
}
