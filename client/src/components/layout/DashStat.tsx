'use client';

import { LucideIcon } from 'lucide-react';

interface DashStatProps {
    label: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    iconColor?: string;
}

export function DashStat({ label, value, subtitle, icon: Icon, iconColor = 'text-neutral-400' }: DashStatProps) {
    return (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-neutral-200 p-5">
            <div>
                <p className="text-sm text-neutral-500 font-medium">{label}</p>
                <p className="text-3xl font-bold text-neutral-900 mt-1">{value}</p>
                {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
            </div>
            <div className="p-3">
                <Icon className={`w-8 h-8 ${iconColor}`} />
            </div>
        </div>
    );
}

export function DashStatsRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {children}
        </div>
    );
}
