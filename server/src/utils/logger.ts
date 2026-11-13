type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: Record<string, unknown>): void => {
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  };

  const serialised = JSON.stringify(line);
  if (level === 'error') {
    console.error(serialised);
  } else if (level === 'warn') {
    console.warn(serialised);
  } else {
    console.log(serialised);
  }
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
