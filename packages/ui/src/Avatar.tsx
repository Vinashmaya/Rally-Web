import { forwardRef, type ImgHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const avatarVariants = cva(
  [
    'relative inline-flex items-center justify-center',
    'rounded-full overflow-hidden',
    'bg-rally-goldMuted text-rally-gold',
    'font-medium select-none shrink-0',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'size'>,
    VariantProps<typeof avatarVariants> {
  /** Full name — used for initials fallback */
  name?: string;
  /** Image URL */
  src?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, name, src, alt, ...props }, ref) => {
    const initials = name ? getInitials(name) : '';
    const altText = alt || name || 'User avatar';

    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size, className }))}
        role="img"
        aria-label={altText}
      >
        {src ? (
          <img
            src={src}
            alt={altText}
            className="h-full w-full object-cover"
            {...props}
          />
        ) : (
          <span className="leading-none">{initials}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar, avatarVariants };
