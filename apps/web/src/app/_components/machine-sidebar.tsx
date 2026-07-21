'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import { Archive, Broadcast, Key, MagnifyingGlass, ShieldCheck, type Icon } from '@phosphor-icons/react';
import { gsap } from 'gsap';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

gsap.registerPlugin(useGSAP);

const NAV_ITEMS = [
  { href: '/events', label: 'Events', caption: '01', icon: Broadcast },
  { href: '/dlq', label: 'Dead letter', caption: '02', icon: Archive },
  { href: '/reconciliation', label: 'Reconcile', caption: '03', icon: MagnifyingGlass },
  { href: '/sdk/scopes', label: 'Scopes', caption: '04', icon: ShieldCheck },
  { href: '/sdk/keys', label: 'API keys', caption: '05', icon: Key },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ConduitMark() {
  return (
    <span className="relative grid h-16 w-[84px] place-items-center overflow-hidden rounded-2xl  bg-[#A01016]/[0.035] text-white/92 transition-[background-color,border-color,color] duration-200  group-hover/logo:bg-[#A01016]/[0.055] group-hover/logo:text-white">
      <span className="absolute inset-y-0 left-0 w-[54px] bg-[radial-gradient(circle_at_center,rgba(160,16,22,0.18),transparent_70%)]" aria-hidden="true" />
      <svg viewBox="0 0 44 44" className="relative z-10 h-6 w-6" aria-hidden="true">
        <path d="M8 8h11v5h-6v18h6v5H8z" fill="currentColor" />
        <path d="M25 8h11v28H25v-5h6V13h-6z" fill="currentColor" />
        <path d="M18 19h8v6h-8z" fill="currentColor" />
      </svg>
      {/* <span className="absolute inset-x-0 top-0 h-px bg-[#A01016]/85" aria-hidden="true" /> */}
      {/* <span className="absolute inset-x-0 bottom-0 h-px bg-[#A01016]/65" aria-hidden="true" /> */}
      {/* <span className="absolute bottom-0 left-0 top-0 w-px bg-[#A01016]/85" aria-hidden="true" /> */}
      {/* <span className="absolute bottom-0 right-0 top-0 w-px bg-[#A01016]/85" aria-hidden="true" /> */}
      <span className="absolute bottom-[-2px] left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#A01016]" aria-hidden="true" />
      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1" aria-hidden="true">
        <span className="h-px w-3 bg-[#A01016]/65" />
        <span className="h-px w-2 bg-[#A01016]/40" />
        <span className="h-px w-3 bg-[#A01016]/55" />
      </span>
    </span>
  );
}

export function SidebarRail({ children }: { children: ReactNode }) {
  return (
    <aside
      data-conduit-sidebar
      className="fixed inset-x-0 bottom-0 z-50 flex h-[70px] items-center border-t border-white/[0.06] bg-gradient-to-r from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 px-3 backdrop-blur-2xl sm:static sm:h-auto sm:w-[84px] sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-r sm:border-t-0 sm:border-white/[0.06] sm:bg-gradient-to-b sm:px-0"
    >
      {children}
    </aside>
  );
}

export function SidebarLogo() {
  const rootRef = useRef<HTMLAnchorElement>(null);

  const animateLogo = useCallback((hovered: boolean) => {
    if (!rootRef.current) return;
    const duration = prefersReducedMotion() ? 0 : 0.2;

    // Animation intent: the logo acknowledges hover with mass/scale, then returns to the rail rhythm.
    gsap.to(rootRef.current, {
      scale: hovered ? 1.055 : 1,
      duration,
      ease: 'power2.out',
    });
  }, []);

  return (
    <Link
      ref={rootRef}
      href="/sdk/scopes"
      aria-label="Conduit access surface"
      onMouseEnter={() => animateLogo(true)}
      onMouseLeave={() => animateLogo(false)}
      onFocus={() => animateLogo(true)}
      onBlur={() => animateLogo(false)}
      className="group/logo relative hidden h-[112px] w-full shrink-0 items-center justify-center outline-none focus-visible:!outline-none sm:flex"
    >
      <ConduitMark />
    </Link>
  );
}

export function NavDivider() {
  return (
    <span
      className="mx-2 hidden h-px w-7 rounded-full bg-white/[0.075] sm:mx-0 sm:my-2 sm:block"
      aria-hidden="true"
    />
  );
}

type NavIconProps = {
  href: string;
  label: string;
  caption: string;
  icon: Icon;
  active: boolean;
  itemRef: (node: HTMLAnchorElement | null) => void;
};

export function NavIcon({ href, label, caption, icon: Icon, active, itemRef }: NavIconProps) {
  const buttonRef = useRef<HTMLAnchorElement | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const setRefs = useCallback((node: HTMLAnchorElement | null) => {
    buttonRef.current = node;
    itemRef(node);
  }, [itemRef]);

  const { contextSafe } = useGSAP(
    () => {
      gsap.set(tooltipRef.current, { opacity: 0, x: -6 });
      gsap.set(iconRef.current, { color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.38)' });

      if (active && !prefersReducedMotion()) {
        gsap.fromTo(
          iconRef.current,
          { scale: 0.84, rotate: -7 },
          { scale: 1, rotate: 0, duration: 0.26, ease: 'back.out(2.2)', overwrite: 'auto' },
        );
      }
    },
    { scope: buttonRef, dependencies: [active] },
  );

  const animateHover = contextSafe((hovered: boolean) => {
    const duration = prefersReducedMotion() ? 0 : hovered ? 0.2 : 0.16;

    // Animation intent: hover compresses inward and picks up a red surface tint without fighting the full-width active rail.
    gsap.to(buttonRef.current, {
      x: hovered ? 2 : 0,
      y: hovered ? -1 : 0,
      scale: hovered ? 0.965 : 1,
      backgroundColor: hovered ? 'rgba(160,16,22,0.075)' : 'rgba(255,255,255,0)',
      duration,
      ease: 'power2.out',
    });
    gsap.to(iconRef.current, {
      color: hovered || active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.38)',
      scale: hovered ? 1.08 : 1,
      rotate: hovered ? (active ? -4 : 4) : 0,
      duration,
      ease: 'power2.out',
    });

    // Animation intent: tooltips slide out from the rail edge so keyboard/mouse users get context without clutter.
    gsap.to(tooltipRef.current, {
      opacity: hovered ? 1 : 0,
      x: hovered ? 0 : -6,
      duration: prefersReducedMotion() ? 0 : 0.15,
      ease: 'power2.out',
    });
  });

  return (
    <Link
      ref={setRefs}
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => animateHover(true)}
      onMouseLeave={() => animateHover(false)}
      onFocus={() => animateHover(true)}
      onBlur={() => animateHover(false)}
      className={cx(
        'group/nav relative z-20 grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-transparent text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-white/15',
        active && 'text-white/92',
      )}
    >
      <span ref={iconRef} className="grid place-items-center">
        <Icon className="h-5 w-5" weight={active ? 'fill' : 'regular'} />
      </span>

      <span
        ref={tooltipRef}
        className="pointer-events-none absolute bottom-full left-1/2 mb-3 min-w-[112px] -translate-x-1/2 whitespace-nowrap rounded-[12px] border border-white/[0.07] bg-black/90 px-3 py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-white/72 opacity-0 backdrop-blur-xl sm:bottom-auto sm:left-full sm:top-1/2 sm:mb-0 sm:ml-3 sm:-translate-x-0 sm:-translate-y-1/2"
      >
        <span className="block text-[8px] text-white/34">Surface {caption}</span>
        <span className="mt-0.5 block text-white/82">{label}</span>
      </span>
    </Link>
  );
}

