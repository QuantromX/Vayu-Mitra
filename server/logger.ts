const SENSITIVE_LOG_KEY_PATTERN =
  /key|token|secret|password|auth|imagebase64|prompt|question/i;

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Emits structured JSON logs to stdout/stderr while redacting secrets, user photos, and prompts.
 */
export function logStructured(
  level: LogLevel,
  event: string,
  meta: Record<string, unknown> = {}
): void {
  const sanitized: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
  };
  for (const [key, value] of Object.entries(meta)) {
    sanitized[key] = SENSITIVE_LOG_KEY_PATTERN.test(key) ? '[REDACTED]' : value;
  }
  const line = `${JSON.stringify(sanitized)}\n`;
  if (level === 'error') {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
}
