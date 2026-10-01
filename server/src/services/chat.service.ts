import { ChatStatus, Prisma } from '@prisma/client';
import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'chat' });

// ============================================
// CHAT SERVICE
// Parent ↔ Mentor chat with dept admin escalation
// ============================================

const ESCALATION_HOURS = 24;

class ChatService {
    /**
     * Get or create a conversation between a parent and their child's mentor.
     */
    async getOrCreateConversation(parentUserId: number, studentProfileId: number) {
        // Verify parent owns this student
        const parentProfile = await prisma.parentProfile.findUnique({
            where: { userId: parentUserId },
        });
        if (!parentProfile || parentProfile.studentProfileId !== studentProfileId) {
            throw new Error('You do not have access to this student');
        }

        // Find active mentor assignment for this student
        const mentorAssignment = await prisma.mentorAssignment.findFirst({
            where: { studentProfileId, isActive: true },
            include: {
                teacherProfile: { include: { user: { select: { id: true, name: true } } } },
                studentProfile: { include: { user: { select: { tenantId: true } } } },
            },
        });

        if (!mentorAssignment) {
            throw new Error('No mentor is currently assigned to your child. Please contact the department.');
        }

        const mentorUserId = mentorAssignment.teacherProfile.user.id;
        const tenantId = mentorAssignment.studentProfile.user.tenantId;

        // Find or create
        const convInclude = {
            mentorUser: { select: { id: true, name: true } },
            parentUser: { select: { id: true, name: true } },
            studentProfile: { include: { user: { select: { name: true } } } },
            escalatedTo: { select: { id: true, name: true } },
        } as const;

        let conversation = await prisma.chatConversation.findFirst({
            where: { parentUserId, mentorUserId, studentProfileId },
            include: convInclude,
        });

        if (!conversation) {
            conversation = await prisma.chatConversation.create({
                data: { tenantId, parentUserId, mentorUserId, studentProfileId },
                include: convInclude,
            });
        }

        // Flatten escalatedTo → adminUser for frontend
        const { escalatedTo, ...rest } = conversation;
        return {
            ...rest,
            adminUser: escalatedTo,
            lastMessage: null,
            lastMessageAt: null,
            unreadCount: 0,
        };
    }

    /**
     * Get or create a conversation initiated by the teacher/mentor.
     * Verifies the teacher is the active mentor for the student and the student has a parent.
     */
    async getOrCreateConversationByTeacher(teacherUserId: number, studentProfileId: number) {
        // Verify teacher is the active mentor for this student
        const teacherProfile = await prisma.teacherProfile.findUnique({
            where: { userId: teacherUserId },
        });
        if (!teacherProfile) throw new Error('Teacher profile not found');

        const mentorAssignment = await prisma.mentorAssignment.findFirst({
            where: { teacherProfileId: teacherProfile.id, studentProfileId, isActive: true },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { tenantId: true } },
                        parentProfile: {
                            include: { user: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        });

        if (!mentorAssignment) {
            throw new Error('You are not the active mentor for this student');
        }

        const parentProfile = mentorAssignment.studentProfile.parentProfile;
        if (!parentProfile) {
            throw new Error('This student does not have a linked parent account');
        }

        const parentUserId = parentProfile.user.id;
        const tenantId = mentorAssignment.studentProfile.user.tenantId;

        const convInclude = {
            mentorUser: { select: { id: true, name: true } },
            parentUser: { select: { id: true, name: true } },
            studentProfile: { include: { user: { select: { name: true } } } },
            escalatedTo: { select: { id: true, name: true } },
        } as const;

        let conversation = await prisma.chatConversation.findFirst({
            where: { parentUserId, mentorUserId: teacherUserId, studentProfileId },
            include: convInclude,
        });

        if (!conversation) {
            conversation = await prisma.chatConversation.create({
                data: { tenantId, parentUserId, mentorUserId: teacherUserId, studentProfileId },
                include: convInclude,
            });
        }

        const { escalatedTo, ...rest } = conversation;
        return {
            ...rest,
            adminUser: escalatedTo,
            lastMessage: null,
            lastMessageAt: null,
            unreadCount: 0,
        };
    }

    /**
     * Send a message in a conversation.
     */
    async sendMessage(conversationId: number, senderUserId: number, content: string) {
        if (!content || content.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }
        if (content.length > 2000) {
            throw new Error('Message cannot exceed 2000 characters');
        }

        // Verify access
        const conversation = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) throw new Error('Conversation not found');

        const isParticipant =
            conversation.parentUserId === senderUserId ||
            conversation.mentorUserId === senderUserId ||
            conversation.escalatedToId === senderUserId;

        if (!isParticipant) throw new Error('You are not part of this conversation');

        if (conversation.status !== 'ACTIVE') {
            throw new Error('This conversation has been resolved');
        }

        const now = new Date();
        const isMentorOrAdmin =
            conversation.mentorUserId === senderUserId ||
            conversation.escalatedToId === senderUserId;

        const message = await prisma.$transaction(async (tx) => {
            const msg = await tx.chatMessage.create({
                data: {
                    conversationId,
                    senderUserId,
                    content: content.trim(),
                },
                include: {
                    sender: { select: { id: true, name: true, role: true } },
                },
            });

            // Update conversation timestamps
            const updateData: Prisma.ChatConversationUpdateInput = {
                lastMessageAt: now,
            };
            if (isMentorOrAdmin) {
                updateData.lastMentorReplyAt = now;
            }

            await tx.chatConversation.update({
                where: { id: conversationId },
                data: updateData,
            });

            return msg;
        });

        // Flatten sender info to match frontend Message interface
        return {
            id: message.id,
            content: message.content,
            senderId: message.sender.id,
            senderName: message.sender.name,
            senderRole: message.sender.role,
            createdAt: message.createdAt,
            isRead: message.isRead,
        };
    }

