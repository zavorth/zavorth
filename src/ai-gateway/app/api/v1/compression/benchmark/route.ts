import { runZavorthCompressionBenchmark } from "@/lib/zavorthCompressionBenchmark";
import { CORS_ORIGIN } from "@/shared/utils/cors";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET() {
  return Response.json(runZavorthCompressionBenchmark(), {
    headers: { "Access-Control-Allow-Origin": CORS_ORIGIN },
  });
}
