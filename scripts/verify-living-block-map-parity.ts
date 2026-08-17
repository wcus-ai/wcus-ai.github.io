#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseParityArgs,
  runLivingBlockMapParity,
  type ParityOptions,
  type ParityReport,
} from './lib/living-block-map-parity.ts';

interface CliDependencies {
  readonly run?: (options: ParityOptions) => Promise<ParityReport>;
  readonly stdout?: (message: string) => void;
  readonly stderr?: (message: string) => void;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: CliDependencies = {},
): Promise<number> {
  const run = dependencies.run ?? runLivingBlockMapParity;
  const stdout = dependencies.stdout ?? console.log;
  const stderr = dependencies.stderr ?? console.error;
  let options: ParityOptions;
  try {
    options = parseParityArgs(argv);
  } catch (error) {
    stderr(errorMessage(error));
    return 2;
  }
  try {
    const report = await run(options);
    for (const result of report.results) {
      const ratio = `${(result.diffRatio * 100).toFixed(4)}%`;
      stdout(
        result.error
          ? `${result.id} ERROR — ${result.error}`
          : `${result.id} ${result.status.toUpperCase()} — ${ratio} (${result.diffPixels} px)`,
      );
    }
    stdout(`Parity report written to ${report.outputDirectory}`);
    return report.results.every(({ status }) => status === 'pass') ? 0 : 1;
  } catch (error) {
    stderr(errorMessage(error));
    return 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === entryUrl) process.exitCode = await main();
