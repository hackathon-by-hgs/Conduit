'use client';

import { useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(useGSAP, CustomEase);

const BOOT_STORAGE_KEY = 'conduit-policy-engine-boot:v1';

const diagnostics = [
  'Initializing Policy Engine',
  'Loading SDK Surface',
  'Resolving Entity Permissions',
  'Verifying Endpoints',
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function PolicyEngineBoot() {
  const [visible, setVisible] = useState(true);

  useGSAP(
    () => {
      if (typeof window === 'undefined') return;

      const hasBooted = window.sessionStorage.getItem(BOOT_STORAGE_KEY) === 'complete';
      if (hasBooted || prefersReducedMotion()) {
        window.sessionStorage.setItem(BOOT_STORAGE_KEY, 'complete');
        setVisible(false);
        return;
      }

      const ease = CustomEase.create('conduitBootCurve', 'M0,0 C0.22,1 0.36,1 1,1');
      const preciseEase = CustomEase.create('conduitPrecisionCurve', 'M0,0 C0.2,0.9 0.2,1 1,1');

      const overlay = document.querySelector<HTMLElement>('[data-boot-overlay]');
      const blackout = document.querySelector<HTMLElement>('[data-boot-blackout]');
      const glow = document.querySelector<HTMLElement>('[data-boot-glow]');
      const core = document.querySelector<HTMLElement>('[data-boot-core]');
      const logoBlock = document.querySelector<HTMLElement>('[data-boot-logo-block]');
      const logoPaths = gsap.utils.toArray<SVGPathElement>('[data-boot-logo-path]');
      const constructionLines = gsap.utils.toArray<HTMLElement>('[data-boot-construction]');
      const diagnosticsNodes = gsap.utils.toArray<HTMLElement>('[data-boot-diagnostic]');
      const calibration = document.querySelector<HTMLElement>('[data-boot-calibration]');
      const sidebarScan = document.querySelector<HTMLElement>('[data-boot-sidebar-scan]');

      const sidebar = document.querySelector<HTMLElement>('[data-conduit-sidebar]');
      const chassis = document.querySelector<HTMLElement>('[data-boot-chassis]');
      const main = document.querySelector<HTMLElement>('[data-boot-main]');
      const mobileHeader = document.querySelector<HTMLElement>('[data-boot-mobile-header]');
      const commandHeader = document.querySelector<HTMLElement>('[data-command-head]');
      const toolbar = document.querySelector<HTMLElement>('[data-boot-toolbar]');
      const search = document.querySelector<HTMLElement>('[data-boot-search]');
      const inspector = window.matchMedia('(min-width: 1280px)').matches
        ? document.querySelector<HTMLElement>('[data-boot-inspector]')
        : null;
      const surface = document.querySelector<HTMLElement>('[data-boot-surface]');
      const table = document.querySelector<HTMLElement>('[data-boot-table]');
      const modules = gsap.utils.toArray<HTMLElement>('[data-policy-module]');
      const cards = gsap.utils.toArray<HTMLElement>('[data-route-card], [data-route-table], [data-route-state], [data-key-module]');
      const progressBars = gsap.utils.toArray<HTMLElement>('[data-boot-progress]');
      const counters = gsap.utils.toArray<HTMLElement>('[data-boot-counter]');

      const coreTargets = [chassis, main, mobileHeader, sidebar].filter(Boolean) as HTMLElement[];
      const constructionTargets = [commandHeader, sidebar, inspector, surface, table, toolbar, search, ...modules, ...cards]
        .filter(Boolean) as HTMLElement[];

      logoPaths.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      });

      gsap.set(coreTargets, { autoAlpha: 0, y: 6, filter: 'blur(8px)' });
      gsap.set(constructionTargets, { autoAlpha: 0, y: 6, filter: 'blur(8px)' });
      if (sidebar) gsap.set(sidebar, { clipPath: 'inset(0 0 100% 0)' });
      gsap.set(progressBars, { scaleX: 0, transformOrigin: 'left center' });
      gsap.set(counters, { textContent: 0 });
      gsap.set(constructionLines, { autoAlpha: 0, scaleX: 0, x: 0, transformOrigin: 'left center' });
      gsap.set(diagnosticsNodes, { autoAlpha: 0, y: 2 });
      gsap.set(calibration, { autoAlpha: 0, y: '-48vh', scaleX: 0.25 });
      gsap.set(sidebarScan, { autoAlpha: 0, y: '-14vh' });

      const animateCounters = () => {
        counters.forEach((node) => {
          const target = Number(node.dataset.bootCount ?? node.textContent ?? 0);
          if (!Number.isFinite(target)) return;

          const proxy = { value: 0 };
          gsap.to(proxy, {
            value: target,
            duration: 0.42,
            ease: 'power2.out',
            onUpdate: () => {
              node.textContent = String(Math.round(proxy.value));
            },
            onComplete: () => {
              node.textContent = String(target);
            },
          });
        });
      };

      const tl = gsap.timeline({
        defaults: { ease },
        onComplete: () => {
          window.sessionStorage.setItem(BOOT_STORAGE_KEY, 'complete');
          setVisible(false);
        },
      });

      tl
        .to(glow, { autoAlpha: 1, scale: 1, duration: 0.55 }, 0)
        .to(core, { autoAlpha: 1, scale: 1, duration: 0.42, ease: preciseEase }, 0.12)
        .to(logoPaths, { strokeDashoffset: 0, duration: 0.78, stagger: 0.08, ease }, 0.58)
        .to(constructionLines, { autoAlpha: 1, scaleX: 1, duration: 0.18, stagger: 0.055, ease: preciseEase }, 1.34)
        .to(constructionLines, { x: '110vw', autoAlpha: 0, duration: 0.38, stagger: 0.045, ease: 'power2.inOut' }, 1.55);

      diagnosticsNodes.forEach((node, index) => {
        const start = 1.92 + index * 0.14;
        tl
          .to(node, { autoAlpha: 1, y: 0, duration: 0.055, ease: 'none' }, start)
          .to(node, { autoAlpha: 0.36, duration: 0.09, ease: 'none' }, start + 0.075)
          .to(node, { autoAlpha: 0.68, duration: 0.07, ease: 'none' }, start + 0.18);
      });

      tl
        .set(coreTargets, { autoAlpha: 0, y: 6, filter: 'blur(8px)' }, 2.28)
        .set(constructionTargets, { autoAlpha: 0, y: 6, filter: 'blur(8px)' }, 2.28)
        .set(progressBars, { scaleX: 0, transformOrigin: 'left center' }, 2.28)
        .to(logoBlock, { autoAlpha: 0, y: -5, duration: 0.22, ease: 'power2.inOut' }, 2.28)
        .to(blackout, { autoAlpha: 0, duration: 0.42, ease: 'power2.inOut' }, 2.34)
        .to([chassis, main, mobileHeader].filter(Boolean), { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.34, stagger: 0.04, ease }, 2.4)
        .to(commandHeader, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.32, ease }, 2.48)
        .to(sidebar, { autoAlpha: 1, y: 0, filter: 'blur(0px)', clipPath: 'inset(0 0 0% 0)', duration: 0.48, ease }, 2.52)
        .to(sidebarScan, { autoAlpha: 1, y: '42vh', duration: 0.48, ease: 'power2.inOut' }, 2.52)
        .to(sidebarScan, { autoAlpha: 0, duration: 0.12 }, 2.94)
        .to(inspector, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.34, ease }, 2.63)
        .to([surface, table].filter(Boolean), { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.34, stagger: 0.05, ease }, 2.7)
        .to(modules.length ? modules : cards, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.3, stagger: 0.04, ease }, 2.76)
        .to(toolbar, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.28, ease }, 2.86)
        .to(search, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.24, ease }, 2.92)
        .to(progressBars, { scaleX: 1, duration: 0.46, stagger: 0.025, ease }, 2.92)
        .add(animateCounters, 2.92)
        .to(calibration, { autoAlpha: 0.44, y: '54vh', scaleX: 1, duration: 0.44, ease: 'power2.inOut' }, 3.12)
        .to(calibration, { autoAlpha: 0, duration: 0.12, ease: 'none' }, 3.48)
        .to(overlay, { autoAlpha: 0, duration: 0.16, ease: 'power2.out' }, 3.5);

      if (document.readyState === 'complete') {
        tl.timeScale(1.14);
      }

      return () => {
        tl.kill();
        gsap.set([...coreTargets, ...constructionTargets], { clearProps: 'opacity,visibility,transform,filter,clipPath' });
        gsap.set(progressBars, { clearProps: 'transform' });
      };
    },
    { dependencies: [] },
  );

  if (!visible) return null;

  return (
    <div
      data-boot-overlay
      className="fixed inset-0 z-[999] overflow-hidden bg-transparent text-white"
      aria-label="Initializing Conduit policy engine"
      role="status"
    >
      <div data-boot-blackout className="absolute inset-0 bg-[#070707]" />
      <div
        data-boot-glow
        className="absolute left-1/2 top-1/2 h-[min(72vw,460px)] w-[min(72vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(160,16,22,0.28),rgba(160,16,22,0.08)_34%,transparent_70%)] opacity-0 blur-2xl"
        aria-hidden="true"
      />
      <span
        data-boot-core
        className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A01016] opacity-0 ring-8 ring-[#A01016]/8"
        aria-hidden="true"
      />

      <div data-boot-logo-block className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center">
        <svg viewBox="0 0 44 44" className="h-20 w-20 text-[#f5f5f5] sm:h-24 sm:w-24" aria-hidden="true">
          <path data-boot-logo-path d="M8 8h11v5h-6v18h6v5H8z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path data-boot-logo-path d="M25 8h11v28H25v-5h6V13h-6z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path data-boot-logo-path d="M18 19h8v6h-8z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
        <p className="mt-4 font-mono text-[8px] font-semibold uppercase tracking-[0.28em] text-white/35">
          Policy Engine Initialization
        </p>
      </div>

      {[
        'top-[18%] left-[8%] w-[42vw]',
        'top-[31%] right-[6%] w-[35vw]',
        'bottom-[28%] left-[12%] w-[30vw]',
        'bottom-[18%] right-[10%] w-[44vw]',
        'top-1/2 left-0 w-screen',
      ].map((className, index) => (
        <span
          key={className}
          data-boot-construction
          className={`absolute h-px bg-[#A01016]/18 ${className}`}
          aria-hidden="true"
          style={{ transformOrigin: index % 2 ? 'right center' : 'left center' }}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 mx-auto grid max-w-[760px] place-items-center px-8">
        <div className="relative h-[280px] w-full">
          {diagnostics.map((item, index) => (
            <span
              key={item}
              data-boot-diagnostic
              className={[
                'absolute whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-[0.22em] text-white/35 opacity-0 sm:text-[9px]',
                index === 0 ? 'left-0 top-6' : '',
                index === 1 ? 'right-0 top-16' : '',
                index === 2 ? 'bottom-14 left-2' : '',
                index === 3 ? 'bottom-6 right-2' : '',
              ].join(' ')}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <span
        data-boot-sidebar-scan
        className="pointer-events-none absolute left-0 top-0 h-24 w-[90px] bg-gradient-to-b from-transparent via-[#A01016]/28 to-transparent opacity-0 blur-[1px] sm:w-[96px]"
        aria-hidden="true"
      />
      <span
        data-boot-calibration
        className="pointer-events-none absolute left-0 top-1/2 h-px w-screen origin-center bg-[#A01016]/28 opacity-0"
        aria-hidden="true"
      />
    </div>
  );
}
