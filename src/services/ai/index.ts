import type { AIProvider } from './ai-provider.js';
import { copilotService } from '../copilot-service.js';
import { ollamaProvider } from './ollama-provider.js';
import { userConfig } from '../../config/user-config.js';

export type { AIProvider, CopilotSuggestion, ConflictResolutionSuggestion } from './ai-provider.js';

/**
 * Resolve the AI provider selected in user config. Copilot is the default and
 * GitCoach's showcase provider; Ollama is a local, secret-free alternative.
 */
function activeProvider(): AIProvider {
  switch (userConfig.getAiProvider()) {
    case 'ollama':
      return ollamaProvider;
    case 'copilot':
    default:
      return copilotService;
  }
}

/**
 * Single entry point for all AI features. Menus and services should depend on
 * this facade rather than a concrete provider, so switching the backend is a
 * config change with no code change.
 */
export const aiService: AIProvider = {
  isAvailable: () => activeProvider().isAvailable(),
  generateCommitMessage: (diff) => activeProvider().generateCommitMessage(diff),
  analyzeContext: (branch, staged, modified) =>
    activeProvider().analyzeContext(branch, staged, modified),
  predictProblems: (action, branch, hasUncommitted) =>
    activeProvider().predictProblems(action, branch, hasUncommitted),
  explainConcept: (concept) => activeProvider().explainConcept(concept),
  askGitQuestion: (question) => activeProvider().askGitQuestion(question),
  explainGitError: (errorMessage, context) =>
    activeProvider().explainGitError(errorMessage, context),
  suggestConflictResolution: (fileName, localVersion, remoteVersion, context) =>
    activeProvider().suggestConflictResolution(fileName, localVersion, remoteVersion, context),
  summarizeStagedDiff: (diff) => activeProvider().summarizeStagedDiff(diff)
};

export default aiService;
