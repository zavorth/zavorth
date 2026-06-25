"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ControlPageClientModel } from "../../controlPageClient.types";
import { asText } from "../../controlPageClient.utils";
import {
  CommandCenterBadge,
  CommandCenterButton,
  CommandCenterCard,
} from "./CommandCenterPrimitives";

type CommandCenterGatewayConsoleProps = {
  model: ControlPageClientModel;
  currentProviderLabel: string;
  currentModelLabel: string;
};

type GatewayConsoleOperation =
  | "providers.test"
  | "resilience.test"
  | "combos.validate"
  | "cache.invalidate"
  | "rate-limits.toggle";

type GatewayConsoleOperationResult = {
  operation: GatewayConsoleOperation;
  ok: boolean;
  httpStatus: number | null;
  status: string;
  message: string;
  payload: Record<string, any> | null;
};

type GatewayConsoleFormState = {
  connectionId: string;
  validationModelId: string;
  comboName: string;
  cacheScope: "all" | "model" | "signature" | "stale";
  cacheModel: string;
  cacheSignature: string;
  cacheStaleMs: string;
  rateLimitEnabled: boolean;
};

const OPERATION_LABELS: Record<GatewayConsoleOperation, string> = {
  "providers.test": "Provider",
  "resilience.test": "Test Route",
  "combos.validate": "Combo",
  "cache.invalidate": "Cache",
  "rate-limits.toggle": "Rate limit",
};

const OPERATION_PATHS: Record<GatewayConsoleOperation, string> = {
  "providers.test": "/api/gateway-control/providers/test",
  "resilience.test": "/api/gateway-control/resilience",
  "combos.validate": "/api/gateway-control/combos/validate",
  "cache.invalidate": "/api/gateway-control/cache/invalidate",
  "rate-limits.toggle": "/api/gateway-control/rate-limits/toggle",
};

