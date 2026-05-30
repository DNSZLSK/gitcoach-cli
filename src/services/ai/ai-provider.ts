/**
 * Provider-agnostic AI interface.
 *
 * GitCoach ships with GitHub Copilot CLI as the default provider, but any LLM
 * backend (local or remote) can be plugged in by implementing this interface
 * and registering it in `./index.ts`. Keeping the contract here (rather than in
 * copilot-service) lets providers depend on the interface without a cycle.
 */

export interface CopilotSuggestion {
  success: boolean;
  message: string;
  command?: string;
}

export interface ConflictResolutionSuggestion {
  recommendation: 'local' | 'remote' | 'both' | 'custom';
  explanation: string;
  customContent?: string;
}

export interface ExplainErrorContext {
  command?: string;
  branch?: string;
  hasUncommitted?: boolean;
}

export interface ConflictContext {
  branch?: string;
  remoteBranch?: string;
}

export interface AIProvider {
  /** Whether the provider is reachable/usable right now. */
  isAvailable(): Promise<boolean>;

  generateCommitMessage(diff: string): Promise<CopilotSuggestion>;

  analyzeContext(
    branch: string,
    stagedFiles: string[],
    modifiedFiles: string[]
  ): Promise<CopilotSuggestion>;

  predictProblems(
    action: string,
    currentBranch: string,
    hasUncommitted: boolean
  ): Promise<CopilotSuggestion>;

  explainConcept(concept: string): Promise<CopilotSuggestion>;

  askGitQuestion(question: string): Promise<CopilotSuggestion>;

  explainGitError(
    errorMessage: string,
    context?: ExplainErrorContext
  ): Promise<CopilotSuggestion>;

  suggestConflictResolution(
    fileName: string,
    localVersion: string,
    remoteVersion: string,
    context?: ConflictContext
  ): Promise<ConflictResolutionSuggestion | null>;

  summarizeStagedDiff(diff: string): Promise<string | null>;
}
