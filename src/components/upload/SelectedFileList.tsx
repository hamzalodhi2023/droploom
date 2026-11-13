import { FileArchive, FileText, File as FileIcon, X } from 'lucide-react';
import type { SelectedFile } from '../../types';

type SelectedFileListProps = {
  files: SelectedFile[];
  onRemove: (id: string) => void;
};

const iconForExtension = (extension: string) => {
  if (extension === 'zip' || extension === 'rar') return FileArchive;
  if (extension === 'pdf' || extension === 'doc' || extension === 'docx' || extension === 'txt') {
    return FileText;
  }
  return FileIcon;
};

export const SelectedFileList = ({ files, onRemove }: SelectedFileListProps) => {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg/40 px-5 py-8 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-accent-soft text-accent">
          <FileIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-medium">No files selected yet</p>
        <p className="mt-1 text-xs text-muted">
          Drag files onto the dropzone above, or browse your device.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {files.map((file) => {
        const FileGlyph = iconForExtension(file.extension);

        return (
          <li
            key={file.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-bg/40 p-3 transition-colors hover:border-accent/50"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-accent-soft text-accent">
              <FileGlyph className="h-5 w-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {file.sizeFormatted}
                <span className="px-1.5 text-border" aria-hidden="true">
                  ·
                </span>
                <span className="uppercase tracking-wide">{file.extension}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name}`}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-border hover:bg-card hover:text-error"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};
