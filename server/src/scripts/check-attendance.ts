import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'check-attendance' });

async function main() {
    // Find all deactivated users (excluding soft-deleted ones)
    const deactivated = await prisma.user.findMany({
        where: {
            isActive: false,
            NOT: { email: { startsWith: 'deleted_' } },
        },
        select: { id: true, email: true, name: true, role: true, tenantId: true, isActive: true },
    });

    log.info({ count: deactivated.length }, 'Found deactivated (non-deleted) users');
    deactivated.forEach(u => log.info({ id: u.id, email: u.email, role: u.role, tenantId: u.tenantId }, 'Deactivated user'));

    // Reactivate them all
    const result = await prisma.user.updateMany({
        where: {
            isActive: false,
            NOT: { email: { startsWith: 'deleted_' } },
        },
        data: { isActive: true },
    });

    log.info({ count: result.count }, 'Reactivated users');

    await prisma.$disconnect();
}

main().catch(e => { log.error({ err: e }, 'Script failed'); process.exit(1); });
