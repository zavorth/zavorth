import fs from 'fs';
import path from 'path';
import os from 'os';
import { ZavorthChartGeneratorTool } from '../../src/tools/ZavorthChartGeneratorTool';

describe('ZavorthChartGeneratorTool', () => {
  let tool: ZavorthChartGeneratorTool;
  let tmpDir: string;

  beforeEach(() => {
    tool = new ZavorthChartGeneratorTool();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-gen-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a bar chart', async () => {
    const data = JSON.stringify([
      { label: 'A', value: 10 },
      { label: 'B', value: 20 },
      { label: 'C', value: 15 },
    ]);
    const result = await tool.execute({ chart_type: 'bar', data });
    expect(result).toContain('Chart generated');
    expect(result).toContain('bar');
    expect(result).toContain('3 data points');
  });

  it('generates a pie chart', async () => {
    const data = JSON.stringify([
      { label: 'X', value: 30 },
      { label: 'Y', value: 70 },
    ]);
    const result = await tool.execute({ chart_type: 'pie', data });
    expect(result).toContain('Chart generated');
    expect(result).toContain('pie');
  });

  it('generates a scatter plot', async () => {
    const data = JSON.stringify([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ]);
    const result = await tool.execute({ chart_type: 'scatter', data });
    expect(result).toContain('Chart generated');
    expect(result).toContain('scatter');
  });

  it('generates a line chart', async () => {
    const data = JSON.stringify([
      { label: 'Jan', value: 10 },
      { label: 'Feb', value: 20 },
    ]);
    const result = await tool.execute({ chart_type: 'line', data });
    expect(result).toContain('Chart generated');
  });

  it('generates a donut chart', async () => {
    const data = JSON.stringify([
      { label: 'A', value: 40 },
      { label: 'B', value: 60 },
    ]);
    const result = await tool.execute({ chart_type: 'donut', data });
    expect(result).toContain('Chart generated');
  });

  it('saves chart to file', async () => {
    const outputPath = path.join(tmpDir, 'chart.svg');
    const data = JSON.stringify([{ label: 'A', value: 10 }]);
    const result = await tool.execute({
      chart_type: 'bar',
      data,
      output_path: outputPath,
    });
    expect(result).toContain('Chart saved');
    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('<svg');
  });

  it('saves chart with custom dimensions', async () => {
    const outputPath = path.join(tmpDir, 'custom.svg');
    const data = JSON.stringify([{ label: 'A', value: 10 }]);
    await tool.execute({
      chart_type: 'bar',
      data,
      output_path: outputPath,
      width: 1200,
      height: 800,
    });
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('width="1200"');
    expect(content).toContain('height="800"');
  });

  it('applies dark mode', async () => {
    const data = JSON.stringify([{ label: 'A', value: 10 }]);
    const result = await tool.execute({ chart_type: 'bar', data, dark_mode: true });
    expect(result).toContain('Chart generated');
  });

  it('includes title', async () => {
    const outputPath = path.join(tmpDir, 'titled.svg');
    const data = JSON.stringify([{ label: 'A', value: 10 }]);
    await tool.execute({
      chart_type: 'bar',
      data,
      title: 'My Chart',
      output_path: outputPath,
    });
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('My Chart');
  });

  it('includes axis labels', async () => {
    const outputPath = path.join(tmpDir, 'labeled.svg');
    const data = JSON.stringify([{ label: 'A', value: 10 }]);
    await tool.execute({
      chart_type: 'bar',
      data,
      x_label: 'Category',
      y_label: 'Value',
      output_path: outputPath,
    });
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('Category');
    expect(content).toContain('Value');
  });

  describe('error handling', () => {
    it('returns error for missing chart_type', async () => {
      const result = await tool.execute({ data: '[]' });
      expect(result).toContain('Error');
      expect(result).toContain('chart_type');
    });

    it('returns error for invalid chart type', async () => {
      const result = await tool.execute({
        chart_type: 'heatmap3d',
        data: '[{"label":"A","value":1}]',
      });
      expect(result).toContain('Error');
      expect(result).toContain('invalid');
    });

    it('returns error for invalid JSON data', async () => {
      const result = await tool.execute({
        chart_type: 'bar',
        data: 'not-json',
      });
      expect(result).toContain('Error');
      expect(result).toContain('invalid JSON');
    });

    it('returns error for empty data array', async () => {
      const result = await tool.execute({
        chart_type: 'bar',
        data: '[]',
      });
      expect(result).toContain('Error');
      expect(result).toContain('non-empty array');
    });

    it('returns error for non-array data', async () => {
      const result = await tool.execute({
        chart_type: 'bar',
        data: '{"not":"array"}',
      });
      expect(result).toContain('Error');
      expect(result).toContain('non-empty array');
    });
  });
});
