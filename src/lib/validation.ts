/**
 * Input validation utilities
 */

import { ValidationError } from './errors';

/**
 * Validate cast text content
 */
export function validateCastText(text: string): string {
  if (!text || typeof text !== 'string') {
    throw new ValidationError('Cast text is required', 'text');
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('Cast text cannot be empty', 'text');
  }

  // Farcaster limit is 320 characters
  if (trimmed.length > 320) {
    throw new ValidationError('Cast text exceeds 320 character limit', 'text');
  }

  return trimmed;
}

/**
 * Validate Farcaster ID (FID)
 */
export function validateFid(fid: string | number | null | undefined): number {
  if (fid === null || fid === undefined) {
    throw new ValidationError('FID is required', 'fid');
  }

  const fidNum = typeof fid === 'string' ? parseInt(fid, 10) : fid;

  if (isNaN(fidNum) || fidNum <= 0) {
    throw new ValidationError('FID must be a positive integer', 'fid');
  }

  return fidNum;
}

/**
 * Validate UUID format
 */
export function validateUuid(uuid: string, fieldName: string = 'uuid'): string {
  if (!uuid || typeof uuid !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  // Basic UUID format check (8-4-4-4-12 hex characters)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(uuid)) {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }

  return uuid;
}

/**
 * Validate hash (cast hash, etc.)
 */
export function validateHash(hash: string, fieldName: string = 'hash'): string {
  if (!hash || typeof hash !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  // Hash should be hex string, typically 0x followed by hex characters
  const hashRegex = /^0x[0-9a-f]{40}$/i;
  
  if (!hashRegex.test(hash)) {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }

  return hash;
}

/**
 * Validate URL
 */
export function validateUrl(url: string, fieldName: string = 'url'): string {
  if (!url || typeof url !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ValidationError(`${fieldName} must use http or https protocol`, fieldName);
    }
    
    return url;
  } catch {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }
}

/**
 * Validate channel key
 */
export function validateChannelKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('Channel key is required', 'channelKey');
  }

  // Channel keys are typically alphanumeric with hyphens
  const channelKeyRegex = /^[a-z0-9-]+$/i;
  
  if (!channelKeyRegex.test(key)) {
    throw new ValidationError('Invalid channel key format', 'channelKey');
  }

  if (key.length > 100) {
    throw new ValidationError('Channel key is too long', 'channelKey');
  }

  return key;
}

/**
 * Validate username
 */
export function validateUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    throw new ValidationError('Username is required', 'username');
  }

  const trimmed = username.trim();

  // Remove @ prefix if present
  const cleanUsername = trimmed.startsWith('@') ? trimmed.substring(1) : trimmed;

  if (cleanUsername.length === 0) {
    throw new ValidationError('Username cannot be empty', 'username');
  }

  // Username should be alphanumeric with hyphens and underscores
  const usernameRegex = /^[a-z0-9_-]+$/i;
  
  if (!usernameRegex.test(cleanUsername)) {
    throw new ValidationError('Invalid username format', 'username');
  }

  if (cleanUsername.length > 50) {
    throw new ValidationError('Username is too long', 'username');
  }

  return cleanUsername;
}

/**
 * Validate pagination limit
 */
export function validateLimit(limit: string | number | null | undefined, max: number = 100): number {
  if (limit === null || limit === undefined) {
    return 25; // Default
  }

  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;

  if (isNaN(limitNum) || limitNum <= 0) {
    throw new ValidationError('Limit must be a positive integer', 'limit');
  }

  if (limitNum > max) {
    throw new ValidationError(`Limit cannot exceed ${max}`, 'limit');
  }

  return limitNum;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): void {
  if (!file) {
    throw new ValidationError('File is required', 'file');
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    throw new ValidationError('File must be an image', 'file');
  }

  // Check file size (10MB max)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    throw new ValidationError('File size exceeds 10MB limit', 'file');
  }

  // Check for specific allowed types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      'File type not supported. Allowed: JPEG, PNG, GIF, WebP',
      'file'
    );
  }
}

/**
 * Validate embeds array
 */
export function validateEmbeds(embeds: any): any[] {
  if (!embeds) {
    return [];
  }

  if (!Array.isArray(embeds)) {
    throw new ValidationError('Embeds must be an array', 'embeds');
  }

  if (embeds.length > 2) {
    throw new ValidationError('Maximum 2 embeds allowed per cast', 'embeds');
  }

  // Validate each embed has a URL
  embeds.forEach((embed, index) => {
    if (!embed || typeof embed !== 'object') {
      throw new ValidationError(`Embed ${index + 1} is invalid`, 'embeds');
    }
    
    if (!embed.url) {
      throw new ValidationError(`Embed ${index + 1} must have a URL`, 'embeds');
    }

    try {
      new URL(embed.url);
    } catch {
      throw new ValidationError(`Embed ${index + 1} has invalid URL`, 'embeds');
    }
  });

  return embeds;
}

/**
 * Sanitize text to prevent XSS and injection attacks
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');
  
  // Trim
  sanitized = sanitized.trim();
  
  return sanitized;
}
