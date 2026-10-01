import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function formatDateTime(date: string | Date): string {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Extract a human-readable error message from an Axios error or any thrown error.
 * Checks response.data.error, response.data.message, then falls back to error.message.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
    if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;
        // Axios error with server response
        const response = err.response as Record<string, unknown> | undefined;
        if (response?.data && typeof response.data === 'object') {
            const data = response.data as Record<string, unknown>;
            if (typeof data.error === 'string') return data.error;
            if (typeof data.message === 'string') return data.message;
        }
        // Plain Error
        if (typeof err.message === 'string' && err.message) return err.message;
    }
    return fallback;
}
