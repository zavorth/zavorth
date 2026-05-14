import { z } from 'zod';

/**
 * Categorias de ferramentas do Echo.
 * OS = controle do sistema operacional
 * IOT = dispositivos IoT e automação residencial
 * WEB = requisições HTTP e pesquisa
 * INTERNAL = ferramentas internas do Zavorth (memória, sessão)
 */
export type ToolCategory = 'OS' | 'IOT' | 'WEB' | 'INTERNAL';

/**
 * Nível de perigo da ferramenta.
 * safe = não tem efeitos destrutivos
 * moderate = pode afetar estado externo
 * dangerous = pode causar danos ao sistema
 */
export type ToolDangerLevel = 'safe' | 'moderate' | 'dangerous';

/**
 * Resultado padronizado da execução de uma ferramenta.
 */
export interface ToolExecutionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Contrato base para todas as ferramentas do Zavorth Echo.
 * Cada ferramenta declara seu schema Zod, categoria, nível de perigo
 * e se requer aprovação do usuário antes da execução.
 */
export interface IZavorthTool {
  name: string;
  description: string;
  schema: z.ZodType<any, any, any>;
  category: ToolCategory;
  dangerLevel: ToolDangerLevel;
  requiresPermission: boolean;
  execute(params: Record<string, any>, context?: Record<string, any>): Promise<ToolExecutionResult>;
}
