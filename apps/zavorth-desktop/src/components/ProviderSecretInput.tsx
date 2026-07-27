import React, { useState } from 'react';
import { Eye, EyeOff, Key } from 'lucide-react';

export interface ProviderSecretInputProps {
  value: string;
  onChange: (val: string) => void;
  hasExistingSecret: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ProviderSecretInput({ value, onChange, hasExistingSecret, placeholder, disabled }: ProviderSecretInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-400 flex items-center gap-2">
        <Key size={14} />
        API Key (Secure)
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder={hasExistingSecret ? "Key already configured. Type to replace it." : (placeholder || "sk?... or token...")}
          className={`w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 pr-10 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hasExistingSecret && !value && (
        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Chave salva e encriptada no fallback secret store (AES-256-GCM)
        </p>
      )}
      {!hasExistingSecret && !value && !disabled && (
        <p className="text-xs text-yellow-500 mt-1">
          Attention: the key will not be exposed to the agent and will never appear in logs.
        </p>
      )}
    </div>
  );
}