type StatusBadgeProps = {
  state?: 'live' | 'degraded' | 'offline';
};

export function StatusBadge({ state = 'live' }: StatusBadgeProps) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const pulseRef = useRef<HTMLSpanElement>(null);
  const copy = state === 'live' ? 'Live' : state === 'degraded' ? 'Degraded' : 'Offline';
  const tone = state === 'live' ? 'bg-[#A01016]' : state === 'degraded' ? 'bg-amber-400' : 'bg-white/28';

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set(pulseRef.current, { opacity: 0.32, scale: 1 });
        return;
      }

      // Animation intent: the status dot pulses like a measured heartbeat, signaling system life without blinking noise.
      gsap.to(pulseRef.current, {
        scale: 2.25,
        opacity: 0,
        duration: 1.55,
        repeat: -1,
        ease: 'power2.out',
      });
      gsap.to(dotRef.current, {
        scale: 1.12,
        duration: 0.78,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    },
    { dependencies: [state] },
  );

  return (
    <div className="hidden w-full shrink-0 pb-5 pt-3 sm:block">
      <div className="relative mx-auto grid h-16 w-[84px] place-items-center gap-1.5 overflow-hidden rounded-2xl  bg-[#A01016]/[0.028] px-2 py-2.5 font-mono uppercase tracking-[0.16em] text-white/44">
        <span className="absolute inset-y-0 left-0 w-[54px] bg-[radial-gradient(circle_at_center,rgba(160,16,22,0.16),transparent_72%)]" aria-hidden="true" />
        <span className="relative z-10 text-[6.5px] leading-none">SDK</span>
        <span className="relative grid h-2.5 w-2.5 place-items-center" aria-hidden="true">
          <span ref={pulseRef} className={cx('absolute h-2.5 w-2.5 rounded-full opacity-22', tone)} />
          <span ref={dotRef} className={cx('relative h-1.5 w-1.5 rounded-full', tone)} />
        </span>
        <span className="relative z-10 text-[6px] leading-none">{copy}</span>
        {/* <span className="absolute inset-x-0 top-0 h-px bg-[#A01016]/70" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 h-px bg-[#A01016]/55" aria-hidden="true" />
        <span className="absolute bottom-0 left-0 top-0 w-px bg-[#A01016]/75" aria-hidden="true" />
        <span className="absolute bottom-0 right-0 top-0 w-px bg-[#A01016]/75" aria-hidden="true" /> */}
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1" aria-hidden="true">
          <span className="h-px w-3 bg-[#A01016]/60" />
          <span className="h-px w-2 bg-[#A01016]/35" />
          <span className="h-px w-3 bg-[#A01016]/50" />
        </span>
      </div>
    </div>
  );
}

