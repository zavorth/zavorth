"use client";

import type { ControlPageClientModel } from "../../controlPageClient.types";
import { asText } from "../../controlPageClient.utils";
import { asRecordArray } from "./CommandCenterControlShellHelpers";
import { CommandCenterCard } from "./CommandCenterPrimitives";
import type { CommandCenterSalesPackBusinessIdentity } from "./useCommandCenterSalesPackBusinessMode";

export function renderCommandCenterDocsSector() {
  return (
    <CommandCenterCard label="Docs" title="Referencias locais">
      <div className="bcc-list">
        {[
          ["CLI", "docs/34-zavorth-cli.md"],
          ["Web", "docs/07-web.md"],
          ["Command Center", "docs/71-dashboard-command-center-architecture.md"],
          ["Inventario visual", "docs/72-dashboard-command-center-phase-0-inventory.md"],
        ].map(([title, path]) => (
          <div key={path} className="bcc-list-item">
            <span className="bcc-list-item__title">{title}</span>
            <span className="bcc-list-item__meta">{path}</span>
          </div>
        ))}
      </div>
    </CommandCenterCard>
  );
}

export function renderCommandCenterCronSector(stateRecord: Record<string, any> | null | undefined) {
  const jobs = [
    ...asRecordArray(stateRecord?.cronPlane?.jobs),
    ...asRecordArray(stateRecord?.schedulerPlane?.jobs),
    ...asRecordArray(stateRecord?.controlPlane?.scheduledTasks),
  ];
  return (
    <CommandCenterCard label="Cron" title={`${jobs.length} tarefas retornadas`}>
      <div className="bcc-list">
        {jobs.length > 0 ? jobs.map((job, index) => (
          <div key={`${asText(job?.id || job?.name, "job")}-${index}`} className="bcc-list-item">
            <span className="bcc-list-item__title">{asText(job?.label || job?.name || job?.id, "Tarefa")}</span>
            <span className="bcc-list-item__meta">{asText(job?.status || job?.schedule || job?.summary, "Sem resumo curto.")}</span>
          </div>
        )) : (
          <p className="bcc-empty-note">Nenhuma tarefa agendada foi retornada pelo runtime ainda.</p>
        )}
      </div>
    </CommandCenterCard>
  );
}

export function resolveCommandCenterSalesPackBusinessIdentity(
  model: ControlPageClientModel,
): CommandCenterSalesPackBusinessIdentity {
  const state = model.state as Record<string, any> | null;
  const runtime = model.runtime as Record<string, any> | null;
  const snapshot = state?.snapshot as Record<string, any> | null | undefined;
  const session = state?.session as Record<string, any> | null | undefined;
  const auth = (state?.auth ?? state?.authenticatedUser) as Record<string, any> | null | undefined;
  const user = (state?.user ?? state?.operator ?? state?.account) as Record<string, any> | null | undefined;
  const profile = (state?.profile ?? state?.workspaceProfile) as Record<string, any> | null | undefined;
  const userId = readFirstCommandCenterIdentityText([
    auth?.userId,
    auth?.id,
    auth?.sub,
    auth?.email,
    user?.userId,
    user?.id,
    user?.email,
    session?.userId,
    session?.ownerId,
    session?.sourceUserId,
    snapshot?.userId,
    snapshot?.sourceUserId,
    runtime?.userId,
    runtime?.operatorId,
  ]);
  const profileId = readFirstCommandCenterIdentityText([
    auth?.profileId,
    auth?.tenantId,
    auth?.organizationId,
    profile?.profileId,
    profile?.id,
    profile?.tenantId,
    runtime?.profileId,
    runtime?.tenantId,
    model.productModeId,
  ]);
  return {
    userId,
    profileId,
  };
}

function readFirstCommandCenterIdentityText(values: unknown[]): string | null {
  for (const value of values) {
    const normalized = asText(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}
