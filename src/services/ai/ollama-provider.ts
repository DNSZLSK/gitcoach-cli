import i18next from 'i18next';
import type {
  AIProvider,
  CopilotSuggestion,
  ConflictResolutionSuggestion,
  ExplainErrorContext,
  ConflictContext
} from './ai-provider.js';
import { userConfig } from '../../config/user-config.js';
import { logger } from '../../utils/logger.js';

const OLLAMA_DEFAULT_ENDPOINT = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL = 'llama3.2';
const OLLAMA_TIMEOUT_MS = 60000;
const OLLAMA_PING_TIMEOUT_MS = 3000;
const MAX_PROMPT_DIFF_LENGTH = 6000;
const MAX_COMMIT_MSG_LENGTH = 100;

function getEndpoint(): string {
  return userConfig.getAiEndpoint() || process.env.OLLAMA_HOST || OLLAMA_DEFAULT_ENDPOINT;
}

function getModel(): string {
  return userConfig.getAiModel() || OLLAMA_DEFAULT_MODEL;
}

/**
 * Local LLM provider backed by Ollama (https://ollama.com).
 *
 * Talks to a local Ollama daemon over HTTP, so nothing leaves the machine and
 * no API key/secret is involved — a privacy-friendly, offline-capable
 * alternative to the cloud Copilot CLI. Endpoint and model are configurable.
 */
