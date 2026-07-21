'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { usePathname } from 'next/navigation';
import { Pulse } from '@phosphor-icons/react';
import { ConduitMark, MachineSidebar } from './machine-sidebar';

gsap.registerPlugin(useGSAP);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const splitLayout = pathname.startsWith('/sdk/scopes');
  const sdkChromeLayout = pathname.startsWith('/sdk/scopes') || pathname.startsWith('/sdk/keys');
  const shellRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap
        .timeline({ defaults: { ease: 'power2.inOut' } })
        .fromTo('.frame-border-top', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.3 })
        .fromTo('.frame-border-right', { scaleY: 0, transformOrigin: 'top center' }, { scaleY: 1, duration: 0.25 }, '-=0.05');
    },
    { scope: shellRef },
  );

  useGSAP(
    () => {
      if (!routeRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.fromTo(
        routeRef.current,
        { autoAlpha: 0.88, y: 8, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.28, ease: 'power2.out' },
      );

      const surfaces = gsap.utils.toArray<HTMLElement>(
        routeRef.current.querySelectorAll(
          '[data-route-card], [data-route-table], [data-route-state], [data-policy-module], [data-key-module]',
        ),
      );

      if (surfaces.length) {
        gsap.fromTo(
          surfaces,
          { autoAlpha: 0, y: 14, filter: 'blur(8px)' },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.36,
            stagger: 0.045,
            ease: 'power3.out',
            overwrite: 'auto',
          },
        );
      }
    },
    { dependencies: [pathname] },
  );

  return (
    <div
      className={`light-app telemetry-app ${splitLayout ? 'split-layout-app' : ''} h-dvh w-full max-w-full overflow-hidden bg-[url('/bg-main.jpg')] bg-cover bg-center bg-fixed p-0 sm:p-3`}
    >
      <div
        ref={shellRef}
        className={`industrial-chassis relative mx-auto flex h-full min-h-0 w-full max-w-[1920px] overflow-hidden bg-black/50 backdrop-blur-xl sm:h-[calc(100dvh-24px)] ${sdkChromeLayout ? '!bg-black/10 !backdrop-blur-none !backdrop-saturate-[115%]' : ''}`}
      >
        <span className={`frame-border-top pointer-events-none absolute inset-x-0 top-0 z-[90] h-px bg-white/25 ${sdkChromeLayout ? 'hidden' : ''}`} aria-hidden="true" />
        <span className={`frame-border-right pointer-events-none absolute inset-y-0 right-0 z-[90] w-px bg-white/20 ${sdkChromeLayout ? 'hidden' : ''}`} aria-hidden="true" />
        <span className="policy-publish-sweep pointer-events-none absolute left-0 top-0 z-[95] h-px w-0 bg-[var(--app-accent)]" aria-hidden="true" />

        <MachineSidebar />

        <div ref={routeRef} className={`h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden pb-16 sm:w-auto sm:pb-0 ${sdkChromeLayout ? 'bg-black/[0.14]' : 'bg-black/35 backdrop-blur-md'}`}>
          <div className="mobile-shell-header flex h-12 items-center justify-between border-b border-white/8 px-4 sm:hidden">
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
