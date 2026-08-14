import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  library: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      ),
    }),
  search: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </>
      ),
    }),
  settings: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.7.8 1.2 1.5 1.2H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </>
      ),
    }),
  play: (p: IconProps) =>
    base({
      ...p,
      children: <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />,
    }),
  pause: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
          <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
        </>
      ),
    }),
  skipForward: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </>
      ),
    }),
  skipBack: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </>
      ),
    }),
  shuffle: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <path d="M16 3h5v5" />
          <path d="M4 20 21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </>
      ),
    }),
  list: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </>
      ),
    }),
  music: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      ),
    }),
  plus: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </>
      ),
    }),
  close: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ),
    }),
  chevronDown: (p: IconProps) =>
    base({
      ...p,
      children: <polyline points="6 9 12 15 18 9" />,
    }),
  chevronBack: (p: IconProps) =>
    base({
      ...p,
      children: <polyline points="15 18 9 12 15 6" />,
    }),
  more: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
          <circle cx="5" cy="12" r="1" fill="currentColor" />
        </>
      ),
    }),
  repeat: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <path d="m17 1 4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="m7 23-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </>
      ),
    }),
  albums: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="12" r="4" />
        </>
      ),
    }),
  sun: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      ),
    }),
  moon: (p: IconProps) =>
    base({
      ...p,
      children: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
    }),
  monitor: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </>
      ),
    }),
  refresh: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </>
      ),
    }),
  grip: (p: IconProps) =>
    base({
      ...p,
      children: (
        <>
          <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
        </>
      ),
    }),
  chevronUp: (p: IconProps) =>
    base({
      ...p,
      children: <polyline points="18 15 12 9 6 15" />,
    }),
};
