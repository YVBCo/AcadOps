'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { chatApi, parentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card } from '@/components/ui/card';
import {
    MessageCircle,
    Send,
    ArrowUpCircle,
    CheckCheck,
    Clock,
    AlertTriangle,
    ChevronLeft,
    Users,
    Shield,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Conversation {
    id: number;
    status: string;
    studentProfile: {
        id: number;
        user: { name: string };
        admissionId: string;
    };
    mentorUser: { id: number; name: string } | null;
    adminUser: { id: number; name: string } | null;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    escalatedAt: string | null;
}

interface Message {
    id: number;
    content: string;
    senderId: number;
    senderName: string;
    senderRole: string;
    createdAt: string;
    isRead: boolean;
}

function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function formatMessageTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ParentChatPage() {
    const searchParams = useSearchParams();
    const studentIdParam = searchParams.get('student');
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    const [activeConversation, setActiveConversation] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [showMobileList, setShowMobileList] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch conversations
    const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
        queryKey: ['chat-conversations'],
        queryFn: chatApi.getConversations,
        refetchInterval: 15000,
    });

    // Fetch messages for active conversation
    const { data: messagesData } = useQuery<{ messages: Message[]; hasMore: boolean }>({
        queryKey: ['chat-messages', activeConversation],
        queryFn: () => chatApi.getMessages(activeConversation!),
        enabled: !!activeConversation,
        refetchInterval: 5000,
    });

    // Check escalation eligibility
    const { data: escalationData } = useQuery<{ canEscalate: boolean }>({
        queryKey: ['chat-can-escalate', activeConversation],
        queryFn: () => chatApi.canEscalate(activeConversation!),
        enabled: !!activeConversation && user?.role === 'PARENT',
        refetchInterval: 60000,
    });

    // Send message mutation
    const sendMutation = useMutation({
        mutationFn: ({ conversationId, content }: { conversationId: number; content: string }) =>
            chatApi.sendMessage(conversationId, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversation] });
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            setMessageInput('');
        },
    });

    // Escalate mutation
    const escalateMutation = useMutation({
        mutationFn: (conversationId: number) => chatApi.escalate(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversation] });
            queryClient.invalidateQueries({ queryKey: ['chat-can-escalate', activeConversation] });
        },
    });

    // Start conversation mutation (when clicking from dashboard)
    const startConvMutation = useMutation({
        mutationFn: (studentProfileId: number) => chatApi.startConversation(studentProfileId),
        onSuccess: (data: Conversation) => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            setActiveConversation(data.id);
            setShowMobileList(false);
        },
    });

    // Auto-start conversation if coming from dashboard with student param
    useEffect(() => {
        if (studentIdParam && !convsLoading) {
            const existingConv = conversations.find(
                (c) => c.studentProfile.id === parseInt(studentIdParam)
            );
            if (existingConv) {
                setActiveConversation(existingConv.id);
                setShowMobileList(false);
            } else {
                startConvMutation.mutate(parseInt(studentIdParam));
            }
        }
    }, [studentIdParam, convsLoading]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messagesData?.messages]);

    // Mark as read when opening conversation
    useEffect(() => {
        if (activeConversation) {
            chatApi.markAsRead(activeConversation);
        }
    }, [activeConversation]);

    const handleSend = useCallback(() => {
        if (!messageInput.trim() || !activeConversation) return;
        sendMutation.mutate({ conversationId: activeConversation, content: messageInput.trim() });
    }, [messageInput, activeConversation, sendMutation]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const activeConv = conversations.find((c) => c.id === activeConversation);
    const messages = messagesData?.messages || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">Active</span>;
            case 'ESCALATED':
                return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Escalated</span>;
            case 'RESOLVED':
                return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">Resolved</span>;
            default:
                return null;
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'PARENT':
                return <Users className="w-3.5 h-3.5" />;
            case 'TEACHER':
                return <MessageCircle className="w-3.5 h-3.5" />;
            case 'DEPARTMENT_ADMIN':
                return <Shield className="w-3.5 h-3.5" />;
            default:
                return null;
        }
    };

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-4">
            {/* Conversation List */}
            <div
                className={clsx(
                    'w-full lg:w-80 flex-shrink-0 flex flex-col',
                    !showMobileList && 'hidden lg:flex'
                )}
            >
                <Card className="flex-1 flex flex-col overflow-hidden !p-0">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-emerald-600" />
                            Conversations
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {convsLoading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl"></div>
                                ))}
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center">
                                <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">No conversations yet</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Start a chat from your dashboard
                                </p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {conversations.map((conv) => (
                                    <button
                                        key={conv.id}
                                        onClick={() => {
                                            setActiveConversation(conv.id);
                                            setShowMobileList(false);
                                        }}
                                        className={clsx(
                                            'w-full text-left p-3 rounded-xl transition-all duration-200',
                                            activeConversation === conv.id
                                                ? 'bg-emerald-50 border border-emerald-200'
                                                : 'hover:bg-slate-50'
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                {conv.studentProfile.user.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                                        {conv.studentProfile.user.name}
                                                    </p>
                                                    {conv.unreadCount > 0 && (
                                                        <span className="ml-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full font-bold">
                                                            {conv.unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {getStatusBadge(conv.status)}
                                                    {conv.mentorUser && (
                                                        <span className="text-xs text-slate-400">
                                                            Mentor: {conv.mentorUser.name.split(' ')[0]}
                                                        </span>
                                                    )}
                                                </div>
                                                {conv.lastMessage && (
                                                    <p className="text-xs text-slate-500 truncate mt-1">
                                                        {conv.lastMessage}
                                                    </p>
                                                )}
                                                {conv.lastMessageAt && (
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {formatTime(conv.lastMessageAt)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Chat Area */}
            <div
                className={clsx(
                    'flex-1 flex flex-col',
                    showMobileList && 'hidden lg:flex'
                )}
            >
                {!activeConversation ? (
                    <Card className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">
                                Select a Conversation
                            </h3>
                            <p className="text-sm text-slate-400">
                                Choose a conversation from the list or start one from the dashboard
                            </p>
                        </div>
                    </Card>
                ) : (
                    <Card className="flex-1 flex flex-col overflow-hidden !p-0">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <button
                                onClick={() => setShowMobileList(true)}
                                className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                                {activeConv?.studentProfile.user.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-800">
                                    {activeConv?.studentProfile.user.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {activeConv && getStatusBadge(activeConv.status)}
                                    {activeConv?.mentorUser && (
                                        <span className="text-xs text-slate-500">
                                            Mentor: {activeConv.mentorUser.name}
                                        </span>
                                    )}
                                    {activeConv?.adminUser && (
                                        <span className="text-xs text-amber-600 font-medium">
                                            • Admin: {activeConv.adminUser.name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Escalate Button */}
                            {user?.role === 'PARENT' && escalationData?.canEscalate && activeConv?.status === 'ACTIVE' && (
                                <button
                                    onClick={() => {
                                        if (confirm('Escalate this conversation to the Department Admin? This will notify them about the unresponsive mentor.')) {
                                            escalateMutation.mutate(activeConversation);
                                        }
                                    }}
                                    disabled={escalateMutation.isPending}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                                >
                                    <ArrowUpCircle className="w-4 h-4" />
                                    Escalate
                                </button>
                            )}
                        </div>

                        {/* Escalation Notice */}
                        {activeConv?.status === 'ESCALATED' && (
                            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-amber-700">
                                    This conversation has been escalated to the Department Admin.
                                    {activeConv.adminUser && ` ${activeConv.adminUser.name} is now included.`}
                                </p>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm text-slate-500">No messages yet</p>
                                        <p className="text-xs text-slate-400">Send a message to start the conversation</p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isOwn = msg.senderId === user?.id;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={clsx(
                                                'flex',
                                                isOwn ? 'justify-end' : 'justify-start'
                                            )}
                                        >
                                            <div
                                                className={clsx(
                                                    'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                                                    isOwn
                                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-800'
                                                )}
                                            >
                                                {!isOwn && (
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        {getRoleIcon(msg.senderRole)}
                                                        <span className={clsx(
                                                            'text-xs font-semibold',
                                                            msg.senderRole === 'DEPARTMENT_ADMIN'
                                                                ? 'text-amber-600'
                                                                : 'text-emerald-600'
                                                        )}>
                                                            {msg.senderName}
                                                            {msg.senderRole === 'DEPARTMENT_ADMIN' && ' (Admin)'}
                                                            {msg.senderRole === 'TEACHER' && ' (Mentor)'}
                                                        </span>
                                                    </div>
                                                )}
                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                    {msg.content}
                                                </p>
                                                <div className={clsx(
                                                    'flex items-center gap-1 mt-1',
                                                    isOwn ? 'justify-end' : 'justify-start'
                                                )}>
                                                    <span className={clsx(
                                                        'text-[10px]',
                                                        isOwn ? 'text-emerald-100' : 'text-slate-400'
                                                    )}>
                                                        {formatMessageTime(msg.createdAt)}
                                                    </span>
                                                    {isOwn && (
                                                        msg.isRead
                                                            ? <CheckCheck className="w-3.5 h-3.5 text-emerald-100" />
                                                            : <Clock className="w-3 h-3 text-emerald-200" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        {activeConv?.status !== 'RESOLVED' && (
                            <div className="p-4 border-t border-slate-100 bg-white">
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type a message..."
                                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!messageInput.trim() || sendMutation.isPending}
                                        className={clsx(
                                            'p-3 rounded-xl transition-all duration-200',
                                            messageInput.trim()
                                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl'
                                                : 'bg-slate-100 text-slate-400'
                                        )}
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                                {user?.role === 'PARENT' && !escalationData?.canEscalate && activeConv?.status === 'ACTIVE' && (
                                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Escalation available 24hrs after last unanswered message
                                    </p>
                                )}
                            </div>
                        )}

                        {activeConv?.status === 'RESOLVED' && (
                            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                                <p className="text-sm text-slate-500">This conversation has been resolved.</p>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
