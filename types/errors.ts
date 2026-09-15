export type AppErrorCode =
  | 'network'
  | 'offline'
  | 'rate_limit'
  | 'auth_expired'
  | 'insufficient_permission'
  | 'not_professional'
  | 'not_found'
  | 'private_account'
  | 'invalid_response'
  | 'unsupported_metric'
  | 'login_required'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: AppErrorCode,
    message?: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = options?.status;
    this.retryable = options?.retryable ?? (code === 'network' || code === 'offline' || code === 'rate_limit');
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof AppError ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AppError')
  );
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network request failed') || msg.includes('failed to fetch') || msg.includes('timeout')) {
      return new AppError('network', err.message, { cause: err });
    }
    return new AppError('unknown', err.message, { cause: err });
  }
  return new AppError('unknown', typeof err === 'string' ? err : 'Unknown error');
}
