'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth-store';

export function Providers({ children }: { children: ReactNode }) {
    const user = useAuthStore((state) => state.user);
    const cacheScope = user
        ? `${user.tenantId ?? 'no-tenant'}:${user.id}:${user.role}`
        : 'anonymous';

    return (
        <ScopedQueryProvider key={cacheScope}>
            {children}
        </ScopedQueryProvider>
    );
}

function ScopedQueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        gcTime: 5 * 60 * 1000,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
