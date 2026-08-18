/**
 * Centralized error handling utilities
 */

import { NextResponse } from 'next/server';

/**
 * Generic Farcaster API error — provider-agnostic.
 * Use this for new code; PinataError is an alias for back-compat.
 */
export class FarcasterAPIError extends Error {
  constructor(
    public details: string,
    public status: number = 500,
    public code: string = 'FARCASTER_API_ERROR'
  ) {
    super('Farcaster API error');
    this.name = 'FarcasterAPIError';
  }
}

/**
 * Alias for FarcasterAPIError — used by the Pinata connector.
 */
export const PinataError = FarcasterAPIError;
export type PinataError = FarcasterAPIError;

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  constructor(
    public message: string,
    public status: number = 401,
    public code: string = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(
    public message: string,
    public field?: string,
    public status: number = 400,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for rate limiting errors
 */
export class RateLimitError extends Error {
  constructor(
    public message: string = 'Too many requests',
    public status: number = 429,
    public code: string = 'RATE_LIMIT_EXCEEDED'
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Centralized API error handler
 * Converts various error types into appropriate NextResponse objects
 */
export function handleApiError(error: any, context: string): NextResponse {
  console.error(`[${context}] Error:`, error);

  // Handle known error types
  if (error instanceof FarcasterAPIError) {
    return NextResponse.json(
      {
        error: 'Farcaster API request failed',
        details: error.details,
        code: error.code,
      },
      { status: error.status }
    );
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        field: error.field,
        code: error.code,
      },
      { status: error.status }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    );
  }

  // Handle generic errors
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction
    ? 'Internal server error'
    : (error?.message || 'Internal server error');

  return NextResponse.json(
    {
      error: errorMessage,
      // Only include stack traces in development
      ...(isProduction ? {} : { stack: error?.stack }),
    },
    { status: 500 }
  );
}

/**
 * Safe error logger that doesn't expose sensitive data
 */
export function logError(context: string, error: any, metadata?: Record<string, any>) {
  const sanitizedMetadata = metadata ? sanitizeForLogging(metadata) : {};
  
  console.error(`[${context}] Error occurred:`, {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    status: error?.status,
    ...sanitizedMetadata,
  });

  // Only log full error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}] Full error:`, error);
  }
}

/**
 * Sanitize objects for logging by removing sensitive fields
 */
function sanitizeForLogging(obj: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password',
    'apiKey',
    'api_key',
    'token',
    'secret',
    'mnemonic',
    'privateKey',
    'private_key',
  ];

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field name contains sensitive keywords
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
