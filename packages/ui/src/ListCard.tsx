'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { Pencil, Share2, Globe, Car } from 'lucide-react';
import { cn } from './utils';
import { Badge } from './Badge';

export interface ListCardProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  vehicleCount: number;
  /** Hex color for the left accent bar */
  color?: string;
  /** Whether this list is shared with others */
  isShared?: boolean;
  /** Whether this list is publicly accessible */
  isPublic?: boolean;
  /** Owner name if the list belongs to someone else */
  ownerName?: string;
  onPress?: () => void;
  onEdit?: () => void;
}

/**
 * ListCard — card for vehicle list items.
 *
 * Color accent bar on the left (4px), name, count, sharing badges.
 * Edit button appears on hover.
 */
const ListCard = forwardRef<HTMLDivElement, ListCardProps>(
  (
    {
      className,
      name,
      vehicleCount,
      color,
      isShared,
      isPublic,
      ownerName,
      onPress,
      onEdit,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role={onPress ? 'button' : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onKeyDown={(e) => {
          if (onPress && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onPress();
          }
        }}
        className={cn(
          'group relative flex items-center gap-3',
          'rounded-rally-lg overflow-hidden',
          'bg-surface-raised border border-surface-border',
          'transition-all duration-150',
          onPress && [
            'cursor-pointer',
            'hover:border-surface-borderHover hover:shadow-rally',
          ],
          className
        )}
        {...props}
      >
        {/* Color accent bar */}
        <div
          className="self-stretch w-1 shrink-0"
          style={{ backgroundColor: color || 'var(--rally-gold)' }}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="flex-1 min-w-0 py-3 pr-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {name}
            </h3>

            {/* Sharing badges */}
            {isShared && (
              <Badge size="sm" variant="default">
                <Share2 className="h-3 w-3" />
                Shared
              </Badge>
            )}
            {isPublic && (
              <Badge size="sm" variant="gold">
                <Globe className="h-3 w-3" />
                Public
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <Car className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-xs text-text-secondary tabular-nums">
              {vehicleCount} {vehicleCount === 1 ? 'vehicle' : 'vehicles'}
            </span>

            {ownerName && (
              <>
                <span className="text-text-disabled" aria-hidden="true">&middot;</span>
                <span className="text-xs text-text-tertiary truncate">
                  {ownerName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Edit button — appears on hover */}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className={cn(
              'shrink-0 mr-3 rounded-rally p-2',
              'text-text-tertiary hover:text-text-primary',
              'hover:bg-surface-overlay transition-all duration-150',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              'cursor-pointer'
            )}
            aria-label={`Edit ${name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

ListCard.displayName = 'ListCard';

export { ListCard };
