export type ScanType = 'uploaded' | 'processing' | 'deployed';

export interface Scan {
  id: string;
  roomName: string;
  capturedDate: Date;
  type: ScanType;
}

// Simple uid generator — Math.random for sample data; production code should
// use a real UUID lib (e.g. nanoid) if these IDs ever cross trust boundaries.
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function createScan(input: Omit<Scan, 'id'> & { id?: string }): Scan {
  return { id: input.id ?? uid(), roomName: input.roomName, capturedDate: input.capturedDate, type: input.type };
}
