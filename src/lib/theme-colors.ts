/**
 * ZENVIX THEME COLOR UTILITIES
 * 
 * Centralized color mappings to ensure consistent use of global theme variables
 * across all components. All colors MUST use HSL variables defined in src/index.css.
 * 
 * Design System: Vibrant, Glassmorphic, High-Contrast Professional
 */

// ============================================================================
// SEMANTIC COLOR MAPPINGS
// ============================================================================

/**
 * Status colors mapped to semantic theme variables
 */
export const STATUS_COLORS = {
  SUCCESS: {
    text: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    glow: 'glow-success',
  },
  WARNING: {
    text: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    glow: 'glow-border',
  },
  ERROR: {
    text: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    glow: 'glow-border',
  },
  INFO: {
    text: 'text-info',
    bg: 'bg-info/10',
    border: 'border-info/20',
    glow: 'glow-border',
  },
  PRIMARY: {
    text: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    glow: 'glow-primary',
  },
  MUTED: {
    text: 'text-muted-foreground',
    bg: 'bg-muted/10',
    border: 'border-muted/20',
  },
} as const;

/**
 * Status badge variants mapped to theme colors
 */
export const STATUS_BADGE_VARIANTS = {
  APPROVED: {
    bg: 'bg-success/20',
    text: 'text-success',
    border: 'border-success/30',
  },
  REJECTED: {
    bg: 'bg-destructive/20',
    text: 'text-destructive',
    border: 'border-destructive/30',
  },
  PENDING: {
    bg: 'bg-warning/20',
    text: 'text-warning',
    border: 'border-warning/30',
  },
  PROCESSING: {
    bg: 'bg-info/20',
    text: 'text-info',
    border: 'border-info/30',
  },
  COMPLETED: {
    bg: 'bg-success/20',
    text: 'text-success',
    border: 'border-success/30',
  },
  FAILED: {
    bg: 'bg-destructive/20',
    text: 'text-destructive',
    border: 'border-destructive/30',
  },
  CANCELLED: {
    bg: 'bg-muted/20',
    text: 'text-muted-foreground',
    border: 'border-muted/30',
  },
} as const;

/**
 * Status indicator colors for gauges, charts, and small indicators
 */
export const STATUS_INDICATORS = {
  ONLINE: {
    bg: 'bg-success',
    text: 'text-success',
    glow: 'shadow-success/50',
  },
  OFFLINE: {
    bg: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    glow: 'shadow-muted/50',
  },
  WARNING: {
    bg: 'bg-warning',
    text: 'text-warning',
    glow: 'shadow-warning/50',
  },
  CRITICAL: {
    bg: 'bg-destructive',
    text: 'text-destructive',
    glow: 'shadow-destructive/50',
  },
  IDLE: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    glow: 'shadow-muted/50',
  },
} as const;

/**
 * Device/Status card background colors
 */
export const STATUS_CARD_COLORS = {
  ONLINE: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
  },
  MAINTENANCE: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
  },
  OFFLINE: {
    bg: 'bg-muted/10',
    text: 'text-muted-foreground',
    border: 'border-muted/20',
  },
  ERROR: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status badge classes based on status string
 */
export function getStatusBadgeClasses(status: string) {
  const statusUpper = status.toUpperCase();
  
  switch (statusUpper) {
    case 'APPROVED':
    case 'ACCEPTED':
    case 'VERIFIED':
    case 'COMPLETED':
    case 'SUCCESS':
      return STATUS_BADGE_VARIANTS.APPROVED;
    case 'REJECTED':
    case 'DENIED':
    case 'FAILED':
    case 'ERROR':
    case 'CANCELLED':
    case 'ABORTED':
      return STATUS_BADGE_VARIANTS.REJECTED;
    case 'PENDING':
    case 'WAITING':
    case 'REVIEW':
    case 'IN_REVIEW':
      return STATUS_BADGE_VARIANTS.PENDING;
    case 'PROCESSING':
    case 'IN_PROGRESS':
    case 'RUNNING':
    case 'ACTIVE':
      return STATUS_BADGE_VARIANTS.PROCESSING;
    default:
      return STATUS_BADGE_VARIANTS.PENDING;
  }
}

/**
 * Get status indicator classes based on status string
 */
export function getStatusIndicatorClasses(status: string) {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('online') || statusLower === 'active' || statusLower === 'running') {
    return STATUS_INDICATORS.ONLINE;
  }
  if (statusLower.includes('offline') || statusLower === 'inactive') {
    return STATUS_INDICATORS.OFFLINE;
  }
  if (statusLower.includes('warning') || statusLower === 'caution') {
    return STATUS_INDICATORS.WARNING;
  }
  if (statusLower.includes('critical') || statusLower === 'error' || statusLower === 'failed') {
    return STATUS_INDICATORS.CRITICAL;
  }
  return STATUS_INDICATORS.IDLE;
}

/**
 * Get device status card classes based on status string
 */
export function getDeviceStatusCardClasses(status: string) {
  const statusLower = status.toLowerCase();
  
  if (statusLower === 'online' || statusLower === 'connected') {
    return STATUS_CARD_COLORS.ONLINE;
  }
  if (statusLower === 'maintenance' || statusLower === 'maintenance') {
    return STATUS_CARD_COLORS.MAINTENANCE;
  }
  if (statusLower === 'offline' || statusLower === 'disconnected') {
    return STATUS_CARD_COLORS.OFFLINE;
  }
  if (statusLower === 'error' || statusLower === 'failed') {
    return STATUS_CARD_COLORS.ERROR;
  }
  return STATUS_CARD_COLORS.OFFLINE;
}

/**
 * Get status text color based on status string
 */
