'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowsClockwise,
  Check,
  Copy,
  Plus,
  ShieldCheck,
  X,
} from '@phosphor-icons/react';
import { ALL_SCOPES, INITIAL_GRANTS } from './access-data';

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
  const rootRef = useRef<HTMLElement>(null);
  const [keys, setKeys] = useState(INITIAL_KEYS);
  const [selectedKey, setSelectedKey] = useState<KeyRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [team, setTeam] = useState('Team Alpha');
  const [preset, setPreset] = useState<ScopePreset>('read');
  const [customScopes, setCustomScopes] = useState<string[]>(['events:read']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useGSAP(
    () => {
      gsap.from('[data-key-module]', {
        y: 5,
        opacity: 0.82,
        stagger: 0.06,
        duration: 0.34,
        ease: 'power2.out',
      });
    },
    { scope: rootRef },
  );

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
      ref={rootRef}
      className="min-h-[calc(100dvh-48px)] w-full min-w-0 max-w-full overflow-x-hidden sm:min-h-[calc(100dvh-26px)]"
    >
      <header className="command-chassis bg-[#080808]">
        <div className="flex min-h-[108px] flex-wrap items-center gap-5 px-4 py-4 sm:px-5 lg:px-7">
          <div className="mobile-command-copy w-full min-w-0 sm:w-auto">
            <h1 className="font-mono text-[10px] font-medium uppercase tracking-[0.32em] text-white/48 sm:text-[11px]">
              API Keys
            </h1>
            <p className="mt-3 max-w-[620px] font-body text-lg leading-7 text-white/78 sm:text-xl">
              Create and manage credentials for SDK access.
            </p>
          </div>

          <div className="command-dock flex w-full flex-wrap items-center gap-px sm:ml-auto sm:w-auto sm:justify-end">
            <Link href="/sdk/scopes" className="command-button">
              <ArrowLeft className="h-3.5 w-3.5" /> Permissions
            </Link>
            <button type="button" onClick={() => openConstructor()} className="command-button is-primary">
              <Plus className="h-3.5 w-3.5" /> Generate key
            </button>
          </div>
        </div>

        <div className="command-status-rail access-scroll flex h-9 items-center gap-4 overflow-x-auto bg-white/[0.018] px-4 font-mono text-[8px] uppercase tracking-[0.15em] text-white/25 sm:px-5 lg:px-7">
          <VaultRailDatum label="Total keys" value={String(keys.length).padStart(2, '0')} />
          <VaultRailDatum label="Active" value={String(activeCount).padStart(2, '0')} accent />
          <VaultRailDatum label="Rotation" value="90 days" />
          <span className="ml-auto hidden items-center gap-2 whitespace-nowrap text-[var(--app-accent-soft)] lg:flex">
            <span className="live-dot h-1.5 w-1.5 bg-[var(--app-accent)]" /> Vault online
          </span>
        </div>
      </header>

      <div className="sdk-key-workspace control-workspace relative min-h-[calc(100dvh-157px)]">
        <div className="credential-surface relative mx-auto w-full min-w-0 max-w-[1460px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="simple-section-heading">
            <div>
              <p>Credentials</p>
              <h2>API keys</h2>
            </div>
            <span>{activeCount} active</span>
          </div>

          <section className="simple-key-register">
            <div className="simple-key-table-head" aria-hidden="true">
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
      className={`simple-key-row ${active ? 'is-active' : 'is-revoked'}`}
    >
      <div className="simple-key-identity">
        <span>K-{String(index + 1).padStart(2, '0')}</span>
        <div>
          <strong>{record.label}</strong>
          <small>{record.id} / {record.team}</small>
        </div>
      </div>
      <span className="simple-key-environment">{record.environment}</span>
      <span className="simple-key-owner">{record.owner}</span>
      <span className="simple-key-scopes">{record.scopes.length}</span>
      <span className="simple-key-used">{record.lastUsed}</span>
      <span className={`simple-key-status ${active ? 'is-active' : ''}`}>{record.status}</span>
      <ArrowUpRight className="h-4 w-4" />
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
  return (
    <div className="credential-overlay" onMouseDown={onClose}>
      <aside className="key-drawer credential-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <DrawerHeader index="02" label="Credential inspector" title={record.id} onClose={onClose} />

        <div className="access-scroll flex-1 overflow-y-auto">
          <section className="credential-identity-block">
            <span>{record.environment} / {record.status}</span>
            <h2>{record.label}</h2>
            <p>{record.team} / {record.owner}</p>
          </section>

          <div className="credential-inspector-grid">
            <InspectorMetric label="Created" value={record.created} />
            <InspectorMetric label="Last used" value={record.lastUsed} />
            <InspectorMetric label="Rotation" value={record.rotation} />
            <InspectorMetric label="Scope count" value={String(record.scopes.length).padStart(2, '0')} />
          </div>

          <section className="credential-scope-ledger">
            <div><span>Effective scopes</span><strong>{record.scopes.length}/18</strong></div>
            {record.scopes.map((scope, index) => (
              <p key={scope}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <code>{scope}</code>
                <small>GRANTED</small>
              </p>
            ))}
          </section>
        </div>

        <div className="credential-drawer-actions">
          <button type="button" onClick={onRotate} className="is-primary">
            <ArrowsClockwise className="h-4 w-4" weight="bold" /> Rotate credential
          </button>
          <button
            type="button"
            disabled={record.status === 'Revoked'}
            onClick={onRevoke}
            className="is-danger"
          >
            Revoke access
          </button>
        </div>
      </aside>
    </div>
  );
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

  return (
    <div className="credential-overlay" onMouseDown={onClose}>
      <aside className="key-drawer credential-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <DrawerHeader index="03" label="Credential constructor" title="Generate API key" onClose={onClose} />

        {generatedKey ? (
          <div className="credential-secret-view">
            <span className="credential-success-mark"><ShieldCheck className="h-5 w-5" /></span>
            <p>KEY MATERIAL GENERATED</p>
            <h2>This secret appears once.</h2>
            <span>Store it in your secret manager before closing this panel.</span>
            <code>{generatedKey}</code>
            <button type="button" onClick={onCopy} className="credential-copy-command">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied to clipboard' : 'Copy secret'}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onGenerate();
            }}
            className="access-scroll credential-constructor-form"
          >
            <FieldLabel>Key label</FieldLabel>
            <input
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder="Production worker"
            />

            <FieldLabel>Assigned team</FieldLabel>
            <select value={team} onChange={(event) => onTeamChange(event.target.value)}>
              <option>Team Alpha</option>
              <option>Team Beta</option>
            </select>

            <FieldLabel>Scope preset</FieldLabel>
            <div className="credential-preset-selector">
              {(['full', 'read', 'custom'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPresetChange(item)}
                  className={preset === item ? 'is-active' : ''}
                >
                  {item === 'read' ? 'Read only' : item}
                </button>
              ))}
            </div>

            <div className="credential-scope-count-row">
              <FieldLabel>Effective scopes</FieldLabel>
              <span>{selectedScopes.length} / 18</span>
            </div>
            <div className="credential-scope-selector">
              {ALL_SCOPES.map((scope, index) => {
                const checked = selectedScopes.includes(scope.id);
                return (
                  <button
                    key={scope.id}
                    type="button"
                    disabled={preset !== 'custom'}
                    onClick={() => onToggleScope(scope.id)}
                    className={checked ? 'is-active' : ''}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <code>{scope.id}</code>
                    <i>{checked ? 'ON' : 'OFF'}</i>
                  </button>
                );
              })}
            </div>

            <p className="credential-secret-warning">
              Key material cannot be recovered after this panel closes.
            </p>
            <button type="submit" className="credential-generate-command">
              <Plus className="h-4 w-4" /> Generate credential
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

function DrawerHeader({
  index,
  label,
  title,
  onClose,
}: {
  index: string;
  label: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <header className="credential-drawer-header">
      <span>{index}</span>
      <div><p>{label}</p><h2>{title}</h2></div>
      <button type="button" onClick={onClose} aria-label="Close panel">
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

function VaultRailDatum({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-white/10 pr-4">
      <span>{label}</span>
      <strong className={accent ? 'font-medium text-[var(--app-accent-soft)]' : 'font-medium text-white/55'}>{value}</strong>
    </span>
  );
}

function InspectorMetric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="credential-field-label">{children}</label>;
}
