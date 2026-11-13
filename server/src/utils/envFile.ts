import { existsSync, readFileSync } from 'node:fs';

/**
 * Minimal `.env` parser.
 *
 * Values declared in the file take precedence over ambient environment
 * variables, so a local `npm run dev` behaves the same regardless of whatever
 * the parent shell exports. In production, ship without a `.env` file and let
 * the platform inject real environment variables.
 *
 * Supports: comments (#), blank lines, `KEY=value`, optional surrounding
 * quotes, and `export ` prefixes.
 */
export const loadEnvFile = (filePath: string): void => {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice(7) : line;
    const separator = withoutExport.indexOf('=');
    if (separator <= 0) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(separator + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (isQuoted && value.length >= 2) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};
