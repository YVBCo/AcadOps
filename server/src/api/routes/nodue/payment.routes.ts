import { Router, Request, Response, NextFunction } from 'express';
import { noduePaymentService } from '../../../services/nodue-payment.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { z } from 'zod';
import { NodueDueType } from '@prisma/client';

const router = Router();

const createOrderSchema = z.object({
    enrollmentId: z.number().nullable(),
    amount: z.number(),
    dueType: z.nativeEnum(NodueDueType),
});

router.post('/create-order', authenticate, requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createOrderSchema.parse(req.body);
        const order = await noduePaymentService.createPaymentOrder(
            req.tenantId!,
            req.user!.userId,
            data.enrollmentId,
            data.amount,
            data.dueType
        );
        res.json(order);
    } catch (error) {
        next(error);
    }
});

const webhookSchema = z.object({
    gatewayOrderId: z.string(),
    gatewayPaymentId: z.string(),
    amountPaid: z.number(),
    signature: z.string(), // normally verified
});

router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = webhookSchema.parse(req.body);
        // Signature verification would go here in reality
        
        const result = await noduePaymentService.processPaymentWebhook(
            data.gatewayOrderId,
            data.gatewayPaymentId,
            data.amountPaid
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/orders', authenticate, requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orders = await noduePaymentService.getPaymentOrders(req.tenantId!, req.user!.userId);
        res.json(orders);
    } catch (error) {
        next(error);
    }
});

export default router;
