'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { chatApi } from '@/lib/api';
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
    Plus,
    UserPlus,
    Search,
    Edit2,
    X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

interface Conversation {
    id: number;
    status: string;
    isEscalated: boolean;
    studentProfile: {
        id: number;
        user: { name: string };
        admissionId: string;
        rollNumber: string | null;
        permanentUsn: string | null;
        temporaryUsn: string | null;
        currentSemester: number;
        section: { name: string } | null;
        batch: { name: string } | null;
        department: { name: string; code: string } | null;
        parentName: string | null;
        parentRelationship: string | null;
    };
    parentUser: { id: number; name: string } | null;
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

interface MenteeStudent {
    studentProfileId: number;
    studentName: string;
    rollNumber: string | null;
    usn: string | null;
    currentSemester: number;
    section: string | null;
    batch: string | null;
    department: string | null;
    parentName: string | null;
    parentUserId: number | null;
    hasParent: boolean;
    existingConversationId: number | null;
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

export default function TeacherChatPage() {
    const searchParams = useSearchParams();
    const studentIdParam = searchParams.get('student');
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    const [activeConversation, setActiveConversation] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [showMobileList, setShowMobileList] = useState(true);
    const [activeTab, setActiveTab] = useState<'chats' | 'new'>('chats');
    const [searchQuery, setSearchQuery] = useState('');
    
    // For Edit functionality
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update current time every second to trigger re-renders for the 15-second edit window
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch conversations
    const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
        queryKey: ['chat-conversations'],
        queryFn: chatApi.getConversations,
        refetchInterval: 15000,
    });

    // Fetch mentee students
    const { data: menteeStudents = [], isLoading: menteesLoading } = useQuery<MenteeStudent[]>({
        queryKey: ['chat-mentee-students'],
        queryFn: chatApi.getMenteeStudents,
        enabled: activeTab === 'new',
    });

    // Fetch messages for active conversation
    const { data: messagesData } = useQuery<{ messages: Message[]; hasMore: boolean }>({
        queryKey: ['chat-messages', activeConversation],
        queryFn: () => chatApi.getMessages(activeConversation!),
        enabled: !!activeConversation,
        refetchInterval: 5000,
    });

