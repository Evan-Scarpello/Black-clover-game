// How each battle status is shown (icon on the unit, floating text when applied).
import type { StatusId } from '../game/types';

export const STATUS_ICON: Record<StatusId, string> = {
  stun: '💫',
  silence: '🤐',
  burn: '🔥',
  poison: '☠️',
  bleed: '🩸',
  regen: '💚',
  atkUp: '⚔️',
  atkDown: '🔻',
  defUp: '🛡️',
  defDown: '💔',
  spdUp: '💨',
  spdDown: '🐌',
  taunt: '😤',
  mark: '🎯',
  reflect: '🪞',
  fate: '🧵',
  shroud: '🌑',
};

export const STATUS_TEXT: Partial<Record<StatusId, string>> = {
  stun: 'STUN!',
  silence: 'SILENCE',
  burn: 'BURN',
  poison: 'POISON',
  bleed: 'BLEED',
  taunt: 'TAUNT!',
  mark: 'MARKED',
  atkDown: 'ATK↓',
  defDown: 'DEF↓',
  spdDown: 'SPD↓',
  fate: 'FATE',
  shroud: 'SHROUDED',
};
