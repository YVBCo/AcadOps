'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
    href: string;
    icon: LucideIcon;
    label: string;
    subtitle?: string;
    iconColor?: string;
    iconBgColor?: string;
}

export function QuickActionCard({
    href,
    icon: Icon,
    label,
    subtitle,
    iconColor = 'text-neutral-600',
    iconBgColor = 'bg-neutral-100',
}: QuickActionCardProps) {
    return (
        <Link href={href} className="group">
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-200/50 transition-all duration-300 hover:-translate-y-0.5 text-center min-h-[140px]">
                <div className={`w-14 h-14 rounded-2xl ${iconBgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-7 h-7 ${iconColor}`} />
                </div>
                <p className="text-sm font-semibold text-neutral-800 group-hover:text-neutral-900">
                    {label}
                </p>
                {subtitle && (
                    <p className="text-xs text-neutral-400 mt-1 leading-tight">
                        {subtitle}
                    </p>
                )}
            </div>
        </Link>
    );
}

export function QuickActionsGrid({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <h2 className="text-lg font-semibold text-neutral-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {children}
            </div>
        </div>
    );
}
