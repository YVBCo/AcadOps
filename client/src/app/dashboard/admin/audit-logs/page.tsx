'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogApi } from '@/lib/api';
import {
    Activity,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    User,
    Calendar,
    FileText,
    Settings,
    Loader2,
    Eye,
    X,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface AuditLog {
    id: number;
    actorId: number | null;
    action: string;
    entityType: string;
    entityId: number | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    timestamp: string;
    actor?: {
        id: number;
        name: string;
        email: string;
    };
}

interface AuditLogStats {
    totalLogs: number;
    todayLogs: number;
    topActions: { action: string; count: number }[];
    topActors: { actorId: number; name: string; count: number }[];
}

export default function AuditLogsPage() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        entityType: '',
        action: '',
        startDate: '',
        endDate: '',
    });
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const limit = 20;

    // Fetch audit logs
    const { data: logsData, isLoading: loadingLogs } = useQuery({
        queryKey: ['audit-logs', page, filters],
        queryFn: () => auditLogApi.getAll({
            page,
            limit,
            entityType: filters.entityType || undefined,
            action: filters.action || undefined,
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
        }),
    });

    // Fetch stats
    const { data: stats } = useQuery<AuditLogStats>({
        queryKey: ['audit-log-stats'],
        queryFn: () => auditLogApi.getStats(),
    });

    const logs: AuditLog[] = logsData?.logs || [];
    const totalPages = Math.ceil((logsData?.total || 0) / limit);

    const actionColors: Record<string, string> = {
        CREATE: 'bg-green-100 text-green-700',
        UPDATE: 'bg-blue-100 text-blue-700',
        DELETE: 'bg-red-100 text-red-700',
        LOGIN: 'bg-purple-100 text-purple-700',
        LOGOUT: 'bg-gray-100 text-gray-700',
    };

    const getActionColor = (action: string) => {
        const type = action.split('_')[0];
        return actionColors[type] || 'bg-slate-100 text-slate-700';
    };

    const entityTypes = ['Department', 'Program', 'Course', 'Subject', 'User', 'Semester', 'Enrollment', 'Attendance', 'Assignment', 'Marks'];
    const actionTypes = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ENROLL', 'UNENROLL', 'ASSIGN', 'CLOSE', 'ARCHIVE'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-7 h-7 text-purple-600" />
                        Audit Logs
                    </h1>
                    <p className="text-slate-500">Track all system activities and changes</p>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Logs"
                        value={stats.totalLogs.toLocaleString()}
                        icon={FileText}
                        iconColor="text-purple-600"
                        iconBgColor="bg-purple-100"
                    />
                    <StatCard
                        title="Today's Activity"
                        value={stats.todayLogs}
                        icon={Calendar}
                        iconColor="text-blue-600"
                        iconBgColor="bg-blue-100"
                    />
                    <StatCard
                        title="Top Action"
                        value={stats.topActions?.[0]?.action.replace('_', ' ') || 'N/A'}
                        icon={Activity}
                        iconColor="text-green-600"
                        iconBgColor="bg-green-100"
                    />
                    <StatCard
                        title="Most Active User"
                        value={stats.topActors?.[0]?.name?.split(' ')[0] || 'N/A'}
                        icon={User}
                        iconColor="text-amber-600"
                        iconBgColor="bg-amber-100"
                    />
                </div>
            )}

            {/* Filters */}
            <Card className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">Filters:</span>
                    </div>
                    <select
                        value={filters.entityType}
                        onChange={(e) => {
                            setFilters(f => ({ ...f, entityType: e.target.value }));
                            setPage(1);
                        }}
                        className="px-3 py-2 border rounded-lg text-sm"
                    >
                        <option value="">All Entity Types</option>
                        {entityTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <select
                        value={filters.action}
                        onChange={(e) => {
                            setFilters(f => ({ ...f, action: e.target.value }));
                            setPage(1);
                        }}
                        className="px-3 py-2 border rounded-lg text-sm"
                    >
                        <option value="">All Actions</option>
                        {actionTypes.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => {
                            setFilters(f => ({ ...f, startDate: e.target.value }));
                            setPage(1);
                        }}
                        className="px-3 py-2 border rounded-lg text-sm"
                        placeholder="Start Date"
                    />
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => {
                            setFilters(f => ({ ...f, endDate: e.target.value }));
                            setPage(1);
                        }}
                        className="px-3 py-2 border rounded-lg text-sm"
                        placeholder="End Date"
                    />
                    {(filters.entityType || filters.action || filters.startDate || filters.endDate) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setFilters({ entityType: '', action: '', startDate: '', endDate: '' });
                                setPage(1);
                            }}
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>
            </Card>

            {/* Logs Table */}
            <Card className="overflow-hidden">
                {loadingLogs ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-sm text-slate-600">Timestamp</th>
                                        <th className="text-left py-3 px-4 font-medium text-sm text-slate-600">Actor</th>
                                        <th className="text-left py-3 px-4 font-medium text-sm text-slate-600">Action</th>
                                        <th className="text-left py-3 px-4 font-medium text-sm text-slate-600">Entity</th>
                                        <th className="text-center py-3 px-4 font-medium text-sm text-slate-600">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-t hover:bg-slate-50">
                                            <td className="py-3 px-4 text-sm">
                                                <div className="font-mono text-slate-600">
                                                    {new Date(log.timestamp).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                                                        <User className="w-4 h-4 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-sm">{log.actor?.name || 'System'}</div>
                                                        <div className="text-xs text-slate-400">{log.actor?.email || ''}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge className={getActionColor(log.action)}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="text-sm font-medium">{log.entityType}</div>
                                                {log.entityId && (
                                                    <div className="text-xs text-slate-400">ID: {log.entityId}</div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {logs.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                No audit logs found
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t">
                                <div className="text-sm text-slate-500">
                                    Page {page} of {totalPages}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Log Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                            <h3 className="font-semibold text-lg">Audit Log Details</h3>
                            <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-slate-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-slate-500">Timestamp</div>
                                    <div className="font-medium">{formatDate(selectedLog.timestamp)}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Actor</div>
                                    <div className="font-medium">{selectedLog.actor?.name || 'System'}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Action</div>
                                    <Badge className={getActionColor(selectedLog.action)}>
                                        {selectedLog.action}
                                    </Badge>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500">Entity</div>
                                    <div className="font-medium">
                                        {selectedLog.entityType} {selectedLog.entityId && `#${selectedLog.entityId}`}
                                    </div>
                                </div>
                            </div>

                            {selectedLog.ipAddress && (
                                <div>
                                    <div className="text-sm text-slate-500">IP Address</div>
                                    <div className="font-mono text-sm">{selectedLog.ipAddress}</div>
                                </div>
                            )}

                            {selectedLog.oldValue && (
                                <div>
                                    <div className="text-sm text-slate-500 mb-2">Previous Value</div>
                                    <pre className="bg-red-50 p-3 rounded-lg text-sm overflow-x-auto">
                                        {JSON.stringify(selectedLog.oldValue, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.newValue && (
                                <div>
                                    <div className="text-sm text-slate-500 mb-2">New Value</div>
                                    <pre className="bg-green-50 p-3 rounded-lg text-sm overflow-x-auto">
                                        {JSON.stringify(selectedLog.newValue, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
