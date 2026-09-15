/**
 * Unit tests for the local Ollama provider.
 *
 * It was the least covered file in the project despite being one of two ways
 * the tool talks to a model. Everything here goes through a stubbed fetch, so
 * no daemon is needed and the tests assert on what the provider does with the
 * answers it gets back, including malformed ones.
 */

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    raw: jest.fn(),
    command: jest.fn()
  }
}));

jest.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    getAiEndpoint: jest.fn(() => 'http://localhost:11434'),
    getAiModel: jest.fn(() => 'llama3.2')
  }
}));

jest.mock('i18next', () => ({ __esModule: true, default: { language: 'en' } }));

import { ollamaProvider } from '../../src/services/ai/ollama-provider.js';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

/** A successful /api/generate response carrying `text`. */
const generates = (text: string) =>
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ response: text })
  });

const fails = (status: number) =>
  fetchMock.mockResolvedValueOnce({ ok: false, status, json: async () => ({}) });

describe('Ollama provider', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('isAvailable', () => {
    it('should be available when the daemon answers', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await expect(ollamaProvider.isAvailable()).resolves.toBe(true);
    });

    it('should not be available when nothing is listening', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(ollamaProvider.isAvailable()).resolves.toBe(false);
    });

    it('should not be available when the daemon errors', async () => {
      fails(500);

      await expect(ollamaProvider.isAvailable()).resolves.toBe(false);
    });

    it('should ask the configured endpoint', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await ollamaProvider.isAvailable();

      expect(fetchMock.mock.calls[0][0]).toContain('/api/tags');
    });
  });

  describe('generateCommitMessage', () => {
    it('should refuse an empty diff without calling the model', async () => {
      const result = await ollamaProvider.generateCommitMessage('');

      expect(result.success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return a conventional commit message', async () => {
      generates('feat: add login module');

      const result = await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      expect(result.success).toBe(true);
      expect(result.message).toBe('feat: add login module');
    });

    it('should reject a conversational preamble rather than commit it', async () => {
      // The whole point of the shared extractor: model chatter must never
      // become a commit subject.
      generates('Sure, here is your commit message:');

      const result = await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      expect(result.success).toBe(false);
    });

    it('should pick the real message out from under a preamble', async () => {
      generates('Of course!\n\nfix: handle expired token');

      const result = await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      expect(result.success).toBe(true);
      expect(result.message).toBe('fix: handle expired token');
    });

    it('should fail when the daemon is unreachable', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      expect(result.success).toBe(false);
    });

    it('should fail on an empty model answer', async () => {
      generates('   ');

      const result = await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      expect(result.success).toBe(false);
    });

    it('should cap an over-long subject', async () => {
      generates('feat: ' + 'x'.repeat(300));

      const result = await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      expect(result.message.length).toBeLessThanOrEqual(100);
    });
  });

  describe('analyzeContext', () => {
    it('should return the suggestion it was given', async () => {
      generates('Commit your staged changes next.');

      const result = await ollamaProvider.analyzeContext('main', ['a.ts'], []);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Commit your staged changes next.');
    });

    it('should report no suggestion when the model says nothing', async () => {
      generates('');

      const result = await ollamaProvider.analyzeContext('main', [], []);

      expect(result.success).toBe(false);
    });
  });

  describe('explainConcept and askGitQuestion', () => {
    it('should return an explanation', async () => {
      generates('A rebase replays commits.');

      const result = await ollamaProvider.explainConcept('rebase');

      expect(result.success).toBe(true);
      expect(result.message).toContain('rebase');
    });

    it('should answer a question', async () => {
      generates('Use git switch to change branch.');

      const result = await ollamaProvider.askGitQuestion('How do I change branch?');

      expect(result.success).toBe(true);
    });
  });

  describe('suggestConflictResolution', () => {
    it('should read the recommendation out of the answer', async () => {
      generates('RECOMMENDATION: REMOTE\nEXPLANATION: The remote version is newer.');

      const result = await ollamaProvider.suggestConflictResolution('a.ts', 'mine', 'theirs');

      expect(result).not.toBeNull();
      expect(result!.recommendation).toBe('remote');
      expect(result!.explanation).toBe('The remote version is newer.');
    });

    it('should tolerate markdown emphasis around the labels', async () => {
      generates('**RECOMMENDATION:** BOTH\n**EXPLANATION:** Keep the two changes.');

      const result = await ollamaProvider.suggestConflictResolution('a.ts', 'mine', 'theirs');

      expect(result!.recommendation).toBe('both');
    });

    it('should fall back to local when the answer has no recommendation', async () => {
      // Defaulting to the user's own version is the conservative choice.
      generates('I am not sure what to do here.');

      const result = await ollamaProvider.suggestConflictResolution('a.ts', 'mine', 'theirs');

      expect(result!.recommendation).toBe('local');
      expect(result!.explanation).toContain('local');
    });

    it('should return null when the model cannot be reached', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await ollamaProvider.suggestConflictResolution('a.ts', 'mine', 'theirs');

      expect(result).toBeNull();
    });
  });

  describe('summarizeStagedDiff', () => {
    it('should return null for an empty diff without calling the model', async () => {
      await expect(ollamaProvider.summarizeStagedDiff('')).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should return the summary', async () => {
      generates('Added the auth module.');

      await expect(ollamaProvider.summarizeStagedDiff('diff --git a/a b/a'))
        .resolves.toBe('Added the auth module.');
    });

    it('should return null when the daemon fails', async () => {
      fails(503);

      await expect(ollamaProvider.summarizeStagedDiff('diff --git a/a b/a'))
        .resolves.toBeNull();
    });
  });

  describe('prompt construction', () => {
    it('should not send the whole diff for a very large change', async () => {
      generates('feat: big change');

      await ollamaProvider.generateCommitMessage('x'.repeat(50000));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      // The prompt is truncated so a huge diff cannot stall the daemon.
      expect(body.prompt.length).toBeLessThan(10000);
    });

    it('should send the configured model', async () => {
      generates('feat: something');

      await ollamaProvider.generateCommitMessage('diff --git a/a b/a');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.model).toBe('llama3.2');
      expect(body.stream).toBe(false);
    });
  });
});
