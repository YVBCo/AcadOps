import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().url(),
    DIRECT_DATABASE_URL: z.string().url().optional(),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // JWT
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Server
    PORT: z.string().default('4000').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // CORS
    ALLOWED_ORIGINS: z.string().default('http://localhost:3001'),

    // Logging
    LOG_LEVEL: z.string().default('info'),

    // S3 (optional)
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET: z.string().optional(),

    // SMTP (optional - for email notifications)
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.string().default('587').transform(Number),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('Academic Ops <noreply@acadops.edu>'),

    // Brevo (HTTP email API — recommended for Railway/cloud)
    BREVO_API_KEY: z.string().optional(),
    BREVO_FROM: z.string().optional(),

    // SMS (optional - for parent notifications)
    SMS_ENABLED: z.string().default('false').transform(v => v === 'true'),
    FAST2SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().default('ACADOP'),

    // Frontend URL (for email links)
    FRONTEND_URL: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = {
    database: {
        url: parsed.data.DATABASE_URL,
        directUrl: parsed.data.DIRECT_DATABASE_URL,
    },
    redis: {
        url: parsed.data.REDIS_URL,
    },
    jwt: {
        secret: parsed.data.JWT_SECRET,
        refreshSecret: parsed.data.JWT_REFRESH_SECRET,
        accessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
        refreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
    },
    server: {
        port: parsed.data.PORT,
        nodeEnv: parsed.data.NODE_ENV,
        isDev: parsed.data.NODE_ENV === 'development',
        isProd: parsed.data.NODE_ENV === 'production',
        allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((s: string) => s.trim()),
        logLevel: parsed.data.LOG_LEVEL,
    },
    s3: {
        endpoint: parsed.data.S3_ENDPOINT,
        accessKey: parsed.data.S3_ACCESS_KEY,
        secretKey: parsed.data.S3_SECRET_KEY,
        bucket: parsed.data.S3_BUCKET,
    },
    smtp: {
        host: parsed.data.SMTP_HOST,
        port: parsed.data.SMTP_PORT,
        user: parsed.data.SMTP_USER,
        pass: parsed.data.SMTP_PASS,
        from: parsed.data.SMTP_FROM,
        brevoApiKey: parsed.data.BREVO_API_KEY,
        brevoFrom: parsed.data.BREVO_FROM,
    },
    sms: {
        enabled: parsed.data.SMS_ENABLED,
        fast2smsApiKey: parsed.data.FAST2SMS_API_KEY,
        senderId: parsed.data.SMS_SENDER_ID,
    },
    frontendUrl: parsed.data.FRONTEND_URL,
} as const;

export type Config = typeof config;
