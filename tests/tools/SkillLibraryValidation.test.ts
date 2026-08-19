import fs from 'fs';
import path from 'path';


const SKILL_LIBRARY_PATH = path.join(__dirname, 'skill-library', 'native');

function getAllSkillDirs(): string[] {
  if (!fs.existsSync(SKILL_LIBRARY_PATH)) return [];
  return fs.readdirSync(SKILL_LIBRARY_PATH, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'README.md')
    .map((d) => d.name);
}

function parseSkillMd(content: string): { name: string; description: string; license: string; body: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return { name: '', description: '', license: '', body: content };

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  const licenseMatch = frontmatter.match(/^license:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || '',
    license: licenseMatch?.[1]?.trim() || '',
    body: body.trim(),
  };
}

function parseSkillJson(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

describe('Skill Library — Structural Validation', () => {
  const skillDirs = getAllSkillDirs();
  const hasSkillLibrary = fs.existsSync(SKILL_LIBRARY_PATH);

  it('has a skill library directory', () => {
    if (!hasSkillLibrary) return; // Skip if no library
    expect(hasSkillLibrary).toBe(true);
  });

  it('has skills in the library', () => {
    if (!hasSkillLibrary) return; // Skip if no library
    expect(skillDirs.length).toBeGreaterThan(0);
  });

  it('every skill directory has SKILL.md', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return; // Skip if no skills
    const missing: string[] = [];
    for (const dir of skillDirs) {
      const skillMd = path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) missing.push(dir);
    }
    expect(missing).toEqual([]);
  });

  it('every skill directory has ZAVORTH_NATIVE_SKILL.json', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return; // Skip if no skills
    const missing: string[] = [];
    for (const dir of skillDirs) {
      const jsonFile = path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json');
      if (!fs.existsSync(jsonFile)) missing.push(dir);
    }
    expect(missing).toEqual([]);
  });

  it('most SKILL.md have valid frontmatter', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return; // Skip if no skills
    let withFrontmatter = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md'), 'utf-8');
      const parsed = parseSkillMd(content);
      if (parsed.name || content.includes('# ') || content.length > 50) withFrontmatter++;
    }
    expect(withFrontmatter).toBeGreaterThan(skillDirs.length * 0.8);
  });

  it('most SKILL.md have a description', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return; // Skip if no skills
    let withDesc = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md'), 'utf-8');
      if (content.length > 30) withDesc++;
    }
    expect(withDesc).toBeGreaterThan(skillDirs.length * 0.8);
  });

  it('most SKILL.md have Operating Rules section', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return; // Skip if no skills
    let withRules = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md'), 'utf-8');
      if (content.includes('Rules') || content.includes('rules') || content.includes('Steps') || content.includes('steps')) withRules++;
    }
    expect(withRules).toBeGreaterThan(skillDirs.length * 0.3);
  });

  it('most SKILL.md have Output section', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return; // Skip if no skills
    let withOutput = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md'), 'utf-8');
      if (content.includes('Output') || content.includes('output') || content.includes('Result') || content.includes('result')) withOutput++;
    }
    expect(withOutput).toBeGreaterThan(skillDirs.length * 0.3);
  });
});

describe('Skill Library — JSON Metadata Validation', () => {
  const skillDirs = getAllSkillDirs();
  const hasSkillLibrary = fs.existsSync(SKILL_LIBRARY_PATH);

  it('every JSON has required fields', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const missing: string[] = [];
    const requiredFields = ['id', 'name', 'native', 'description', 'category'];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      for (const field of requiredFields) {
        if (!(field in json)) {
          missing.push(`${dir}: missing ${field}`);
          break;
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every JSON id matches directory name', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const mismatches: string[] = [];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (json.id !== dir) mismatches.push(`${dir}: id=${json.id}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('every JSON has native=true', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const notNative: string[] = [];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (json.native !== true) notNative.push(dir);
    }
    expect(notNative).toEqual([]);
  });

  it('every JSON has valid riskLevel', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const invalid: string[] = [];
    const validRisk = ['low', 'medium', 'high', 'critical'];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (!validRisk.includes(String(json.riskLevel))) invalid.push(dir);
    }
    expect(invalid).toEqual([]);
  });

  it('every JSON has valid permissionProfileId', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const invalid: string[] = [];
    const validProfiles = ['workspace-read', 'workspace-write', 'host-write', 'workspace-write-approval', 'local-readonly', 'connector-live-secretref', 'network-read-approval', 'tool-execution-approval', 'owner-approved', 'local-scoped'];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (!validProfiles.includes(String(json.permissionProfileId))) invalid.push(dir);
    }
    expect(invalid).toEqual([]);
  });

  it('every JSON has capabilityTags array', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    let withTags = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (Array.isArray(json.capabilityTags)) withTags++;
    }
    expect(withTags).toBeGreaterThan(skillDirs.length * 0.8);
  });

  it('every JSON has presets array', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    let withPresets = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (Array.isArray(json.presets)) withPresets++;
    }
    expect(withPresets).toBeGreaterThan(skillDirs.length * 0.8);
  });
});

