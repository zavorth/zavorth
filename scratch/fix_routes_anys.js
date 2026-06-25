import fs from 'fs';

const filePath = 'c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src/services/ZavorthControlCoreRouteService.ts';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  // Types & Interfaces
  "type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, any>>;":
    "type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;",
  
  "buildSnapshot: (input?: any) => any;":
    "buildSnapshot: (input?: { selectedNodeId?: string | null }) => unknown;",
  
  "claimPairing: (input: any) => any;":
    "claimPairing: (input: Record<string, unknown>) => unknown;",
  
  "receiveHeartbeat: (input: any) => any;":
    "receiveHeartbeat: (input: Record<string, unknown>) => unknown;",
  
  "a2ui: any;":
    "a2ui: unknown;",
  
  "proactivePermissions: any;":
    "proactivePermissions: unknown;",
  
  "resolvePermission: (id: string, approved: boolean, resolvedBy?: Record<string, unknown>) => Promise<any>;":
    "resolvePermission: (id: string, approved: boolean, resolvedBy?: Record<string, unknown>) => Promise<unknown>;",

  // Methods signatures
  "private readResolverContext(body: Record<string, any>): Record<string, unknown> | null {":
    "private readResolverContext(body: Record<string, unknown>): Record<string, unknown> | null {",

  "private readSalesPackInboundMessage(body: Record<string, any>): SalesPackInboundMessageInput | null {":
    "private readSalesPackInboundMessage(body: Record<string, unknown>): SalesPackInboundMessageInput | null {",

  "private readSalesPackChannelIoEnvelope(\n    body: Record<string, any>,\n    headers: http.IncomingHttpHeaders,\n  ): SalesPackChannelIoEnvelope {":
    "private readSalesPackChannelIoEnvelope(\n    body: Record<string, unknown>,\n    headers: http.IncomingHttpHeaders,\n  ): SalesPackChannelIoEnvelope {",

  "private readSalesPackChannelIoEnvelope(\r\n    body: Record<string, any>,\r\n    headers: http.IncomingHttpHeaders,\r\n  ): SalesPackChannelIoEnvelope {":
    "private readSalesPackChannelIoEnvelope(\r\n    body: Record<string, unknown>,\r\n    headers: http.IncomingHttpHeaders,\r\n  ): SalesPackChannelIoEnvelope {",

  "private readBusinessModeIdentity(\n    req: http.IncomingMessage,\n    url: URL,\n    body: Record<string, any> = {},\n    deps: ZavorthControlCoreRouteDeps,\n  ): SalesPackBusinessModeIdentity & { authorized: boolean } {":
    "private readBusinessModeIdentity(\n    req: http.IncomingMessage,\n    url: URL,\n    body: Record<string, unknown> = {},\n    deps: ZavorthControlCoreRouteDeps,\n  ): SalesPackBusinessModeIdentity & { authorized: boolean } {",

  "private readBusinessModeIdentity(\r\n    req: http.IncomingMessage,\r\n    url: URL,\r\n    body: Record<string, any> = {},\r\n    deps: ZavorthControlCoreRouteDeps,\r\n  ): SalesPackBusinessModeIdentity & { authorized: boolean } {":
    "private readBusinessModeIdentity(\r\n    req: http.IncomingMessage,\r\n    url: URL,\r\n    body: Record<string, unknown> = {},\n    deps: ZavorthControlCoreRouteDeps,\n  ): SalesPackBusinessModeIdentity & { authorized: boolean } {",

  "private readScopedProfileId(\n    authenticatedIdentity: ZavorthControlAuthenticatedIdentity,\n    body: Record<string, any>,\n    url: URL,\n  ): string | null {":
    "private readScopedProfileId(\n    authenticatedIdentity: ZavorthControlAuthenticatedIdentity,\n    body: Record<string, unknown>,\n    url: URL,\n  ): string | null {",

  "private readScopedProfileId(\r\n    authenticatedIdentity: ZavorthControlAuthenticatedIdentity,\r\n    body: Record<string, any>,\r\n    url: URL,\r\n  ): string | null {":
    "private readScopedProfileId(\r\n    authenticatedIdentity: ZavorthControlAuthenticatedIdentity,\r\n    body: Record<string, unknown>,\r\n    url: URL,\r\n  ): string | null {",

  // db calls
  "rows = db.all<any>(\n": "rows = db.all<unknown>(\n",
  "rows = db.all<any>(\r\n": "rows = db.all<unknown>(\r\n",
  "const proposal = db.get<any>(\n": "const proposal = db.get<unknown>(\n",
  "const proposal = db.get<any>(\r\n": "const proposal = db.get<unknown>(\r\n",

  // as any casts
  "const { secretRef, keySuffix, key_suffix, ...rest } = p as any;":
    "const { secretRef, keySuffix, key_suffix, ...rest } = p as Record<string, unknown>;",
  
  "const { secretRef, keySuffix, key_suffix, ...safeConfig } = config as any;":
    "const { secretRef, keySuffix, key_suffix, ...safeConfig } = config as Record<string, unknown>;"
};

let replacedCount = 0;
for (const [target, replacement] of Object.entries(replacements)) {
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    replacedCount++;
  }
}

// Replace body.property with body['property'] in body-reading methods (sorted descending by key length)
const bodyReplacements = {
  "body.channelAccountId": "body['channelAccountId']",
  "body.productModeId": "body['productModeId']",
  "body.conversationId": "body['conversationId']",
  "body.requestedBy": "body['requestedBy']",
  "body.sessionId": "body['sessionId']",
  "body.customerId": "body['customerId']",
  "body.receivedAt": "body['receivedAt']",
  "body.profileId": "body['profileId']",
  "body.metadata": "body['metadata']",
  "body.threadId": "body['threadId']",
  "body.tenantId": "body['tenantId']",
  "body.actorId": "body['actorId']",
  "body.traceId": "body['traceId']",
  "body.surface": "body['surface']",
  "body.channel": "body['channel']",
  "body.chatId": "body['chatId']",
  "body.userId": "body['userId']",
  "body.runId": "body['runId']",
  "body.text": "body['text']"
};

// Sort keys descending by length
const sortedKeys = Object.keys(bodyReplacements).sort((a, b) => b.length - a.length);

for (const key of sortedKeys) {
  content = content.split(key).join(bodyReplacements[key]);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Successfully replaced ${replacedCount} definitions and body properties with sorted keys.`);
