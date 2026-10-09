import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole =
    | 'STUDENT'
    | 'TEACHER'
    | 'DEPARTMENT_ADMIN'
    | 'SUPER_ADMIN'
    | 'COE'
    | 'CLERK'
    | 'ADMISSIONS_ADMIN'
    | 'ADMIN_CLERK'
    | 'FIRST_YEAR_COORDINATOR'
    | 'PARENT'
    | 'LIBRARIAN'
    | 'PRINCIPAL'
    | 'ACCOUNTS_STAFF'
    | 'PLACEMENT_COMPANY';

export interface User {
    id: number;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: number;
    tenantId?: number;
    tenantSlug?: string;
    tenantType?: string;
    department?: {
        id: number;
        name: string;
        code: string;
    };
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isHydrated: boolean;
    setAuth: (user: User, token: string, refreshToken?: string) => void;
    setAccessToken: (token: string) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
    setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: true,
            isHydrated: false,

            setAuth: (user, token, refreshToken) => {
                localStorage.setItem('token', token);
                if (refreshToken) localStorage.setItem('refresh-token', refreshToken);
                set({ user, token, isAuthenticated: true, isLoading: false });
            },

            setAccessToken: (token) => {
                localStorage.setItem('token', token);
                set({ token });
            },

            logout: () => {
                localStorage.removeItem('token');
                localStorage.removeItem('refresh-token');
                set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            },

            setLoading: (loading) => set({ isLoading: loading }),

            setHydrated: () => set({ isHydrated: true, isLoading: false }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated
            }),
            onRehydrateStorage: () => (state) => {
                // Once hydration is complete, set isLoading to false
                state?.setHydrated();
            },
        }
    )
);

// Role-based access helpers
export const roleLabels: Record<UserRole, string> = {
    STUDENT: 'Student',
    TEACHER: 'Teacher',
    DEPARTMENT_ADMIN: 'Department Admin',
    SUPER_ADMIN: 'Super Admin',
    COE: 'Controller of Examinations',
    CLERK: 'Clerk',
    ADMISSIONS_ADMIN: 'Admissions Administrator',
    ADMIN_CLERK: 'Administration Clerk',
    FIRST_YEAR_COORDINATOR: 'First Year Coordinator',
    PARENT: 'Parent',
    LIBRARIAN: 'Librarian',
    PRINCIPAL: 'Principal',
    ACCOUNTS_STAFF: 'Accounts Staff',
    PLACEMENT_COMPANY: 'Placement Company',
};


export const roleColors: Record<UserRole, string> = {
    STUDENT: 'badge-primary',
    TEACHER: 'badge-success',
    DEPARTMENT_ADMIN: 'badge-warning',
    SUPER_ADMIN: 'badge-error',
    COE: 'badge-accent',
    CLERK: 'badge-neutral',
    ADMISSIONS_ADMIN: 'badge-info',
    ADMIN_CLERK: 'badge-neutral',
    FIRST_YEAR_COORDINATOR: 'badge-primary',
    PARENT: 'badge-success',
    LIBRARIAN: 'badge-info',
    PRINCIPAL: 'badge-error',
    ACCOUNTS_STAFF: 'badge-warning',
    PLACEMENT_COMPANY: 'badge-accent',
};


export const roleVariants: Record<UserRole, "primary" | "success" | "warning" | "error" | "neutral" | "outline"> = {
    STUDENT: 'neutral',
    TEACHER: 'success',
    DEPARTMENT_ADMIN: 'warning',
    SUPER_ADMIN: 'error',
    COE: 'primary',
    CLERK: 'outline',
    ADMISSIONS_ADMIN: 'primary',
    ADMIN_CLERK: 'outline',
    FIRST_YEAR_COORDINATOR: 'primary',
    PARENT: 'success',
    LIBRARIAN: 'primary',
    PRINCIPAL: 'error',
    ACCOUNTS_STAFF: 'warning',
    PLACEMENT_COMPANY: 'neutral',
};

export const canAccessAdminPanel = (role?: UserRole): boolean => {
    return role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN' || role === 'COE' || role === 'ADMISSIONS_ADMIN';
};

export const canAccessAdmissionsPanel = (role?: UserRole): boolean => {
    return role === 'ADMISSIONS_ADMIN' || role === 'ADMIN_CLERK';
};

export const canManageSemesters = (role?: UserRole): boolean => {
    return role === 'SUPER_ADMIN';
};

export const canManageDepartments = (role?: UserRole): boolean => {
    return role === 'SUPER_ADMIN';
};
