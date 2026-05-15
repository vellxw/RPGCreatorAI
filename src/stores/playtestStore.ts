import { useState, useCallback } from 'react';
import type { PlaytestState, LogEntry } from '../types/project';

const initialPlaytestState: PlaytestState = {
  running: true,
  currentMap: 'town',
  playerX: 4,
  playerY: 4,
  direction: 'down',
  flags: {
    chest_001_opened: false,
    talked_to_old_man: false,
  },
  inventory: [
    { itemId: 'potion', name: 'Potion', amount: 1 },
  ],
  activeEvent: 'OldMan_NPC / showText',
};

const initialLogs: LogEntry[] = [
  { timestamp: '10:24:31', level: 'INFO', message: 'Project loaded: Demo RPG' },
  { timestamp: '10:24:31', level: 'INFO', message: 'Map loaded: town' },
  { timestamp: '10:24:32', level: 'INFO', message: 'Dialogue [Anciano]: No cruces el puente de noche.' },
];

export function usePlaytestStore() {
  const [state, setState] = useState<PlaytestState>(initialPlaytestState);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs(prev => [...prev, { timestamp, level, message }]);
  }, []);

  const movePlayer = useCallback((dx: number, dy: number) => {
    setState(prev => {
      const newX = Math.max(0, Math.min(9, prev.playerX + dx));
      const newY = Math.max(0, Math.min(9, prev.playerY + dy));
      const direction = dx > 0 ? 'right' as const : dx < 0 ? 'left' as const : dy > 0 ? 'down' as const : 'up' as const;
      return { ...prev, playerX: newX, playerY: newY, direction };
    });
    addLog('INFO', `Player moved to (${state.playerX + dx}, ${state.playerY + dy})`);
  }, [state.playerX, state.playerY, addLog]);

  const restart = useCallback(() => {
    setState(initialPlaytestState);
    setLogs([]);
    addLog('INFO', 'Playtest restarted');
  }, [addLog]);

  const stop = useCallback(() => {
    setState(prev => ({ ...prev, running: false }));
    addLog('INFO', 'Playtest stopped');
  }, [addLog]);

  return { state, logs, addLog, movePlayer, restart, stop };
}
