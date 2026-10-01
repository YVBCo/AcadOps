'use client';

import { cn } from '@/lib/utils';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'outline';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    neutral: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300',
    outline: 'border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 bg-transparent',
};

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                variantStyles[variant],
                className
            )}
        >
            {children}
        </span>
    );
}

// Semester status badge
type SemesterStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

const statusVariants: Record<SemesterStatus, BadgeVariant> = {
    ACTIVE: 'success',
    CLOSED: 'error',
    ARCHIVED: 'neutral',
};

export function SemesterStatusBadge({ status, className }: { status: SemesterStatus; className?: string }) {
    return (
        <Badge variant={statusVariants[status]} className={className}>
            <span
                className={cn(
                    'w-1.5 h-1.5 rounded-full mr-1.5',
                    status === 'ACTIVE' && 'bg-green-500 animate-pulse',
                    status === 'CLOSED' && 'bg-red-500',
                    status === 'ARCHIVED' && 'bg-neutral-400'
                )}
            />
            {status}
        </Badge>
    );
}