    /**
     * Get conversations for a user based on their role.
     */
    async getConversations(userId: number, role: string) {
        const where: Prisma.ChatConversationWhereInput = {};

        if (role === 'PARENT') {
            where.parentUserId = userId;
        } else if (role === 'TEACHER') {
            where.mentorUserId = userId;
        } else if (role === 'DEPARTMENT_ADMIN') {
            where.isEscalated = true;
            where.escalatedToId = userId;
        } else {
            throw new Error('Invalid role for chat');
        }

        const conversations = await prisma.chatConversation.findMany({
            where,
            include: {
                parentUser: { select: { id: true, name: true } },
                mentorUser: { select: { id: true, name: true } },
                studentProfile: {
                    include: {
                        user: { select: { name: true } },
                        section: { select: { name: true } },
                        batch: { select: { name: true } },
                        optedDepartment: { select: { name: true, code: true } },
                        cycleDepartment: { select: { name: true, code: true } },
                        parentProfile: {
                            include: { user: { select: { name: true } } },
                        },
                    },
                },
                escalatedTo: { select: { id: true, name: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { content: true, createdAt: true, senderUserId: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Add unread count per conversation, flatten for frontend
        const result = await Promise.all(
            conversations.map(async (conv) => {
                const unreadCount = await prisma.chatMessage.count({
                    where: {
                        conversationId: conv.id,
                        senderUserId: { not: userId },
                        isRead: false,
                    },
                });

                // Flatten: lastMessage → string, escalatedTo → adminUser
                const { messages: lastMsgs, escalatedTo, studentProfile, ...rest } = conv;
                return {
                    ...rest,
                    studentProfile: {
                        id: studentProfile.id,
                        user: studentProfile.user,
                        admissionId: studentProfile.admissionId,
                        rollNumber: studentProfile.rollNumber,
                        permanentUsn: studentProfile.permanentUsn,
                        temporaryUsn: studentProfile.temporaryUsn,
                        currentSemester: studentProfile.currentSemester,
                        section: studentProfile.section,
                        batch: studentProfile.batch,
                        department: studentProfile.optedDepartment || studentProfile.cycleDepartment,
                        parentName: studentProfile.parentProfile?.user?.name || null,
                        parentRelationship: studentProfile.parentProfile?.relationship || null,
                    },
                    adminUser: escalatedTo,
                    lastMessage: lastMsgs[0]?.content || null,
                    lastMessageAt: lastMsgs[0]?.createdAt?.toISOString() || conv.lastMessageAt?.toISOString() || null,
                    unreadCount,
                };
            })
        );

        return result;
    }

    /**
     * Get paginated messages for a conversation.
     */
    async getMessages(conversationId: number, userId: number, cursor?: number, limit = 50) {
        // Verify access
        const conversation = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) throw new Error('Conversation not found');

        const isParticipant =
            conversation.parentUserId === userId ||
            conversation.mentorUserId === userId ||
            conversation.escalatedToId === userId;
        if (!isParticipant) throw new Error('You are not part of this conversation');

        const messages = await prisma.chatMessage.findMany({
            where: {
                conversationId,
                ...(cursor ? { id: { lt: cursor } } : {}),
            },
            include: {
                sender: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        // Flatten sender info to match frontend Message interface
        const flatMessages = messages.reverse().map((msg) => ({
            id: msg.id,
            content: msg.content,
            senderId: msg.sender.id,
            senderName: msg.sender.name,
            senderRole: msg.sender.role,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
        }));

        return {
            messages: flatMessages,
            hasMore: messages.length === limit,
        };
    }

    /**
     * Mark all messages in a conversation as read for a user.
     */
    async markAsRead(conversationId: number, userId: number) {
        const conversation = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) throw new Error('Conversation not found');

        const isParticipant =
            conversation.parentUserId === userId ||
            conversation.mentorUserId === userId ||
            conversation.escalatedToId === userId;
        if (!isParticipant) throw new Error('You are not part of this conversation');

        await prisma.chatMessage.updateMany({
            where: {
                conversationId,
                senderUserId: { not: userId },
                isRead: false,
            },
            data: { isRead: true },
        });

        return { success: true };
    }

    /**
     * Check if a conversation can be escalated (24h with no mentor reply).
     */
    async canEscalate(conversationId: number): Promise<boolean> {
        const conversation = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) return false;
        if (conversation.isEscalated) return false;
        if (!conversation.lastMessageAt) return false;

        const hoursSinceLastMessage =
            (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60);

        // Can escalate if:
        // 1. Last message was sent > 24h ago
        // 2. Mentor hasn't replied since that message (or never replied)
        if (hoursSinceLastMessage < ESCALATION_HOURS) return false;

        if (!conversation.lastMentorReplyAt) return true; // Mentor never replied
        return conversation.lastMentorReplyAt < conversation.lastMessageAt;
    }

    /**
     * Escalate a conversation to the department admin.
     */
    async escalateToAdmin(conversationId: number, parentUserId: number) {
        const conversation = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
            include: { studentProfile: true },
        });
        if (!conversation) throw new Error('Conversation not found');
        if (conversation.parentUserId !== parentUserId) throw new Error('Unauthorized');
        if (conversation.isEscalated) throw new Error('Already escalated');

        // Check escalation eligibility
        const eligible = await this.canEscalate(conversationId);
        if (!eligible) {
            throw new Error('Cannot escalate yet. Please wait 24 hours after your last message with no mentor response.');
        }

        // Find the department admin
        const studentProfile = conversation.studentProfile;
        const deptId = studentProfile.optedDepartmentId || studentProfile.cycleDepartmentId;

        if (!deptId) {
            throw new Error('Cannot determine department for escalation');
        }

        const deptAdmin = await prisma.user.findFirst({
            where: {
                departmentId: deptId,
                role: 'DEPARTMENT_ADMIN',
                isActive: true,
                tenantId: conversation.tenantId,
            },
        });

        if (!deptAdmin) {
            throw new Error('No department admin found for escalation');
        }

        const updated = await prisma.chatConversation.update({
            where: { id: conversationId },
            data: {
                isEscalated: true,
                escalatedAt: new Date(),
                escalatedToId: deptAdmin.id,
            },
        });

        // Send a system message about escalation
        await prisma.chatMessage.create({
            data: {
                conversationId,
                senderUserId: parentUserId,
                content: '⚠️ This conversation has been escalated to the Department Admin due to no response from the mentor.',
            },
        });

        log.info({ conversationId, deptAdminId: deptAdmin.id }, 'Chat escalated to department admin');
        return updated;
    }

    /**
     * Resolve a conversation (mentor or dept admin).
     */
    async resolveConversation(conversationId: number, userId: number) {
        const conversation = await prisma.chatConversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) throw new Error('Conversation not found');

        const canResolve =
            conversation.mentorUserId === userId ||
            conversation.escalatedToId === userId;
        if (!canResolve) throw new Error('Only the mentor or admin can resolve this conversation');

        return prisma.chatConversation.update({
            where: { id: conversationId },
            data: { status: 'RESOLVED' },
        });
    }

    /**
     * Get total unread message count for a user.
     */
    async getUnreadCount(userId: number, role: string): Promise<number> {
        const convWhere: Prisma.ChatConversationWhereInput = {};

        if (role === 'PARENT') {
            convWhere.parentUserId = userId;
        } else if (role === 'TEACHER') {
            convWhere.mentorUserId = userId;
        } else if (role === 'DEPARTMENT_ADMIN') {
            convWhere.isEscalated = true;
            convWhere.escalatedToId = userId;
        } else {
            return 0;
        }

        return prisma.chatMessage.count({
            where: {
                conversation: convWhere,
                senderUserId: { not: userId },
                isRead: false,
            },
        });
    }
    /**
     * Edit a message (only within 15 seconds of sending).
     */
    async editMessage(messageId: number, userId: number, newContent: string) {
        if (!newContent || newContent.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }
        if (newContent.length > 2000) {
            throw new Error('Message cannot exceed 2000 characters');
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
        });
        if (!message) throw new Error('Message not found');
        if (message.senderUserId !== userId) throw new Error('You can only edit your own messages');

        // Check 15-second window
        const elapsedMs = Date.now() - message.createdAt.getTime();
        const EDIT_WINDOW_MS = 15 * 1000; // 15 seconds
        if (elapsedMs > EDIT_WINDOW_MS) {
            throw new Error('Edit window expired. Messages can only be edited within 15 seconds of sending.');
        }

        const updated = await prisma.chatMessage.update({
            where: { id: messageId },
            data: { content: newContent.trim() },
            include: {
                sender: { select: { id: true, name: true, role: true } },
            },
        });

        return {
            id: updated.id,
            content: updated.content,
            senderId: updated.sender.id,
            senderName: updated.sender.name,
            senderRole: updated.sender.role,
            createdAt: updated.createdAt,
            isRead: updated.isRead,
        };
    }

    /**
     * Get mentee students for a teacher to initiate chats.
     */
    async getMenteeStudentsForChat(teacherUserId: number) {
        // Get teacher profile
        const teacherProfile = await prisma.teacherProfile.findUnique({
            where: { userId: teacherUserId },
        });
        if (!teacherProfile) throw new Error('Teacher profile not found');

        // Get active mentee assignments
        const assignments = await prisma.mentorAssignment.findMany({
            where: {
                teacherProfileId: teacherProfile.id,
                isActive: true,
            },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { name: true } },
                        section: { select: { name: true } },
                        batch: { select: { name: true } },
                        optedDepartment: { select: { name: true, code: true } },
                        cycleDepartment: { select: { name: true, code: true } },
                        parentProfile: {
                            include: { user: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
        });

        // Get existing conversations for this teacher
        const existingConvs = await prisma.chatConversation.findMany({
            where: { mentorUserId: teacherUserId },
            select: { studentProfileId: true, id: true },
        });
        const convMap = new Map(existingConvs.map(c => [c.studentProfileId, c.id]));

        return assignments.map(a => {
            const sp = a.studentProfile;
            return {
                studentProfileId: sp.id,
                studentName: sp.user.name,
                rollNumber: sp.rollNumber,
                usn: sp.permanentUsn || sp.temporaryUsn || sp.rollNumber,
                currentSemester: sp.currentSemester,
                section: sp.section?.name || null,
                batch: sp.batch?.name || null,
                department: sp.optedDepartment?.code || sp.cycleDepartment?.code || null,
                parentName: sp.parentProfile?.user?.name || null,
                parentUserId: sp.parentProfile?.user?.id || null,
                hasParent: !!sp.parentProfile,
                existingConversationId: convMap.get(sp.id) || null,
            };
        });
    }
}

export const chatService = new ChatService();
