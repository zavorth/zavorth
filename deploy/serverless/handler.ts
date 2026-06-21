import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";

let appReady = false;

async function ensureApp(): Promise<void> {
  if (!appReady) {
    const { startHost } = await import("./host.js");
    await startHost();
    appReady = true;
  }
}

function toApiResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await ensureApp();

    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const body = event.body;

    if (path === "/health") {
      return toApiResponse(200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        runtime: "lambda",
      });
    }

    return toApiResponse(200, {
      message: "Request processed",
      method,
      path,
      hasBody: !!body,
    });
  } catch (error) {
    console.error("Lambda handler error:", error);
    return toApiResponse(500, {
      status: "error",
      message: "Internal server error",
    });
  }
}
