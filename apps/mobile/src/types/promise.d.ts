/**
 * Type declarations for the `promise` package (optional devDependency).
 * Used by analytics.ts for unhandled promise rejection tracking.
 */
declare module 'promise/setimmediate/rejection-tracking' {
  interface Options {
    all?: boolean;
    onUnhandled?: (id: number, error: Error) => void;
    onHandled?: (id: number) => void;
  }

  export function enable(options: Options): void;
}
