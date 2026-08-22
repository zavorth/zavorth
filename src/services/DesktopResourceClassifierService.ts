import type {
  DesktopResourceActionDescriptor,
  DesktopResourceCollection,
  DesktopResourceControlId,
  DesktopResourceGroup,
  DesktopResourceItem,
  DesktopResourceMetrics,
  DesktopResourceOwner,
  DesktopResourcePressureLevel,
  DesktopResourceProcessSample,
  DesktopResourceSnapshot,
} from '../contracts/DesktopResourceContract.js';

export class DesktopResourceClassifierService {
  public buildSnapshot(collection: DesktopResourceCollection): DesktopResourceSnapshot {
    const processItems = this.buildProcessItems(collection)
      .sort((left, right) => this.scoreItem(right) - this.scoreItem(left));
    const wslItems = this.buildWslItems(collection);
    const allItems = [...processItems, ...wslItems];
    const items = [...processItems.slice(0, 100), ...wslItems]
      .sort((left, right) => this.scoreItem(right) - this.scoreItem(left));

    const topConsumers = allItems.slice(0, 12);
    const groups = this.buildGroups(allItems, collection);
    const recommendedActions = groups.flatMap((group) => group.actions).slice(0, 12);
    const usedPhysicalMemoryMb = Math.max(
      0,
      this.round(collection.host.totalVisibleMemoryMb - collection.host.freePhysicalMemoryMb),
    );
    const companionMemoryMb = this.round(
      allItems
        .filter((entry) => entry.owner === 'companion')
        .reduce((total, entry) => total + entry.metrics.workingSetMb, 0),
    );
    const zavorthMemoryMb = this.round(
      allItems
        .filter((entry) => entry.owner === 'zavorth')
        .reduce((total, entry) => total + entry.metrics.workingSetMb, 0),
    );
    const externalMemoryMb = this.round(
      allItems
        .filter((entry) => entry.owner === 'external')
        .reduce((total, entry) => total + entry.metrics.workingSetMb, 0),
    );

    const warnings = this.buildWarnings(collection, groups, topConsumers);
    const recommendations = this.buildRecommendations(collection, groups);

    return {
      version: 1,
      generatedAt: collection.generatedAt,
      host: {
        ...collection.host,
        pressure: this.classifyHostPressure(collection.host.memoryLoadPercent),
        usedPhysicalMemoryMb,
      },
      signals: {
        wsl: collection.wsl,
        docker: collection.docker,
      },
      totals: {
        processesTracked: collection.processes.length,
        groupsTracked: groups.length,
        memoryTrackedMb: this.round(allItems.reduce((total, entry) => total + entry.metrics.workingSetMb, 0)),
        companionMemoryMb,
        zavorthMemoryMb,
        externalMemoryMb,
      },
      groups,
      items,
      topConsumers,
      recommendedActions,
      warnings,
      recommendations,
    };
  }

  private buildProcessItems(collection: DesktopResourceCollection): DesktopResourceItem[] {
    const hasDockerDesktop = collection.processes.some((entry) => this.resolveControlId(entry, collection) === 'docker-desktop');
    const runningUserWsl = collection.wsl.distros.filter((entry) => entry.state.toLowerCase() === 'running');
    return collection.processes
      .filter((entry) => entry.workingSetMb > 0 || entry.cpuSeconds > 0 || entry.pagedMemoryMb > 0)
      .map((entry) => {
        const controlId = this.resolveControlId(entry, collection, { hasDockerDesktop, runningUserWsl: runningUserWsl.length });
        const owner = this.resolveOwner(controlId);
        const workingSetMb = this.round(entry.workingSetMb);
        const summary = this.buildProcessSummary(entry, controlId);
        return {
          id: `process:${entry.pid}`,
          label: this.buildProcessLabel(entry, controlId),
          owner,
          kind: this.resolveKind(controlId),
          pressure: this.classifyProcessPressure(workingSetMb),
          controlId,
          status: this.resolveProcessStatus(entry),
          summary,
          details: this.buildProcessDetails(entry, controlId),
          metrics: {
            cpuSeconds: this.round(entry.cpuSeconds),
            workingSetMb,
            pagedMemoryMb: this.round(entry.pagedMemoryMb),
            privateMemoryMb: this.round(entry.privateMemoryMb),
            readTransferMb: this.round(entry.readTransferMb),
            writeTransferMb: this.round(entry.writeTransferMb),
          },
          process: {
            pid: entry.pid,
            processName: entry.processName,
            executablePath: entry.executablePath,
            commandLine: entry.commandLine,
            mainWindowTitle: entry.mainWindowTitle,
          },
        };
      });
  }

