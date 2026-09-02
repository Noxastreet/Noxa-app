import type { DriveSessionStatus } from './types';

export function formatDriveDistance(distanceMeters: number | null) {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) return 'Route pending';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km`;
}

export function formatDriveDuration(durationSeconds: number | null) {
  if (durationSeconds === null || !Number.isFinite(durationSeconds)) return 'Time pending';
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export function formatDriveDate(value: string | null) {
  if (!value) return 'When everyone is ready';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Schedule unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function driveStatusLabel(status: DriveSessionStatus) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'scheduled':
      return 'Scheduled';
    case 'active':
      return 'Live';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function driveStatusCaption(status: DriveSessionStatus) {
  switch (status) {
    case 'draft':
      return 'Finish the setup and invite your people.';
    case 'scheduled':
      return 'Waiting for the host to start.';
    case 'active':
      return 'This drive is currently active.';
    case 'completed':
      return 'This Group Drive has ended.';
    case 'cancelled':
      return 'This Group Drive is no longer active.';
  }
}
