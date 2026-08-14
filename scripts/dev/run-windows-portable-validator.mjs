import { resolve } from 'node:path';
import { build } from 'esbuild';

try {
  const entry = resolve(process.cwd(), 'scripts/dev/validate-windows-portable-release.ts');
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    logLevel: 'silent',
    sourcemap: false,
  });
  const code = result.outputFiles[0]?.text;
  if (!code) throw new Error('esbuild returned no validator output.');
  await import(`data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`);
} catch (error) {
  console.error(`WINDOWS PORTABLE VALIDATOR BOOTSTRAP FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
