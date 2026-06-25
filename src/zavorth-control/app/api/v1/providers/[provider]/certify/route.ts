import { ZavorthProviderLiveCanaryService } from "../../../../../../../services/ZavorthProviderLiveCanaryService.js";
import { ZavorthProviderLiveProofStoreService } from "../../../../../../../services/ZavorthProviderLiveProofStoreService.js";

export async function POST(request: Request, { params }: { params: { provider: string } }) {
  const body = await request.json().catch(() => ({}));
  const runLive = body?.run_live === true || body?.runLive === true;
  const service = new ZavorthProviderLiveCanaryService();
  const snapshot = await service.buildSnapshot({
    providerName: params.provider,
    modelName: typeof body?.model === "string" ? body.model : null,
    runLive,
    timeoutMs: typeof body?.timeout_ms === "number" ? body.timeout_ms : undefined,
  });
  const proofStore = new ZavorthProviderLiveProofStoreService();
  if (runLive && (snapshot.status === "passed" || snapshot.status === "blocked")) {
    proofStore.writeManualProof({
      providerId: snapshot.selectedProviderName || params.provider,
      keys: [params.provider, snapshot.selectedProviderName || ""].filter(Boolean),
      status: snapshot.status === "passed" ? "healthy" : "unhealthy",
      message: snapshot.narrative.operatorSummary,
      target: snapshot.selectedModelName,
      httpStatus: snapshot.status === "passed" ? 200 : 503,
      modelCount: null,
      evidenceHash: snapshot.live.markerObserved ? snapshot.canaryMarker : null,
      source: "provider-readiness-live-probe",
    });
  }
  return Response.json({
    ...snapshot,
    proof: {
      persisted: runLive && (snapshot.status === "passed" || snapshot.status === "blocked"),
      provider: snapshot.selectedProviderName || params.provider,
    },
  }, { status: snapshot.status === "blocked" ? 409 : 200 });
}

export async function GET(_request: Request, { params }: { params: { provider: string } }) {
  const service = new ZavorthProviderLiveCanaryService();
  const snapshot = await service.buildSnapshot({ providerName: params.provider, runLive: false });
  return Response.json(snapshot);
}
