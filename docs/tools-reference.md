# Tools Reference

Zavorth provides 88+ built-in tools organized by category. This reference covers the most important ones.

## File Operations

| Tool | Description | Approval |
|------|-------------|----------|
| `ReadFileTool` | Read file contents with encoding support | No |
| `CreateFileTool` | Create new files with content | Yes |
| `WriteFileTool` | Write content to files | Yes |
| `EditFileTool` | Edit files with search/replace | Yes |
| `ListDirectoryTool` | List directory contents | No |
| `GlobTool` | Find files by pattern | No |
| `GrepTool` | Search file contents with regex | No |

## Web & Search

| Tool | Description | Approval |
|------|-------------|----------|
| `WebSearchTool` | Search the web | No |
| `QueryExternalAiTool` | Query external AI services | No |

## Execution

| Tool | Description | Approval |
|------|-------------|----------|
| `SandboxExecutionTool` | Execute code in sandbox | Yes |
| `RemoteShellTool` | Execute shell commands | Yes |
| `DesktopAutomationTool` | Desktop automation | Yes |

## Memory & Knowledge

| Tool | Description | Approval |
|------|-------------|----------|
| `Mem0Tool` | Memory storage and retrieval | No |
| `UnifiedSearchTool` | Search across memory and files | No |

## Media

| Tool | Description | Approval |
|------|-------------|----------|
| `ImageGenerationTool` | Generate images | Yes |
| `VideoGenerationTool` | Generate videos | Yes |
| `MediaAnalysisTool` | Analyze media files | No |

## Communication

| Tool | Description | Approval |
|------|-------------|----------|
| `EmailTool` | Send emails | Yes |
| `ZavorthChannelSendTool` | Send messages via channels | Yes |

## Project Management

| Tool | Description | Approval |
|------|-------------|----------|
| `KanbanTool` | Manage kanban boards | No |
| `CalendarTool` | Calendar operations | No |
| `DateTimeTool` | Date/time utilities | No |
| `ZavorthCronSchedulerTool` | Schedule recurring tasks | Yes |

## Code Intelligence

| Tool | Description | Approval |
|------|-------------|----------|
| `CodeReviewTool` | Review code changes | No |
| `ZavorthCodeIntelligenceTool` | Code analysis | No |
| `ZavorthDependencyAnalyzerTool` | Analyze dependencies | No |

## DevOps

| Tool | Description | Approval |
|------|-------------|----------|
| `ZavorthDockerComposeTool` | Docker Compose operations | Yes |
| `ZavorthContainerManagerTool` | Container management | Yes |
| `ZavorthGitAdvancedTool` | Advanced git operations | Yes |

## Security

| Tool | Description | Approval |
|------|-------------|----------|
| `ZavorthSecurityScannerTool` | Security scanning | No |
| `ZavorthPolicyEnforcerTool` | Enforce policies | No |

## Agent Management

| Tool | Description | Approval |
|------|-------------|----------|
| `ZavorthDelegateTool` | Delegate to subagents | Yes |
| `AgentManagerTool` | Manage agent instances | Yes |
| `AutoSkillCreatorTool` | Create skills from experience | Yes |

## Provider Management

| Tool | Description | Approval |
|------|-------------|----------|
| `ConfigureLlmProfileTool` | Configure LLM profiles | Yes |
| `ZavorthProviderActivationTool` | Activate providers | Yes |

## Custom Skills

Skills extend tools via the skill system. Install from marketplace:

```bash
zavorth skills list
zavorth skills install <skill-name>
```

## Tool Registration

Tools are registered in `src/tools/ToolRegistry.ts`:

```typescript
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ReadFileTool } from '../tools/ReadFileTool.js';

const registry = new ToolRegistry();
registry.register(new ReadFileTool());
```

## Tool Policy

Tools are governed by `McpToolPolicy` with three security profiles:

- **safe** — read-only tools (Read, Glob, Grep, LS)
- **trusted** — adds write tools (Create, Write)
- **dangerous** — adds execution tools (Shell, Sandbox)

The policy is enforced before every tool execution.
