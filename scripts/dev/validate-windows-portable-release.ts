import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { validateWindowsPortableRelease } from '../../src/export/windowsPortableRelease';

interface CliOptions {
  manifest: string;
  nativeData: string;
  gameBundle: string;
  provenance: string;
  compilerWarnings: string;
  report: string;
}

function parseOptions(argv: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('Expected --name value argument pairs.');
    }
    values.set(key.slice(2), value);
  }
  const required = ['manifest', 'native-data', 'game-bundle', 'provenance', 'compiler-warnings', 'report'] as const;
  for (const key of required) {
    if (!values.get(key)) throw new Error(`Missing required --${key} argument.`);
  }
  return {
    manifest: values.get('manifest')!,
    nativeData: values.get('native-data')!,
    gameBundle: values.get('game-bundle')!,
    provenance: values.get('provenance')!,
    compilerWarnings: values.get('compiler-warnings')!,
    report: values.get('report')!,
  };
}

function readJson(path: string, maxBytes: number, label: string): unknown {
  const sizeBytes = statSync(path).size;
  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    throw new Error(`${label} must contain between 1 and ${maxBytes} bytes.`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

try {
  const options = parseOptions(process.argv.slice(2));
  const compilerEvidence = readJson(options.compilerWarnings, 4 * 1024 * 1024, 'Compiler warnings');
  const compilerWarnings = Array.isArray(compilerEvidence)
    ? compilerEvidence
    : compilerEvidence !== null
      && typeof compilerEvidence === 'object'
      && Array.isArray((compilerEvidence as { warnings?: unknown }).warnings)
      ? (compilerEvidence as { warnings: unknown[] }).warnings
      : compilerEvidence;

  const result = validateWindowsPortableRelease({
    manifest: readJson(options.manifest, 16 * 1024 * 1024, 'Release manifest'),
    nativeData: readJson(options.nativeData, 576 * 1024 * 1024, 'Native data validation input'),
    gameBundle: readJson(options.gameBundle, 64 * 1024 * 1024, 'GameBundle'),
    provenance: readJson(options.provenance, 16 * 1024 * 1024, 'Provenance'),
    compilerWarnings,
  });
  writeFileSync(options.report, `${JSON.stringify({ schemaVersion: 1, target: 'windows-portable', ...result }, null, 2)}\n`, 'utf8');

  if (!result.ok) {
    for (const issue of result.errors) {
      console.error(`[${issue.checkId}] ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`WINDOWS PORTABLE CONTRACT PASSED (${result.warnings.length} warnings)`);
  }
} catch (error) {
  console.error(`WINDOWS PORTABLE CONTRACT FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
