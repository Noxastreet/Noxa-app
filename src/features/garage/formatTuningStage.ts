export function formatTuningStage(value: string | null) {
  const stage = value?.trim();
  return stage && stage !== '-1' ? stage : null;
}
