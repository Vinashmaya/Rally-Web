import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';

export interface StockHeroProps extends HTMLAttributes<HTMLSpanElement> {
  /** The stock number to display */
  stockNumber: string;
}

/**
 * StockHero — THE signature element of Rally.
 *
 * 2.5rem, font-weight 800, Geist Mono, gold.
 * This is the single most important visual element in the entire platform.
 * People on hot asphalt finding cars in 3 seconds. This is how.
 */
const StockHero = forwardRef<HTMLSpanElement, StockHeroProps>(
  ({ className, stockNumber, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'text-stock-hero font-extrabold font-mono text-rally-gold',
          'tracking-tight leading-none',
          'select-all',
          className
        )}
        {...props}
      >
        {stockNumber}
      </span>
    );
  }
);

StockHero.displayName = 'StockHero';

export { StockHero };
