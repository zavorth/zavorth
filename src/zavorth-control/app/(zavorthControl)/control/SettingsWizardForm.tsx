"use client";

import { useEffect, useState } from "react";

type WizardFieldState = {
  configured: boolean;
  masked: string | null;
};

type WizardState = {
  fields?: Record<string, WizardFieldState>;
};

export function SettingsWizardForm() {
  const [apiKey, setApiKey] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [state, setState] = useState<WizardState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/settings/wizard")
      .then((res) => res.json())
      .then((data) => {
        setState(data || {});
        setLoading(false);
      })
      .catch(() => {
        setMessage({ text: "Nao foi possivel carregar o status das configuracoes.", type: "error" });
        setLoading(false);
      });
  }, []);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string> = {};
      if (apiKey.trim()) payload.AISTUDIO_API_KEY = apiKey.trim();
      if (botToken.trim()) payload.TELEGRAM_BOT_TOKEN = botToken.trim();
      payload.TELEGRAM_DEFAULT_CHAT_ID = chatId.trim();

      const res = await fetch("/api/settings/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error || "Falha ao salvar configuracoes.", type: "error" });
        return;
      }
      setApiKey("");
      setBotToken("");
      setMessage({ text: "Configuracoes salvas. Segredos existentes continuam mascarados.", type: "success" });
      const refreshed = await fetch("/api/settings/wizard").then((response) => response.json());
      setState(refreshed || {});
    } catch (error: unknown) {
      setMessage({ text: error instanceof Error ? error.message : "Erro de rede.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner">Carregando configuracoes...</div>;
  }

  return (
    <form onSubmit={handleSave} className="setup-wizard-form" style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "480px" }}>
      <WizardSecretInput
        label="Google AI Studio Key (Gemini API)"
        value={apiKey}
        configured={state.fields?.AISTUDIO_API_KEY}
        placeholder="Cole uma nova chave para substituir a atual"
        onChange={setApiKey}
      />
      <WizardSecretInput
        label="Access Bot Token"
        value={botToken}
        configured={state.fields?.TELEGRAM_BOT_TOKEN}
        placeholder="Cole um novo token para substituir o atual"
        onChange={setBotToken}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <label style={labelStyle}>Default Channel Chat ID</label>
        <input
          type="text"
          value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          placeholder={state.fields?.TELEGRAM_DEFAULT_CHAT_ID?.masked || "Insira o ID do Chat"}
          style={inputStyle}
        />
      </div>
      {message && (
        <div style={{
          padding: "0.75rem",
          borderRadius: "8px",
          fontSize: "0.85rem",
          backgroundColor: message.type === "success" ? "rgba(46, 204, 113, 0.15)" : "rgba(231, 76, 60, 0.15)",
          color: message.type === "success" ? "#2ecc71" : "#e74c3c",
          border: `1px solid ${message.type === "success" ? "#2ecc71" : "#e74c3c"}`,
        }}>
          {message.text}
        </div>
      )}
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: "0.75rem",
          borderRadius: "8px",
          border: "none",
          backgroundColor: saving ? "#666" : "var(--primary-color, #1a73e8)",
          color: "#fff",
          fontWeight: "bold",
          cursor: saving ? "not-allowed" : "pointer",
          marginTop: "0.5rem",
          transition: "background-color 0.2s",
        }}
      >
        {saving ? "Salvando..." : "Save Settings"}
      </button>
    </form>
  );
}

function WizardSecretInput({
  label,
  value,
  configured,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  configured?: WizardFieldState;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={configured?.configured ? `${configured.masked} configurado; cole novo valor para trocar` : placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const labelStyle = {
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-color, #fff)",
} as const;

const inputStyle = {
  padding: "0.75rem",
  borderRadius: "8px",
  border: "1px solid var(--border-color, #333)",
  backgroundColor: "var(--bg-input, #111)",
  color: "var(--text-color, #fff)",
  fontSize: "0.9rem",
} as const;
