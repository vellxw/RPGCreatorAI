/**
 * Phase 12 M03 — Command Router Host Hook (PX-056 / PX-081 / PX-082).
 *
 * Pure presentational helper that owns a `CommandRouterResult` state for a
 * host component. The hook never calls providers, never mutates project
 * data, and never performs programmatic navigation. The host owns every
 * effect that happens after the host invokes an `onAction` callback.
 *
 * The hook mirrors the latest result into a ref so that callers (and
 * synchronous test code) can observe the updated state without waiting for
 * a re-render. The `state` field returned by the hook reflects the
 * post-render value when the component re-renders.
 */

import { useCallback, useRef, useState } from 'react';
import { routeCreatorRequest, type CommandRouterInput, type CommandRouterResult } from './router';

export interface UseRouteCreatorRequestState {
  result: CommandRouterResult | null;
  lastInput: CommandRouterInput | null;
}

export interface UseRouteCreatorRequest {
  state: UseRouteCreatorRequestState;
  route: (input: CommandRouterInput) => CommandRouterResult;
  clear: () => void;
}

const INITIAL_STATE: UseRouteCreatorRequestState = {
  result: null,
  lastInput: null,
};

export function useRouteCreatorRequest(): UseRouteCreatorRequest {
  const [state, setState] = useState<UseRouteCreatorRequestState>(INITIAL_STATE);
  const stateRef = useRef<UseRouteCreatorRequestState>(INITIAL_STATE);

  const route = useCallback((input: CommandRouterInput): CommandRouterResult => {
    const result = routeCreatorRequest(input);
    const next: UseRouteCreatorRequestState = { result, lastInput: input };
    stateRef.current = next;
    setState(next);
    return result;
  }, []);

  const clear = useCallback(() => {
    stateRef.current = INITIAL_STATE;
    setState(INITIAL_STATE);
  }, []);

  return { state: stateRef.current, route, clear };
}
