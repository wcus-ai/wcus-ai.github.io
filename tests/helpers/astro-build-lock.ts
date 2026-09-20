/* oxlint-disable no-await-in-loop -- lock acquisition and stale-lock cleanup are serial by design */
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const lockPath = join(tmpdir(), 'wcus-ai-github-io-astro-build.lock');
const staleAfterMs = 5 * 60_000;
const waitTimeoutMs = 2 * 60_000;

export async function withAstroBuildLock<T>(build: () => T | Promise<T>): Promise<T> {
  const deadline = Date.now() + waitTimeoutMs;

  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      const lockStat = await stat(lockPath).catch(() => null);
      if (lockStat && Date.now() - lockStat.mtimeMs > staleAfterMs) {
        await rm(lockPath, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for Astro build lock: ${lockPath}`, { cause: error });
      }
      await delay(100);
    }
  }

  try {
    return await build();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}
