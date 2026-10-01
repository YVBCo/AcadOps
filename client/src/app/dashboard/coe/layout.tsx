'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function COELayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['COE']}
            portalName="COE Portal"
            basePath="/dashboard/coe"
            badgeClasses="bg-violet-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
