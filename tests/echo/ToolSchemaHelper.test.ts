import { ToolSchemaHelper } from '../../src/echo/types/ToolSchemaHelper';
import { SystemMediaTool } from '../../src/echo/tools/os/SystemMediaTool';
import { SystemScreenshotTool } from '../../src/echo/tools/os/SystemScreenshotTool';
import { HomeAssistantBridge } from '../../src/echo/tools/iot/HomeAssistantBridge';

describe('ToolSchemaHelper', () => {
  it('exports tool metadata and zod enum values', () => {
    const media = ToolSchemaHelper.toToolDefinition(new SystemMediaTool());
    expect(media.name).toBe('os_media_control');
    expect(media.category).toBe('OS');
    expect(media.dangerLevel).toBe('safe');
    expect(media.requiresPermission).toBe(false);
    expect(media.parameters.properties.action.enum).toContain('play_pause');
  });

  it('marks permission-required tools for the dashboard', () => {
    const screenshot = ToolSchemaHelper.toToolDefinition(new SystemScreenshotTool());
    expect(screenshot.name).toBe('os_screenshot');
    expect(screenshot.dangerLevel).toBe('moderate');
    expect(screenshot.requiresPermission).toBe(true);
  });

  it('exports expanded Home Assistant action enums', () => {
    const homeAssistant = ToolSchemaHelper.toToolDefinition(new HomeAssistantBridge());
    expect(homeAssistant.parameters.properties.action.enum).toContain('lock');
    expect(homeAssistant.parameters.properties.action.enum).toContain('vacuum_return_to_base');
    expect(homeAssistant.parameters.properties.action.enum).toContain('select_option');
  });
});
