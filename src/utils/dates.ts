export const formatDateTime = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

/** "Expires in 6 hours" style label, or "Expired" for past timestamps. */
export const formatRemaining = (isoDate: string): string => {
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return 'Unknown expiry';

  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'Expired';

  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `Expires in ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Expires in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  const days = Math.round(hours / 24);
  return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
};

export const isExpired = (isoDate: string): boolean => {
  const target = new Date(isoDate).getTime();
  return Number.isNaN(target) || target <= Date.now();
};
