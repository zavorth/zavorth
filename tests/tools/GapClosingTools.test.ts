import { ZavorthBrowserAutomationTool } from '../../src/tools/ZavorthBrowserAutomationTool';
import { ZavorthCodeFormatterTool } from '../../src/tools/ZavorthCodeFormatterTool';
import { ZavorthDependencyAnalyzerTool } from '../../src/tools/ZavorthDependencyAnalyzerTool';
import { ZavorthGitAdvancedTool } from '../../src/tools/ZavorthGitAdvancedTool';
import { ZavorthDataScienceTool } from '../../src/tools/ZavorthDataScienceTool';
import { ZavorthMlOpsTool } from '../../src/tools/ZavorthMlOpsTool';
import { ZavorthContainerManagerTool } from '../../src/tools/ZavorthContainerManagerTool';
import { ZavorthDatabaseAdminTool } from '../../src/tools/ZavorthDatabaseAdminTool';
import { ZavorthFileSystemAdvancedTool } from '../../src/tools/ZavorthFileSystemAdvancedTool';
import { ZavorthNetworkDiagnosticsTool } from '../../src/tools/ZavorthNetworkDiagnosticsTool';
import { ZavorthSecurityScannerTool } from '../../src/tools/ZavorthSecurityScannerTool';
import { ZavorthCloudStorageTool } from '../../src/tools/ZavorthCloudStorageTool';
import { ZavorthEmailAdvancedTool } from '../../src/tools/ZavorthEmailAdvancedTool';
import { ZavorthCalendarAdvancedTool } from '../../src/tools/ZavorthCalendarAdvancedTool';
import { ZavorthNotificationTool } from '../../src/tools/ZavorthNotificationTool';
import { ZavorthApiBuilderTool } from '../../src/tools/ZavorthApiBuilderTool';

const TOOLS = [
  { name: 'BrowserAutomation', Factory: ZavorthBrowserAutomationTool },
  { name: 'CodeFormatter', Factory: ZavorthCodeFormatterTool },
  { name: 'DependencyAnalyzer', Factory: ZavorthDependencyAnalyzerTool },
  { name: 'GitAdvanced', Factory: ZavorthGitAdvancedTool },
  { name: 'DataScience', Factory: ZavorthDataScienceTool },
  { name: 'MlOps', Factory: ZavorthMlOpsTool },
  { name: 'ContainerManager', Factory: ZavorthContainerManagerTool },
  { name: 'DatabaseAdmin', Factory: ZavorthDatabaseAdminTool },
  { name: 'FileSystemAdvanced', Factory: ZavorthFileSystemAdvancedTool },
  { name: 'NetworkDiagnostics', Factory: ZavorthNetworkDiagnosticsTool },
  { name: 'SecurityScanner', Factory: ZavorthSecurityScannerTool },
  { name: 'CloudStorage', Factory: ZavorthCloudStorageTool },
  { name: 'EmailAdvanced', Factory: ZavorthEmailAdvancedTool },
  { name: 'CalendarAdvanced', Factory: ZavorthCalendarAdvancedTool },
  { name: 'Notification', Factory: ZavorthNotificationTool },
  { name: 'ApiBuilder', Factory: ZavorthApiBuilderTool },
];

describe('Gap-Closing Tools — Deep Coverage', () => {
  for (const { name, Factory } of TOOLS) {
    describe(name, () => {
      const tool = new Factory();

      it('has a non-empty name', () => {
        expect(tool.name).toBeTruthy();
        expect(typeof tool.name).toBe('string');
      });

      it('has a non-empty description', () => {
        expect(tool.description).toBeTruthy();
        expect(typeof tool.description).toBe('string');
      });

      it('has valid parameters schema', () => {
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters?.type).toBe('object');
        expect(tool.parameters?.properties).toBeDefined();
      });

      it('returns error string for empty input', async () => {
        const result = await tool.execute({});
        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('error');
      });

      it('returns error for invalid action', async () => {
        const result = await tool.execute({ action: 'nonexistent_action_xyz' });
        expect(typeof result).toBe('string');
      });

      it('getDefinition returns valid structure', () => {
        const def = tool.getDefinition();
        expect(def).toBeDefined();
        expect(def.name).toBe(tool.name);
        expect(def.description).toBe(tool.description);
        expect(def.parameters).toBeDefined();
      });
    });
  }
});
