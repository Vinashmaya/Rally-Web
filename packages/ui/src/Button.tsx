'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from './utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium transition-all duration-150',
    'rounded-rally',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none cursor-pointer',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-rally-gold text-text-inverse',
          'hover:bg-rally-goldLight active:bg-rally-goldDim',
          'shadow-rally-sm hover:shadow-rally',
        ],
        secondary: [
          'bg-transparent text-rally-gold',
          'border border-rally-gold',
          'hover:bg-rally-goldMuted active:bg-rally-goldMuted/70',
        ],
        ghost: [
          'bg-transparent text-text-secondary',
          'hover:text-text-primary hover:bg-surface-overlay',
          'active:bg-surface-border',
        ],
        danger: [
          'bg-status-error text-text-primary',
          'hover:bg-status-error/90 active:bg-status-error/80',
          'shadow-rally-sm',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, asChild, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
