
export type Locale = string;
export interface TranslationDict {
  [key: string]: string | TranslationDict;
}

export type InterpolationParams = Record<string, string | number>;

export type PluralForms = {
  one: string;
  other: string;
  zero?: string;
};

export type DateFormatOptions = {
  locale: string;
  format: 'short' | 'long' | 'relative';
};

export type NumberFormatOptions = {
  locale: string;
  style: 'decimal' | 'currency' | 'percent';
  currency?: string;
};

