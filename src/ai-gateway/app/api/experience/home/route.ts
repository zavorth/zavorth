import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const surface = url.searchParams.get("surface") || "web";

  return Response.json({
    version: "ExperienceSnapshot/v1",
    surface,
    generatedAt: new Date().toISOString(),
    agent: {
      state: "ready",
      headline: "Hello, operator.",
      summary: "Zavorth is ready for governed work from the zavorthControl, CLI and connected channels.",
      model: "configured route",
    },
    health: {
      status: "ready",
      summary: "Local zavorthControl is reachable. Runtime details appear as they become available.",
    },
    chat: {
      messages: [
        {
          id: "welcome",
          role: "zavorth",
          content:
            "Hello, operator. Ask naturally; I will plan, request approval for sensitive work and leave receipts.",
          createdAt: new Date().toISOString(),
        },
      ],
    },
    actionCards: [],
    approvals: [],
    receipts: [],
    memory: {
      summary: "Mnemos is available when approved memory or learning exists.",
    },
  });
}
