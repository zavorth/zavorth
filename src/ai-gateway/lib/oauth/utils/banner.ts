import figlet from "figlet";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import { logger } from "@/shared/utils/logger";

/**
 * Display banner
 */
export function showBanner() {
  const banner = (figlet as unknown as Record<string, unknown>).textSync("LLM Proxy", {
    font: "ANSI Shadow",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  logger.info("\n" + gradient.pastel.multiline(banner));
  logger.info(gradient.cristal("  🚀 OAuth CLI for AI Providers\n"));
}

/**
 * Display simple banner (no animation)
 */
export function showSimpleBanner() {
  const banner = (figlet as unknown as Record<string, unknown>).textSync("EP CLI", {
    font: "Standard",
    horizontalLayout: "default",
  });
  logger.info(gradient.pastel.multiline(banner));
  logger.info(gradient.cristal("  OAuth CLI for AI Providers\n"));
}

/**
 * Display success animation
 */
export async function showSuccess(message: string) {
  return new Promise<void>((resolve) => {
    const animation = chalkAnimation.rainbow(`\n✨ ${message}\n`);
    setTimeout(() => {
      animation.stop();
      resolve();
    }, 1000);
  });
}

/**
 * Display loading animation
 */
export function showLoading(text: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);

  return {
    stop: () => {
      clearInterval(interval);
      process.stdout.write("\r");
    },
  };
}
