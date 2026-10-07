// Spec types for the parametric chibi character system.

export type HairStyle =
  | 'spiky' | 'tousled' | 'swept' | 'wavy' | 'twintails' | 'mane' | 'upswept'
  | 'long' | 'longWavy' | 'wild' | 'medium' | 'messy' | 'fringe' | 'sidepart'
  | 'pompadour' | 'bob' | 'slicked' | 'ponytail' | 'bald' | 'flame' | 'none';

export type EyeStyle =
  | 'round' | 'sharp' | 'fierce' | 'narrow' | 'closed' | 'tired' | 'cute' | 'cold'
  | 'glow' | 'crazy' | 'gentle' | 'beast';

export type BrowStyle = 'normal' | 'angry' | 'raised' | 'worried' | 'flat' | 'none' | 'thick';

export type MouthStyle =
  | 'smile' | 'grin' | 'fang' | 'smirk' | 'flat' | 'open' | 'wide' | 'happy'
  | 'frown' | 'pout' | 'lips' | 'cat' | 'gentle' | 'snarl' | 'none';

export type FaceExtra =
  | 'stubble' | 'scar' | 'scarCheek' | 'mask' | 'boneMask' | 'eyepatch' | 'nosebleed'
  | 'glasses' | 'sunglasses' | 'darkCircles' | 'curseMarks' | 'tattoo' | 'shadow'
  | 'scarf' | 'clothMask' | 'freckles' | 'eyeliner' | 'cigarette' | 'pale';

export type HeadAcc =
  | 'headband' | 'crown' | 'horns' | 'bigHorns' | 'witchHat' | 'flower' | 'goggles'
  | 'bandana' | 'helmet' | 'crystalHelm' | 'visorHelm' | 'hood' | 'hairTie' | 'tiara'
  | 'sideClip';

export type Squad =
  | 'bulls' | 'dawn' | 'lions' | 'eagles' | 'rose' | 'king' | 'sun' | 'spade'
  | 'diamond' | 'bandit' | 'dark' | 'none';

export type CapeStyle = 'short' | 'captain' | 'hood' | 'hoodUp' | 'none';

export type OutfitStyle = 'shirt' | 'sleeveless' | 'dress' | 'robe' | 'armor' | 'coat' | 'tank' | 'bare';

export type Build = 'normal' | 'muscular' | 'big' | 'slim' | 'girl' | 'tiny';

export type Weapon =
  | 'greatsword' | 'katana' | 'lightsword' | 'club' | 'spoon' | 'mirror' | 'staff'
  | 'spear' | 'crystalSword' | 'dagger' | 'none';

export type Fx =
  | 'water' | 'fireFists' | 'fire' | 'mercury' | 'roses' | 'gravity' | 'blood' | 'portal'
  | 'lightning' | 'thread' | 'blocks' | 'cube' | 'flowers' | 'poison' | 'steel' | 'rock'
  | 'gel' | 'bones' | 'soulHalo' | 'clock' | 'sprout' | 'wind' | 'light' | 'fireball'
  | 'salamander' | 'bell' | 'sheep' | 'curse' | 'portals' | 'crystals' | 'darkOrb'
  | 'claws' | 'antiMagic' | 'boneWing' | 'devilWings' | 'gravityAura';

export interface Spec {
  /** Overall scale about the feet (1 = default height). */
  scale?: number;
  skin: string;
  hair: {
    style: HairStyle; color: string; shade?: string; streak?: string; tips?: string;
    /** bang variant override: zig | blunt | side | parted | center | spikyShort | hairline | slick | fringe | pomp | wavy */
    bangs?: string;
  };
  eyes: { color: string; style?: EyeStyle; lashes?: boolean };
  brows?: BrowStyle;
  mouth?: MouthStyle;
  blush?: boolean;
  face?: FaceExtra[];
  ears?: 'normal' | 'elf' | 'none';
  /** 'square' gives a wider adult jaw (brutes, older men). */
  faceShape?: 'round' | 'square';
  /** Scale of the whole head about the neck (smaller head = bigger-looking body). */
  headScale?: number;
  build?: Build;
  outfit: {
    style: OutfitStyle;
    top: string;
    bottom?: string;
    boots?: string;
    accent?: string;
    /** sleeve colour; 'skin' for bare arms */
    sleeves?: string;
    belt?: string;
  };
  cape?: { squad: Squad; style?: CapeStyle; collar?: boolean };
  head?: HeadAcc[];
  weapon?: Weapon;
  grimoire?: { cover: string; leaves?: 3 | 4 | 5; clover?: string; side?: 'L' | 'R' } | false;
  fx?: Fx[];
  /** Signature colour (aura / UI accents). */
  aura: string;
  /** Hand positions override [x, y]. l = viewer's left, r = viewer's right. */
  pose?: { l?: [number, number]; r?: [number, number] };
  /** Portrait crop override [x, y, w, h] in the 100x120 box. */
  portrait?: [number, number, number, number];
}
