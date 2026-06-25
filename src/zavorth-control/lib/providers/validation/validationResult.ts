export type ProviderValidationResult = {
  valid: boolean;
  error: string | null;
  unsupported?: boolean;
  method?: string;
  warning?: string;
};

export function validationSuccess(
  extra: Omit<ProviderValidationResult, "valid" | "error"> = {}
): ProviderValidationResult {
  return { valid: true, error: null, ...extra };
}

export function validationFailure(
  error: string,
  extra: Omit<ProviderValidationResult, "valid" | "error"> = {}
): ProviderValidationResult {
  return { valid: false, error, ...extra };
}

export function invalidApiKey(
  extra: Omit<ProviderValidationResult, "valid" | "error"> = {}
): ProviderValidationResult {
  return validationFailure("Invalid API key", extra);
}

export function validationFailed(
  status: number,
  extra: Omit<ProviderValidationResult, "valid" | "error"> = {}
): ProviderValidationResult {
  return validationFailure(`Validation failed: ${status}`, extra);
}

export function providerUnavailable(
  status: number,
  extra: Omit<ProviderValidationResult, "valid" | "error"> = {}
): ProviderValidationResult {
  return validationFailure(`Provider unavailable (${status})`, extra);
}

export function connectionFailed(
  message = "Connection failed",
  extra: Omit<ProviderValidationResult, "valid" | "error"> = {}
): ProviderValidationResult {
  return validationFailure(message, extra);
}