    // Send message mutation
    const sendMutation = useMutation({
        mutationFn: ({ conversationId, content }: { conversationId: number; content: string }) =>
            chatApi.sendMessage(conversationId, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversation] });
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            setMessageInput('');
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to send message');
        }
    });

    // Edit message mutation
    const editMutation = useMutation({
        mutationFn: ({ messageId, content }: { messageId: number; content: string }) =>
            chatApi.editMessage(messageId, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversation] });
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            setMessageInput('');
            setEditingMessageId(null);
            toast.success('Message updated successfully');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to edit message');
        }
    });

    // Start conversation mutation
    const startConvMutation = useMutation({
        mutationFn: (studentProfileId: number) => chatApi.startConversationAsTeacher(studentProfileId),
        onSuccess: (newConv) => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat-mentee-students'] });
            setActiveConversation(newConv.id);
            setActiveTab('chats');
            setShowMobileList(false);
            toast.success('Conversation started');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to start conversation');
        }
    });

    // Resolve mutation
    const resolveMutation = useMutation({
        mutationFn: (conversationId: number) => chatApi.resolve(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversation] });
            toast.success('Conversation resolved');
        },
    });

    // Auto-select conversation if coming from dashboard with student param
    useEffect(() => {
        if (studentIdParam && !convsLoading) {
            const existingConv = conversations.find(
                (c) => c.studentProfile.id === parseInt(studentIdParam)
            );
            if (existingConv) {
                setActiveConversation(existingConv.id);
                setShowMobileList(false);
            }
        }
    }, [studentIdParam, convsLoading, conversations]);

    // Scroll to bottom on new messages (unless editing)
    useEffect(() => {
        if (!editingMessageId) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messagesData?.messages, editingMessageId]);

    // Mark as read when opening conversation
    useEffect(() => {
        if (activeConversation) {
            chatApi.markAsRead(activeConversation);
        }
    }, [activeConversation, messagesData]);

    const handleSendOrEdit = useCallback(() => {
        if (!messageInput.trim() || !activeConversation) return;

        if (editingMessageId) {
            editMutation.mutate({ messageId: editingMessageId, content: messageInput.trim() });
        } else {
            sendMutation.mutate({ conversationId: activeConversation, content: messageInput.trim() });
        }
    }, [messageInput, activeConversation, editingMessageId, editMutation, sendMutation]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendOrEdit();
        } else if (e.key === 'Escape' && editingMessageId) {
            cancelEdit();
        }
    };

    const startEdit = (msg: Message) => {
        setEditingMessageId(msg.id);
        setMessageInput(msg.content);
        inputRef.current?.focus();
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setMessageInput('');
    };

    const activeConv = conversations.find((c) => c.id === activeConversation);
    const messages = messagesData?.messages || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full border border-emerald-200">Active</span>;
            case 'ESCALATED':
                return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full border border-amber-200">Escalated</span>;
            case 'RESOLVED':
                return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full border border-slate-200">Resolved</span>;
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

    const filteredMentees = menteeStudents.filter(m => 
        m.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.usn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.parentName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-4">
            {/* Left Sidebar */}
            <div
                className={clsx(
                    'w-full lg:w-96 flex-shrink-0 flex flex-col',
                    !showMobileList && 'hidden lg:flex'
                )}
            >
                <Card className="flex-1 flex flex-col overflow-hidden !p-0 shadow-sm border-slate-200">
                    <div className="p-4 border-b border-slate-100 bg-white z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-lg">
                                <MessageCircle className="w-5 h-5 text-emerald-600" />
                                Messages
                            </h3>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('chats')}
                                className={clsx(
                                    'flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors',
                                    activeTab === 'chats' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                Chats
                                {conversations.some(c => c.unreadCount > 0) && (
                                    <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('new')}
                                className={clsx(
                                    'flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors',
                                    activeTab === 'new' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                Mentees
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-slate-50/50">
                        {activeTab === 'chats' ? (
                            convsLoading ? (
                                <div className="p-4 space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-24 bg-white border border-slate-100 animate-pulse rounded-xl"></div>
                                    ))}
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="p-8 text-center h-full flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <MessageCircle className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h4 className="text-slate-800 font-medium mb-1">No chats yet</h4>
                                    <p className="text-sm text-slate-500 mb-4">You haven't started any conversations with parents.</p>
                                    <button 
                                        onClick={() => setActiveTab('new')}
                                        className="text-sm text-emerald-600 font-medium hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg"
                                    >
                                        Start a new chat
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 space-y-2">
                                    {conversations.map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => {
                                                setActiveConversation(conv.id);
                                                setShowMobileList(false);
                                                if (editingMessageId) cancelEdit();
                                            }}
                                            className={clsx(
                                                'w-full text-left p-3.5 rounded-xl transition-all duration-200 border',
                                                activeConversation === conv.id
                                                    ? 'bg-white border-emerald-200 shadow-sm ring-1 ring-emerald-500/10'
                                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-inner">
                                                    {conv.studentProfile.parentName ? conv.studentProfile.parentName.charAt(0) : 'P'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                                            {conv.studentProfile.parentName || 'Parent'}
                                                            <span className="text-xs font-normal text-slate-500 ml-1">
                                                                ({conv.studentProfile.user.name} – {conv.studentProfile.permanentUsn || conv.studentProfile.rollNumber || 'No USN'})
                                                            </span>
                                                        </p>
                                                        {conv.lastMessageAt && (
                                                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                                                                {formatTime(conv.lastMessageAt)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <p className={clsx(
                                                            "text-xs truncate max-w-[85%]",
                                                            conv.unreadCount > 0 ? "text-slate-800 font-medium" : "text-slate-500"
                                                        )}>
                                                            {conv.lastMessage || <span className="italic text-slate-400">No messages</span>}
                                                        </p>
                                                        {conv.unreadCount > 0 && (
                                                            <span className="ml-2 px-1.5 min-w-[20px] text-center py-0.5 bg-emerald-500 text-white text-[10px] rounded-full font-bold shadow-sm">
                                                                {conv.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="p-3 sticky top-0 bg-slate-50/95 backdrop-blur z-10 border-b border-slate-100">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Search by name or USN..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                
                                {menteesLoading ? (
                                    <div className="p-4 space-y-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="h-16 bg-white border border-slate-100 animate-pulse rounded-xl"></div>
                                        ))}
                                    </div>
                                ) : filteredMentees.length === 0 ? (
                                    <div className="p-8 text-center mt-8">
                                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm text-slate-500">No mentees found</p>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-2">
                                        {filteredMentees.map((mentee) => (
                                            <div key={mentee.studentProfileId} className="bg-white p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors shadow-sm">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                            {mentee.parentName ? mentee.parentName.charAt(0) : '?'}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-800">
                                                                {mentee.parentName || 'No Parent'}
                                                                <span className="text-xs font-normal text-slate-500 ml-1">
                                                                    ({mentee.studentName} – {mentee.usn || mentee.rollNumber || 'N/A'})
                                                                </span>
                                                            </h4>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                                            Sem {mentee.currentSemester} • {mentee.section || '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                                                    <div></div>
                                                    
                                                    {mentee.existingConversationId ? (
                                                        <button 
                                                            onClick={() => {
                                                                setActiveConversation(mentee.existingConversationId);
                                                                setActiveTab('chats');
                                                                setShowMobileList(false);
                                                            }}
                                                            className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                                        >
                                                            Open Chat
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => startConvMutation.mutate(mentee.studentProfileId)}
                                                            disabled={!mentee.hasParent || startConvMutation.isPending}
                                                            className={clsx(
                                                                "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
                                                                !mentee.hasParent 
                                                                    ? "text-slate-400 bg-slate-100 cursor-not-allowed"
                                                                    : "text-white bg-slate-800 hover:bg-slate-700 shadow-sm"
                                                            )}
                                                        >
                                                            {!mentee.hasParent ? 'No Parent Account' : (
                                                                <>
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                    Start Chat
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Main Chat Area */}
            <div
                className={clsx(
                    'flex-1 flex flex-col',
                    showMobileList && 'hidden lg:flex'
                )}
            >
                {!activeConversation || !activeConv ? (
                    <Card className="flex-1 flex items-center justify-center bg-slate-50/50 border-dashed border-2 border-slate-200">
                        <div className="text-center max-w-sm">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-5 border border-slate-100">
                                <MessageCircle className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">
                                Teacher-Parent Chat
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                Select a conversation from the sidebar to view messages, or start a new chat with a mentee's parent.
                            </p>
                            <button
                                onClick={() => setActiveTab('new')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                <UserPlus className="w-4 h-4" />
                                Find a Mentee
                            </button>
                        </div>
                    </Card>
                ) : (
                    <Card className="flex-1 flex flex-col overflow-hidden !p-0 shadow-sm border-slate-200 relative">
                        {/* Chat Header */}
                        <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center gap-4 z-10 shadow-sm relative">
                            <button
                                onClick={() => setShowMobileList(true)}
                                className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner flex-shrink-0">
                                {activeConv.studentProfile.parentName ? activeConv.studentProfile.parentName.charAt(0) : 'P'}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-slate-800 text-base">
                                        {activeConv.studentProfile.parentName || 'Parent'}
                                        <span className="text-sm font-normal text-slate-500 ml-1.5">
                                            ({activeConv.studentProfile.user.name} – {activeConv.studentProfile.permanentUsn || activeConv.studentProfile.rollNumber || 'No USN'})
                                        </span>
                                    </h3>
                                    {getStatusBadge(activeConv.status)}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium">Sem {activeConv.studentProfile.currentSemester}</span>
                                    {activeConv.studentProfile.section && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-xs">{activeConv.studentProfile.section.name}</span>
                                        </>
                                    )}
                                    {activeConv.studentProfile.department && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-xs">{activeConv.studentProfile.department.code}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Resolve Button */}
                            {user?.role === 'TEACHER' && activeConv.status !== 'RESOLVED' && (
                                <button
                                    onClick={() => {
                                        if (confirm('Resolve this conversation? Parents will no longer be able to send messages unless they start a new chat.')) {
                                            resolveMutation.mutate(activeConversation);
                                        }
                                    }}
                                    disabled={resolveMutation.isPending}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm"
                                >
                                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                                    <span className="hidden sm:inline">Mark Resolved</span>
                                </button>
                            )}
                        </div>

                        {/* Escalation Notice */}
                        {activeConv.status === 'ESCALATED' && (
                            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Conversation Escalated</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        This thread has been escalated to the Department Admin.
                                        {activeConv.adminUser && ` Admin ${activeConv.adminUser.name} is now monitoring.`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center max-w-sm">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 border border-slate-100">
                                            <Send className="w-6 h-6 text-slate-300 ml-1" />
                                        </div>
                                        <p className="text-base font-medium text-slate-700 mb-1">Start the conversation</p>
                                        <p className="text-sm text-slate-500">Send a message to {activeConv.studentProfile.parentName || 'the parent'} about {activeConv.studentProfile.user.name}'s progress.</p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isOwn = msg.senderId === user?.id;
                                    const msgTime = new Date(msg.createdAt).getTime();
                                    const isEditable = isOwn && (currentTime - msgTime < 15000); // 15 seconds window
                                    
                                    return (
                                        <div
                                            key={msg.id}
                                            className={clsx(
                                                'flex group',
                                                isOwn ? 'justify-end' : 'justify-start'
                                            )}
                                        >
                                            <div
                                                className={clsx(
                                                    'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm relative',
                                                    isOwn
                                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-sm'
                                                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                                                )}
                                            >
                                                {!isOwn && (
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        {getRoleIcon(msg.senderRole)}
                                                        <span className={clsx(
                                                            'text-xs font-bold tracking-wide',
                                                            msg.senderRole === 'DEPARTMENT_ADMIN'
                                                                ? 'text-amber-600'
                                                                : 'text-indigo-600'
                                                        )}>
                                                            {msg.senderName}
                                                            {msg.senderRole === 'DEPARTMENT_ADMIN' && ' (Admin)'}
                                                        </span>
                                                    </div>
                                                )}
                                                
                                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                                    {msg.content}
                                                </p>
                                                
                                                <div className={clsx(
                                                    'flex items-center gap-1.5 mt-2',
                                                    isOwn ? 'justify-end' : 'justify-start'
                                                )}>
                                                    {/* Editable Indicator */}
                                                    {isEditable && activeConv.status !== 'RESOLVED' && !editingMessageId && (
                                                        <button 
                                                            onClick={() => startEdit(msg)}
                                                            className="flex items-center gap-1 text-[10px] bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded transition-colors mr-1 font-medium"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            Edit
                                                        </button>
                                                    )}
                                                    
                                                    <span className={clsx(
                                                        'text-[11px] font-medium',
                                                        isOwn ? 'text-emerald-50' : 'text-slate-400'
                                                    )}>
                                                        {formatMessageTime(msg.createdAt)}
                                                    </span>
                                                    
                                                    {isOwn && (
                                                        msg.isRead
                                                            ? <CheckCheck className="w-4 h-4 text-emerald-100" />
                                                            : <Clock className="w-3.5 h-3.5 text-emerald-200" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} className="h-2" />
                        </div>

                        {/* Message Input Area */}
                        {activeConv.status !== 'RESOLVED' ? (
                            <div className="p-4 bg-white border-t border-slate-100">
                                {editingMessageId && (
                                    <div className="mb-2 flex items-center justify-between bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                        <div className="flex items-center gap-2 text-emerald-700 text-sm">
                                            <Edit2 className="w-4 h-4" />
                                            <span className="font-medium">Editing message...</span>
                                        </div>
                                        <button 
                                            onClick={cancelEdit}
                                            className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-100 rounded-md transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex items-end gap-3">
                                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition-all shadow-sm">
                                        <textarea
                                            ref={inputRef as any}
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendOrEdit();
                                                } else if (e.key === 'Escape' && editingMessageId) {
                                                    cancelEdit();
                                                }
                                            }}
                                            placeholder={editingMessageId ? "Edit your message..." : "Type your message... (Shift+Enter for new line)"}
                                            className="w-full max-h-32 min-h-[44px] px-4 py-3 bg-transparent text-[15px] focus:outline-none resize-none"
                                            rows={1}
                                            style={{ height: 'auto' }}
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = 'auto';
                                                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendOrEdit}
                                        disabled={!messageInput.trim() || sendMutation.isPending || editMutation.isPending}
                                        className={clsx(
                                            'p-3.5 rounded-xl transition-all duration-200 flex items-center justify-center h-[48px] w-[48px] flex-shrink-0',
                                            messageInput.trim()
                                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                                : 'bg-slate-100 text-slate-400'
                                        )}
                                    >
                                        {editingMessageId ? <CheckCheck className="w-5 h-5" /> : <Send className="w-5 h-5 ml-1" />}
                                    </button>
                                </div>
                                {editingMessageId && (
                                    <p className="text-[11px] text-slate-500 mt-2 ml-1">
                                        Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono">Esc</kbd> to cancel editing
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="p-5 border-t border-slate-100 bg-slate-50/80 text-center backdrop-blur-sm">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-sm text-slate-600 font-medium">
                                    <CheckCheck className="w-4 h-4 text-slate-400" />
                                    This conversation has been resolved
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
