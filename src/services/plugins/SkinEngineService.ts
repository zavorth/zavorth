import fs from 'fs';
import path from 'path';

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
    background: string;
    foreground: string;
    border: string;
  };
  prompt: {
    prefix: string;
    suffix: string;
    separator: string;
    thinking_indicator: string;
    success_indicator: string;
    error_indicator: string;
  };
  typography: {
    font_family: string;
    heading_style: 'bold' | 'italic' | 'underline' | 'normal';
    code_style: 'bold' | 'italic' | 'normal';
  };
  layout: {
    max_width: number;
    padding: number;
    compact_mode: boolean;
    show_timestamps: boolean;
    show_tool_names: boolean;
  };
  metadata: {
    created_at: string;
    updated_at: string;
    tags: string[];
  };
}

export class SkinEngineService {
  private readonly storageDir: string;
  private readonly builtinSkins: Map<string, SkinDefinition> = new Map();
  private userSkins: Map<string, SkinDefinition> = new Map();
  private activeSkinId: string = 'default';

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'skins');
    this.ensureStorageDir();
    this.initBuiltinSkins();
    this.loadUserSkins();
    this.loadActiveSkin();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initBuiltinSkins(): void {
    this.builtinSkins.set('default', {
      id: 'default',
      name: 'Default',
      description: 'Tema padrao do Zavorth',
      author: 'Zavorth',
      version: '1.0.0',
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        muted: '#6b7280',
        background: '#0f172a',
        foreground: '#f8fafc',
        border: '#334155',
      },
      prompt: {
        prefix: 'zavorth',
        suffix: '❯',
        separator: '·',
        thinking_indicator: '💭',
        success_indicator: '✅',
        error_indicator: '❌',
      },
      typography: {
        font_family: 'monospace',
        heading_style: 'bold',
        code_style: 'italic',
      },
      layout: {
        max_width: 120,
        padding: 1,
        compact_mode: false,
        show_timestamps: true,
        show_tool_names: true,
      },
      metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: ['default', 'dark'] },
    });

    this.builtinSkins.set('ares', {
      id: 'ares',
      name: 'Ares',
      description: 'Tema vermelho militar, alto contraste',
      author: 'Zavorth',
      version: '1.0.0',
      colors: {
        primary: '#dc2626',
        secondary: '#991b1b',
        accent: '#f97316',
        success: '#15803d',
        warning: '#ca8a04',
        error: '#b91c1c',
        info: '#0284c7',
        muted: '#78716c',
        background: '#1c1917',
        foreground: '#fafaf9',
        border: '#44403c',
      },
      prompt: {
        prefix: 'ARES',
        suffix: '▸',
        separator: '|',
        thinking_indicator: '⚡',
        success_indicator: '■',
        error_indicator: '✖',
      },
      typography: {
        font_family: 'monospace',
        heading_style: 'bold',
        code_style: 'bold',
      },
      layout: {
        max_width: 100,
        padding: 0,
        compact_mode: true,
        show_timestamps: false,
        show_tool_names: true,
      },
      metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: ['military', 'red', 'compact'] },
    });

    this.builtinSkins.set('mono', {
      id: 'mono',
      name: 'Mono',
      description: 'Tema monocromatico minimalista',
      author: 'Zavorth',
      version: '1.0.0',
      colors: {
        primary: '#a3a3a3',
        secondary: '#737373',
        accent: '#d4d4d4',
        success: '#a3a3a3',
        warning: '#a3a3a3',
        error: '#d4d4d4',
        info: '#a3a3a3',
        muted: '#525252',
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        border: '#262626',
      },
      prompt: {
        prefix: '>',
        suffix: '',
        separator: '',
        thinking_indicator: '...',
        success_indicator: 'ok',
        error_indicator: '!!',
      },
      typography: {
        font_family: 'monospace',
        heading_style: 'normal',
        code_style: 'normal',
      },
      layout: {
        max_width: 80,
        padding: 0,
        compact_mode: true,
        show_timestamps: false,
        show_tool_names: false,
      },
      metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: ['minimal', 'mono'] },
    });

    this.builtinSkins.set('slate', {
      id: 'slate',
      name: 'Slate',
      description: 'Tema azul profundo corporativo',
      author: 'Zavorth',
      version: '1.0.0',
      colors: {
        primary: '#3b82f6',
        secondary: '#1d4ed8',
        accent: '#0ea5e9',
        success: '#10b981',
        warning: '#eab308',
        error: '#ef4444',
        info: '#06b6d4',
        muted: '#64748b',
        background: '#0f172a',
        foreground: '#e2e8f0',
        border: '#1e293b',
      },
      prompt: {
        prefix: 'zavorth',
        suffix: '→',
        separator: '│',
        thinking_indicator: '◐',
        success_indicator: '✓',
        error_indicator: '✗',
      },
      typography: {
        font_family: 'monospace',
        heading_style: 'bold',
        code_style: 'italic',
      },
      layout: {
        max_width: 120,
        padding: 1,
        compact_mode: false,
        show_timestamps: true,
        show_tool_names: true,
      },
      metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: ['corporate', 'blue', 'dark'] },
    });
  }

  private loadUserSkins(): void {
    const skinsDir = path.join(this.storageDir, 'user');
    if (!fs.existsSync(skinsDir)) return;

    const files = fs.readdirSync(skinsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const skin = JSON.parse(fs.readFileSync(path.join(skinsDir, file), 'utf-8'));
        this.userSkins.set(skin.id, skin);
      } catch { /* ignore */ }
    }
  }

  private loadActiveSkin(): void {
    const configPath = path.join(this.storageDir, 'active.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.activeSkinId = config.active_skin || 'default';
      } catch { /* ignore */ }
    }
  }

  private saveActiveSkin(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'active.json'),
      JSON.stringify({ active_skin: this.activeSkinId }),
      'utf-8',
    );
  }

  public setActiveSkin(skinId: string): string {
    if (!this.builtinSkins.has(skinId) && !this.userSkins.has(skinId)) {
      return `Skin "${skinId}" nao encontrado.`;
    }
    this.activeSkinId = skinId;
    this.saveActiveSkin();
    return `Skin ativo alterado para "${skinId}".`;
  }

  public getActiveSkin(): SkinDefinition {
    return this.builtinSkins.get(this.activeSkinId) || this.userSkins.get(this.activeSkinId) || this.builtinSkins.get('default')!;
  }

  public listSkins(): string {
    const lines: string[] = ['Skins disponiveis:'];

    lines.push('  Built-in:');
    for (const [id, skin] of this.builtinSkins) {
      const active = id === this.activeSkinId ? ' ← ativo' : '';
      lines.push(`    ${id}: ${skin.name} — ${skin.description}${active}`);
    }

    if (this.userSkins.size > 0) {
      lines.push('  Usuario:');
      for (const [id, skin] of this.userSkins) {
        const active = id === this.activeSkinId ? ' ← ativo' : '';
        lines.push(`    ${id}: ${skin.name} — ${skin.description}${active}`);
      }
    }

    return lines.join('\n');
  }

  public installSkin(skinJson: string): string {
    let skin: SkinDefinition;
    try {
      skin = JSON.parse(skinJson);
    } catch {
      return 'Erro: JSON de skin invalido.';
    }

    if (!skin.id || !skin.name) {
      return 'Erro: skin deve ter "id" e "name".';
    }

    const stripProto = (obj: unknown): unknown => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
          clean[k] = stripProto(v);
        }
        return clean;
      }
      if (Array.isArray(obj)) return obj.map(stripProto);
      return obj;
    };
    skin = stripProto(skin) as SkinDefinition;

    skin.metadata.updated_at = new Date().toISOString();
    this.userSkins.set(skin.id, skin);

    const skinsDir = path.join(this.storageDir, 'user');
    if (!fs.existsSync(skinsDir)) fs.mkdirSync(skinsDir, { recursive: true });
    fs.writeFileSync(path.join(skinsDir, `${skin.id}.json`), JSON.stringify(skin, null, 2), 'utf-8');

    return `Skin "${skin.name}" (${skin.id}) instalado com sucesso.`;
  }

  public removeSkin(skinId: string): string {
    if (!this.userSkins.has(skinId)) {
      return `Skin "${skinId}" nao encontrado ou e built-in.`;
    }

    this.userSkins.delete(skinId);
    const filePath = path.join(this.storageDir, 'user', `${skinId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    if (this.activeSkinId === skinId) {
      this.activeSkinId = 'default';
      this.saveActiveSkin();
    }

    return `Skin "${skinId}" removido.`;
  }

  public getSkinPreview(skinId?: string): string {
    const skin = skinId
      ? (this.builtinSkins.get(skinId) || this.userSkins.get(skinId))
      : this.getActiveSkin();

    if (!skin) return `Skin "${skinId}" nao encontrado.`;

    const c = skin.colors;
    const p = skin.prompt;

    const lines: string[] = [
      `Preview: ${skin.name}`,
      '',
      `  ${p.prefix} ${p.separator} ${p.thinking_indicator} Pensando...`,
      `  ${p.prefix} ${p.separator} ${p.success_indicator} Operacao concluida`,
      `  ${p.prefix} ${p.separator} ${p.error_indicator} Erro encontrado`,
      `  ${p.prefix} ${p.suffix} Olá! Como posso ajudar?`,
      '',
      `  Cores: primary=${c.primary} accent=${c.accent} bg=${c.background}`,
      `  Layout: ${skin.layout.max_width}col compact=${skin.layout.compact_mode}`,
    ];

    return lines.join('\n');
  }

  public exportSkin(skinId: string): string {
    const skin = this.builtinSkins.get(skinId) || this.userSkins.get(skinId);
    if (!skin) return `Skin "${skinId}" nao encontrado.`;
    return JSON.stringify(skin, null, 2);
  }
}
