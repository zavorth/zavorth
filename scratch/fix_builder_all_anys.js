import fs from 'fs';

const filePath = 'c:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth/src/services/distributed-runtime/ZavorthDistributedRuntimeSnapshotBuilder.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replacements map
const replacements = {
  // Methods
  "private buildFleetCapabilityCoverage(nodes: any): ZavorthDistributedRuntimeCapabilityCoverage[] {":
    "private buildFleetCapabilityCoverage(nodes: NodeMeshSnapshot): ZavorthDistributedRuntimeCapabilityCoverage[] {",
  
  "private buildSurfaceEntries(manifest: any): ZavorthDistributedRuntimeSurfaceEntry[] {":
    "private buildSurfaceEntries(manifest: RuntimeAccessManifest): ZavorthDistributedRuntimeSurfaceEntry[] {",

  "private resolveChannelPosture(channels: any, advancedChannels: any[]): ZavorthDistributedRuntimePosture {":
    "private resolveChannelPosture(channels: ChannelMeshSnapshot, advancedChannels: ChannelMeshSnapshot['entries']): ZavorthDistributedRuntimePosture {",

  "private resolveNodePosture(\n    nodes: any,\n    capabilityCatalog: any[],\n  ): ZavorthDistributedRuntimePosture {":
    "private resolveNodePosture(\n    nodes: NodeMeshSnapshot,\n    capabilityCatalog: any[],\n  ): ZavorthDistributedRuntimePosture {",

  "private resolveNodePosture(\r\n    nodes: any,\r\n    capabilityCatalog: any[],\r\n  ): ZavorthDistributedRuntimePosture {":
    "private resolveNodePosture(\r\n    nodes: NodeMeshSnapshot,\r\n    capabilityCatalog: any[],\r\n  ): ZavorthDistributedRuntimePosture {",

  "private resolveTransportPosture(transports: any): ZavorthDistributedRuntimePosture {":
    "private resolveTransportPosture(transports: ZavorthRemoteTransportSnapshot): ZavorthDistributedRuntimePosture {",

  "private resolveSurfacePosture(manifest: any): ZavorthDistributedRuntimePosture {":
    "private resolveSurfacePosture(manifest: RuntimeAccessManifest): ZavorthDistributedRuntimePosture {",

  "private resolveInfrastructureState(nodes: any, transports: any): 'mesh_online' | 'offline' | 'dormant' {":
    "private resolveInfrastructureState(nodes: NodeMeshSnapshot, transports: ZavorthRemoteTransportSnapshot): 'mesh_online' | 'offline' | 'dormant' {",

  "private resolveInfrastructureOfflineReason(nodes: any, transports: any): string | null {":
    "private resolveInfrastructureOfflineReason(nodes: NodeMeshSnapshot, transports: ZavorthRemoteTransportSnapshot): string | null {",

  "private pickChannelNextAction(advancedChannels: any[]): string {":
    "private pickChannelNextAction(advancedChannels: ChannelMeshSnapshot['entries']): string {",

  "private isActionableAdvancedChannel(entry: any): boolean {":
    "private isActionableAdvancedChannel(entry: ChannelMeshSnapshot['entries'][number]): boolean {",

  "private prioritizeAdvancedChannels(entries: any[]): any[] {":
    "private prioritizeAdvancedChannels(entries: ChannelMeshSnapshot['entries']): ChannelMeshSnapshot['entries'] {",

  "private pickFleetNextAction(nodes: any, fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[]): string {":
    "private pickFleetNextAction(nodes: NodeMeshSnapshot, fleetCapabilities: ZavorthDistributedRuntimeCapabilityCoverage[]): string {",

  "private pickTransportNextAction(transports: any): string {":
    "private pickTransportNextAction(transports: ZavorthRemoteTransportSnapshot): string {",

  "private pickSurfaceNextAction(manifest: any): string {":
    "private pickSurfaceNextAction(manifest: RuntimeAccessManifest): string {",

  "private countMaintenanceNodes(nodes: any): number {":
    "private countMaintenanceNodes(nodes: NodeMeshSnapshot): number {",

  "private countReadySurfaces(manifest: any): number {":
    "private countReadySurfaces(manifest: RuntimeAccessManifest): number {",

  "private countTotalSurfaces(manifest: any): number {":
    "private countTotalSurfaces(manifest: RuntimeAccessManifest): number {",

  "private resolvePrimarySurfaceReady(manifest: any): boolean {":
    "private resolvePrimarySurfaceReady(manifest: RuntimeAccessManifest): boolean {",

  "private firstActionCommand(entry: any, kind: string): string | null {":
    "private firstActionCommand(entry: any, kind: string): string | null {",

  "public buildFallbackManifest(): any {":
    "public buildFallbackManifest(): RuntimeAccessManifest {"
};

let replacedCount = 0;
for (const [target, replacement] of Object.entries(replacements)) {
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    replacedCount++;
  }
}

// Replace callback lambdas: (entry: any) => -> (entry) =>
content = content.replace(/\(entry:\s*any\)/g, 'entry');
content = content.replace(/\(item:\s*any\)/g, 'item');

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Replaced ${replacedCount} methods and lambda annotations.`);
