'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function FirstYearCoordinatorLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['FIRST_YEAR_COORDINATOR']}
            portalName="First Year Coordinator"
            basePath="/dashboard/first-year-coordinator"
            badgeClasses="bg-purple-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
