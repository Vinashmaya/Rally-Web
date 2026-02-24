import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  [
    'inline-flex items-center font-medium rounded-full',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        default: 'bg-surface-overlay text-text-secondary border border-surface-border',
        success: 'bg-status-success/15 text-status-success border border-status-success/30',
        warning: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
        error: 'bg-status-error/15 text-status-error border border-status-error/30',
        info: 'bg-status-info/15 text-status-info border border-status-info/30',
        gold: 'bg-rally-goldMuted text-rally-gold border border-rally-gold/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