  private buildWslItems(collection: DesktopResourceCollection): DesktopResourceItem[] {
    return collection.wsl.distros.map((entry) => {
      const running = entry.state.toLowerCase() === 'running';
      return {
        id: `wsl:${entry.name.toLowerCase()}`,
        label: `WSL ${entry.name}`,
        owner: 'companion',
        kind: 'wsl-distro',
        pressure: running ? 'moderate' : 'low',
        controlId: 'wsl',
        status: running ? 'running' : 'stopped',
        summary: running ? `Distro ${entry.name} is active no WSL.`
          : `Distro ${entry.name} is parada.`,
        details: [
          `WSL version: ${entry.version}.`,
          entry.isDefault ? 'is e a distro default of the host.' : 'Distro secundaria of the host.',
        ],
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 0,
          pagedMemoryMb: 0,
          privateMemoryMb: 0,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        process: null,
      };
    });
  }

  private buildGroups(items: DesktopResourceItem[], collection: DesktopResourceCollection): DesktopResourceGroup[] {
    const grouped = new Map<string, DesktopResourceItem[]>();
    for (const item of items) {
      const key = item.controlId || `${item.owner}:${item.kind}`;
      const bucket = grouped.get(key) || [];
      bucket.push(item);
      grouped.set(key, bucket);
    }

    const groups: DesktopResourceGroup[] = [];
    for (const [groupId, bucket] of grouped.entries()) {
      const metrics = bucket.reduce<DesktopResourceMetrics>(
        (totals, item) => ({
          cpuSeconds: this.round(totals.cpuSeconds + item.metrics.cpuSeconds),
          workingSetMb: this.round(totals.workingSetMb + item.metrics.workingSetMb),
          pagedMemoryMb: this.round(totals.pagedMemoryMb + item.metrics.pagedMemoryMb),
          privateMemoryMb: this.round(totals.privateMemoryMb + item.metrics.privateMemoryMb),
          readTransferMb: this.round(totals.readTransferMb + item.metrics.readTransferMb),
          writeTransferMb: this.round(totals.writeTransferMb + item.metrics.writeTransferMb),
        }),
        {
          cpuSeconds: 0,
          workingSetMb: 0,
          pagedMemoryMb: 0,
          privateMemoryMb: 0,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
      );
      const owner = bucket[0]?.owner || 'unknown';
      const controlId = this.normalizeControlId(groupId);
      const pressure = this.classifyProcessPressure(metrics.workingSetMb);
      groups.push({
        id: groupId,
        label: this.buildGroupLabel(groupId, owner),
        owner,
        pressure,
        summary: this.buildGroupSummary(groupId, bucket, collection),
        metrics,
        itemCount: bucket.length,
        itemIds: bucket.map((item) => item.id),
        actions: this.buildGroupActions(controlId, bucket, collection),
      });
    }

    return groups.sort((left, right) => this.scoreMetrics(right.metrics) - this.scoreMetrics(left.metrics));
  }

  private buildGroupActions(
    controlId: DesktopResourceControlId | null,
    bucket: DesktopResourceItem[],
    collection: DesktopResourceCollection,
  ): DesktopResourceActionDescriptor[] {
    const actions: DesktopResourceActionDescriptor[] = [
      {
        actionId: 'inspect',
        label: 'Inspecionar',
        description: 'review este consumidor before mexer no runtime.',
        safety: 'safe',
        requiresApproval: false,
        controlId,
      },
    ];

    if (controlId === 'docker-desktop') {
      const idle = collection.docker.detected && (collection.docker.runningContainerCount || 0) === 0;
      actions.push({
        actionId: idle ? 'hibernate' : 'stop-idle',
        label: idle ? 'Hibernar Docker ocioso' : 'review Docker active',
        description: idle ? 'Docker Desktop parece ocioso e costuma enable bastante RAM when fecha.'
          : 'Docker Desktop is active com containers ou contexto aberto; revise before desligar.',
        safety: idle ? 'safe' : 'cautious',
        requiresApproval: !idle,
        controlId,
        command: idle ? 'docker-desktop:hibernate' : 'docker-desktop:inspect',
      });
    }

    if (controlId === 'wsl') {
      const runningDistros = collection.wsl.distros.filter((entry) => entry.state.toLowerCase() === 'running');
      actions.push({
        actionId: runningDistros.length > 0 ? 'hibernate' : 'resume',
        label: runningDistros.length > 0 ? 'Hibernar WSL' : 'resume WSL',
        description: runningDistros.length > 0
          ? 'WSL is active; shutting it down can return memory when no work is running.'
          : 'WSL is parado; resume only when realmente need.',
        safety: runningDistros.length > 0 ? 'cautious' : 'safe',
        requiresApproval: runningDistros.length > 0,
        controlId,
        command: runningDistros.length > 0 ? 'wsl:hibernate' : 'wsl:resume',
      });
    }

    if (controlId === 'zavorthBridge' || controlId === 'codex-companion') {
      actions.push({
        actionId: 'trim',
        label: 'review modo leve',
        description: 'Vale checar extensions, watchers e windows abertas before encerrar o app.',
        safety: 'cautious',
        requiresApproval: true,
        controlId,
        command: `${controlId}:trim`,
      });
    }

    if (controlId === 'zavorth') {
      actions.push({
        actionId: 'trim',
        label: 'review runtime Zavorth',
        description: 'when o core estiver acima do esperado, vale review sidecars, profile e watchers.',
        safety: 'cautious',
        requiresApproval: true,
        controlId,
        command: 'zavorth:trim',
      });
    }

    return actions;
  }

  private buildWarnings(
    collection: DesktopResourceCollection,
    groups: DesktopResourceGroup[],
    topConsumers: DesktopResourceItem[],
  ): string[] {
    const warnings: string[] = [];
    if (collection.processes.length === 0) {
      warnings.push('Desktop Resource Plane could not enumerate processes on this host; local collection may be blocked.');
    }
    if ((collection.host.memoryLoadPercent || 0) >= 85) {
      warnings.push(`Host memory is high (${collection.host.memoryLoadPercent}%).`);
    }
    if (!collection.wsl.ok && collection.wsl.message) {
      warnings.push(`WSL cannot be queried right now: ${collection.wsl.message}.`);
    }
    if (Array.isArray(collection.docker.warnings) && collection.docker.warnings.length > 0) {
      warnings.push(`Docker cannot be queried right now: ${collection.docker.warnings[0]}.`);
    }
    const zavorthGroup = groups.find((group) => group.id === 'zavorth');
    if (zavorthGroup && zavorthGroup.metrics.workingSetMb >= 350) {
      warnings.push(`O Zavorth is acima da meta leve local (${this.round(zavorthGroup.metrics.workingSetMb)} MB).`);
    }
    const dockerGroup = groups.find((group) => group.id === 'docker-desktop');
    if (dockerGroup && collection.docker.detected && (collection.docker.runningContainerCount || 0) === 0) {
      warnings.push('Docker Desktop appears active mesmo without containers rodando.');
    }
    const topCompanion = topConsumers.find((entry) => entry.owner === 'companion');
    if (topCompanion) {
      warnings.push(`Companion em destaque: ${topCompanion.label} (${this.round(topCompanion.metrics.workingSetMb)} MB).`);
    }
    return warnings.slice(0, 8);
  }

  private buildRecommendations(collection: DesktopResourceCollection, groups: DesktopResourceGroup[]): string[] {
    const recommendations: string[] = [];
    if (collection.processes.length === 0) {
      recommendations.push('Run o desktop doctor em um host without sandbox ou com permissions locais plenas para obter o mapa completo de processs.');
    }
    const dockerGroup = groups.find((group) => group.id === 'docker-desktop');
    if (dockerGroup && collection.docker.detected && (collection.docker.runningContainerCount || 0) === 0) {
      recommendations.push('Docker Desktop parece ocioso; hibernar costuma devolver bastante RAM.');
    }

    const wslGroup = groups.find((group) => group.id === 'wsl');
    if (wslGroup && collection.wsl.distros.some((entry) => entry.state.toLowerCase() === 'running')) {
      recommendations.push('WSL is active; it is worth shutting down when there is no real task open.');
    }

    const zavorthBridgeGroup = groups.find((group) => group.id === 'zavorthBridge');
    if (zavorthBridgeGroup) {
      recommendations.push('ZavorthBridge pesado costuma pedir workspace smallest, menos Git polling e menos watchers.');
    }

    const codexGroup = groups.find((group) => group.id === 'codex-companion');
    if (codexGroup) {
      recommendations.push('Codex companion should only stay active in sessions you are actually using.');
    }

    if (!collection.wsl.ok && /eperm|access|denied|blocked/i.test(collection.wsl.message || '')) {
      recommendations.push('If you need to diagnose WSL, run the doctor outside the current sandbox or use the supervised companion track.');
    }

    if (Array.isArray(collection.docker.warnings) && collection.docker.warnings.some((entry) => /eperm|access|denied|blocked/i.test(String(entry || '')))) {
      recommendations.push('If you need to diagnose Docker Desktop, run the doctor with full local permission or use the Companion Control Plane.');
    }

    if ((collection.host.memoryLoadPercent || 0) >= 85) {
      recommendations.push('With memory above 85%, prioritize shutting down idle companions before changing Zavorth.');
    }

    return recommendations.slice(0, 8);
  }

  private resolveControlId(
    entry: DesktopResourceProcessSample,
    collection: DesktopResourceCollection,
    runtime: {
      hasDockerDesktop?: boolean;
      runningUserWsl?: number;
    } = {},
  ): DesktopResourceControlId | null {
    const haystack = `${entry.processName} ${entry.executablePath || ''} ${entry.commandLine || ''}`.toLowerCase();

    if (
      haystack.includes('\\zavorth-core\\zavorth\\')
      || haystack.includes('/zavorth-core/zavorth/')
      || haystack.includes('launch-zavorth')
      || haystack.includes('zavorth-cli')
      || haystack.includes('dist\\host.js')
      || haystack.includes('dist\\index.js')
      || haystack.includes('start-ai-gateway-runtime')
      || haystack.includes('ops-remote-keepalive')
      || haystack.includes('node-mesh-host')
    ) {
      return 'zavorth';
    }

    if (haystack.includes('zavorthBridge')) {
      return 'zavorthBridge';
    }

    if (haystack.includes('codex')) {
      return 'codex-companion';
    }

    if (
      haystack.includes('docker desktop')
      || haystack.includes('com.docker')
      || haystack.includes('docker.exe')
      || haystack.includes('docker-agent')
      || haystack.includes('docker desktop backend')
    ) {
      return 'docker-desktop';
    }

    if (haystack.includes('vmmemwsl')) {
      return runtime.hasDockerDesktop && !runtime.runningUserWsl ? 'docker-desktop' : 'wsl';
    }

    if (haystack.includes('wslservice') || haystack.includes('wslhost')) {
      return 'wsl';
    }

    return null;
  }

  private resolveOwner(controlId: DesktopResourceControlId | null): DesktopResourceOwner {
    if (controlId === 'zavorth') {
      return 'zavorth';
    }
    if (controlId) {
      return 'companion';
    }
    return 'external';
  }

  private resolveKind(controlId: DesktopResourceControlId | null): DesktopResourceItem['kind'] {
    if (controlId === 'wsl') {
      return 'virtual-machine';
    }
    if (controlId === 'docker-desktop') {
      return 'docker-runtime';
    }
    if (controlId === 'zavorthBridge' || controlId === 'codex-companion') {
      return 'companion-app';
    }
    return 'process';
  }

  private buildProcessLabel(entry: DesktopResourceProcessSample, controlId: DesktopResourceControlId | null): string {
    if (controlId === 'zavorth') {
      return `Zavorth ${entry.processName}`;
    }
    if (controlId === 'docker-desktop') {
      return `Docker ${entry.processName}`;
    }
    if (controlId === 'zavorthBridge') {
      return 'ZavorthBridge';
    }
    if (controlId === 'codex-companion') {
      return 'Codex';
    }
    if (controlId === 'wsl') {
      return entry.processName;
    }
    return entry.mainWindowTitle || entry.processName;
  }

  private buildProcessSummary(entry: DesktopResourceProcessSample, controlId: DesktopResourceControlId | null): string {
    const memory = `${this.round(entry.workingSetMb)} MB`;
    switch (controlId) {
      case 'zavorth':
        return `Processo do Zavorth usando ${memory} de RAM.`;
      case 'docker-desktop':
        return `Processo ligado ao Docker Desktop usando ${memory}.`;
      case 'zavorthBridge':
        return `Processo do ZavorthBridge usando ${memory}.`;
      case 'codex-companion':
        return `Processo do Codex usando ${memory}.`;
      case 'wsl':
        return `Camada do WSL usando ${memory}.`;
      default:
        return `${entry.processName} usando ${memory}.`;
    }
  }

  private buildProcessDetails(entry: DesktopResourceProcessSample, controlId: DesktopResourceControlId | null): string[] {
    const details = [
      `PID ${entry.pid}.`,
      `CPU acumulada: ${this.round(entry.cpuSeconds)} s.`,
      `Paged memory: ${this.round(entry.pagedMemoryMb)} MB.`,
    ];
    if (entry.mainWindowTitle) {
      details.push(`Janela: ${entry.mainWindowTitle}.`);
    }
    if (entry.commandLine && controlId !== null) {
      details.push(`Command: ${entry.commandLine}.`);
    }
    return details.slice(0, 5);
  }

  private resolveProcessStatus(entry: DesktopResourceProcessSample): string {
    if (entry.responding === false) {
      return 'unresponsive';
    }
    return 'running';
  }

  private buildGroupLabel(groupId: string, owner: DesktopResourceOwner): string {
    switch (groupId) {
      case 'zavorth':
        return 'Zavorth';
      case 'docker-desktop':
        return 'Docker Desktop';
      case 'wsl':
        return 'WSL';
      case 'zavorthBridge':
        return 'ZavorthBridge';
      case 'codex-companion':
        return 'Codex';
      default:
        return owner === 'external' ? 'Apps externos' : groupId;
    }
  }

  private buildGroupSummary(
    groupId: string,
    bucket: DesktopResourceItem[],
    collection: DesktopResourceCollection,
  ): string {
    const workingSetMb = this.round(bucket.reduce((total, item) => total + item.metrics.workingSetMb, 0));
    if (groupId === 'docker-desktop') {
      const containerCount = collection.docker.runningContainerCount;
      return containerCount === null ? `Docker Desktop appears no host usando ${workingSetMb} MB.`
        : `Docker Desktop usa ${workingSetMb} MB e tem ${containerCount} container(es) rodando.`;
    }
    if (groupId === 'wsl') {
      const runningDistros = collection.wsl.distros.filter((entry) => entry.state.toLowerCase() === 'running');
      return runningDistros.length > 0
        ? `WSL usa ${workingSetMb} MB com ${runningDistros.length} distro(s) active(s).`
        : `WSL appears no host usando ${workingSetMb} MB.`;
    }
    if (groupId === 'zavorth') {
      return `Zavorth soma ${workingSetMb} MB nesta fotografia of the host.`;
    }
    if (groupId === 'zavorthBridge' || groupId === 'codex-companion') {
      return `${this.buildGroupLabel(groupId, bucket[0]?.owner || 'companion')} soma ${workingSetMb} MB no host.`;
    }
    return `${bucket.length} item(s) somam ${workingSetMb} MB.`;
  }

  private classifyHostPressure(memoryLoadPercent: number | null): DesktopResourcePressureLevel {
    if ((memoryLoadPercent || 0) >= 90) {
      return 'critical';
    }
    if ((memoryLoadPercent || 0) >= 80) {
      return 'high';
    }
    if ((memoryLoadPercent || 0) >= 65) {
      return 'moderate';
    }
    return 'low';
  }

  private classifyProcessPressure(workingSetMb: number): DesktopResourcePressureLevel {
    if (workingSetMb >= 512) {
      return 'critical';
    }
    if (workingSetMb >= 256) {
      return 'high';
    }
    if (workingSetMb >= 96) {
      return 'moderate';
    }
    return 'low';
  }

  private normalizeControlId(groupId: string): DesktopResourceControlId | null {
    return groupId === 'zavorth'
      || groupId === 'wsl'
      || groupId === 'docker-desktop'
      || groupId === 'zavorthBridge'
      || groupId === 'codex-companion'
      ? groupId
      : null;
  }

  private scoreItem(entry: DesktopResourceItem): number {
    return this.scoreMetrics(entry.metrics);
  }

  private scoreMetrics(metrics: DesktopResourceMetrics): number {
    return metrics.workingSetMb * 10 + metrics.pagedMemoryMb * 5 + metrics.cpuSeconds;
  }

  private round(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }
}
