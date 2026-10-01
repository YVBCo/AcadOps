'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['TEACHER']}
            portalName="Teacher Portal"
            basePath="/dashboard/teacher"
            badgeClasses="bg-teal-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
