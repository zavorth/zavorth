import { runtimeShellScriptPart1 } from './web-console-runtime-shell-script/part1.js';
import { runtimeShellScriptPart2 } from './web-console-runtime-shell-script/part2.js';
import { runtimeShellScriptPart3 } from './web-console-runtime-shell-script/part3.js';
import { runtimeShellScriptPart4 } from './web-console-runtime-shell-script/part4.js';
import { runtimeShellScriptPart5 } from './web-console-runtime-shell-script/part5.js';
import { runtimeShellScriptPart6 } from './web-console-runtime-shell-script/part6.js';
import { runtimeShellScriptPart7 } from './web-console-runtime-shell-script/part7.js';
import { runtimeShellScriptPart8 } from './web-console-runtime-shell-script/part8.js';

export function buildRuntimeShellScript(): string {
  return [
    runtimeShellScriptPart1,
    runtimeShellScriptPart2,
    runtimeShellScriptPart3,
    runtimeShellScriptPart4,
    runtimeShellScriptPart5,
    runtimeShellScriptPart6,
    runtimeShellScriptPart7,
    runtimeShellScriptPart8,
  ].join('\n');
}
