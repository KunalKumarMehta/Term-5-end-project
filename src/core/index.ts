export interface WorkflowFile {
  path: string;
  text: string;
}

export interface SimulationResult {
  verdicts: unknown[];
  diagnostics: unknown[];
}

// Stub: the real simulate() arrives with core flow 1.
export function simulate(
  _files: WorkflowFile[],
  _scenario: object,
): SimulationResult {
  return { verdicts: [], diagnostics: [] };
}
