import React, { useState, useEffect } from 'react';
import { Settings, Plus, Server, Edit2, Trash2, Key, CheckCircle2, XCircle } from 'lucide-react';
import { ProviderSetupModal, ProviderConfigPayload } from '../components/ProviderSetupModal.js';

export function ProviderSettingsPanel() {
  const [providers, setProviders] = useState<ProviderConfigPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfigPayload | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/v2/providers');
      if (!res.ok) throw new Error('Falha ao buscar providers');
      const data = await res.json();
      setProviders(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSave = async (data: ProviderConfigPayload) => {
    const isEditing = !!data.providerId;
    // se for create, backend vai gerar providerId. Se for update, passa no body ou URL
    const res = await fetch('/api/v2/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Failed to save provider');
    }
    await fetchProviders();
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm('Tem certeza que deseja remover este provider? A chave será apagada.')) return;
    try {
      const res = await fetch(`/api/v2/providers/${providerId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Falha ao deletar provider');
      await fetchProviders();
    } catch (err: any) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    try {
      const res = await fetch('/api/v2/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      if (data.ok && data.data?.ok) {
        alert('Conexão testada com sucesso!');
      } else {
        alert('Falha na conexão: ' + (data.data?.message || data.error));
      }
    } catch (err: any) {
      alert('Erro ao testar: ' + err.message);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Carregando providers...</div>;

  return (
    <div className="flex flex-col gap-4 mt-4 w-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Server className="text-blue-500" size={20} />
            AI Providers
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Configure modelos e credenciais de forma segura (AES-256-GCM fallback store).
          </p>
        </div>
        <button
          onClick={() => { setEditingProvider(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Adicionar Provider
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {providers.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-700 rounded-lg text-gray-500">
          <Server size={48} className="mb-4 opacity-50" />
          <p>Nenhum provider configurado.</p>
          <p className="text-sm mt-1">Adicione um provider para poder utilizar a IA.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map(p => (
            <div key={p.providerId} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col relative group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${p.enabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-500'}`} />
                  <h3 className="font-semibold text-lg">{p.displayName}</h3>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingProvider(p); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Editar">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(p.providerId!)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded" title="Remover">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
                <span className="font-mono bg-gray-900 px-1.5 py-0.5 rounded text-xs border border-gray-700">{p.type}</span>
              </div>
              
              <div className="text-xs text-gray-500 truncate mb-4" title={p.baseUrl}>
                {p.baseUrl || 'URL padrão'}
              </div>

              <div className="mt-auto pt-4 border-t border-gray-700 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Key size={12} /> Autenticação:
                  </span>
                  {p.requiresApiKey ? (
                    p.secretRef ? (
                      <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Configurada</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1"><XCircle size={12} /> Faltando</span>
                    )
                  ) : (
                    <span className="text-gray-500">Não requerida</span>
                  )}
                </div>
                
                <button
                  onClick={() => handleTestConnection(p.providerId!)}
                  className="w-full mt-2 text-xs py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                >
                  Testar Conexão
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProviderSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        providerToEdit={editingProvider}
      />
    </div>
  );
}
