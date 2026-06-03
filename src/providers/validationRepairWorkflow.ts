import type { ProviderAdapter } from './providerAdapter';
import type { ValidationMessage } from '../types/project';

export interface RepairSuggestion {
  errorMessage: string;
  suggestion: string;
  actionType: 'manual' | 'reference-repair' | 'data-fix';
  confidence: 'high' | 'medium' | 'low';
  details?: string;
}

export interface ValidationRepairCandidate {
  reviewState: 'pending' | 'approved';
  suggestions: RepairSuggestion[];
  summary: string;
  provenance: {
    providerId: string;
    modelId: string;
    responseFormat: string;
    requestId: string;
    reviewedAt?: string;
  };
}

export function buildValidationRepairRequest(
  errors: ValidationMessage[],
  warnings: ValidationMessage[],
  metadata: { requestId: string; createdAt: string }
) {
  return {
    request: {
      id: metadata.requestId,
      operation: 'text.generate' as const,
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: metadata.createdAt,
      prompt: `Analyze ${errors.length} validation errors and ${warnings.length} warnings and suggest repairs.`,
      input: {
        responseFormat: 'rpgcreatorai.validationRepair.v1',
        fixture: 'validation-repair',
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    },
  };
}

export async function generateValidationRepairCandidate(
  adapter: ProviderAdapter,
  errors: ValidationMessage[],
  warnings: ValidationMessage[],
  metadata: { requestId: string; createdAt: string }
): Promise<ValidationRepairCandidate> {
  const built = buildValidationRepairRequest(errors, warnings, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Validation repair generation failed');
  }

  const allMessages = [...errors, ...warnings];
  const suggestions: RepairSuggestion[] = allMessages.slice(0, 20).map(msg => {
    const isError = msg.level === 'error';
    return buildSuggestionForMessage(msg, isError);
  });

  return {
    reviewState: 'pending' as const,
    suggestions,
    summary: `Generated ${suggestions.length} repair suggestion${suggestions.length === 1 ? '' : 's'} for ${errors.length} error${errors.length === 1 ? '' : 's'} and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`,
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.validationRepair.v1',
      requestId: metadata.requestId,
    },
  };
}

function buildSuggestionForMessage(
  msg: ValidationMessage,
  isError: boolean
): RepairSuggestion {
  const message = msg.message;

  // Empty/required field errors — check first so "missing required" → data-fix
  if (message.includes('required') || message.includes('empty') || message.includes('blank')) {
    return {
      errorMessage: message,
      suggestion: 'Open the relevant editor and provide a valid value for the required field.',
      actionType: 'data-fix',
      confidence: 'high',
      details: msg.source ?? undefined,
    };
  }

  // Stat/value range errors
  if (message.includes('must be') && (message.includes('non-negative') || message.includes('positive') || message.includes('number'))) {
    return {
      errorMessage: message,
      suggestion: 'Open the database editor for this record and correct the value to be within the valid range.',
      actionType: 'data-fix',
      confidence: 'high',
      details: msg.source ?? undefined,
    };
  }

  // Reference-related errors — "does not exist" or "broken reference"
  if (message.includes('does not exist') || message.includes('broken') || message.includes('unknown')) {
    return {
      errorMessage: message,
      suggestion: 'Use the Reference Repair tool in the Validation tab to replace the broken reference with an existing record, or remove the reference from the source.',
      actionType: 'reference-repair',
      confidence: 'high',
      details: msg.source ?? undefined,
    };
  }

  // Duplicate errors
  if (message.includes('duplicate')) {
    return {
      errorMessage: message,
      suggestion: 'Remove or rename the duplicate entry to ensure each record has a unique identifier.',
      actionType: 'manual',
      confidence: 'medium',
      details: msg.source ?? undefined,
    };
  }

  // Default suggestion
  return {
    errorMessage: message,
    suggestion: isError
      ? 'Review and fix this validation error in the relevant editor before saving or playtesting.'
      : 'Review this warning to improve project quality. Warnings do not block save.',
    actionType: 'manual',
    confidence: 'low',
    details: msg.source ?? undefined,
  };
}

export function validateRepairCandidate(
  candidate: any
): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  if (!candidate.suggestions) {
    errors.push('Suggestions are required');
    return errors;
  }
  if (!Array.isArray(candidate.suggestions)) {
    errors.push('Suggestions must be an array');
    return errors;
  }
  for (let i = 0; i < candidate.suggestions.length; i++) {
    const s = candidate.suggestions[i];
    if (!s || typeof s !== 'object') {
      errors.push(`Suggestion ${i} must be an object`);
      continue;
    }
    if (typeof s.errorMessage !== 'string' || !s.errorMessage.trim()) {
      errors.push(`Suggestion ${i}: errorMessage is required`);
    }
    if (typeof s.suggestion !== 'string' || !s.suggestion.trim()) {
      errors.push(`Suggestion ${i}: suggestion text is required`);
    }
    const validActionTypes = ['manual', 'reference-repair', 'data-fix'];
    if (!validActionTypes.includes(s.actionType)) {
      errors.push(`Suggestion ${i}: actionType must be one of ${validActionTypes.join(', ')}`);
    }
    const validConfidences = ['high', 'medium', 'low'];
    if (!validConfidences.includes(s.confidence)) {
      errors.push(`Suggestion ${i}: confidence must be one of ${validConfidences.join(', ')}`);
    }
  }
  return errors;
}

export function approveRepairCandidate(
  candidate: ValidationRepairCandidate,
  approvalMetadata: { reviewedAt: string }
): ValidationRepairCandidate {
  const errors = validateRepairCandidate(candidate);
  if (errors.length > 0) {
    throw new Error('Invalid validation repair candidate');
  }
  return {
    ...candidate,
    reviewState: 'approved' as const,
    provenance: {
      ...candidate.provenance,
      reviewedAt: approvalMetadata.reviewedAt,
    },
  };
}
