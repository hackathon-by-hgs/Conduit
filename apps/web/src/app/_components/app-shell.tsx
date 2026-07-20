'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Broadcast, Key, MagnifyingGlass, Pulse, ShieldCheck } from '@phosphor-icons/react';

gsap.registerPlugin(useGSAP);

const NAV_ITEMS = [
  { href: '/events', label: 'Events', icon: Broadcast },
  { href: '/dlq', label: 'Dead letter', icon: Archive },
  { href: '/reconciliation', label: 'Reconcile', icon: MagnifyingGlass },
  { href: '/sdk/scopes', label: 'Scopes', icon: ShieldCheck },
  { href: '/sdk/keys', label: 'API keys', icon: Key },
];

function ConduitMark() {
  return (
    <span className="conduit-mark relative grid h-11 w-11 place-items-center overflow-hidden bg-white text-black">
      <svg viewBox="0 0 44 44" className="h-7 w-7" aria-hidden="true">
        <path d="M8 8h11v5h-6v18h6v5H8z" fill="currentColor" />
        <path d="M25 8h11v28H25v-5h6V13h-6z" fill="currentColor" />
        <path d="M18 19h8v6h-8z" fill="currentColor" />
      </svg>
      <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 bg-[var(--app-accent)]" />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const splitLayout = pathname.startsWith('/sdk/scopes');
  const shellRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const notchRef = useRef<HTMLSpanElement>(null);
  const previousNotchTop = useRef<number | null>(null);

  useGSAP(
    () => {
      const timeline = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
      timeline
        .fromTo('.frame-border-top', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.3 })
        .fromTo('.frame-border-right', { scaleY: 0, transformOrigin: 'top center' }, { scaleY: 1, duration: 0.25 }, '-=0.05')
        .fromTo('.machine-sidebar', { borderRightColor: 'rgba(255,255,255,0)' }, { borderRightColor: 'rgba(255,255,255,.1)', duration: 0.3 }, '-=0.1');
    },
    { scope: shellRef },
  );

  useGSAP(
    () => {
      const sidebar = sidebarRef.current;
      const notch = notchRef.current;
      const activeItem = sidebar?.querySelector<HTMLElement>('.machine-nav-cell.is-active');
      if (!sidebar || !notch || !activeItem || window.matchMedia('(max-width: 639px)').matches) return;

      const nextTop = activeItem.offsetTop + (activeItem.offsetHeight - 32) / 2;
      if (previousNotchTop.current === null) {
        gsap.set(notch, { top: nextTop, scaleY: 1 });
      } else {
        const timeline = gsap.timeline();
        timeline
          .to(notch, { top: nextTop, duration: 0.35, ease: 'back.out(1.7)' }, 0)
          .to(notch, { scaleY: 1.5, duration: 0.14, ease: 'power2.in' }, 0)
          .to(notch, { scaleY: 1, duration: 0.2, ease: 'power3.out' }, 0.14);
      }
      previousNotchTop.current = nextTop;
    },
    { scope: shellRef, dependencies: [pathname] },
  );

  return (
    <div className={`light-app telemetry-app ${splitLayout ? 'split-layout-app' : ''} min-h-dvh w-full max-w-full overflow-x-hidden p-0 sm:p-3`}>
      <div ref={shellRef} className="industrial-chassis relative mx-auto flex min-h-dvh w-full max-w-[1920px] overflow-hidden bg-[#080808] sm:min-h-[calc(100dvh-24px)]">
        <span className="frame-border-top pointer-events-none absolute inset-x-0 top-0 z-[90] h-px bg-white/25" aria-hidden="true" />
        <span className="frame-border-right pointer-events-none absolute inset-y-0 right-0 z-[90] w-px bg-white/20" aria-hidden="true" />
        <span className="policy-publish-sweep pointer-events-none absolute left-0 top-0 z-[95] h-px w-0 bg-[var(--app-accent)]" aria-hidden="true" />

        <aside ref={sidebarRef} className="machine-sidebar fixed inset-x-0 bottom-0 z-50 flex h-16 items-center bg-[#080808] px-2 sm:static sm:h-auto sm:w-16 sm:shrink-0 sm:flex-col sm:px-0">
          <Link href="/sdk/scopes" aria-label="Conduit access surface" className="machine-logo-dock hidden h-16 w-full place-items-center sm:grid">
            <ConduitMark />
          </Link>

          <nav className="machine-nav-stack flex w-full flex-1 items-center justify-around sm:flex-col sm:justify-center">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={`machine-nav-cell group/nav relative flex h-11 w-11 items-center justify-center text-white/30 transition-colors hover:text-white sm:h-12 sm:w-full ${active ? 'is-active text-white' : ''}`}
                >
                  <Icon className="h-5 w-5" weight={active ? 'fill' : 'regular'} />
                  <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap border border-white/10 bg-black px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/70 opacity-0 transition group-hover/nav:opacity-100 sm:bottom-auto sm:left-full sm:ml-3">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="machine-terminal hidden w-full p-3 sm:block">
            <div className="mx-auto grid h-9 w-9 place-items-center font-mono text-[9px] text-white/45">CD</div>
          </div>

          <span ref={notchRef} className="nav-dock-notch pointer-events-none absolute hidden sm:block" aria-hidden="true" />
        </aside>

        <div className="w-full min-w-0 flex-1 overflow-x-hidden pb-16 sm:w-auto sm:pb-0">
          <div className="mobile-shell-header flex h-12 items-center justify-between border-b px-4 sm:hidden">
            <div className="flex items-center gap-3">
              <ConduitMark />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">Conduit</span>
            </div>
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
              <Pulse className="h-4 w-4 text-[var(--app-accent)]" weight="bold" /> Operational
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
