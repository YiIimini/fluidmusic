// ============================================================
// FluidMusic — ErrorHandler: centralized error reporting
// ============================================================

export type ErrorSeverity = 'toast' | 'modal' | 'silent';

export interface AppError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  retry?: () => Promise<void>;
}

type ErrorListener = (error: AppError) => void;

export class ErrorHandler {
  private static listeners = new Set<ErrorListener>();

  static handle(error: AppError): void {
    console.error(`[${error.code}]`, error.message);
    this.listeners.forEach(fn => {
      try {
        fn(error);
      } catch (e) {
        /* swallow listener errors */
      }
    });
  }

  static onError(fn: ErrorListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  static wrapAsync<T>(
    code: string,
    fn: () => Promise<T>,
    message?: string
  ): Promise<T | null> {
    return fn().catch(e => {
      this.handle({
        code,
        message: message || e?.message || 'Unknown error',
        severity: 'toast',
        recoverable: true,
      });
      return null;
    });
  }
}
