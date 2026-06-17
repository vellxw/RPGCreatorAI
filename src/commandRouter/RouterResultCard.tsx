/**
 * Phase 12 M03 — Command Router Result Card (PX-056 / PX-081 / PX-082).
 *
 * Dispatcher presentational component that decides which sub-card to render
 * for a `CommandRouterResult`. The host owns every callback; this component
 * stays inert and never mutates the project, calls providers, or navigates.
 */

import type { ReactNode } from 'react';
import type { CommandRouterResult } from './router';
import { ClarificationCard } from './ClarificationCard';
import { IntentPreviewCard } from './IntentPreviewCard';
import type { CommandRouterIntent } from './intentContract';

export interface RouterResultCardProps {
  result: CommandRouterResult;
  onSelectClarification?: (optionId: string, pipeline: string) => void;
  onAcceptIntent?: (intent: CommandRouterIntent) => void;
  onRejectIntent?: (intent: CommandRouterIntent) => void;
  'data-testid'?: string;
}

export function RouterResultCard({
  result,
  onSelectClarification,
  onAcceptIntent,
  onRejectIntent,
  'data-testid': testId = 'command-router-result',
}: RouterResultCardProps): ReactNode {
  if (result.kind === 'clarification') {
    return (
      <div data-testid={testId} data-state="clarification" data-kind="clarification">
        <ClarificationCard
          clarification={result.clarification}
          onSelect={onSelectClarification}
        />
      </div>
    );
  }
  return (
    <div
      data-testid={testId}
      data-state={result.intent.capability}
      data-kind="intent"
      data-pipeline={result.intent.pipeline}
    >
      <IntentPreviewCard
        intent={result.intent}
        onAccept={onAcceptIntent}
        onReject={onRejectIntent}
      />
    </div>
  );
}
