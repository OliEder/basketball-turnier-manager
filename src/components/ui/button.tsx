import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'outline' | 'destructive'
type Size = 'default' | 'sm'

const variantClasses: Record<Variant, string> = {
  default:
    'bg-brand-primary text-white hover:bg-brand-primary-light active:bg-brand-primary-dark',
  outline:
    'border border-border-ui bg-transparent text-brand-primary hover:bg-tint',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm font-sans font-semibold uppercase tracking-wide transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
