import React, { useState, useEffect } from 'react';
import { ErrorNormalizationService } from '../../../../src/services/ErrorNormalizationService.js';

export interface DiagnosticsCheck {
  id: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  remediation?: string;
}

export interface DiagnosticsReport {
  readyForInternalBeta: boolean;
  generatedAt: string;
  checks: DiagnosticsCheck[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  manual: boolean;
}

export const InternalBetaDiagnosticsPanel: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const diagRes = await fetch(`/api/v2/workspace/agent-config/diagnostics?workspaceId=${encodeURIComponent(workspaceId)}`);
      const checklistRes = await fetch(`/api/v2/workspace/agent-config/checklist?workspaceId=${encodeURIComponent(workspaceId)}`);

      if (!diagRes.ok || !checklistRes.ok) {
        throw new Error('Falha ao consultar diagnósticos locais.');
      }

      const diagData = await diagRes.json();
      const checklistData = await checklistRes.json();

      const rawReport = diagData.data || diagData;
      const rawChecklist = checklistData.data || checklistData;

      const normalizer = ErrorNormalizationService.getInstance();
      const sanitizedReport: DiagnosticsReport = {
        ...rawReport,
        checks: (rawReport.checks || []).map((c: any) => ({
          ...c,
          message: normalizer.sanitizeText(c.message),
          remediation: c.remediation ? normalizer.sanitizeText(c.remediation) : undefined
        }))
      };

      const sanitizedChecklist: ChecklistItem[] = (rawChecklist || []).map((item: any) => ({
        ...item,
        title: normalizer.sanitizeText(item.title),
        description: normalizer.sanitizeText(item.description)
      }));

      setReport(sanitizedReport);
      setChecklist(sanitizedChecklist);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div style={{ padding: '20px', color: '#888' }} data-testid="diagnostics-loading">
        Carregando diagnósticos e checklist do Beta Interno...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ff4d4f' }} data-testid="diagnostics-error">
        <strong>Erro:</strong> {error}
        <button onClick={fetchData} style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }} data-testid="diagnostics-panel">
      {/* Overall Status Header */}
      <div 
        style={{
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid',
          backgroundColor: report?.readyForInternalBeta ? 'rgba(82, 196, 26, 0.1)' : 'rgba(250, 173, 20, 0.1)',
          borderColor: report?.readyForInternalBeta ? '#52c41a' : '#faad14',
          color: report?.readyForInternalBeta ? '#3f8600' : '#d46b08',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        data-testid="overall-readiness"
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>
            {report?.readyForInternalBeta ? 'Pronto para Beta Interno' : 'Necessita Ajustes para Beta Interno'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
            Geração: {report ? new Date(report.generatedAt).toLocaleString() : ''}
          </p>
        </div>
        <button 
          onClick={fetchData} 
          style={{
            padding: '8px 16px',
            backgroundColor: report?.readyForInternalBeta ? '#52c41a' : '#faad14',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          data-testid="btn-re-run"
        >
          Recalcular
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left: Diagnostics Checks */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
            Inspecionar Verificações de Saúde
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="diagnostics-checks-list">
            {report?.checks.map((check) => {
              const statusColor = 
                check.status === 'pass' ? '#52c41a' : 
                check.status === 'warning' ? '#faad14' : '#ff4d4f';
              
              const statusSymbol = 
                check.status === 'pass' ? '✓' : 
                check.status === 'warning' ? '⚠' : '✗';

              return (
                <div 
                  key={check.id} 
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${statusColor}`,
                    backgroundColor: '#fafafa'
                  }}
                  data-testid={`check-item-${check.id}`}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: statusColor, fontWeight: 'bold' }}>{statusSymbol}</span>
                    <strong style={{ fontSize: '14px' }}>{check.message}</strong>
                  </div>
                  {check.remediation && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#666' }}>
                      <strong>Remediação:</strong> {check.remediation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Onboarding Checklist */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
            Checklist de Onboarding
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="checklist-items-list">
            {checklist.map((item) => {
              const isCompleted = item.status === 'completed';
              return (
                <div 
                  key={item.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e8e8e8',
                    backgroundColor: isCompleted ? '#f6ffed' : '#fff',
                    borderColor: isCompleted ? '#b7eb8f' : '#e8e8e8'
                  }}
                  data-testid={`checklist-item-${item.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={isCompleted} 
                      readOnly 
                      style={{ marginTop: '4px', cursor: 'default' }}
                      data-testid={`checkbox-${item.id}`}
                    />
                    <div>
                      <strong style={{ fontSize: '14px', color: isCompleted ? '#389e0d' : '#333' }}>
                        {item.title} {item.manual ? '(Manual)' : ''}
                      </strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