export function CommandCenterGatewayConsole({
  model,
  currentProviderLabel,
  currentModelLabel,
}: CommandCenterGatewayConsoleProps) {
  const snapshot = model.gatewayControl;
  const health = asRecord(snapshot?.health);
  const providers = asRecord(snapshot?.providers);
  const providerSummary = asRecord(providers.summary);
  const providerEntries = asRecordArray(providers.entries);
  const models = asRecord(snapshot?.models);
  const modelEntries = asRecordArray(models.entries);
  const combos = asRecord(snapshot?.combos);
  const comboEntries = asRecordArray(combos.entries);
  const cache = asRecord(snapshot?.cache);
  const rateLimits = asRecord(snapshot?.rateLimits);
  const resilience = asRecord(snapshot?.resilience);
  const resiliencePolicy = asRecord(resilience.policy);
  const resilienceBudget = asRecord(resilience.budget);
  const resilienceHealth = asRecord(resilience.health);
  const resilienceReceipts = asRecordArray(resilience.receipts);
  const resilienceFallbackOrder = asRecordArray(resiliencePolicy.fallbackOrder);
  const rateLimitEntries = asRecordArray(rateLimits.entries);
  const operations = asRecordArray(snapshot?.operations);
  const warnings = asTextArray(snapshot?.warnings);
  const modelPicker = asRecord(snapshot?.modelPicker);
  const modelPickerSelected = asRecord(modelPicker.selected);
  const modelPickerFamilies = asRecordArray(asRecord(modelPicker.families).families);
  const modelPickerRoutes = asRecordArray(asRecord(modelPicker.routes).routes);
  const modelPickerReadyRoutes = modelPickerRoutes.filter((route) => route.ready === true);
  const productization = asRecord(model.runtime?.productization);
  const productizationControl = asRecord(productization.control);
  const productizationCli = asRecord(productization.cli);
  const productizationOnboarding = asRecord(productization.onboarding);
  const productizationWebsite = asRecord(productization.website);
  const productizationItems = asRecordArray(productizationControl.items);
  const productizationAreas = asRecordArray(productizationOnboarding.areas);

  const firstProvider = providerEntries[0] || {};
  const firstModel = modelEntries[0] || {};
  const firstCombo = comboEntries[0] || {};
  const defaultConnectionId = asText(
    firstProvider.connectionId
      ?? firstProvider.providerConnectionId
      ?? firstProvider.id
      ?? providers.currentProvider,
  );
  const defaultValidationModelId = asText(firstModel.model ?? providers.currentModel ?? currentModelLabel);
  const defaultComboName = asText(firstCombo.comboName ?? firstCombo.name ?? firstCombo.id);
  const defaultCacheModel = asText(providers.currentModel ?? currentModelLabel);
  const defaultFormState: GatewayConsoleFormState = {
    connectionId: defaultConnectionId,
    validationModelId: defaultValidationModelId,
    comboName: defaultComboName,
    cacheScope: "all",
    cacheModel: defaultCacheModel,
    cacheSignature: "",
    cacheStaleMs: "3600000",
    rateLimitEnabled: true,
  };
  const [activeOperation, setActiveOperation] = useState<GatewayConsoleOperation>("providers.test");
  const [formState, setFormState] = useState<GatewayConsoleFormState>(defaultFormState);
  const [operationPending, setOperationPending] = useState(false);
  const [operationResult, setOperationResult] = useState<GatewayConsoleOperationResult | null>(null);

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      connectionId: current.connectionId || defaultConnectionId,
      validationModelId: current.validationModelId || defaultValidationModelId,
      comboName: current.comboName || defaultComboName,
      cacheModel: current.cacheModel || defaultCacheModel,
    }));
  }, [
    defaultCacheModel,
    defaultComboName,
    defaultConnectionId,
    defaultValidationModelId,
  ]);

  const applyFormPatch = (patch: Partial<GatewayConsoleFormState>) => {
    setFormState((current) => ({ ...current, ...patch }));
  };

  const runOperation = async () => {
    setOperationPending(true);
    setOperationResult(null);

    try {
      const response = await fetch(OPERATION_PATHS[activeOperation], {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildGatewayConsoleOperationInput(activeOperation, formState)),
      });
      const payload = await readGatewayConsolePayload(response);
      const status = asText(payload?.status, String(response.status));
      setOperationResult({
        operation: activeOperation,
        ok: response.ok || payload?.ok === true,
        httpStatus: response.status,
        status,
        message: asText(
          payload?.message,
          response.ok
            ? "Operacao concluida."
            : "Gateway Control retornou bloqueio estruturado.",
        ),
        payload,
      });

      if (response.ok || payload?.ok === true) {
        await model.reloadGatewayControl();
      }
    } catch (error: any) {
      setOperationResult({
        operation: activeOperation,
        ok: false,
        httpStatus: null,
        status: "failed",
        message: error?.message || "Falha ao chamar a Gateway Control API.",
        payload: null,
      });
    } finally {
      setOperationPending(false);
    }
  };

  return (
    <div className="bcc-gateway-console">
      <section className="bcc-gateway-console__hero" data-status={asText(health.status, "degraded")}>
        <div>
          <span className="bcc-card__label">Gateway Console</span>
          <h2>{currentProviderLabel} / {currentModelLabel}</h2>
          <p>{asText(health.issues?.[0], "Gateway Control API pronta para leitura e operacoes controladas.")}</p>
        </div>
        <div className="bcc-gateway-console__badges">
          <CommandCenterBadge tone={gatewayTone(health.status)}>
            health {asText(health.status, "desconhecido")}
          </CommandCenterBadge>
          <CommandCenterBadge tone={snapshot?.ok === false ? "warn" : "ok"}>
            {asText(snapshot?.contractVersion, "sem contrato")}
          </CommandCenterBadge>
        </div>
      </section>

      <div className="bcc-state-grid">
        <GatewayConsoleMetric
          label="Providers"
          value={`${asText(providerSummary.ready, "0")}/${asText(providerSummary.total, "0")}`}
          detail={`needs_config ${asText(providerSummary.needsConfig, "0")} - needs_probe ${asText(providerSummary.needsProbe, "0")}`}
          tone={Number(providerSummary.ready || 0) > 0 ? "ok" : "warn"}
        />
        <GatewayConsoleMetric
          label="Models"
          value={String(modelEntries.length)}
          detail={asText(providers.currentModel, currentModelLabel)}
          tone={modelEntries.length > 0 ? "ok" : "warn"}
        />
        <GatewayConsoleMetric
          label="Operations"
          value={String(operations.length)}
          detail={`${operations.filter((entry) => entry.requiresApproval).length} com approval`}
          tone={operations.length > 0 ? "info" : "warn"}
        />
        <GatewayConsoleMetric
          label="Picker"
          value={asText(modelPickerSelected.modelLabel ?? modelPickerSelected.modelName, "sem modelo")}
          detail={`${asText(modelPickerSelected.familyId, "sem familia")} - ${asText(modelPickerSelected.routeId, "sem rota")}`}
          tone={modelPickerReadyRoutes.length > 0 || modelPickerSelected.ready === true ? "ok" : "warn"}
        />
        <GatewayConsoleMetric
          label="Resilience"
          value={asText(resilienceHealth.status, "unknown")}
          detail={`${resilienceFallbackOrder.length} fallback(s) - budget ${asText(resilienceBudget.decision, "allowed")}`}
          tone={resilience.ok === false ? "warn" : resilienceFallbackOrder.length > 0 ? "ok" : "info"}
        />
        <GatewayConsoleMetric
          label="Warnings"
          value={String(warnings.length + asTextArray(combos.warnings).length + asTextArray(cache.warnings).length + asTextArray(rateLimits.warnings).length)}
          detail={model.gatewayControlError || asText(warnings[0], "sem alerta")}
          tone={model.gatewayControlError || warnings.length > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="bcc-gateway-console__grid">
        <CommandCenterCard label="Productization C9" title={asText(productization.status, "sem snapshot")}>
          {Object.keys(productization).length > 0 ? (
            <div className="bcc-list">
              <div className="bcc-list-item" data-active={productizationCli.sameContract === true}>
                <span className="bcc-list-item__title">CLI</span>
                <span className="bcc-list-item__meta">
                  {asText(productizationCli.command, "zavorth productization --json")} - same contract {String(productizationCli.sameContract === true)}
                </span>
              </div>
              <div className="bcc-list-item" data-active={productizationWebsite.status === "ready"}>
                <span className="bcc-list-item__title">Website</span>
                <span className="bcc-list-item__meta">
                  {asText(productizationWebsite.status, "unknown")} - {asText(productizationWebsite.promisePolicy, "stable-or-preview-only")}
                </span>
              </div>
              {productizationItems.slice(0, 8).map((item) => (
                <div key={asText(item.id, "item")} className="bcc-list-item" data-active={item.status === "ready"}>
                  <span className="bcc-list-item__title">{asText(item.label, asText(item.id, "item"))}</span>
                  <span className="bcc-list-item__meta">{asText(item.status, "unknown")}</span>
                </div>
              ))}
              <p className="bcc-empty-note">
                Onboarding: {productizationAreas.filter((area) => area.status === "ready").length}/{productizationAreas.length} area(s) prontas.
              </p>
            </div>
          ) : (
            <p className="bcc-empty-note">Runtime ainda nao publicou o contrato C9.</p>
          )}
        </CommandCenterCard>

        <CommandCenterCard label="Providers" title={`${providerEntries.length} catalogados`}>
          <div className="bcc-list">
            {providerEntries.length > 0 ? providerEntries.slice(0, 8).map((provider, index) => (
              <div key={`${asText(provider.id, "provider")}-${index}`} className="bcc-list-item" data-active={provider.ready === true}>
                <span className="bcc-list-item__title">{asText(provider.label ?? provider.id, "Provider")}</span>
                <span className="bcc-list-item__meta">
                  {asText(provider.readiness, "unknown")} - model {asText(provider.currentModel, "nao informado")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum provider retornado pelo contrato.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Resilient AI Gateway" title={asText(resilienceHealth.status, "unknown")}>
          <div className="bcc-list">
            <div className="bcc-list-item" data-active={resiliencePolicy.enabled === true}>
              <span className="bcc-list-item__title">
                Primary route: {asText(resiliencePolicy.primaryProviderId, "auto")}
                {asText(resiliencePolicy.primaryModelId) ? ` / ${asText(resiliencePolicy.primaryModelId)}` : ""}
              </span>
              <span className="bcc-list-item__meta">
                timeout {asText(resiliencePolicy.timeoutMs, "30000")}ms - max attempts {asText(resiliencePolicy.maxAttempts, "3")}
              </span>
            </div>
            <div className="bcc-list-item" data-active={resilienceBudget.decision !== "blocked"}>
              <span className="bcc-list-item__title">Budget: {asText(resilienceBudget.decision, "allowed")}</span>
              <span className="bcc-list-item__meta">
                daily {asText(resilienceBudget.dailyBudgetCents, "unlimited")} cents - {asText(resilienceBudget.reason, "no budget block")}
              </span>
            </div>
            {resilienceFallbackOrder.length > 0 ? resilienceFallbackOrder.map((target, index) => (
              <div key={`${asText(target.providerId, "fallback")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">Fallback {index + 1}: {asText(target.providerId, "provider")}</span>
                <span className="bcc-list-item__meta">{asText(target.modelId, "provider default model")}</span>
              </div>
            )) : (
              <p className="bcc-empty-note">Fallback order ainda nao foi configurado.</p>
            )}
            {resilienceReceipts.slice(0, 3).map((receipt) => (
              <div key={asText(receipt.receiptId, "receipt")} className="bcc-list-item" data-active={receipt.fallbackUsed === true}>
                <span className="bcc-list-item__title">
                  {receipt.fallbackUsed === true ? "Fallback usado" : "Sem fallback"} - {asText(receipt.budgetDecision, "allowed")}
                </span>
                <span className="bcc-list-item__meta">{asText(receipt.receiptId, "sem receipt")}</span>
              </div>
            ))}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Modelos" title={`${modelEntries.length} rotas`}>
          <div className="bcc-list">
            {modelEntries.length > 0 ? modelEntries.slice(0, 8).map((modelEntry, index) => (
              <div key={`${asText(modelEntry.providerId, "provider")}-${asText(modelEntry.model, "model")}-${index}`} className="bcc-list-item" data-active={modelEntry.ready === true}>
                <span className="bcc-list-item__title">{asText(modelEntry.model, "Modelo")}</span>
                <span className="bcc-list-item__meta">
                  {asText(modelEntry.providerLabel ?? modelEntry.providerId, "Provider")} - {asText(modelEntry.modality, "chat")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum modelo exposto pelo ProviderControlPlane.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Model Picker" title={asText(modelPickerSelected.modelLabel ?? modelPickerSelected.modelName, "sem modelo")}>
          {Object.keys(modelPickerSelected).length > 0 ? (
            <div className="bcc-list">
              <div className="bcc-list-item" data-active={modelPickerSelected.ready === true}>
                <span className="bcc-list-item__title">
                  {asText(modelPickerSelected.providerLabel ?? modelPickerSelected.providerName, "Provider")} / {asText(modelPickerSelected.routeId, "rota")}
                </span>
                <span className="bcc-list-item__meta">
                  {asText(modelPickerSelected.familyId, "familia")} - {asText(modelPickerSelected.readiness, "unknown")} - {asText(modelPickerSelected.catalogSource, "catalog")}
                </span>
              </div>
            </div>
          ) : (
            <p className="bcc-empty-note">Model Picker ainda nao foi retornado pelo Gateway Control.</p>
          )}
          <div className="bcc-list">
            {modelPickerRoutes.length > 0 ? modelPickerRoutes.slice(0, 6).map((route, index) => (
              <div key={`${asText(route.id, "route")}-${index}`} className="bcc-list-item" data-active={route.ready === true}>
                <span className="bcc-list-item__title">{asText(route.label ?? route.id, "Rota")}</span>
                <span className="bcc-list-item__meta">
                  {asText(route.routeClass ?? route.routeKind, "route")} - {asText(route.readinessCode ?? route.readiness, "unknown")} - {asText(route.explanation?.[1] ?? route.issue ?? route.catalogSource, "sem explicacao")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhuma rota canonica de picker retornada.</p>
            )}
          </div>
          {modelPickerFamilies.length > 0 ? (
            <GatewayConsoleSourceRoutes routes={modelPickerFamilies.slice(0, 4).map((family) => asText(family.label ?? family.id, "familia"))} />
          ) : null}
        </CommandCenterCard>

        <CommandCenterCard label="Combos" title={asText(combos.status, "desconhecido")}>
          <GatewayConsoleSourceRoutes routes={asTextArray(combos.sourceRoutes)} />
          <GatewayConsoleWarnings warnings={asTextArray(combos.warnings)} />
          {comboEntries.length > 0 ? (
            <div className="bcc-list">
              {comboEntries.slice(0, 5).map((combo, index) => (
                <div key={`${asText(combo.comboName ?? combo.name ?? combo.id, "combo")}-${index}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">{asText(combo.comboName ?? combo.name ?? combo.id, "Combo")}</span>
                  <span className="bcc-list-item__meta">{asText(combo.status ?? combo.summary, "sem detalhe")}</span>
                </div>
              ))}
            </div>
          ) : null}
        </CommandCenterCard>

        <CommandCenterCard label="Cache" title={asText(cache.status, "desconhecido")}>
          <GatewayConsoleSourceRoutes routes={asTextArray(cache.sourceRoutes)} />
          <GatewayConsoleWarnings warnings={asTextArray(cache.warnings)} />
          <RuntimeJsonPreview value={cache.semanticStats} emptyLabel="Sem estatistica semantica retornada." />
        </CommandCenterCard>

        <CommandCenterCard label="Rate limits" title={asText(rateLimits.status, "desconhecido")}>
          <GatewayConsoleSourceRoutes routes={asTextArray(rateLimits.sourceRoutes)} />
          <GatewayConsoleWarnings warnings={asTextArray(rateLimits.warnings)} />
          {rateLimitEntries.length > 0 ? (
            <div className="bcc-list">
              {rateLimitEntries.slice(0, 5).map((entry, index) => (
                <div key={`${asText(entry.connectionId ?? entry.id, "rate-limit")}-${index}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">{asText(entry.connectionId ?? entry.id, "Rate limit")}</span>
                  <span className="bcc-list-item__meta">{asText(entry.status ?? entry.summary, "sem detalhe")}</span>
                </div>
              ))}
            </div>
          ) : null}
        </CommandCenterCard>

        <CommandCenterCard label="Operacoes" title="Playground controlado" className="bcc-gateway-console__operations">
          <div className="bcc-run-observatory-toolbar" aria-label="Operacoes da Gateway Control API">
            {(Object.keys(OPERATION_LABELS) as GatewayConsoleOperation[]).map((operation) => (
              <button
                key={operation}
                type="button"
                className="bcc-run-observatory-filter"
                data-active={activeOperation === operation ? "true" : "false"}
                onClick={() => setActiveOperation(operation)}
              >
                {OPERATION_LABELS[operation]}
              </button>
            ))}
          </div>

          <form
            className="bcc-gateway-console__form"
            onSubmit={(event) => {
              event.preventDefault();
              void runOperation();
            }}
          >
            <GatewayConsoleOperationFields
              activeOperation={activeOperation}
              formState={formState}
              onChange={applyFormPatch}
            />
            <CommandCenterButton type="submit" variant="primary" disabled={operationPending}>
              {operationPending ? "Executando..." : "Executar gate"}
            </CommandCenterButton>
          </form>

          {operationResult ? (
            <div className="bcc-gateway-console__result" data-status={operationResult.status}>
              <div className="bcc-gateway-console__result-head">
                <CommandCenterBadge tone={operationResult.ok ? "ok" : gatewayTone(operationResult.status)}>
                  {operationResult.status}
                </CommandCenterBadge>
                <span>{operationResult.httpStatus ? `HTTP ${operationResult.httpStatus}` : "sem HTTP"}</span>
              </div>
              <p>{operationResult.message}</p>
              <RuntimeJsonPreview value={operationResult.payload} emptyLabel="Sem payload retornado." />
            </div>
          ) : null}
        </CommandCenterCard>
      </div>
    </div>
  );
}

function GatewayConsoleOperationFields({
  activeOperation,
  formState,
  onChange,
}: {
  activeOperation: GatewayConsoleOperation;
  formState: GatewayConsoleFormState;
  onChange: (patch: Partial<GatewayConsoleFormState>) => void;
}) {
  if (activeOperation === "combos.validate") {
    return (
      <GatewayConsoleField label="comboName">
        <input
          value={formState.comboName}
          onChange={(event) => onChange({ comboName: event.target.value })}
          placeholder="default"
        />
      </GatewayConsoleField>
    );
  }

  if (activeOperation === "cache.invalidate") {
    return (
      <>
        <GatewayConsoleField label="scope">
          <select
            value={formState.cacheScope}
            onChange={(event) => onChange({ cacheScope: event.target.value as GatewayConsoleFormState["cacheScope"] })}
          >
            <option value="all">all</option>
            <option value="model">model</option>
            <option value="signature">signature</option>
            <option value="stale">stale</option>
          </select>
        </GatewayConsoleField>
        {formState.cacheScope === "model" ? (
          <GatewayConsoleField label="model">
            <input
              value={formState.cacheModel}
              onChange={(event) => onChange({ cacheModel: event.target.value })}
              placeholder="gpt-4o"
            />
          </GatewayConsoleField>
        ) : null}
        {formState.cacheScope === "signature" ? (
          <GatewayConsoleField label="signature">
            <input
              value={formState.cacheSignature}
              onChange={(event) => onChange({ cacheSignature: event.target.value })}
              placeholder="cache-signature"
            />
          </GatewayConsoleField>
        ) : null}
        {formState.cacheScope === "stale" ? (
          <GatewayConsoleField label="staleMs">
            <input
              value={formState.cacheStaleMs}
              onChange={(event) => onChange({ cacheStaleMs: event.target.value })}
              inputMode="numeric"
              placeholder="3600000"
            />
          </GatewayConsoleField>
        ) : null}
      </>
    );
  }

  if (activeOperation === "resilience.test") {
    return (
      <GatewayConsoleField label="workspaceId">
        <input
          value={formState.connectionId || "control-ui"}
          onChange={(event) => onChange({ connectionId: event.target.value })}
          placeholder="control-ui"
        />
      </GatewayConsoleField>
    );
  }

  if (activeOperation === "rate-limits.toggle") {
    return (
      <>
        <GatewayConsoleField label="connectionId">
          <input
            value={formState.connectionId}
            onChange={(event) => onChange({ connectionId: event.target.value })}
            placeholder="openai"
          />
        </GatewayConsoleField>
        <label className="bcc-gateway-console__check">
          <input
            type="checkbox"
            checked={formState.rateLimitEnabled}
            onChange={(event) => onChange({ rateLimitEnabled: event.target.checked })}
          />
          <span>enabled</span>
        </label>
      </>
    );
  }

  return (
    <>
      <GatewayConsoleField label="connectionId">
        <input
          value={formState.connectionId}
          onChange={(event) => onChange({ connectionId: event.target.value })}
          placeholder="openai"
        />
      </GatewayConsoleField>
      <GatewayConsoleField label="validationModelId">
        <input
          value={formState.validationModelId}
          onChange={(event) => onChange({ validationModelId: event.target.value })}
          placeholder="gpt-4o"
        />
      </GatewayConsoleField>
    </>
  );
}

function GatewayConsoleField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="bcc-gateway-console__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function GatewayConsoleMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "info" | "ok" | "warn" | "danger";
}) {
  return (
    <article className="bcc-state-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function GatewayConsoleSourceRoutes({ routes }: { routes: string[] }) {
  if (routes.length === 0) {
    return null;
  }
  return (
    <div className="bcc-gateway-console__routes">
      {routes.slice(0, 4).map((route) => (
        <span key={route}>{route}</span>
      ))}
    </div>
  );
}

function GatewayConsoleWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <div className="bcc-gateway-console__warnings">
      {warnings.slice(0, 3).map((warning, index) => (
        <span key={`${warning}-${index}`}>{warning}</span>
      ))}
    </div>
  );
}

function RuntimeJsonPreview({
  value,
  emptyLabel,
}: {
  value: unknown;
  emptyLabel: string;
}) {
  if (!value || (typeof value === "object" && Object.keys(value as Record<string, unknown>).length === 0)) {
    return <p className="bcc-empty-note">{emptyLabel}</p>;
  }
  return (
    <pre className="bcc-gateway-console__json">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function buildGatewayConsoleOperationInput(
  operation: GatewayConsoleOperation,
  formState: GatewayConsoleFormState,
): Record<string, unknown> {
  if (operation === "combos.validate") {
    return {
      comboName: formState.comboName,
    };
  }

  if (operation === "cache.invalidate") {
    const input: Record<string, unknown> = {
      scope: formState.cacheScope,
    };
    if (formState.cacheScope === "model") {
      input.model = formState.cacheModel;
    } else if (formState.cacheScope === "signature") {
      input.signature = formState.cacheSignature;
    } else if (formState.cacheScope === "stale") {
      input.staleMs = Number(formState.cacheStaleMs);
    }
    return input;
  }

  if (operation === "rate-limits.toggle") {
    return {
      connectionId: formState.connectionId,
      enabled: formState.rateLimitEnabled,
    };
  }

  if (operation === "resilience.test") {
    return {
      action: "testRoute",
      workspaceId: formState.connectionId || "control-ui",
    };
  }

  return {
    connectionId: formState.connectionId,
    validationModelId: formState.validationModelId,
  };
}

async function readGatewayConsolePayload(response: Response): Promise<Record<string, any> | null> {
  try {
    const payload = await response.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asRecordArray(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) as Array<Record<string, any>>
    : [];
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : [];
}

function gatewayTone(value: unknown): "info" | "ok" | "warn" | "danger" {
  const status = asText(value).toLowerCase();
  if (["ready", "ok", "available", "delegated"].includes(status)) {
    return "ok";
  }
  if (["partial", "approval_required", "blocked", "warn", "warning"].includes(status)) {
    return "warn";
  }
  if (["degraded", "failed", "invalid", "timeout", "error"].includes(status)) {
    return "danger";
  }
  return "info";
}