class OllamaProvider implements AIProvider {
  private languageInstruction(): string {
    const lang = i18next.language || 'en';
    const langMap: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish' };
    return `Reply in ${langMap[lang] || 'English'}.`;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async generate(prompt: string): Promise<string | null> {
    try {
      const res = await this.fetchWithTimeout(
        `${getEndpoint()}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: getModel(), prompt, stream: false })
        },
        OLLAMA_TIMEOUT_MS
      );
      if (!res.ok) {
        logger.debug(`Ollama responded with status ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { response?: string };
      const text = (data.response || '').trim();
      return text.length > 0 ? text : null;
    } catch (error) {
      logger.debug('Ollama generate failed:', error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${getEndpoint()}/api/tags`, {}, OLLAMA_PING_TIMEOUT_MS);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateCommitMessage(diff: string): Promise<CopilotSuggestion> {
    if (!diff || diff.trim().length === 0) {
      return { success: false, message: 'No changes to analyze' };
    }
    const prompt = `Generate a single conventional commit message (format "type: description" where type is one of feat fix docs refactor test chore) for the following git diff. Reply with ONLY the commit message, no quotes, no explanation. ${this.languageInstruction()}\n\nDiff:\n${diff.slice(0, MAX_PROMPT_DIFF_LENGTH)}`;
    const out = await this.generate(prompt);
    if (!out) {
      return { success: false, message: 'Could not generate a commit message' };
    }
    const firstLine = out.split('\n').map(l => l.trim()).find(l => l.length > 0) || out.trim();
    const message = firstLine.replace(/^["'`]|["'`]$/g, '').slice(0, MAX_COMMIT_MSG_LENGTH);
    return { success: true, message };
  }

  async analyzeContext(
    branch: string,
    stagedFiles: string[],
    modifiedFiles: string[]
  ): Promise<CopilotSuggestion> {
    const context = `Branch: ${branch}. Staged files: ${stagedFiles.join(', ') || 'none'}. Modified files: ${modifiedFiles.join(', ') || 'none'}.`;
    const out = await this.generate(
      `Given this git state: ${context} What should the user do next? Reply with a single brief suggestion in one sentence. ${this.languageInstruction()}`
    );
    return { success: !!out, message: out || 'No suggestion available' };
  }

  async predictProblems(
    action: string,
    currentBranch: string,
    hasUncommitted: boolean
  ): Promise<CopilotSuggestion> {
    const out = await this.generate(
      `Will this git action cause problems? Action: ${action}. Branch: ${currentBranch}. Uncommitted changes: ${hasUncommitted}. Reply briefly in one sentence. ${this.languageInstruction()}`
    );
    return { success: !!out, message: out || 'No issues predicted' };
  }

  async explainConcept(concept: string): Promise<CopilotSuggestion> {
    const out = await this.generate(
      `Explain this Git concept briefly for a beginner in 2-3 sentences: ${concept} ${this.languageInstruction()}`
    );
    return { success: !!out, message: out || 'No explanation available' };
  }

  async askGitQuestion(question: string): Promise<CopilotSuggestion> {
    if (!question || question.trim().length === 0) {
      return { success: false, message: 'Please provide a question' };
    }
    const out = await this.generate(
      `You are a Git expert assistant. Answer this Git question clearly and concisely. If it involves commands, show the exact command to use.\n\nQuestion: ${question}\n\nProvide a helpful answer in 2-4 sentences. ${this.languageInstruction()}`
    );
    return { success: !!out, message: out || 'Could not get an answer' };
  }

  async explainGitError(
    errorMessage: string,
    context?: ExplainErrorContext
  ): Promise<CopilotSuggestion> {
    if (!errorMessage || errorMessage.trim().length === 0) {
      return { success: false, message: 'No error message provided' };
    }
    const commandLine = context?.command ? `The Git command "${context.command}" failed. ` : '';
    const out = await this.generate(
      `${commandLine}Error: "${errorMessage}". Explain this error in simple terms for a beginner: what happened, why, and how to fix it. Reply in 3-4 sentences maximum, no code blocks. ${this.languageInstruction()}`
    );
    if (!out) {
      return { success: false, message: 'Could not explain the error' };
    }
    return { success: true, message: out };
  }

  async suggestConflictResolution(
    fileName: string,
    localVersion: string,
    remoteVersion: string,
    context?: ConflictContext
  ): Promise<ConflictResolutionSuggestion | null> {
    const branchInfo = context?.branch ? `current branch ${context.branch}` : 'current branch';
    const remoteBranchInfo = context?.remoteBranch ? `from ${context.remoteBranch}` : 'from remote';
    const out = await this.generate(
      `Merge conflict in file: ${fileName}\n\nLOCAL version (${branchInfo}):\n${localVersion.slice(0, MAX_PROMPT_DIFF_LENGTH)}\n\nREMOTE version (${remoteBranchInfo}):\n${remoteVersion.slice(0, MAX_PROMPT_DIFF_LENGTH)}\n\nWhich version should be kept and why? Reply with format:\nRECOMMENDATION: LOCAL|REMOTE|BOTH|CUSTOM\nEXPLANATION: (1-2 sentences why)\n${this.languageInstruction()}`
    );
    if (!out) {
      return null;
    }
    return this.parseConflict(out);
  }

  private parseConflict(text: string): ConflictResolutionSuggestion {
    let recommendation: ConflictResolutionSuggestion['recommendation'] = 'local';
    let explanation = '';
    for (const line of text.split('\n')) {
      const rec = line.match(/^\*{0,2}RECOMMENDATION:?\*{0,2}\s*(LOCAL|REMOTE|BOTH|CUSTOM)/i);
      if (rec) {
        recommendation = rec[1].toLowerCase() as ConflictResolutionSuggestion['recommendation'];
      }
      const exp = line.match(/^\*{0,2}EXPLANATION:?\*{0,2}\s*(.+)/i);
      if (exp) {
        explanation = exp[1].trim();
      }
    }
    return { recommendation, explanation: explanation || `Recommended: ${recommendation}` };
  }

  async summarizeStagedDiff(diff: string): Promise<string | null> {
    if (!diff || diff.trim().length === 0) {
      return null;
    }
    return this.generate(
      `Summarize these staged Git changes in plain language for a developer. One short line per file, no markdown, no code blocks. ${this.languageInstruction()}\n\nChanges:\n${diff.slice(0, MAX_PROMPT_DIFF_LENGTH)}`
    );
  }
}

export const ollamaProvider = new OllamaProvider();
export default ollamaProvider;
