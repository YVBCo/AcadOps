import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'developer' });

export interface DevJwtPayload {
    developerId: number;
    email: string;
    isDeveloper: true;
}

export interface DevLoginData {
    email: string;
    password: string;
}

export interface DevAuthResult {
    developer: { id: number; email: string; name: string };
    token: string;
}

class DeveloperService {
    async hashPassword(password: string): Promise<string> {
        return argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
    }

    async verifyPassword(hash: string, password: string): Promise<boolean> {
        return argon2.verify(hash, password);
    }

    generateToken(payload: DevJwtPayload): string {
        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: '7d',
        } as jwt.SignOptions);
    }

    verifyToken(token: string): DevJwtPayload {
        return jwt.verify(token, config.jwt.secret) as DevJwtPayload;
    }

    /**
     * Login developer
     */
    async login(data: DevLoginData): Promise<DevAuthResult> {
        const developer = await prisma.developer.findUnique({
            where: { email: data.email },
        });

        if (!developer || !developer.isActive) {
            throw new Error('Invalid credentials');
        }

        const isValid = await this.verifyPassword(developer.passwordHash, data.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const token = this.generateToken({
            developerId: developer.id,
            email: developer.email,
            isDeveloper: true,
        });

        return {
            developer: { id: developer.id, email: developer.email, name: developer.name },
            token,
        };
    }

    /**
     * Create developer account (only callable by existing developer)
     */
    async create(email: string, password: string, name: string) {
        const existing = await prisma.developer.findUnique({ where: { email } });
        if (existing) throw new Error('Email already registered');

        const passwordHash = await this.hashPassword(password);
        return prisma.developer.create({
            data: { email, passwordHash, name },
            select: { id: true, email: true, name: true, isActive: true, createdAt: true },
        });
    }

    /**
     * Seed initial developer if none exists
     */
    async seedIfEmpty(): Promise<void> {
        const count = await prisma.developer.count();
        if (count === 0) {
            const seedPassword = process.env.DEV_SEED_PASSWORD;
            if (config.server.isProd && !seedPassword) {
                log.warn('No developer account exists — set DEV_SEED_PASSWORD env var to create one');
                return;
            }
            const password = seedPassword || 'dev123';
            const passwordHash = await this.hashPassword(password);
            await prisma.developer.create({
                data: {
                    email: 'dev@system.com',
                    passwordHash,
                    name: 'System Developer',
                },
            });
            if (seedPassword) {
                log.info('Developer account created (password from DEV_SEED_PASSWORD)');
            } else {
                log.warn('Developer account created with default password (dev only)');
            }
        }
    }

    /**
     * Get developer from token
     */
    async getFromToken(token: string) {
        try {
            const payload = this.verifyToken(token);
            if (!payload.isDeveloper) return null;
            return prisma.developer.findUnique({
                where: { id: payload.developerId },
                select: { id: true, email: true, name: true, isActive: true },
            });
        } catch {
            return null;
        }
    }
}

export const developerService = new DeveloperService();
