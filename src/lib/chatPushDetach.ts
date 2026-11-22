export type QueuedDetach = {
  installationId: string;
  registrationGeneration: number;
  detachSecret: string;
};

export function queueIsStale(queuedGeneration: number, currentGeneration: number): boolean {
  return currentGeneration > queuedGeneration;
}

/** A sent detach, or a newer registration, retires the queued credential. Offline keeps it. */
export function detachQueueDecision(input: {
  result: 'sent' | 'offline';
  queuedGeneration: number;
  registeredGeneration: number | null;
}): 'clear' | 'keep' {
  if (input.result === 'sent') return 'clear';
  if (
    input.registeredGeneration != null &&
    queueIsStale(input.queuedGeneration, input.registeredGeneration)
  ) {
    return 'clear';
  }
  return 'keep';
}
