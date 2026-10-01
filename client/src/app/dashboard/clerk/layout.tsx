'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function ClerkLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['CLERK']}
            portalName="Clerk Portal"
            basePath="/dashboard/clerk"
            badgeClasses="bg-amber-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
