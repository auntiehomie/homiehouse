import { Upload } from 'tus-js-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoUploadOptions {
  /** tus-compatible upload endpoint (defaults to /api/upload-video). */
  endpoint?: string;

  /** Additional key-value metadata sent to the tus server. */
  metadata?: Record<string, string>;

  /** Progress callback. */
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;

  /** Error callback. */
  onError?: (error: Error) => void;

  /** Called when the upload starts (useful for obtaining the upload ID). */
  onStart?: (upload: Upload) => void;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Upload a video file using tus resumable upload protocol.
 *
 * Returns a Promise that resolves with the upload URL on success.
 * Progress is reported via the optional onProgress callback.
 *
 * @example
 * ```ts
 * const url = await uploadVideo(file, {
 *   onProgress: (uploaded, total) => console.log(`${uploaded}/${total}`),
 * });
 * ```
 */
export function uploadVideo(
  file: File,
  options: VideoUploadOptions = {},
): Promise<string> {
  const {
    endpoint = '/api/upload-video',
    metadata: extraMetadata,
    onProgress,
    onError,
    onStart,
  } = options;

  return new Promise<string>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,

      metadata: {
        filename: file.name,
        filetype: file.type,
        ...extraMetadata,
      },

      // 1 MB chunks provide a good balance between network overhead and
      // resumption granularity.
      chunkSize: 1024 * 1024,

      // Retry with exponential-ish backoff (immediate, 1s, 3s, 5s).
      retryDelays: [0, 1000, 3000, 5000],

      // Allow up to 3 retries before failing permanently.
      onShouldRetry: (err, _retryAttempt, _options) => {
        // Retry on network / server errors; do NOT retry on 4xx client errors.
        if (!err.originalResponse) return true;
        const status = err.originalResponse.getStatus();
        return status >= 500 || status === 0;
      },

      onError: (error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        reject(err);
      },

      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(bytesUploaded, bytesTotal);
      },

      onSuccess: () => {
        // tus-js-client stores the upload URL on the instance after success.
        resolve(upload.url || '');
      },

      onAfterResponse: (_req, _res) => {
        // Stub - extend if you need to read response headers.
      },
    });

    onStart?.(upload);
    upload.start();
  });
}
