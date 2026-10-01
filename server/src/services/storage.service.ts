/**
 * Storage Service — Abstraction for file uploads
 * 
 * Supports two backends:
 * - **local**: Files stored on disk under `uploads/` (development / single-instance)
 * - **s3**: Files stored in S3-compatible storage (production / multi-instance)
 * 
 * The backend is selected automatically based on the S3 env vars.
 * When S3 is configured, all uploads go to the bucket and public URLs are returned.
 * When S3 is not configured, falls back to local filesystem (existing behavior).
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

const log = logger.child({ module: 'storage' });

export type StorageBackend = 's3' | 'local';

export interface UploadResult {
    /** Public URL to access the file */
    url: string;
    /** Storage key (S3 key or relative path) */
    key: string;
    /** Which backend was used */
    backend: StorageBackend;
}

class StorageService {
    private s3Client: S3Client | null = null;
    private bucket: string = '';
    readonly backend: StorageBackend;

    constructor() {
        const { endpoint, accessKey, secretKey, bucket } = config.s3;

        if (endpoint && accessKey && secretKey && bucket) {
            this.backend = 's3';
            this.bucket = bucket;
            this.s3Client = new S3Client({
                endpoint,
                region: 'auto', // Cloudflare R2 uses 'auto'
                credentials: {
                    accessKeyId: accessKey,
                    secretAccessKey: secretKey,
                },
                forcePathStyle: true, // Required for MinIO / R2
            });
            log.info({ endpoint, bucket }, 'Storage backend: S3-compatible');
        } else {
            this.backend = 'local';
            log.info('Storage backend: Local filesystem (set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET for cloud storage)');
        }
    }

    // ─── Upload ────────────────────────────────────────────────────

    /**
     * Upload a file buffer to storage.
     * @param buffer - File content
     * @param key - Storage path (e.g. 'login-bg/bg-123.png')
     * @param contentType - MIME type
     * @returns Upload result with public URL
     */
    async upload(buffer: Buffer, key: string, contentType: string): Promise<UploadResult> {
        if (this.backend === 's3') {
            return this.uploadToS3(buffer, key, contentType);
        }
        return this.uploadToLocal(buffer, key);
    }

    /**
     * Upload a multer file to storage.
     * Convenience method that handles both memory and disk storage multer files.
     */
    async uploadFile(file: Express.Multer.File, directory: string): Promise<UploadResult> {
        const ext = path.extname(file.originalname) || '.png';
        const sanitizedName = file.originalname
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50);
        const key = `${directory}/${Date.now()}-${sanitizedName}`;
        const contentType = file.mimetype || 'application/octet-stream';

        // Get buffer from either memory or disk storage
        const buffer = file.buffer || fs.readFileSync(file.path);

        return this.upload(buffer, key, contentType);
    }

    // ─── Delete ────────────────────────────────────────────────────

    /**
     * Delete a file from storage by key.
     */
    async delete(key: string): Promise<void> {
        if (this.backend === 's3') {
            return this.deleteFromS3(key);
        }
        return this.deleteFromLocal(key);
    }

    // ─── Signed URLs ──────────────────────────────────────────────

    /**
     * Get a signed URL for private file access (S3 only).
     * Falls back to the public path for local storage.
     */
    async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
        if (this.backend === 's3' && this.s3Client) {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
            });
            return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
        }
        // Local: return the public path
        return `/uploads/${key}`;
    }

    // ─── S3 Implementation ────────────────────────────────────────

    private async uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<UploadResult> {
        if (!this.s3Client) throw new Error('S3 client not initialized');

        try {
            await this.s3Client.send(new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            }));

            // Build public URL
            const endpoint = config.s3.endpoint!;
            const url = `${endpoint}/${this.bucket}/${key}`;

            log.info({ key, contentType, size: buffer.length }, 'File uploaded to S3');
            return { url, key, backend: 's3' };
        } catch (err) {
            log.error({ err, key }, 'S3 upload failed');
            throw new Error(`Storage upload failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async deleteFromS3(key: string): Promise<void> {
        if (!this.s3Client) throw new Error('S3 client not initialized');

        try {
            await this.s3Client.send(new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
            log.info({ key }, 'File deleted from S3');
        } catch (err) {
            log.error({ err, key }, 'S3 delete failed');
            throw new Error(`Storage delete failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // ─── Local Implementation ─────────────────────────────────────

    private async uploadToLocal(buffer: Buffer, key: string): Promise<UploadResult> {
        const fullPath = path.join(process.cwd(), 'uploads', key);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, buffer);

        const url = `/uploads/${key}`;
        log.info({ key, size: buffer.length }, 'File uploaded to local storage');
        return { url, key, backend: 'local' };
    }

    private async deleteFromLocal(key: string): Promise<void> {
        const fullPath = path.join(process.cwd(), 'uploads', key);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            log.info({ key }, 'File deleted from local storage');
        }
    }
}

export const storageService = new StorageService();
