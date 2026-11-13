import { useCallback, useMemo, useRef, useState } from 'react';
import { formatBytes } from '../types';
import type { FileValidationError, SelectedFile } from '../types';
import { getFileFingerprint, validateFileForSelection } from '../utils/fileValidation';

type UseFileSelectionResult = {
  files: SelectedFile[];
  errors: FileValidationError[];
  totalSize: number;
  totalSizeFormatted: string;
  addFiles: (incoming: readonly File[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  dismissErrors: () => void;
};

/**
 * Holds the files selected for the next upload. Validation happens here for
 * immediate feedback; the server validates independently.
 */
export const useFileSelection = (): UseFileSelectionResult => {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [errors, setErrors] = useState<FileValidationError[]>([]);

  // Mirror of `files` so addFiles can validate synchronously without stale closures
  // or side effects inside a state updater (which StrictMode double-invokes).
  const filesRef = useRef<SelectedFile[]>([]);
  const idRef = useRef(0);

  const nextId = useCallback(() => {
    idRef.current += 1;
    return `selected-${idRef.current}`;
  }, []);

  const commit = useCallback((next: SelectedFile[]) => {
    filesRef.current = next;
    setFiles(next);
  }, []);

  const addFiles = useCallback(
    (incoming: readonly File[]) => {
      if (incoming.length === 0) return;

      const seen = new Set(filesRef.current.map((selected) => selected.fingerprint));
      const accepted: SelectedFile[] = [];
      const rejected: FileValidationError[] = [];

      for (const file of incoming) {
        const result = validateFileForSelection({ file, existingFingerprints: seen });

        if (result.ok) {
          const fingerprint = getFileFingerprint(file);
          seen.add(fingerprint);
          accepted.push({
            id: nextId(),
            file,
            name: file.name,
            size: file.size,
            sizeFormatted: formatBytes(file.size),
            extension: result.extension,
            fingerprint,
          });
        } else {
          rejected.push({
            id: `${nextId()}-error`,
            fileName: file.name,
            code: result.code,
            message: result.message,
          });
        }
      }

      if (accepted.length > 0) {
        commit([...filesRef.current, ...accepted]);
      }
      setErrors(rejected);
    },
    [commit, nextId],
  );

  const removeFile = useCallback(
    (id: string) => {
      commit(filesRef.current.filter((file) => file.id !== id));
      setErrors((current) => current.filter((error) => error.id !== id));
    },
    [commit],
  );

  const clearAll = useCallback(() => {
    commit([]);
    setErrors([]);
  }, [commit]);

  const dismissErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const { totalSize, totalSizeFormatted } = useMemo(() => {
    const sum = files.reduce((total, file) => total + file.size, 0);
    return { totalSize: sum, totalSizeFormatted: formatBytes(sum) };
  }, [files]);

  return {
    files,
    errors,
    totalSize,
    totalSizeFormatted,
    addFiles,
    removeFile,
    clearAll,
    dismissErrors,
  };
};

