import { useMemo } from 'react';
import { FileList } from './FileList';
import type { UploadedFile } from '../../types';

const MOCK_UPLOADS = [
  {
    id: '1',
    name: 'contract.pdf',
    size: 245760,
    sizeFormatted: '240 KB',
    uploadDate: '2025-01-15',
    expiry: '2025-01-22',
    link: 'https://droploom.com/share/abc123def',
  },
  {
    id: '2',
    name: 'presentation.pptx',
    size: 5242880,
    sizeFormatted: '5.0 MB',
    uploadDate: '2025-01-14',
    expiry: null,
    link: 'https://droploom.com/share/ghi456jkl',
  },
  {
    id: '3',
    name: 'archive.zip',
    size: 104857600,
    sizeFormatted: '100 MB',
    uploadDate: '2025-01-13',
    expiry: '2025-01-20',
    link: 'https://droploom.com/share/mno789pqr',
  },
] as const;

type RecentUploadsProps = {
  onCopyLink: (link: string) => void;
};

export const RecentUploads = ({ onCopyLink }: RecentUploadsProps) => {
  const files = useMemo<UploadedFile[]>(
    () =>
      MOCK_UPLOADS.map((mock) => {
        const expiryDate = mock.expiry ? new Date(mock.expiry) : null;
        const isExpired = expiryDate !== null && expiryDate.getTime() < Date.now();

        return {
          id: mock.id,
          name: mock.name,
          size: mock.size,
          sizeFormatted: mock.sizeFormatted,
          uploadDate: new Date(mock.uploadDate),
          expiryDate,
          expiryEnabled: expiryDate !== null,
          sharingLink: mock.link,
          status: isExpired ? 'expired' : 'ready',
        };
      }),
    [],
  );

  return <FileList files={files} onCopyLink={onCopyLink} />;
};
