import type { ComponentProps } from 'react'
import { cn } from './lib/utils'

export function Button({ className, variant = 'default', size = 'lg', ...props }: ComponentProps<'button'> & {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'lg' | 'icon'
}) {
  return <button data-size={size} className={cn('booking-button', `booking-button-${variant}`, className)} {...props} />
}
