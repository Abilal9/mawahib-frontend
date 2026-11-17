let processing = false;
const listeners = new Set<() => void>();

export function isDeletionProcessing(): boolean {
  return processing;
}

export function markDeletionProcessing(): void {
  if (processing) return;
  processing = true;
  for (const listener of listeners) listener();
}

export function clearDeletionProcessing(): void {
  if (!processing) return;
  processing = false;
  for (const listener of listeners) listener();
}

export function subscribeDeletionProcessing(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
