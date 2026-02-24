/**
 * Rally Design Tokens
 *
 * Single source of truth for all visual constants.
 * Industrial command center meets luxury automotive.
 * Dark mode ONLY. Gold on black.
 */

export const colors = {
  rally: {
    gold: '#D4A017',
    goldLight: '#E8C547',
    goldDim: '#A67C13',
    goldMuted: '#3D3209',
  },
  surface: {
    base: '#09090B',
    raised: '#111114',
    overlay: '#18181B',
    border: '#27272A',
    borderHover: '#3F3F46',
  },
  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    tertiary: '#71717A',
    disabled: '#52525B',
    inverse: '#09090B',
  },
  status: {
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
  },
  activity: {
    showVideo: '#3B82F6',
    testDrive: '#8B5CF6',
    offLot: '#F97316',
    fueling: '#22C55E',
    runCharge: '#06B6D4',
    sold: '#EF4444',
    available: '#22C55E',
  },
  battery: {
    healthy: '#22C55E',
    warning: '#EAB308',
    critical: '#EF4444',
  },
} as const;

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const radii = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const typography = {
  stockHero: {
    fontSize: '2.5rem',
    fontWeight: 800,
    fontFamily: 'var(--font-geist-mono)',
  },
  heading1: {
    fontSize: '1.875rem',
    fontWeight: 700,
  },
  heading2: {
    fontSize: '1.5rem',
    fontWeight: 600,
  },
  heading3: {
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  body: {
    fontSize: '0.875rem',
    fontWeight: 400,
  },
  bodySmall: {
    fontSize: '0.75rem',
    fontWeight: 400,
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  mono: {
    fontSize: '0.875rem',
    fontWeight: 500,
    fontFamily: 'var(--font-geist-mono)',
  },
} as const;

export type RallyColor = typeof colors;
export type RallySpacing = typeof spacing;
export type RallyRadii = typeof radii;
export type RallyTypography = typeof typography;
