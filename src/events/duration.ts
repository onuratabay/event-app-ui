// Quick duration options shared by event creation and availability preferences.
export const DURATIONS = [30, 60, 90, 120, 180];
export const MAX_DURATION_MINUTES = 1440;
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours && `${hours} saat`, rest && `${rest} dk`].filter(Boolean).join(" ");
}
