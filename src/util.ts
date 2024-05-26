import path from 'node:path';
import type { Position } from 'unist';
import { spawn } from 'node:child_process';

export interface Replacement {
  start: number;
  end: number;
  value: string;
}

export function applyReplacements(input: string, replacements: Replacement[]): string {
  let output = input;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const replacement = replacements[i];
    const before = output.slice(0, replacement.start);
    const after = output.slice(replacement.end);
    output = before + replacement.value + after;
  }
  return output;
}

export function computeReplacementOffsets(
  mdString: string,
  nodePosition: Position | undefined,
): [number, number] {
  if (
    !nodePosition ||
    typeof nodePosition.start.offset !== 'number' ||
    typeof nodePosition.end.offset !== 'number'
  ) {
    throw new Error('internal error: nodePosition is undefined');
  }

  const codeBlockString = mdString.slice(nodePosition.start.offset, nodePosition.end.offset);

  const firstNewLineIndex = codeBlockString.indexOf('\n') + 1;
  const finalNewLineIndex = codeBlockString.lastIndexOf('\n');
  const start = nodePosition.start.offset + firstNewLineIndex;
  const end = nodePosition.end.offset - (codeBlockString.length - finalNewLineIndex);

  return [start, end];
}

export class ProcessExitError extends Error {
  constructor(
    public code: number | null,
    public stderr: string,
  ) {
    super(`process exited with code ${code ?? '<unknown>'}`);
  }
}

export function execProgram(program: string, args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const result = spawn(program, args, {
      stdio: 'pipe',
      shell: true,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    result.stderr.on('data', (chunk) => {
      const chunkString = chunk.toString('utf-8');
      stderr += chunkString;
    });
    result.stdout.on('data', (chunk) => {
      const chunkString = chunk.toString('utf-8');
      stdout += chunkString;
    });

    result.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new ProcessExitError(code, stderr));
      }
    });
    result.stdin.write(input);
    result.stdin.end();
  });
}

// From https://github.com/prettier/prettier/blob/c2e20fbae8ce1800ac0c8242c176d9379db5c001/src/cli/utils.js#L105
export const normalizeToPosixPath =
  path.sep === '\\'
    ? (filepath: string) => filepath.replaceAll('\\', '/')
    : (filepath: string) => filepath;
