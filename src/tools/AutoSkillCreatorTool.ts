import { BaseTool } from './BaseTool.js';
import * as fs from 'fs';
import * as path from 'path';

type ValidatedSkillArgs =
  | {
      ok: true;
      category: string;
      skillId: string;
      skillName: string;
      description: string;
      toolsJson: string;
      toolsMarkdown: string;
    }
  | { ok: false; message: string };

export class AutoSkillCreatorTool extends BaseTool {
  public readonly name = 'auto_skill_creator';
  public readonly description =
    'Cria uma Skill declarativa (manifest.json e TOOLS.md). Registra metadados para descoberta e Cognitive Firewall, mas nao cria codigo executavel automaticamente.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Categoria da skill (development, information, execution, filesystem etc.). Padrao: development.',
      },
      skillId: {
        type: 'string',
        description: 'ID da skill em snake_case/kebab-case, ex: image_generator.',
      },
      skillName: {
        type: 'string',
        description: 'Nome legivel da skill, ex: Image Generator.',
      },
      description: {
        type: 'string',
        description: 'Breve descricao da skill e suas ferramentas.',
      },
      toolsJson: {
        type: 'string',
        description: 'String JSON contendo array de definicoes de tools (name, description, parameters).',
      },
      toolsMarkdown: {
        type: 'string',
        description: 'Conteudo do TOOLS.md em Markdown com instrucoes de uso.',
      },
    },
    required: ['skillId', 'skillName', 'description', 'toolsJson', 'toolsMarkdown'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const validation = this.validateArgs(args);
    if (!validation.ok) {
      return validation.message;
    }

    const { category, skillId, skillName, description, toolsJson, toolsMarkdown } = validation;
    const skillRoot = path.resolve(process.cwd(), 'src', 'skills');
    const skillPath = path.resolve(skillRoot, category, skillId);

    if (!skillPath.startsWith(skillRoot + path.sep)) {
      return 'Erro: category/skillId resolveram para fora de src/skills. Operacao bloqueada.';
    }

    try {
      if (!fs.existsSync(skillPath)) {
        fs.mkdirSync(skillPath, { recursive: true });
      }

      let parsedTools: Array<Record<string, unknown>>;
      try {
        parsedTools = JSON.parse(toolsJson);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return `Erro: toolsJson invalido. Deve ser uma string JSON valida de um array. Detalhe: ${message}`;
      }

      if (!Array.isArray(parsedTools) || parsedTools.length === 0) {
        return 'Erro: toolsJson deve ser um array JSON nao vazio de definicoes de tool.';
      }

      const invalidTool = parsedTools.find((tool) => !this.isValidToolDefinition(tool));
      if (invalidTool) {
        return 'Erro: cada tool precisa ter name, description e parameters.type="object".';
      }

      const manifest = {
        id: skillId,
        name: skillName,
        version: '1.0.0',
        description,
        category,
        dangerLevel: 'low',
        tools: parsedTools,
        metadata: {
          author: 'zavorth-auto',
          firewall_category: category,
          implementation_status: 'declarative_manifest_only',
          requires_sandbox: false,
        },
      };

      fs.writeFileSync(path.join(skillPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      fs.writeFileSync(path.join(skillPath, 'TOOLS.md'), toolsMarkdown, 'utf8');

      const { GlobalContextReloadEvents } = require('../bootstrap/bootstrapContextEngine.js');
      const loadResult = GlobalContextReloadEvents.reloadSkills();

      console.log(
        `[AutoSkillCreator] Skill '${skillId}' criada em ${skillPath}. Reloader reportou ${loadResult?.totalSkills || 0} skills carregadas.`,
      );

      return [
        `Sucesso! Skill declarativa '${skillId}' criada e engatada no Cognitive Firewall.`,
        `Arquivos salvos em ${skillPath}.`,
        'Importante: isso registra manifest.json/TOOLS.md e habilita descoberta/filtragem. A execucao real exige uma tool runtime com o mesmo nome ou uma implementacao futura.',
      ].join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AutoSkillCreator] Erro ao criar skill:', message);
      return `Erro ao criar nova skill: ${message}`;
    }
  }

  private validateArgs(args: Record<string, unknown>): ValidatedSkillArgs {
    const category = this.normalizeSegment(String(args.category || 'development'));
    const skillId = this.normalizeSegment(String(args.skillId || ''));
    const skillName = String(args.skillName || '').trim();
    const description = String(args.description || '').trim();
    const toolsJson = String(args.toolsJson || '').trim();
    const toolsMarkdown = String(args.toolsMarkdown || '').trim();

    if (!category || !skillId) {
      return { ok: false, message: 'Erro: category e skillId devem conter apenas letras, numeros, _ ou -.' };
    }
    if (!skillName || !description || !toolsJson || !toolsMarkdown) {
      return { ok: false, message: 'Erro: skillName, description, toolsJson e toolsMarkdown sao obrigatorios.' };
    }

    return { ok: true, category, skillId, skillName, description, toolsJson, toolsMarkdown };
  }

  private normalizeSegment(value: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[a-z0-9_-]+$/.test(normalized) ? normalized : '';
  }

  private isValidToolDefinition(tool: Record<string, unknown>): boolean {
    const parameters = tool.parameters as { type?: unknown } | undefined;
    return Boolean(
      String(tool.name || '').trim() &&
        String(tool.description || '').trim() &&
        parameters &&
        parameters.type === 'object',
    );
  }
}
