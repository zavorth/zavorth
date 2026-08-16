/**
 * Stack-Aware Persona Engine.
 * Inspects workspace configuration and manifests to automatically tailor specialist subagents to the project stack.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSubagentScientistName } from '../../services/ZavorthSubagentIdentityService.js';

export interface TechStackProfile {
  languages: string[];
  frameworks: string[];
  testRunners: string[];
  typeSystem: string;
  hasStrictTyping: boolean;
}

export interface TailoredSpecialist {
  id: string;
  scientist: string;
  role: string;
  title: string;
  systemPrompt: string;
  capabilities: string[];
  maxTokensBudget: number;
}

export class StackAwarePersonaEngine {
  /**
   * Scans workspace to detect languages, frameworks, and tools.
   */
  static detectTechStack(workspaceRoot: string = process.cwd()): TechStackProfile {
    const profile: TechStackProfile = {
      languages: [],
      frameworks: [],
      testRunners: [],
      typeSystem: 'standard',
      hasStrictTyping: false,
    };

    // Check package.json (Node/JS/TS)
    const pkgPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };

        if (allDeps['typescript']) {
          profile.languages.push('TypeScript');
          profile.hasStrictTyping = true;
        } else {
          profile.languages.push('JavaScript');
        }

        if (allDeps['react'] || allDeps['next']) profile.frameworks.push('React');
        if (allDeps['vue'] || allDeps['nuxt']) profile.frameworks.push('Vue');
        if (allDeps['express'] || allDeps['fastify']) profile.frameworks.push('Node.js Backend');
        if (allDeps['jest']) profile.testRunners.push('Jest');
        if (allDeps['vitest']) profile.testRunners.push('Vitest');
      } catch {
        // Fallback
      }
    }

    // Check tsconfig.json
    const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      profile.typeSystem = 'TypeScript Strict';
      profile.hasStrictTyping = true;
    }

    // Check Cargo.toml (Rust)
    if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) {
      profile.languages.push('Rust');
      profile.testRunners.push('cargo test');
    }

    // Check Python
    if (
      fs.existsSync(path.join(workspaceRoot, 'requirements.txt')) ||
      fs.existsSync(path.join(workspaceRoot, 'pyproject.toml'))
    ) {
      profile.languages.push('Python');
      profile.testRunners.push('pytest');
    }

    if (profile.languages.length === 0) {
      profile.languages.push('TypeScript');
    }

    return profile;
  }

  /**
   * Generates specialized, stack-tailored subagents for a task.
   */
  static generateSpecialists(
    taskDescription: string,
    sessionId: string = 'session-default',
    workspaceRoot: string = process.cwd()
  ): TailoredSpecialist[] {
    const stack = this.detectTechStack(workspaceRoot);
    const lang = stack.languages.join('/') || 'TypeScript';
    const testTool = stack.testRunners[0] || 'Jest';
    const specialists: TailoredSpecialist[] = [];

    // 1. Architect (Euler)
    const archScientist = getSubagentScientistName('arch', sessionId);
    specialists.push({
      id: `spec_arch_${sessionId.slice(0, 6)}`,
      scientist: archScientist,
      role: 'System Architect & Contract Planner',
      title: `${archScientist} (${lang} Architecture Planner)`,
      systemPrompt: `You are ${archScientist}, a Principal Software Architect specializing in ${lang}. Decompose complex goals into verified milestones adhering to clean-code principles and modular SOLID design.`,
      capabilities: ['view_file', 'list_dir', 'grep_search'],
      maxTokensBudget: 5000,
    });

    // 2. Core Implementer (Turing)
    const codeScientist = getSubagentScientistName('code', sessionId);
    specialists.push({
      id: `spec_code_${sessionId.slice(0, 6)}`,
      scientist: codeScientist,
      role: 'Core Implementation Engineer',
      title: `${codeScientist} (${lang} Senior Engineer)`,
      systemPrompt: `You are ${codeScientist}, an expert ${lang} developer. Write robust, strictly typed code with zero dead code and high testability.`,
      capabilities: ['write_to_file', 'replace_file_content', 'view_file'],
      maxTokensBudget: 14000,
    });

    // 3. QA & Verification Auditor (Curie)
    const qaScientist = getSubagentScientistName('qa', sessionId);
    specialists.push({
      id: `spec_qa_${sessionId.slice(0, 6)}`,
      scientist: qaScientist,
      role: 'Quality & Test Verification Auditor',
      title: `${qaScientist} (${testTool} & LSP Verification Auditor)`,
      systemPrompt: `You are ${qaScientist}, a Quality Assurance lead. Execute ${testTool} test suites and in-memory LSP diagnostics. Reject regressions and demand fixes before user delivery.`,
      capabilities: ['run_command', 'view_file'],
      maxTokensBudget: 7000,
    });

    // 4. Security Guardian (Noether) - For sensitive tasks
    const desc = taskDescription.toLowerCase();
    if (desc.includes('auth') || desc.includes('secret') || desc.includes('token') || desc.includes('api') || desc.includes('guard')) {
      const secScientist = getSubagentScientistName('sec', sessionId);
      specialists.push({
        id: `spec_sec_${sessionId.slice(0, 6)}`,
        scientist: secScientist,
        role: 'Security & Egress Policy Guardian',
        title: `${secScientist} (Boundary Isolation & Security Guardian)`,
        systemPrompt: `You are ${secScientist}, an Information Security officer. Verify credential isolation, prevent API key leakages, and enforce input validation gates.`,
        capabilities: ['view_file', 'grep_search'],
        maxTokensBudget: 4000,
      });
    }

    return specialists;
  }
}
