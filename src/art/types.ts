// Spec types for the parametric chibi character system.

export type HairStyle =
  | 'spiky' | 'tousled' | 'swept' | 'wavy' | 'twintails' | 'mane' | 'upswept'
  | 'long' | 'longWavy' | 'wild' | 'medium' | 'messy' | 'fringe' | 'sidepart'
  | 'pompadour' | 'bob' | 'slicked' | 'ponytail' | 'bald' | 'flame' | 'none'
  | 'sweptLong' | 'bobSleek' | 'curlyBun';

export type EyeStyle =
  | 'round' | 'sharp' | 'fierce' | 'narrow' | 'closed' | 'tired' | 'cute' | 'cold'
  | 'glow' | 'crazy' | 'gentle' | 'beast' | 'demon';

export type BrowStyle = 'normal' | 'angry' | 'raised' | 'worried' | 'flat' | 'none' | 'thick';

export type MouthStyle =
  | 'smile' | 'grin' | 'fang' | 'smirk' | 'flat' | 'open' | 'wide' | 'happy'
  | 'frown' | 'pout' | 'lips' | 'cat' | 'gentle' | 'snarl' | 'none';

export type FaceExtra =
  | 'stubble' | 'scar' | 'scarCheek' | 'mask' | 'boneMask' | 'eyepatch' | 'nosebleed'
  | 'glasses' | 'sunglasses' | 'darkCircles' | 'curseMarks' | 'tattoo' | 'shadow'
  | 'scarf' | 'clothMask' | 'freckles' | 'eyeliner' | 'cigarette' | 'pale'
  | 'blackMarks' | 'facePaint' | 'spectacles' | 'mustache' | 'aged';

export type HeadAcc =
  | 'headband' | 'crown' | 'horns' | 'bigHorns' | 'witchHat' | 'flower' | 'goggles'
  | 'bandana' | 'helmet' | 'crystalHelm' | 'visorHelm' | 'hood' | 'hairTie' | 'tiara'
  | 'sideClip' | 'circlet' | 'devilHorns' | 'ramHorns' | 'hornNubs';

export type Squad =
  | 'bulls' | 'dawn' | 'lions' | 'eagles' | 'rose' | 'king' | 'sun' | 'spade'
  | 'diamond' | 'bandit' | 'dark' | 'none'
  | 'royal' | 'devil' | 'mantis' | 'peacock' | 'deer' | 'judge';

export type CapeStyle = 'short' | 'captain' | 'hood' | 'hoodUp' | 'none';

export type OutfitStyle = 'shirt' | 'sleeveless' | 'dress' | 'robe' | 'armor' | 'coat' | 'tank' | 'bare';

export type Build = 'normal' | 'muscular' | 'big' | 'slim' | 'girl' | 'tiny';

export type Weapon =
  | 'greatsword' | 'katana' | 'lightsword' | 'club' | 'spoon' | 'mirror' | 'staff'
  | 'spear' | 'crystalSword' | 'dagger' | 'paintbrush' | 'gavel' | 'none';

export type Fx =
  | 'water' | 'fireFists' | 'fire' | 'mercury' | 'roses' | 'gravity' | 'blood' | 'portal'
  | 'lightning' | 'thread' | 'blocks' | 'cube' | 'flowers' | 'poison' | 'steel' | 'rock'
  | 'gel' | 'bones' | 'soulHalo' | 'clock' | 'sprout' | 'wind' | 'light' | 'fireball'
  | 'salamander' | 'bell' | 'sheep' | 'curse' | 'portals' | 'crystals' | 'darkOrb'
  | 'claws' | 'antiMagic' | 'boneWing' | 'devilWings' | 'gravityAura'
  // premium (UR) auras and the 2nd expansion
  | 'urAura' | 'shadowAura' | 'gimodelo' | 'radiance' | 'antiAura' | 'armScarf' | 'glyphs'
  | 'nero' | 'seal' | 'armBlades' | 'dreamBubbles' | 'zzz' | 'paint' | 'lightSwords';

export interface Spec {
  /** Overall scale about the feet (1 = default height). */
  scale?: number;
  skin: string;
  hair: {
    style: HairStyle; color: string; shade?: string; streak?: string; tips?: string;
    /** two-tone: colour of the bangs/fringe */
    fringe?: string;
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
    /** extra gold filigree / buttons for premium (UR) outfits */
    ornate?: boolean;
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
