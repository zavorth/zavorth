export const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  PATCH: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  DELETE: "bg-red-500/15 text-red-500 border-red-500/30",
};

export const WEBHOOK_EVENTS = [
  "request.completed",
  "request.failed",
  "provider.error",
  "provider.recovered",
  "quota.exceeded",
  "combo.switched",
];