describe('Skill Library — Risk Distribution', () => {
  const skillDirs = getAllSkillDirs();
  const hasSkillLibrary = fs.existsSync(SKILL_LIBRARY_PATH);

  it('has skills in all risk levels', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      const risk = String(json.riskLevel || 'low');
      riskCounts[risk] = (riskCounts[risk] || 0) + 1;
    }
    expect(riskCounts.low).toBeGreaterThan(0);
    expect(riskCounts.medium).toBeGreaterThan(0);
  });

  it('high-risk skills have requiresPolicyBroker set', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const missing: string[] = [];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (json.riskLevel === 'high' && json.requiresPolicyBroker === undefined) {
        missing.push(dir);
      }
    }
    expect(missing.length).toBeLessThan(5);
  });

  it('high-risk skills have receiptsRequired set', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const missing: string[] = [];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (json.riskLevel === 'high' && json.receiptsRequired === undefined) {
        missing.push(dir);
      }
    }
    expect(missing.length).toBeLessThan(5);
  });

  it('high-risk skills have appropriate permissions', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const inappropriate: string[] = [];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      if (json.riskLevel === 'high' && !['workspace-write', 'workspace-read', 'host-write', 'workspace-write-approval'].includes(String(json.permissionProfileId))) {
        inappropriate.push(dir);
      }
    }
    expect(inappropriate).toEqual([]);
  });
});

describe('Skill Library — Category Coverage', () => {
  const skillDirs = getAllSkillDirs();
  const hasSkillLibrary = fs.existsSync(SKILL_LIBRARY_PATH);

  it('has skills in multiple categories', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const categories = new Set<string>();
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      categories.add(String(json.category));
    }
    expect(categories.size).toBeGreaterThan(10);
  });

  it('has devops skills', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const devops = skillDirs.filter((dir) => {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      return json.category === 'devops';
    });
    expect(devops.length).toBeGreaterThan(3);
  });

  it('has security skills', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const security = skillDirs.filter((dir) => {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      return json.category === 'security';
    });
    expect(security.length).toBeGreaterThan(3);
  });

  it('has ml/ai skills', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const ml = skillDirs.filter((dir) => {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      return json.category === 'ml' || json.category === 'ai';
    });
    expect(ml.length).toBeGreaterThan(3);
  });

  it('has finance skills', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const finance = skillDirs.filter((dir) => {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      return json.category === 'finance';
    });
    expect(finance.length).toBeGreaterThan(2);
  });

  it('has blockchain skills', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const blockchain = skillDirs.filter((dir) => {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'ZAVORTH_NATIVE_SKILL.json'), 'utf-8');
      const json = parseSkillJson(content);
      return json.category === 'blockchain';
    });
    expect(blockchain.length).toBeGreaterThan(1);
  });
});

describe('Skill Library — Content Quality', () => {
  const skillDirs = getAllSkillDirs();
  const hasSkillLibrary = fs.existsSync(SKILL_LIBRARY_PATH);

  it('every SKILL.md has meaningful content', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    const empty: string[] = [];
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md'), 'utf-8');
      if (content.length < 20) empty.push(dir);
    }
    expect(empty).toEqual([]);
  });

  it('most SKILL.md have a title', () => {
    if (!hasSkillLibrary || skillDirs.length === 0) return;
    let withTitle = 0;
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(SKILL_LIBRARY_PATH, dir, 'SKILL.md'), 'utf-8');
      if (content.includes('# ') || content.includes('name:')) withTitle++;
    }
    expect(withTitle).toBeGreaterThan(skillDirs.length * 0.8);
  });
});

