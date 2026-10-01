import prisma from '../data-access/prisma.js';
import { NoduePaymentStatus, NodueDueType } from '@prisma/client';
import crypto from 'crypto';

class NoduePaymentService {
    async createPaymentOrder(tenantId: number, studentId: number, enrollmentId: number | null, amount: number, dueType: NodueDueType) {
        const gatewayOrderId = `ORD_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        
        return prisma.noduePaymentOrder.create({
            data: {
                tenantId,
                studentId,
                enrollmentId,
                amount,
                gatewayOrderId,
                dueType,
                status: NoduePaymentStatus.CREATED,
            },
        });
    }

    async processPaymentWebhook(gatewayOrderId: string, gatewayPaymentId: string, amountPaid: number) {
        const order = await prisma.noduePaymentOrder.findUnique({
            where: { gatewayOrderId },
        });

        if (!order) throw new Error('Payment order not found');

        const updatedOrder = await prisma.noduePaymentOrder.update({
            where: { id: order.id },
            data: {
                gatewayPaymentId,
                amountPaid,
                status: NoduePaymentStatus.PAID,
                paidAt: new Date(),
            },
        });

        if (order.enrollmentId) {
            await prisma.nodueSubjectEnrollment.update({
                where: { id: order.enrollmentId },
                data: {
                    attendanceFeeVerified: true,
                    paymentDate: new Date(),
                },
            });
        }

        return updatedOrder;
    }

    async getPaymentOrders(tenantId: number, studentId?: number) {
        const where: any = { tenantId };
        if (studentId) where.studentId = studentId;

        return prisma.noduePaymentOrder.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }
}

export const noduePaymentService = new NoduePaymentService();
