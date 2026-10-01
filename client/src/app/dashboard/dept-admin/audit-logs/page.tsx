'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
    Clock,
    Search,
    ChevronDown,
    AlertCircle,
    User,
    Calendar,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    oldValue: any;
    newValue: any;
    timestamp: string;
    actor: {
        id: number;
        name: string;
        email: string;
        role: string;
    } | null;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [actionFilter, setActionFilter] = useState('');
    const pageSize = 20;

    useEffect(() => {
        fetchLogs();
    }, [page, actionFilter]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.append('skip', (page * pageSize).toString());
            params.append('take', pageSize.toString());
            if (actionFilter) params.append('action', actionFilter);

            const res = await api.get(`/dept-admin/audit-logs?${params}`);
            setLogs(res.data.logs || []);
            setTotal(res.data.total || 0);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    const getActionBadgeColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-emerald-100 text-emerald-700';
        if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-700';
        if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'bg-red-100 text-red-700';
        if (action.includes('LOCK') || action.includes('FINALIZE')) return 'bg-amber-100 text-amber-700';
        if (action.includes('SUBMIT')) return 'bg-purple-100 text-purple-700';
        return 'bg-neutral-100 text-neutral-700';
    };

    const formatAction = (action: string) => {
        return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    };

    if (loading && logs.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Audit Logs</h1>
                <p className="text-neutral-500">Track all actions performed within the department</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                    <select
                        value={actionFilter}
                        onChange={(e) => {
                            setActionFilter(e.target.value);
                            setPage(0);
                        }}
                        className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">All Actions</option>
                        <option value="CREATE">Create</option>
                        <option value="UPDATE">Update</option>
                        <option value="EDIT">Edit</option>
                        <option value="LOCK">Lock</option>
                        <option value="FINALIZE">Finalize</option>
                        <option value="SUBMIT">Submit</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                </div>

                <Badge variant="outline" className="text-neutral-600">
                    {total} logs
                </Badge>
            </div>

            {/* Logs List */}
            <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                <div className="divide-y divide-neutral-100">
                    {logs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-neutral-50 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-neutral-100">
                                    <Clock className="h-5 w-5 text-neutral-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className={getActionBadgeColor(log.action)}>
                                            {formatAction(log.action)}
                                        </Badge>
                                        <span className="text-sm text-neutral-500">
                                            on <strong>{log.entityType}</strong>
                                            {log.entityId && ` #${log.entityId}`}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-neutral-500">
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            <span>{log.actor?.name || 'System'}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {(log.oldValue || log.newValue) && (
                                        <div className="mt-2 text-xs text-neutral-500">
                                            {log.oldValue && (
                                                <span className="bg-red-50 text-red-600 px-2 py-1 rounded mr-2">
                                                    Old: {JSON.stringify(log.oldValue).slice(0, 100)}...
                                                </span>
                                            )}
                                            {log.newValue && (
                                                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded">
                                                    New: {JSON.stringify(log.newValue).slice(0, 100)}...
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination */}
                {total > pageSize && (
                    <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
                        <p className="text-sm text-neutral-500">
                            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-1 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={(page + 1) * pageSize >= total}
                                className="px-3 py-1 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {logs.length === 0 && !loading && (
                <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No audit logs found</h3>
                    <p className="text-neutral-500">Actions performed in the department will appear here</p>
                </div>
            )}
        </div>
    );
}
