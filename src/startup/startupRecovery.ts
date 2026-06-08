export interface StartupRecoveryState {
  title: string;
  detail: string;
  options: string[];
}

const DEFAULT_OPTIONS = [
  'Open Project Folder',
  'Create Project',
  'Import Project Bundle',
  'Use bundled sample',
];

function normalizeError(error?: string): string {
  return (error ?? '').trim();
}

function isMissingProjectData(error: string): boolean {
  const normalized = error.toLowerCase();
  return (
    normalized.includes('data/project.json') ||
    normalized.includes('does not contain') ||
    normalized.includes('missing project')
  );
}

function isInvalidProjectData(error: string): boolean {
  const normalized = error.toLowerCase();
  return (
    normalized.includes('unexpected token') ||
    normalized.includes('invalid json') ||
    normalized.includes('schema') ||
    normalized.includes('parse')
  );
}

function isPermissionError(error: string): boolean {
  const normalized = error.toLowerCase();
  return (
    normalized.includes('permission') ||
    normalized.includes('access is denied') ||
    normalized.includes('eacces') ||
    normalized.includes('unauthorized')
  );
}

function recoveryDetail(error?: string): string {
  const detail = normalizeError(error);
  if (isMissingProjectData(detail)) {
    return 'This folder does not look like an RPGCreatorAI project. Choose a folder containing data/project.json, create a new local project, import a project bundle, or use the bundled sample.';
  }
  if (isInvalidProjectData(detail)) {
    return 'The project data could not be read as a valid RPGCreatorAI project. Open another project folder, create a new project, import a known-good bundle, or use the bundled sample.';
  }
  if (isPermissionError(detail)) {
    return 'RPGCreatorAI could not read that local folder. Check that the project is local and that you have permission, then open the project folder again or choose another startup option.';
  }
  if (detail) {
    const punctuated = detail.endsWith('.') ? detail : `${detail}.`;
    return `RPGCreatorAI could not finish this startup action: ${punctuated} Open another project folder, create a new project, import a bundle, or use the bundled sample.`;
  }
  return 'RPGCreatorAI could not finish this startup action. Open a project folder, create a new project, import a bundle, or use the bundled sample.';
}

export function projectStartupRecovery(
  label: 'Open' | 'Create' | 'Import',
  error?: string,
): StartupRecoveryState {
  return {
    title: `${label} project failed`,
    detail: recoveryDetail(error),
    options: DEFAULT_OPTIONS,
  };
}

export function recentProjectStartupRecovery(
  root: string | null,
  error?: string,
): StartupRecoveryState {
  const location = root ? ` at ${root}` : '';
  const base =
    `The recent project${location} could not be opened automatically. ` +
    'Choose another project folder, create a new local project, import a project bundle, or use the bundled sample.';
  const detail = isMissingProjectData(normalizeError(error))
    ? `${base} The saved folder does not contain data/project.json.`
    : base;
  return {
    title: 'Recent project could not be restored',
    detail,
    options: DEFAULT_OPTIONS,
  };
}
