interface PostgresError {
  code?: string;
  cause?: { code?: string };
}

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const pgErr = err as PostgresError;
  return pgErr.code === '23505' || pgErr.cause?.code === '23505';
}
