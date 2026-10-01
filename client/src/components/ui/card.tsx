'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardProps {
    className?: string;
    children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
    return (
        <div className={cn('card-premium p-6', className)}>
            {children}
        </div>
    );
}

export interface StatCardProps {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    iconColor?: string;
    iconBgColor?: string;
    change?: {
        value: number;
        type: 'positive' | 'negative' | 'neutral';
    };
    className?: string;
}

export function StatCard({
    title,
    value,
    icon: Icon,
    iconColor,
    iconBgColor,
    change,
    className,
}: StatCardProps) {
    return (
        <Card className={cn('relative overflow-hidden', className)}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        {title}
                    </p>
                    <p className="stat-value mt-2">{value}</p>
                    {change && (
                        <p
                            className={cn(
                                'mt-2',
                                change.type === 'positive' && 'stat-change-positive',
                                change.type === 'negative' && 'stat-change-negative',
                                change.type === 'neutral' && 'text-neutral-500'
                            )}
                        >
                            {change.type === 'positive' && '+'}
                            {change.value}%
                        </p>
                    )}
                </div>
                {Icon && (
                    <div className={cn('p-3 rounded-lg', iconBgColor || 'bg-primary-100 dark:bg-primary-900/30')}>
                        <Icon className={cn('h-6 w-6', iconColor || 'text-primary-600 dark:text-primary-400')} />
                    </div>
                )}
            </div>
        </Card>
    );
}
