import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../src');
const DOMAIN_DIR = path.join(SRC_DIR, 'domain');

const domains = [
  'gateway',
  'sessions',
  'memory',
  'artifacts',
  'platform',
  'nodes',
  'transports',
  'security',
  'ops',
  'providers'
];

// Helper para criar pastas e arquivos base de dominio
function createDomainScaffolding() {
  if (!fs.existsSync(DOMAIN_DIR)) {
    fs.mkdirSync(DOMAIN_DIR);
  }

  for (const domain of domains) {
    const domainPath = path.join(DOMAIN_DIR, domain);
    if (!fs.existsSync(domainPath)) fs.mkdirSync(domainPath);

    const facadeName = domain.charAt(0).toUpperCase() + domain.slice(1) + 'Facade.ts';
    const facadePath = path.join(domainPath, facadeName);
    
    // Interface base com injecao de dependencias para composicao da Facade Fina
    if (!fs.existsSync(facadePath)) {
      const content = `export class ${facadeName.replace('.ts', '')} {
  // TODO: Injete aqui os services de 'src/services' referentes ao domínio '${domain}'
  // Esta classe atua como proxy limitando o acoplamento horizontal.
  
  constructor() {}
  
  async initialize() {
    console.log('[Domain Facade] ${domain} initialized.');
  }
}
`;
      fs.writeFileSync(facadePath, content);
    }

    const indexPath = path.join(domainPath, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, `export * from './${facadeName.replace('.ts', '')}';\n`);
    }
  }

  // Cria o core Registry agregador para evitar import cruzado
  const registryPath = path.join(DOMAIN_DIR, 'DomainRegistry.ts');
  if (!fs.existsSync(registryPath)) {
    const imports = domains.map(d => `import { ${d.charAt(0).toUpperCase() + d.slice(1)}Facade } from './${d}';`).join('\n');
    const props = domains.map(d => `  public readonly ${d} = new ${d.charAt(0).toUpperCase() + d.slice(1)}Facade();`).join('\n');
    const inits = domains.map(d => `    await this.${d}.initialize();`).join('\n');
    
    fs.writeFileSync(registryPath, `${imports}

export class DomainRegistry {
${props}

  async initializeAll() {
${inits}
  }
}

export const Domains = new DomainRegistry();
`);
  }
}

console.log('[Phase 3] Starting Domain Scaffolding...');
createDomainScaffolding();
console.log('[Phase 3] Scaffolding Complete. Facades generated in src/domain/*');
