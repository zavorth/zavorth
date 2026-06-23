import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthChartGeneratorTool extends BaseTool {
  public readonly name = 'zavorth_chart_generator';

  public readonly description =
    'Generate charts and visualizations from data — bar, line, pie, scatter, heatmap. Exports as SVG or PNG.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      chart_type: {
        type: 'string',
        description: "Type: 'bar', 'line', 'pie', 'scatter', 'heatmap', 'area', 'donut'.",
      },
      data: {
        type: 'string',
        description: 'JSON array of data points [{label, value}] or [{x, y}].',
      },
      title: {
        type: 'string',
        description: 'Chart title.',
      },
      x_label: {
        type: 'string',
        description: 'X-axis label.',
      },
      y_label: {
        type: 'string',
        description: 'Y-axis label.',
      },
      width: {
        type: 'number',
        description: 'Width in pixels. Default: 800.',
      },
      height: {
        type: 'number',
        description: 'Height in pixels. Default: 600.',
      },
      colors: {
        type: 'string',
        description: 'JSON array of hex colors.',
      },
      output_path: {
        type: 'string',
        description: 'Path to save the chart (SVG or PNG based on extension).',
      },
      format: {
        type: 'string',
        description: "Output format: 'svg' (default), 'png'.",
      },
      dark_mode: {
        type: 'boolean',
        description: 'Use dark theme. Default: false.',
      },
    },
    required: ['chart_type', 'data'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const chartType = String(args.chart_type || '');
    if (!chartType) return 'Error: "chart_type" is required.';

    const validTypes = ['bar', 'line', 'pie', 'scatter', 'heatmap', 'area', 'donut'];
    if (!validTypes.includes(chartType)) {
      return `Error: chart type "${chartType}" is invalid. Use: ${validTypes.join(', ')}.`;
    }

    let data: Array<Record<string, unknown>>;
    try {
      data = JSON.parse(String(args.data || '[]'));
    } catch {
      return 'Error: invalid JSON for "data".';
    }

    if (!Array.isArray(data) || data.length === 0) {
      return 'Error: "data" must be a non-empty array.';
    }

    const title = String(args.title || 'Chart');
    const width = typeof args.width === 'number' ? args.width : 800;
    const height = typeof args.height === 'number' ? args.height : 600;
    const darkMode = args.dark_mode === true;
    const outputFormat = String(args.format || 'svg');
    const outputPath = typeof args.output_path === 'string' ? args.output_path : undefined;

    const svg = this.generateSVG(chartType, data, {
      title, width, height, darkMode,
      xLabel: String(args.x_label || ''),
      yLabel: String(args.y_label || ''),
    });

    if (outputPath) {
      const dir = path.dirname(path.resolve(outputPath));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.resolve(outputPath), svg, 'utf-8');
      return `Chart saved to ${outputPath} (${svg.length} bytes).`;
    }

    return `Chart generated (${chartType}, ${data.length} data points, ${width}x${height}):\nSVG preview: ${svg.slice(0, 500)}...`;
  }

  private generateSVG(
    type: string,
    data: Array<Record<string, unknown>>,
    opts: { title: string; width: number; height: number; darkMode: boolean; xLabel: string; yLabel: string },
  ): string {
    const bg = opts.darkMode ? '#1a1a2e' : '#ffffff';
    const fg = opts.darkMode ? '#e0e0e0' : '#333333';
    const accent = '#6366f1';

    const margin = { top: 60, right: 30, bottom: 60, left: 60 };
    const chartW = opts.width - margin.left - margin.right;
    const chartH = opts.height - margin.top - margin.bottom;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">\n`;
    svg += `<rect width="${opts.width}" height="${opts.height}" fill="${bg}"/>\n`;
    svg += `<text x="${opts.width / 2}" y="30" text-anchor="middle" fill="${fg}" font-size="18" font-weight="bold">${opts.title}</text>\n`;

    if (type === 'bar' || type === 'line' || type === 'area') {
      const values = data.map((d) => Number(d.value || d.y || 0));
      const maxVal = Math.max(...values, 1);
      const barWidth = chartW / data.length;

      for (let i = 0; i < data.length; i++) {
        const x = margin.left + i * barWidth;
        const val = Number(data[i].value || data[i].y || 0);
        const barH = (val / maxVal) * chartH;
        const y = margin.top + chartH - barH;

        if (type === 'bar') {
          svg += `<rect x="${x + 2}" y="${y}" width="${barWidth - 4}" height="${barH}" fill="${accent}" rx="2"/>\n`;
        } else if (type === 'line' && i > 0) {
          const prevX = margin.left + (i - 1) * barWidth + barWidth / 2;
          const prevVal = Number(data[i - 1].value || data[i - 1].y || 0);
          const prevY = margin.top + chartH - (prevVal / maxVal) * chartH;
          svg += `<line x1="${prevX}" y1="${prevY}" x2="${x + barWidth / 2}" y2="${y}" stroke="${accent}" stroke-width="2"/>\n`;
        } else if (type === 'area') {
          svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${accent}" opacity="0.3"/>\n`;
        }

        const label = String(data[i].label || data[i].x || i);
        svg += `<text x="${x + barWidth / 2}" y="${margin.top + chartH + 20}" text-anchor="middle" fill="${fg}" font-size="10">${label.slice(0, 10)}</text>\n`;
        svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" fill="${fg}" font-size="10">${val}</text>\n`;
      }
    }

    if (type === 'pie' || type === 'donut') {
      const values = data.map((d) => Number(d.value || 0));
      const total = values.reduce((s, v) => s + v, 0);
      const cx = opts.width / 2;
      const cy = margin.top + chartH / 2;
      const r = Math.min(chartW, chartH) / 2 - 20;
      const innerR = type === 'donut' ? r * 0.5 : 0;
      let startAngle = 0;

      const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

      for (let i = 0; i < data.length; i++) {
        const val = values[i];
        const sliceAngle = (val / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;
        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);

        if (innerR > 0) {
          const ix1 = cx + innerR * Math.cos(startAngle);
          const iy1 = cy + innerR * Math.sin(startAngle);
          const ix2 = cx + innerR * Math.cos(endAngle);
          const iy2 = cy + innerR * Math.sin(endAngle);
          svg += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc},0 ${ix1},${iy1} Z" fill="${colors[i % colors.length]}"/>\n`;
        } else {
          svg += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"/>\n`;
        }

        const midAngle = startAngle + sliceAngle / 2;
        const labelR = r + 20;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        const label = String(data[i].label || i);
        svg += `<text x="${lx}" y="${ly}" text-anchor="middle" fill="${fg}" font-size="11">${label.slice(0, 12)}</text>\n`;

        startAngle = endAngle;
      }
    }

    if (type === 'scatter') {
      const xValues = data.map((d) => Number(d.x || 0));
      const yValues = data.map((d) => Number(d.y || 0));
      const maxX = Math.max(...xValues, 1);
      const maxY = Math.max(...yValues, 1);

      for (let i = 0; i < data.length; i++) {
        const x = margin.left + (xValues[i] / maxX) * chartW;
        const y = margin.top + chartH - (yValues[i] / maxY) * chartH;
        svg += `<circle cx="${x}" cy="${y}" r="4" fill="${accent}" opacity="0.7"/>\n`;
      }
    }

    if (opts.xLabel) {
      svg += `<text x="${opts.width / 2}" y="${opts.height - 10}" text-anchor="middle" fill="${fg}" font-size="12">${opts.xLabel}</text>\n`;
    }
    if (opts.yLabel) {
      svg += `<text x="15" y="${margin.top + chartH / 2}" text-anchor="middle" fill="${fg}" font-size="12" transform="rotate(-90, 15, ${margin.top + chartH / 2})">${opts.yLabel}</text>\n`;
    }

    svg += '</svg>';
    return svg;
  }
}