export function getStatusTextColor(status: string) {
  const badgeClasses = getStatusBadgeClasses(status);
  return badgeClasses.text;
}

/**
 * Get status background color based on status string
 */
export function getStatusBgColor(status: string) {
  const badgeClasses = getStatusBadgeClasses(status);
  return badgeClasses.bg;
}

// ============================================================================
// THEME UTILITIES
// ============================================================================

/**
 * Get all theme variables as a string for inline styles
 */
export function getThemeVariables() {
  return `
    --background: var(--background);
    --foreground: var(--foreground);
    --primary: var(--primary);
    --primary-foreground: var(--primary-foreground);
    --secondary: var(--secondary);
    --secondary-foreground: var(--secondary-foreground);
    --muted: var(--muted);
    --muted-foreground: var(--muted-foreground);
    --accent: var(--accent);
    --accent-foreground: var(--accent-foreground);
    --destructive: var(--destructive);
    --destructive-foreground: var(--destructive-foreground);
    --success: var(--success);
    --success-foreground: var(--success-foreground);
    --warning: var(--warning);
    --warning-foreground: var(--warning-foreground);
    --info: var(--info);
    --info-foreground: var(--info-foreground);
    --border: var(--border);
    --input: var(--input);
    --ring: var(--ring);
    --radius: var(--radius);
  `;
}

/**
 * Check if a color class is a hardcoded color (not using theme variables)
 */
export function isHardcodedColor(className: string): boolean {
  const hardcodedPatterns = [
    'text-red-', 'bg-red-', 'border-red-',
    'text-amber-', 'bg-amber-', 'border-amber-',
    'text-emerald-', 'bg-emerald-', 'border-emerald-',
    'text-green-', 'bg-green-', 'border-green-',
    'text-blue-', 'bg-blue-', 'border-blue-',
    'text-purple-', 'bg-purple-', 'border-purple-',
    'text-pink-', 'bg-pink-', 'border-pink-',
    'text-indigo-', 'bg-indigo-', 'border-indigo-',
    'text-sky-', 'bg-sky-', 'border-sky-',
    'text-orange-', 'bg-orange-', 'border-orange-',
    'text-yellow-', 'bg-yellow-', 'border-yellow-',
    'text-teal-', 'bg-teal-', 'border-teal-',
    'text-cyan-', 'bg-cyan-', 'border-cyan-',
    'text-lime-', 'bg-lime-', 'border-lime-',
    'text-fuchsia-', 'bg-fuchsia-', 'border-fuchsia-',
    'text-rose-', 'bg-rose-', 'border-rose-',
    'text-gray-', 'bg-gray-', 'border-gray-',
    'text-zinc-', 'bg-zinc-', 'border-zinc-',
    'text-neutral-', 'bg-neutral-', 'border-neutral-',
  ];
  
  return hardcodedPatterns.some(pattern => className.includes(pattern));
}

/**
 * Convert hardcoded color to theme variable
 */
export function convertToThemeColor(className: string): string {
  // Red/rose/destructive
  if (className.includes('text-red-') || className.includes('text-rose-')) {
    return className.replace(/text-red-\d+/, 'text-destructive').replace(/text-rose-\d+/, 'text-destructive');
  }
  if (className.includes('bg-red-') || className.includes('bg-rose-')) {
    return className.replace(/bg-red-\d+/, 'bg-destructive').replace(/bg-rose-\d+/, 'bg-destructive');
  }
  
  // Amber/warning
  if (className.includes('text-amber-')) {
    return className.replace(/text-amber-\d+/, 'text-warning');
  }
  if (className.includes('bg-amber-')) {
    return className.replace(/bg-amber-\d+/, 'bg-warning');
  }
  
  // Emerald/green/success
  if (className.includes('text-emerald-') || className.includes('text-green-')) {
    return className.replace(/text-emerald-\d+/, 'text-success').replace(/text-green-\d+/, 'text-success');
  }
  if (className.includes('bg-emerald-') || className.includes('bg-green-')) {
    return className.replace(/bg-emerald-\d+/, 'bg-success').replace(/bg-green-\d+/, 'bg-success');
  }
  
  // Blue/primary/info
  if (className.includes('text-blue-')) {
    return className.replace(/text-blue-\d+/, 'text-primary');
  }
  if (className.includes('bg-blue-')) {
    return className.replace(/bg-blue-\d+/, 'bg-primary');
  }
  
  // Purple/pink (keep for specific cases)
  if (className.includes('text-purple-') || className.includes('text-pink-')) {
    return className; // Keep as-is for now
  }
  if (className.includes('bg-purple-') || className.includes('bg-pink-')) {
    return className; // Keep as-is for now
  }
  
  // Indigo/primary
  if (className.includes('text-indigo-')) {
    return className.replace(/text-indigo-\d+/, 'text-primary');
  }
  if (className.includes('bg-indigo-')) {
    return className.replace(/bg-indigo-\d+/, 'bg-primary');
  }
  
  // Sky/info
  if (className.includes('text-sky-')) {
    return className.replace(/text-sky-\d+/, 'text-info');
  }
  if (className.includes('bg-sky-')) {
    return className.replace(/bg-sky-\d+/, 'bg-info');
  }
  
  // Orange (keep for specific cases)
  if (className.includes('text-orange-')) {
    return className; // Keep as-is for now
  }
  if (className.includes('bg-orange-')) {
    return className; // Keep as-is for now
  }
  
  // Yellow/warning
  if (className.includes('text-yellow-')) {
    return className.replace(/text-yellow-\d+/, 'text-warning');
  }
  if (className.includes('bg-yellow-')) {
    return className.replace(/bg-yellow-\d+/, 'bg-warning');
  }
  
  return className;
}
