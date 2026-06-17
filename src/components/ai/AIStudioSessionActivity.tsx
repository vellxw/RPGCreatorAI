import { type ReactNode } from 'react';

export type AIStudioActivityKind =
  | 'accept'
  | 'reject'
  | 'archive'
  | 'cancel'
  | 'reset'
  | 'clarify'
  | 'route'
  | 'clarify-pick'
  | 'apply';

export interface AIStudioActivityEntry {
  id: string;
  kind: AIStudioActivityKind;
  message: string;
  at: string;
}

export interface AIStudioSessionActivityProps {
  entries: readonly AIStudioActivityEntry[];
  'data-testid'?: string;
}

const KIND_LABEL: Record<AIStudioActivityKind, string> = {
  accept: 'Accepted',
  reject: 'Rejected',
  archive: 'Archived',
  cancel: 'Canceled',
  reset: 'Reset',
  clarify: 'Asked for clarification',
  route: 'Routed',
  'clarify-pick': 'Picked an option',
  apply: 'Recorded accept',
};

export function AIStudioSessionActivity({
  entries,
  'data-testid': testId = 'ai-studio-session-activity',
}: AIStudioSessionActivityProps): ReactNode {
  if (entries.length === 0) {
    return (
      <div
        data-testid={testId}
        data-state="empty"
        className="rounded-md border border-gray-200 bg-white p-3 text-[12px] text-gray-600"
      >
        <p className="font-medium text-gray-700">No activity yet</p>
        <p className="mt-1 leading-5">
          Accepting, rejecting, archiving, or canceling a draft will be listed here for the current project.
        </p>
      </div>
    );
  }
  return (
    <ul
      data-testid={testId}
      data-state="populated"
      className="flex flex-col gap-2"
    >
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-activity-id={entry.id}
          data-activity-kind={entry.kind}
          className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
        >
          <div>
            <p className="text-[12px] font-semibold text-gray-700">{KIND_LABEL[entry.kind]}</p>
            <p className="text-[12px] text-gray-600">{entry.message}</p>
          </div>
          <time className="text-[11px] text-gray-500" dateTime={entry.at}>
            {entry.at}
          </time>
        </li>
      ))}
    </ul>
  );
}
