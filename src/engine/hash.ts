import * as crypto from 'crypto';

/**
 * Computes a normalized SHA-256 hash for an image buffer.
 * For SVG files, normalizes CRLF to LF to prevent cross-platform hash mismatches.
 */
export function computeNormalizedImageHash(buffer: Buffer, ext: string): string {
    let hashBuffer = buffer;
    if (ext.toLowerCase() === '.svg') {
        hashBuffer = Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    }
    const hashSum = crypto.createHash('sha256');
    hashSum.update(hashBuffer);
    return hashSum.digest('hex');
}
