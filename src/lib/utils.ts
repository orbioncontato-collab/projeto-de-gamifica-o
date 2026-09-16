import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Junta classes Tailwind sem duplicar utilitários conflitantes. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
