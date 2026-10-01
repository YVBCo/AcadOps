/**
 * Storage Service Unit Tests
 * Tests both local and S3 backends with full coverage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs at module level (ESM-compatible)
vi.mock('fs', () => ({
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    readFileSync: vi.fn(() => Buffer.from('data')),
}));

// Mock the config before importing the service
vi.mock('../config/env.js', () => ({
    config: {
        s3: {
            endpoint: undefined,
            accessKey: undefined,
            secretKey: undefined,
            bucket: undefined,
        },
    },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
        }),
    },
}));

import * as fs from 'fs';

describe('StorageService — Local Backend', () => {
    let storageService: any;

    beforeEach(async () => {
        vi.resetModules();
        // Re-import to get a fresh instance
        const mod = await import('../services/storage.service.js');
        storageService = mod.storageService;
        vi.clearAllMocks();
    });

    it('should default to local backend when S3 vars are not set', () => {
        expect(storageService.backend).toBe('local');
    });

    it('should upload file to local filesystem', async () => {
        const buffer = Buffer.from('test image data');
        const result = await storageService.upload(buffer, 'test/image.png', 'image/png');

        expect(result.backend).toBe('local');
        expect(result.url).toBe('/uploads/test/image.png');
        expect(result.key).toBe('test/image.png');
        expect(fs.mkdirSync).toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should delete file from local filesystem', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        await storageService.delete('test/image.png');
        expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should not throw when deleting non-existent local file', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        await expect(storageService.delete('nonexistent.png')).resolves.not.toThrow();
    });

    it('should return local path for getSignedUrl', async () => {
        const url = await storageService.getSignedUrl('test/image.png');
        expect(url).toBe('/uploads/test/image.png');
    });

    it('should handle multer file upload', async () => {
        const mockFile = {
            originalname: 'photo.jpg',
            mimetype: 'image/jpeg',
            buffer: Buffer.from('jpeg data'),
            size: 9,
        } as Express.Multer.File;

        const result = await storageService.uploadFile(mockFile, 'form-logos');

        expect(result.backend).toBe('local');
        expect(result.key).toContain('form-logos/');
        expect(result.key).toContain('photo.jpg');
        expect(result.url).toContain('/uploads/form-logos/');
    });

    it('should sanitize filenames with special characters', async () => {
        const mockFile = {
            originalname: 'my file (1) [copy].png',
            mimetype: 'image/png',
            buffer: Buffer.from('data'),
            size: 4,
        } as Express.Multer.File;

        const result = await storageService.uploadFile(mockFile, 'test');
        // Should not contain spaces, parens, or brackets
        expect(result.key).not.toContain(' ');
        expect(result.key).not.toContain('(');
        expect(result.key).not.toContain('[');
    });
});
