import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={cn('rounded-md border border-brand-primary/30 bg-tint p-4 text-sm', className)}
      {...props}
    />
  )
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-foreground', className)} {...props} />
}
