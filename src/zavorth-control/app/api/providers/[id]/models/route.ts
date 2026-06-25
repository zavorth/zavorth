import { handleProviderModelsGet } from "./providerModelsHandler";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export { getStaticModelsForProvider } from "./providerModelsCatalog";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  return handleProviderModelsGet(request, context);
}
