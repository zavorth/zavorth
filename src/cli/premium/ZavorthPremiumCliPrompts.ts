export type ZavorthPremiumPromptChoice<TValue extends string = string> = {
  name: string;
  value: TValue;
  description?: string;
  recommended?: boolean;
};

export type ZavorthPremiumPromptAdapter = {
  select<TValue extends string>(input: {
    message: string;
    choices: Array<ZavorthPremiumPromptChoice<TValue>>;
    defaultValue?: TValue;
  }): Promise<TValue>;
  confirm(input: {
    message: string;
    defaultValue?: boolean;
  }): Promise<boolean>;
  input(input: {
    message: string;
    defaultValue?: string;
  }): Promise<string>;
  password(input: {
    message: string;
    mask?: string;
  }): Promise<string>;
};

export function createNonInteractivePromptAdapter(input: {
  defaults?: Record<string, string | boolean>;
} = {}): ZavorthPremiumPromptAdapter {
  const defaults = input.defaults || {};
  return {
    async select<TValue extends string>(request: {
      message: string;
      choices: Array<ZavorthPremiumPromptChoice<TValue>>;
      defaultValue?: TValue;
    }): Promise<TValue> {
      const configured = defaults[request.message];
      if (typeof configured === 'string' && request.choices.some((choice) => choice.value === configured)) {
        return configured as TValue;
      }
      return request.defaultValue || request.choices[0]?.value;
    },
    async confirm(request: { message: string; defaultValue?: boolean }): Promise<boolean> {
      const configured = defaults[request.message];
      return typeof configured === 'boolean' ? configured : request.defaultValue !== false;
    },
    async input(request: { message: string; defaultValue?: string }): Promise<string> {
      const configured = defaults[request.message];
      return typeof configured === 'string' ? configured : request.defaultValue || '';
    },
    async password(request: { message: string; mask?: string }): Promise<string> {
      const configured = defaults[request.message];
      return typeof configured === 'string' ? configured : '';
    },
  };
}
