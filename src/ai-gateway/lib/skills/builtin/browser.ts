import { SkillHandler } from "../types";

export const browserSkill: SkillHandler = async (input, _context) => {
  const { action, ...params } = input as {
    action: "navigate" | "click" | "type" | "screenshot" | "extract";
    url?: string;
    selector?: string;
    text?: string;
  };

  switch (action) {
    case "navigate":
      return { success: false, action: "navigate", url: params.url, error: "No browser adapter is connected to this gateway." };
    case "click":
      return { success: false, action: "click", selector: params.selector, error: "No browser adapter is connected to this gateway." };
    case "type":
      return {
        success: false,
        action: "type",
        selector: params.selector,
        text: params.text,
        error: "No browser adapter is connected to this gateway.",
      };
    case "screenshot":
      return { success: false, action: "screenshot", error: "No browser adapter is connected to this gateway." };
    case "extract":
      return { success: false, action: "extract", selector: params.selector, data: null, error: "No browser adapter is connected to this gateway." };
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};

export function registerBrowserSkill(executor: unknown): void {
  executor.registerHandler("browser", browserSkill);
}
