import chalk from "chalk";
import ora from "ora";
import { logger } from "@/shared/utils/logger";

/**
 * UI Helper Functions
 */

export function success(message) {
  logger.info(chalk.green(`\n✓ ${message}\n`));
}

export function error(message) {
  logger.info(chalk.red(`\n✗ ${message}\n`));
}

export function info(message) {
  logger.info(chalk.blue(`\n${message}\n`));
}

export function warn(message) {
  logger.info(chalk.yellow(`\n⚠ ${message}\n`));
}

export function gray(message) {
  logger.info(chalk.gray(message));
}

export function spinner(text) {
  return ora(text);
}

export function printSection(title) {
  logger.info(chalk.blue(`\n${title}\n`));
}

export function printKeyValue(key, value, isSuccess = false) {
  const color = isSuccess ? chalk.green : chalk.gray;
  logger.info(color(`  ${key}: ${value}`));
}

export function printList(items, isSuccess = false) {
  const symbol = isSuccess ? "✓" : "✗";
  const color = isSuccess ? chalk.green : chalk.gray;
  items.forEach((item) => {
    logger.info(color(`  ${symbol} ${item}`));
  });
}
