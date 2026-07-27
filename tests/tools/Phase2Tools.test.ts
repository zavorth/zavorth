import { ZavorthDockerComposeTool } from '../../src/tools/ZavorthDockerComposeTool';
import { ZavorthCodeIntelligenceTool } from '../../src/tools/ZavorthCodeIntelligenceTool';
import { ZavorthSshTunnelTool } from '../../src/tools/ZavorthSshTunnelTool';
import { ZavorthChartGeneratorTool } from '../../src/tools/ZavorthChartGeneratorTool';
import { ZavorthFileWatcherTool } from '../../src/tools/ZavorthFileWatcherTool';
import { ZavorthNetworkTool } from '../../src/tools/ZavorthNetworkTool';
import { ZavorthWebhookReceiverTool } from '../../src/tools/ZavorthWebhookReceiverTool';

describe('ZavorthDockerComposeTool', () => {
  const tool = new ZavorthDockerComposeTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_docker_compose');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('invalid');
  });

  it('lists valid actions', async () => {
    const result = await tool.execute({ action: 'invalid' });
    expect(result).toContain('up');
    expect(result).toContain('down');
  });
});

describe('ZavorthCodeIntelligenceTool', () => {
  const tool = new ZavorthCodeIntelligenceTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_code_intelligence');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'dance' });
    expect(result).toContain('invalid');
  });
});

describe('ZavorthSshTunnelTool', () => {
  const tool = new ZavorthSshTunnelTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_ssh_tunnel');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('lists tunnels when empty', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('No active');
  });

  it('returns error for non-existent tunnel', async () => {
    const result = await tool.execute({ action: 'status', tunnel_id: 'nonexistent' });
    expect(result).toContain('not found');
  });
});

describe('ZavorthChartGeneratorTool', () => {
  const tool = new ZavorthChartGeneratorTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_chart_generator');
  });

  it('returns error without chart_type', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('returns error for invalid chart type', async () => {
    const result = await tool.execute({ chart_type: 'invalid', data: '[{"label":"a","value":1}]' });
    expect(result).toContain('invalid');
  });

  it('generates a bar chart', async () => {
    const result = await tool.execute({
      chart_type: 'bar',
      data: JSON.stringify([
        { label: 'Jan', value: 10 },
        { label: 'Feb', value: 20 },
        { label: 'Mar', value: 15 },
      ]),
      title: 'Sales',
    });
    expect(result).toContain('Chart generated');
    expect(result).toContain('bar');
  });

  it('generates a pie chart', async () => {
    const result = await tool.execute({
      chart_type: 'pie',
      data: JSON.stringify([
        { label: 'A', value: 30 },
        { label: 'B', value: 70 },
      ]),
    });
    expect(result).toContain('Chart generated');
  });

  it('saves chart to file', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-'));
    const outputPath = path.join(tmpDir, 'test.svg');
    const result = await tool.execute({
      chart_type: 'bar',
      data: JSON.stringify([{ label: 'X', value: 5 }]),
      output_path: outputPath,
    });
    expect(result).toContain('saved');
    expect(fs.existsSync(outputPath)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns error for invalid data', async () => {
    const result = await tool.execute({ chart_type: 'bar', data: 'not json' });
    expect(result).toContain('Error');
  });
});

describe('ZavorthFileWatcherTool', () => {
  const tool = new ZavorthFileWatcherTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_file_watcher');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('lists watchers when empty', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('No active');
  });

  it('returns error for non-existent watcher', async () => {
    const result = await tool.execute({ action: 'status', watch_id: 'nonexistent' });
    expect(result).toContain('not found');
  });
});

describe('ZavorthNetworkTool', () => {
  const tool = new ZavorthNetworkTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_network');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'there isck' });
    expect(result).toContain('invalid');
  });

  it('returns error for ping without host', async () => {
    const result = await tool.execute({ action: 'ping' });
    expect(result).toContain('Error');
  });
});

describe('ZavorthWebhookReceiverTool', () => {
  const tool = new ZavorthWebhookReceiverTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_webhook_receiver');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('lists webhooks when empty', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('No active');
  });

  it('returns error for non-existent webhook', async () => {
    const result = await tool.execute({ action: 'log', webhook_id: 'nonexistent' });
    expect(result).toContain('not found');
  });
});
