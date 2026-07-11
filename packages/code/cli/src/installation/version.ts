declare global {
  const zavorth_VERSION: string
  const zavorth_CHANNEL: string
}

export const InstallationVersion = typeof zavorth_VERSION === "string" ? zavorth_VERSION : "local"
export const InstallationChannel = typeof zavorth_CHANNEL === "string" ? zavorth_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
