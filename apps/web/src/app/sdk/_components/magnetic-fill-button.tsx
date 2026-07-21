'use client';

import Link from 'next/link';
import {
  useCallback,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

type MagneticElement = HTMLButtonElement | HTMLAnchorElement;

const MAGNETIC_BASE =
  'group/magnetic relative isolate overflow-hidden transition-[transform,color,background-color,border-color] duration-300 ease-[cubic-bezier(.23,1,.32,1)] hover:scale-[0.965] active:scale-[0.94] disabled:pointer-events-none disabled:opacity-55';

const MAGNETIC_FILL =
  'pointer-events-none absolute left-[var(--magnetic-fill-x)] top-[var(--magnetic-fill-y)] z-0 size-[var(--magnetic-fill-size)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform';

const MAGNETIC_CONTENT =
  'relative z-10 flex items-center justify-center gap-2 transition-colors duration-300';

function useMagneticFill() {
  const ref = useRef<MagneticElement | null>(null);
  const [fillOrigin, setFillOrigin] = useState({ x: 0, y: 0 });
  const [fillSize, setFillSize] = useState(420);
  const [hovered, setHovered] = useState(false);

  const getRelativeCoords = useCallback((event: MouseEvent<MagneticElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const handleMouseEnter = useCallback((event: MouseEvent<MagneticElement>) => {
    const coords = getRelativeCoords(event);
    const rect = ref.current?.getBoundingClientRect();

    if (rect) {
      const farthestX = Math.max(coords.x, rect.width - coords.x);
      const farthestY = Math.max(coords.y, rect.height - coords.y);
      setFillSize(Math.ceil(Math.hypot(farthestX, farthestY) * 2 + 26));
    }

    setFillOrigin(coords);
    setHovered(true);
  }, [getRelativeCoords]);

  const handleMouseLeave = useCallback((event: MouseEvent<MagneticElement>) => {
    setFillOrigin(getRelativeCoords(event));
    setHovered(false);
  }, [getRelativeCoords]);

  const style = {
    '--magnetic-fill-x': `${fillOrigin.x}px`,
    '--magnetic-fill-y': `${fillOrigin.y}px`,
    '--magnetic-fill-size': `${fillSize}px`,
  } as CSSProperties;

  return {
    ref,
    hovered,
    style,
    handleMouseEnter,
    handleMouseLeave,
  };
}

type MagneticFillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fillClassName?: string;
  contentClassName?: string;
};

export function MagneticFillButton({
  children,
  className = '',
  fillClassName = 'bg-[linear-gradient(135deg,#A01016_0%,#ff434c_100%)]',
  contentClassName = '',
  onMouseEnter,
  onMouseLeave,
  ...props
}: MagneticFillButtonProps) {
  const magnetic = useMagneticFill();

  return (
    <button
      {...props}
      ref={magnetic.ref as RefObject<HTMLButtonElement>}
      style={{ ...magnetic.style, ...props.style }}
      onMouseEnter={(event) => {
        magnetic.handleMouseEnter(event as MouseEvent<MagneticElement>);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        magnetic.handleMouseLeave(event as MouseEvent<MagneticElement>);
        onMouseLeave?.(event);
      }}
      className={[MAGNETIC_BASE, className].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          MAGNETIC_FILL,
          magnetic.hovered
            ? 'scale-100 duration-[900ms] ease-[cubic-bezier(.4,0,.2,1)]'
            : 'scale-0 duration-[700ms] ease-[cubic-bezier(.4,0,.2,1)]',
          fillClassName,
        ].join(' ')}
      />
      <span className={[MAGNETIC_CONTENT, contentClassName].join(' ')}>
        {children}
      </span>
    </button>
  );
}

type MagneticFillLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  fillClassName?: string;
  contentClassName?: string;
};

export function MagneticFillLink({
  children,
  className = '',
  fillClassName = 'bg-[linear-gradient(135deg,#A01016_0%,#ff434c_100%)]',
  contentClassName = '',
  onMouseEnter,
  onMouseLeave,
  href,
  ...props
}: MagneticFillLinkProps) {
  const magnetic = useMagneticFill();

  return (
    <Link
      {...props}
      href={href}
      ref={magnetic.ref as RefObject<HTMLAnchorElement>}
      style={{ ...magnetic.style, ...props.style }}
      onMouseEnter={(event) => {
        magnetic.handleMouseEnter(event as MouseEvent<MagneticElement>);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        magnetic.handleMouseLeave(event as MouseEvent<MagneticElement>);
        onMouseLeave?.(event);
      }}
      className={[MAGNETIC_BASE, className].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          MAGNETIC_FILL,
          magnetic.hovered
            ? 'scale-100 duration-[900ms] ease-[cubic-bezier(.4,0,.2,1)]'
            : 'scale-0 duration-[700ms] ease-[cubic-bezier(.4,0,.2,1)]',
          fillClassName,
        ].join(' ')}
      />
      <span className={[MAGNETIC_CONTENT, contentClassName].join(' ')}>
        {children}
      </span>
    </Link>
  );
}
