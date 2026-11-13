import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { MAX_FILE_SIZE_LABEL } from '../../utils/fileValidation';

type UploadAreaProps = {
  onFilesSelected: (files: File[]) => void;
  /** Text shown under the primary label. */
  hint?: string;
  disabled?: boolean;
};

export const UploadArea = ({
  onFilesSelected,
  hint = 'or browse from your device',
  disabled = false,
}: UploadAreaProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Dropping a file anywhere outside the zone must not navigate away.
  useEffect(() => {
    const prevent = (event: globalThis.DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const emitFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFilesSelected(Array.from(fileList));
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Dragging over child elements fires leave on the parent; only clear the
    // highlighted state once the pointer has left the dropzone entirely.
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current = 0;
      setIsDragging(false);
      if (!disabled) emitFiles(event.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFilesSelected, disabled],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    emitFiles(event.target.files);
    // Allow re-selecting the same file after removing it.
    event.target.value = '';
  };

  const handleZoneClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    openPicker();
  };

  const handleBrowseClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openPicker();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Upload files: drag and drop, or press Enter to browse"
      data-testid="upload-dropzone"
      onClick={handleZoneClick}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      } ${
        isDragging
          ? 'border-accent bg-accent-soft'
          : 'border-border bg-bg/40 hover:border-accent/70 hover:bg-accent-soft/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
        aria-label="Select files to upload"
        data-testid="upload-input"
      />

      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-accent-soft text-accent transition-transform ${
          isDragging ? 'scale-110' : 'group-hover:-translate-y-0.5'
        }`}
      >
        <UploadCloud className="h-7 w-7" aria-hidden="true" />
      </span>

      <h3 className="mt-5 text-base font-semibold">
        {isDragging ? 'Drop files to add them' : 'Drag & drop your files'}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {hint}{' '}
        <button
          type="button"
          onClick={handleBrowseClick}
          className="cursor-pointer font-medium text-accent underline underline-offset-4"
        >
          browse
        </button>
      </p>
      <p className="mt-4 text-xs text-muted">
        Any file type · up to {MAX_FILE_SIZE_LABEL} per file
      </p>
    </div>
  );
};
