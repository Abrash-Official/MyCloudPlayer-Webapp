import type { RepeatModeSetting } from '../types';

export const cycleRepeatMode = (
  mode: RepeatModeSetting
): RepeatModeSetting =>
  mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off';

export const repeatModeIcon = (mode: RepeatModeSetting): string => {
  switch (mode) {
    case 'one':
    case 'all':
      return 'repeat';
    default:
      return 'repeat';
  }
};
