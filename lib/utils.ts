import { clsx, type ClassValue } from 'clsx';

/** Tailwind class combiner. */
export function cn(...inputs: ClassValue[]): string {
    return clsx(inputs);
}
