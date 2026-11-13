const encodeRfc5987 = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Builds an attachment header with an ASCII fallback plus the RFC 5987 encoded
 * filename, so unicode names survive and header injection is impossible
 * (quotes, backslashes, CR and LF are replaced).
 */
export const buildContentDisposition = (filename: string): string => {
  const asciiFallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180);

  return `attachment; filename="${asciiFallback || 'download'}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
};
