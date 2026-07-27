import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkspaceProfileService } from '../../src/services/WorkspaceProfileService';

describe('WorkspaceProfileService', () => {
  it('detects stack, scripts and important paths for a node/typescript workspace', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-profile-'));
    const profilesDir = path.join(root, 'profiles');
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, 'tests'));
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }), 'utf8');
    fs.writeFileSync(path.join(root, 'package-lock.json'), '', 'utf8');
    fs.writeFileSync(
      path.join(root, 'ZAVORTH.md'),
      [
        '# Workspace Playbook',
        '',
        'Priorize mudancas pequenas, verificaveis e com testes sempre que possivel.',
        '',
        '- Rode npm test antes de concluir changes importantes.',
        '- Prefer editar files em src/ e tests/ antes de tocar em scripts operacionais.',
        '',
        '## Hooks',
        '- before-complete: npm test',
        '- before-publish: npm run security:preflight',
        '',
        '## Commands',
        '- review: /workflow review ${args}',
        '- smoke: /run npm run test:smoke',
      ].join('\n'),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'sample-app',
        scripts: {
          dev: 'vite',
          build: 'tsc -p .',
          test: 'jest --runInBand',
        },
        dependencies: {
          react: '^19.0.0',
          next: '^15.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      }),
      'utf8',
    );

    try {
      const service = new WorkspaceProfileService(profilesDir);
      const profile = await service.getProfile(root);

      expect(profile).toBeTruthy();
      expect(profile?.detected_stacks).toEqual(expect.arrayContaining(['nodejs', 'javascript-app', 'frontend', 'tested']));
      expect(profile?.frameworks).toEqual(expect.arrayContaining(['react', 'nextjs', 'typescript']));
      expect(profile?.package_manager).toBe('npm');
      expect(profile?.scripts).toEqual(expect.objectContaining({
        dev: 'vite',
        build: 'tsc -p .',
        test: 'jest --runInBand',
      }));
      expect(profile?.important_paths).toEqual(expect.arrayContaining([
        path.join(root, 'src').replace(/\\/g, '/'),
        path.join(root, 'tests').replace(/\\/g, '/'),
      ]));
      expect(profile?.instruction_file).toBe(path.join(root, 'ZAVORTH.md').replace(/\\/g, '/'));
      expect(profile?.instruction_summary).toContain('Priorize mudancas pequenas');
      expect(profile?.instruction_notes).toEqual(expect.arrayContaining([
        'Rode npm test antes de concluir changes importantes.',
        'Prefer editar files em src/ e tests/ antes de tocar em scripts operacionais.',
      ]));
      expect(profile?.workspace_hooks).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'before-complete', command: 'npm test' }),
        expect.objectContaining({ event: 'before-publish', command: 'npm run security:preflight' }),
      ]));
      expect(profile?.workspace_commands).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'review', template: '/workflow review ${args}' }),
        expect.objectContaining({ name: 'smoke', template: '/run npm run test:smoke' }),
      ]));
      expect(fs.existsSync(path.join(profilesDir, `${profile?.slug}.json`))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('merges AGENTS.md and local skill directories into the workspace instruction profile', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-agents-'));
    const profilesDir = path.join(root, 'profiles');
    fs.mkdirSync(path.join(root, '.agents', 'skills', 'ship'), { recursive: true });
    fs.mkdirSync(path.join(root, 'skills', 'qa'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'AGENTS.md'),
      [
        '# Agent Playbook',
        '',
        'Use o ZAVORTH Gateway como contrato primario da interface local.',
        '',
        '- Sempre validar reconnect e replay do websocket.',
        '',
        '## Commands',
        '- gatewaycheck: /run npm run test:gateway:smoke',
      ].join('\n'),
      'utf8',
    );
    fs.writeFileSync(path.join(root, '.agents', 'skills', 'ship', 'SKILL.md'), '# Ship\n\nRun gateway rollout safely.\n', 'utf8');
    fs.writeFileSync(path.join(root, 'skills', 'qa', 'SKILL.md'), '# QA\n\nRun qa checks.\n', 'utf8');

    try {
      const service = new WorkspaceProfileService(profilesDir);
      const profile = await service.getProfile(root);

      expect(profile).toBeTruthy();
      expect(profile?.instruction_file).toBe(path.join(root, 'AGENTS.md').replace(/\\/g, '/'));
      expect(profile?.instruction_sources).toEqual(expect.arrayContaining([
        path.join(root, 'AGENTS.md').replace(/\\/g, '/'),
        path.join(root, '.agents', 'skills').replace(/\\/g, '/'),
        path.join(root, 'skills').replace(/\\/g, '/'),
      ]));
      expect(profile?.instruction_summary).toContain('Use o ZAVORTH Gateway');
      expect(profile?.instruction_notes).toEqual(expect.arrayContaining([
        '[AGENTS] Sempre validar reconnect e replay do websocket.',
        'Skills em skills: qa',
      ]));
      expect(profile?.skill_directories).toEqual(expect.arrayContaining([
        path.join(root, '.agents', 'skills').replace(/\\/g, '/'),
        path.join(root, 'skills').replace(/\\/g, '/'),
      ]));
      expect(profile?.workspace_commands).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'gatewaycheck', template: '/run npm run test:gateway:smoke' }),
      ]));
      expect(profile?.important_paths).toEqual(expect.arrayContaining([
        path.join(root, '.agents', 'skills').replace(/\\/g, '/'),
        path.join(root, 'skills').replace(/\\/g, '/'),
      ]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
