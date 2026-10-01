'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { API_URL } from '@/lib/config';
import axios from 'axios';

/**
 * Dynamically sets the browser favicon to the tenant's logo.
 * Reads the tenant slug from the authenticated user, fetches branding,
 * and injects a <link rel="icon"> into the document head.
 */
export default function FaviconSetter() {
    const user = useAuthStore((s) => s.user);

    useEffect(() => {
        if (!user?.tenantSlug) return;

        let cancelled = false;

        const fetchAndSetFavicon = async () => {
            try {
                const baseUrl = API_URL.replace(/\/api$/, '');
                const res = await axios.get(`${baseUrl}/api/dev/tenants/branding/${user.tenantSlug}`);
                const logo: string | null = res.data?.logo;
                const name: string | null = res.data?.name;

                if (cancelled) return;

                // Set favicon if logo available
                if (logo) {
                    const existing = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
                    existing.forEach((el) => el.remove());

                    const link = document.createElement('link');
                    link.rel = 'icon';
                    link.type = logo.startsWith('data:image/png') ? 'image/png'
                        : logo.startsWith('data:image/webp') ? 'image/webp'
                        : 'image/x-icon';
                    link.href = logo;
                    document.head.appendChild(link);
                }

                // Set page title
                if (name) {
                    document.title = `${name} — Academic Operations`;
                }
            } catch {
                // Silently fail — default favicon remains
            }
        };

        fetchAndSetFavicon();

        return () => {
            cancelled = true;
        };
    }, [user?.tenantSlug]);

    return null;
}
