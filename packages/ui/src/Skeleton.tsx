import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const skeletonVariants = cva(
  ['animate-rally-pulse bg-surface-overlay rounded-rally'],
  {
    variants: {
      variant: {
        text: 'h-4 w-full rounded',
        card: 'h-32 w-full',
        circle: 'rounded-full',
        stockHero: 'h-10 w-40 rounded font-mono',
      },
    },
    defaultVariants: {
      variant: 'text',
    },
  }
);

export interface SkeletonProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

/**
 * Skeleton — Loading placeholder.
 *
 * Rule 16: every page has a loading state with skeletons, never spinner-only.
 */
const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, className }))}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export { Skeleton, skeletonVariants };
