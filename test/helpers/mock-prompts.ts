/**
 * Mock Prompts for testing
 * Simulates user input for integration tests
 */

export interface MockPromptResponses {
  select: (string | number)[];
  confirm: boolean[];
  input: string[];
  checkbox: string[][];
}

export function createMockPromptResponses(overrides: Partial<MockPromptResponses> = {}): MockPromptResponses {
  return {
    select: [],
    confirm: [],
    input: [],
    checkbox: [],
    ...overrides
  };
}

/**
 * Create mock prompt functions that return pre-defined responses
 */
export function createMockPrompts(responses: Partial<MockPromptResponses> = {}) {
  const state = createMockPromptResponses(responses);
  let selectIndex = 0;
  let confirmIndex = 0;
  let inputIndex = 0;
  let checkboxIndex = 0;

  return {
    __state: state,
    __reset: () => {
      selectIndex = 0;
      confirmIndex = 0;
      inputIndex = 0;
      checkboxIndex = 0;
    },
    __setResponses: (newResponses: Partial<MockPromptResponses>) => {
      Object.assign(state, newResponses);
    },

    promptSelect: jest.fn(async <T>(_message: string, _choices: Array<{ name: string; value: T }>): Promise<T> => {
      const response = state.select[selectIndex++];
      if (response === undefined) {
        throw new Error(`No mock response for promptSelect at index ${selectIndex - 1}`);
      }
      return response as T;
    }),

    promptConfirm: jest.fn(async (_message: string, _defaultValue?: boolean): Promise<boolean> => {
      const response = state.confirm[confirmIndex++];
      if (response === undefined) {
        return _defaultValue ?? false;
      }
      return response;
    }),

    promptInput: jest.fn(async (_message: string, _defaultValue?: string, _validate?: (value: string) => boolean | string): Promise<string> => {
      const response = state.input[inputIndex++];
      if (response === undefined) {
        return _defaultValue ?? '';
      }
      return response;
    }),

    promptCheckbox: jest.fn(async <T>(_message: string, _choices: Array<{ name: string; value: T }>): Promise<T[]> => {
      const response = state.checkbox[checkboxIndex++];
      if (response === undefined) {
        return [];
      }
      return response as T[];
    })
  };
}

export type MockPrompts = ReturnType<typeof createMockPrompts>;

/**
 * Sequence builder for complex user flows
 */
export class UserFlowBuilder {
  private responses: MockPromptResponses = {
    select: [],
    confirm: [],
    input: [],
    checkbox: []
  };

  select(value: string | number): this {
    this.responses.select.push(value);
    return this;
  }

  confirm(value: boolean): this {
    this.responses.confirm.push(value);
    return this;
  }

  input(value: string): this {
    this.responses.input.push(value);
    return this;
  }

  checkbox(values: string[]): this {
    this.responses.checkbox.push(values);
    return this;
  }

  build(): MockPromptResponses {
    return this.responses;
  }
}

export function userFlow(): UserFlowBuilder {
  return new UserFlowBuilder();
}
