import chalk from 'chalk';
import fs from 'node:fs/promises';
import { globStream } from 'glob';
import path from 'node:path';
import { program } from 'commander';

import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import {
  applyReplacements,
  computeReplacementOffsets,
  execProgram,
  normalizeToPosixPath,
  ProcessExitError,
  type Replacement,
} from './util';

const mdx = unified().use(remarkParse).use(remarkMdx);

interface Options {
  input: string;
}

export async function main() {
  const packageJson = JSON.parse(
    await fs.readFile(path.resolve(path.join(__dirname, '..', 'package.json')), 'utf-8'),
  );

  let exitCode = 0;
  program
    .name(packageJson.name)
    .version(packageJson.version)
    .requiredOption('-i, --input <pattern>', 'input pattern')
    .argument('<program...>', 'program to run')
    .showHelpAfterError()
    .parse();

  const options: Options = program.opts();

  iterPaths: for await (const matchPath of globStream(options.input)) {
    const startedAt = Date.now();
    const msDiff = () => chalk.gray(`${Date.now() - startedAt}ms`);
    const fileNameToDisplay = normalizeToPosixPath(path.relative(process.cwd(), matchPath));

    const contents = await fs.readFile(matchPath, 'utf-8');
    const ast = mdx.parse(contents);
    const replacements: Replacement[] = [];

    for (const node of ast.children) {
      if (node.type === 'code') {
        const [start, end] = computeReplacementOffsets(contents, node.position);

        const codeString = node.value;
        try {
          const output = await execProgram(program.args.shift()!, program.args, codeString);

          replacements.push({
            start,
            end,
            value: output,
          });
        } catch (error) {
          if (error instanceof ProcessExitError) {
            console.error(
              `${chalk.red(chalk.bold(fileNameToDisplay))} (exit code: ${error.code}) ${msDiff()}`,
            );

            console.group();
            console.error(error.stderr);
            console.groupEnd();
          } else {
            console.error(
              `${chalk.red(chalk.bold(fileNameToDisplay))} unknown error ${msDiff()}\n`,
            );
          }
          exitCode = 1;
          continue iterPaths;
        }
      }
    }

    const newContents = applyReplacements(contents, replacements);
    const didChange = newContents !== contents;
    if (didChange) {
      await fs.writeFile(matchPath, newContents, 'utf-8');
    }

    console.log(`${chalk.grey(fileNameToDisplay)} ${msDiff()}${didChange ? '' : ' (unchanged)'}`);
  }

  process.exit(exitCode);
}

if (require.main === module) {
  main();
}
