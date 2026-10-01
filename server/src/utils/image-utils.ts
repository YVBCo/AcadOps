/**
 * Image processing utility for converting uploaded images to optimised
 * base64 data URIs suitable for database storage.
 *
 * - Logos: resized to max 256×256, converted to PNG, typically 10–50 KB
 * - Backgrounds: resized to max 1920 wide, converted to WebP (quality 80), typically 100–400 KB
 */
import sharp from 'sharp';
import { logger } from './logger.js';

const log = logger.child({ module: 'image-utils' });

/** Maximum dimensions for each image type */
const LOGO_MAX = 256;
const BG_MAX_WIDTH = 1920;
const BG_MAX_HEIGHT = 1080;

/**
 * Convert a raw image buffer into an optimised base64 data URI for a logo.
 * Output: PNG with transparency support, max 256×256.
 */
export async function bufferToLogoDataUri(buffer: Buffer): Promise<string> {
    const optimised = await sharp(buffer)
        .resize(LOGO_MAX, LOGO_MAX, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90, compressionLevel: 9 })
        .toBuffer();

    const base64 = optimised.toString('base64');
    log.info({ originalKB: Math.round(buffer.length / 1024), optimisedKB: Math.round(optimised.length / 1024) }, 'Logo optimised');
    return `data:image/png;base64,${base64}`;
}

/**
 * Convert a raw image buffer into an optimised base64 data URI for a background.
 * Output: WebP at quality 80, max 1920×1080.
 */
export async function bufferToBgDataUri(buffer: Buffer): Promise<string> {
    const optimised = await sharp(buffer)
        .resize(BG_MAX_WIDTH, BG_MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

    const base64 = optimised.toString('base64');
    log.info({ originalKB: Math.round(buffer.length / 1024), optimisedKB: Math.round(optimised.length / 1024) }, 'Background optimised');
    return `data:image/webp;base64,${base64}`;
}