export function MachineSidebar() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeIndex = NAV_ITEMS.findIndex((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const activeHref = activeIndex >= 0 ? NAV_ITEMS[activeIndex].href : null;

  const setItemRef = useCallback((index: number) => (node: HTMLAnchorElement | null) => {
    itemRefs.current[index] = node;
  }, []);

  const updateIndicator = useCallback((instant = false) => {
    const activeItem = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    const indicator = indicatorRef.current;
    const nav = navRef.current;

    if (!indicator || !nav || !activeItem) {
      if (indicator) gsap.set(indicator, { opacity: 0 });
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const isDesktopRail = window.matchMedia('(min-width: 640px)').matches;
    const targetX = itemRect.left - navRect.left + (isDesktopRail ? -18 : 0);
    const targetY = itemRect.top - navRect.top + (isDesktopRail ? -8 : 0);
    const targetWidth = isDesktopRail ? 84 : itemRect.width;
    const targetHeight = isDesktopRail ? 64 : itemRect.height;
    const duration = instant || prefersReducedMotion() ? 0 : 0.35;

    gsap.killTweensOf(indicator);

    if (duration === 0) {
      gsap.set(indicator, {
        x: targetX,
        y: targetY,
        width: targetWidth,
        height: targetHeight,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
      });
      return;
    }

    // Animation intent: active state compresses, slides, then settles so route changes feel physical rather than snapping.
    gsap
      .timeline({ defaults: { ease: 'power3.inOut' } })
      .to(indicator, { scaleX: 0.88, scaleY: 0.96, duration: 0.09, transformOrigin: 'center center' })
      .to(indicator, {
        x: targetX,
        y: targetY,
        width: targetWidth,
        height: targetHeight,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration,
      }, '<');
  }, [activeIndex]);

  useGSAP(
    () => {
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => updateIndicator(false));
      });

      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    },
    { scope: navRef, dependencies: [pathname, activeIndex, updateIndicator] },
  );

  useEffect(() => {
    const handleLayoutChange = () => updateIndicator(true);
    window.addEventListener('resize', handleLayoutChange);
    document.fonts?.ready.then(handleLayoutChange);

    return () => {
      window.removeEventListener('resize', handleLayoutChange);
    };
  }, [updateIndicator]);

  return (
    <SidebarRail>
      <SidebarLogo />

      <nav aria-label="Primary navigation" className="relative flex w-full flex-1 items-center justify-center px-1 sm:px-0">
        <div ref={navRef} className="relative flex items-center gap-2 sm:flex-col sm:items-center sm:gap-2">
          <span
            ref={indicatorRef}
            className={cx(
              'pointer-events-none absolute left-0 top-0 z-10 overflow-hidden rounded-[2px] border border-[#A01016]/90 bg-[#A01016]/[0.035] opacity-0',
              activeHref ? 'block' : 'hidden',
            )}
            aria-hidden="true"
          >
            <span className="absolute inset-y-0 left-0 w-[64px] bg-[radial-gradient(circle_at_center,rgba(160,16,22,0.2),transparent_68%)]" />
            <span className="absolute inset-x-0 top-0 h-px bg-[#A01016]/80" />
            <span className="absolute inset-x-0 bottom-0 h-px bg-[#A01016]/65" />
            <span className="absolute bottom-0 left-0 top-0 w-px bg-[#A01016]/90" />
            <span className="absolute bottom-0 right-0 top-0 w-px bg-[#A01016]/90" />
            <span className="absolute bottom-[-2px] left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#A01016] sm:bottom-auto sm:left-auto sm:right-[27px] sm:top-1/2 sm:h-1.5 sm:w-1.5 sm:-translate-y-1/2 sm:translate-x-0 sm:rounded-full" />
            <span className="absolute right-2 top-1/2 hidden -translate-y-1/2 flex-col gap-1 sm:flex">
              <span className="h-px w-3 bg-[#A01016]/65" />
              <span className="h-px w-2 bg-[#A01016]/40" />
              <span className="h-px w-3 bg-[#A01016]/55" />
            </span>
          </span>

          {NAV_ITEMS.slice(0, 4).map((item, index) => (
            <NavIcon
              key={item.href}
              href={item.href}
              label={item.label}
              caption={item.caption}
              icon={item.icon}
              active={activeHref === item.href}
              itemRef={setItemRef(index)}
            />
          ))}

          <NavDivider />

          {NAV_ITEMS.slice(4).map((item, offset) => {
            const index = offset + 4;
            return (
              <NavIcon
                key={item.href}
                href={item.href}
                label={item.label}
                caption={item.caption}
                icon={item.icon}
                active={activeHref === item.href}
                itemRef={setItemRef(index)}
              />
            );
          })}
        </div>
      </nav>

      <StatusBadge />
    </SidebarRail>
  );
}
