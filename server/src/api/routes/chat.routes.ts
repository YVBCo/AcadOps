import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { chatService } from '../../services/chat.service.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

const CHAT_ROLES: UserRole[] = ['PARENT', 'TEACHER', 'DEPARTMENT_ADMIN'];

// GET /api/chat/conversations — list conversations for current user
router.get('/conversations', requireRole(...CHAT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversations = await chatService.getConversations(
            req.user!.userId,
            req.user!.role
        );
        res.json(conversations);
    } catch (error) {
        next(error);
    }
});

// Teacher-initiated conversation handler (shared logic)
const handleTeacherConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileId = parseIntParam(req.params.studentProfileId as string, 'studentProfileId');
        const conversation = await chatService.getOrCreateConversationByTeacher(
            req.user!.userId,
            studentProfileId
        );
        res.json(conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/chat/teacher-conversations/:studentProfileId — teacher-initiated (primary path)
router.post('/teacher-conversations/:studentProfileId', requireRole('TEACHER'), handleTeacherConversation);

// POST /api/chat/conversations/teacher/:studentProfileId — teacher-initiated (legacy path)
router.post('/conversations/teacher/:studentProfileId', requireRole('TEACHER'), handleTeacherConversation);

// POST /api/chat/conversations/:studentProfileId — start/get conversation with mentor (parent-initiated)
router.post('/conversations/:studentProfileId', requireRole('PARENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileId = parseIntParam(req.params.studentProfileId as string, 'studentProfileId');
        const conversation = await chatService.getOrCreateConversation(
            req.user!.userId,
            studentProfileId
        );
        res.json(conversation);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/conversations/:id/messages — get messages
router.get('/conversations/:id/messages', requireRole(...CHAT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = parseIntParam(req.params.id as string, 'id');
        const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

        const data = await chatService.getMessages(
            conversationId,
            req.user!.userId,
            cursor,
            Math.min(limit, 100)
        );
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/conversations/:id/messages — send a message
router.post('/conversations/:id/messages', requireRole(...CHAT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = parseIntParam(req.params.id as string, 'id');
        const { content } = req.body;

        if (!content || typeof content !== 'string') {
            res.status(400).json({ error: 'Message content is required' });
            return;
        }

        const message = await chatService.sendMessage(
            conversationId,
            req.user!.userId,
            content
        );
        res.status(201).json(message);
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/conversations/:id/read — mark messages as read
router.post('/conversations/:id/read', requireRole(...CHAT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = parseIntParam(req.params.id as string, 'id');
        const result = await chatService.markAsRead(conversationId, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/conversations/:id/can-escalate — check escalation eligibility
router.get('/conversations/:id/can-escalate', requireRole('PARENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = parseIntParam(req.params.id as string, 'id');
        const canEscalate = await chatService.canEscalate(conversationId);
        res.json({ canEscalate });
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/conversations/:id/escalate — escalate to dept admin
router.post('/conversations/:id/escalate', requireRole('PARENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = parseIntParam(req.params.id as string, 'id');
        const result = await chatService.escalateToAdmin(conversationId, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/conversations/:id/resolve — resolve conversation
router.post('/conversations/:id/resolve', requireRole('TEACHER', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const conversationId = parseIntParam(req.params.id as string, 'id');
        const result = await chatService.resolveConversation(conversationId, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/unread-count — total unread count
router.get('/unread-count', requireRole(...CHAT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const count = await chatService.getUnreadCount(req.user!.userId, req.user!.role);
        res.json({ unreadCount: count });
    } catch (error) {
        next(error);
    }
});

// PUT /api/chat/messages/:id — edit a message (within 15 seconds)
router.put('/messages/:id', requireRole(...CHAT_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const messageId = parseIntParam(req.params.id as string, 'id');
        const { content } = req.body;

        if (!content || typeof content !== 'string') {
            res.status(400).json({ error: 'Message content is required' });
            return;
        }

        const message = await chatService.editMessage(messageId, req.user!.userId, content);
        res.json(message);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/mentee-students — get mentee students for starting chats (teacher only)
router.get('/mentee-students', requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const students = await chatService.getMenteeStudentsForChat(req.user!.userId);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

export default router;
