import { DesktopAutomationTool } from '../dist/tools/DesktopAutomationTool.js';

async function test() {
  console.log("Instantiating generic tool...");
  const tool = new DesktopAutomationTool();
  
  console.log("Calling tool for an unknown window...");
  const res = await tool.execute({
    action: 'list-elements',
    windowTitle: 'Code',
  });
  console.log("Result:", res);
}

test().catch(console.error);
