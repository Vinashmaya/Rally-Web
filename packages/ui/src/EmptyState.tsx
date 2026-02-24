import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from './utils';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Primary message */
  title: string;
  /** Secondary description */
  description?: string;
  /** Optional call-to-action — pass a Button component */
  action?: ReactNode;
}

/**
 * EmptyState — shown when lists or views have no data.
 * Rule 16: every page has an empty state.
 */
const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center',
          'py-16 px-4 text-center',
          className
        )}
        {...props}
      >
        <div className="mb-4 rounded-full bg-surface-overlay p-4">
          <Icon className="h-8 w-8 text-text-tertiary" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-text-secondary max-w-sm mb-6">{description}</p>
        )}
        {action && <div>{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export { EmptyState };
