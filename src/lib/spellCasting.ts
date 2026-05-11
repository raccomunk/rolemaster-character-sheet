import type { MagicalRealm, SpellListType } from "@/lib/types";

type PrepColumn = "instant" | "nonInstant0" | "prep1" | "prep2" | "prep34" | "prep56" | "prep78" | "prep9plus";

type PrepBandKey =
  | "9+"
  | "6-8"
  | "5"
  | "4"
  | "3"
  | "2"
  | "1"
  | "0"
  | "-1"
  | "-2"
  | "-3"
  | "-4"
  | "-5"
  | "-6--7"
  | "-8--10"
  | "-11--15"
  | "-16--20"
  | "<=-21";

const LEVEL_PREP_TABLE: Record<PrepBandKey, Record<PrepColumn, number>> = {
  "9+": { instant: 15, nonInstant0: 5, prep1: 10, prep2: 15, prep34: 20, prep56: 25, prep78: 30, prep9plus: 35 },
  "6-8": { instant: 10, nonInstant0: 0, prep1: 5, prep2: 10, prep34: 15, prep56: 20, prep78: 25, prep9plus: 30 },
  "5": { instant: 5, nonInstant0: -10, prep1: 0, prep2: 5, prep34: 10, prep56: 15, prep78: 20, prep9plus: 25 },
  "4": { instant: 5, nonInstant0: -20, prep1: 0, prep2: 5, prep34: 10, prep56: 15, prep78: 20, prep9plus: 25 },
  "3": { instant: 5, nonInstant0: -30, prep1: 0, prep2: 5, prep34: 10, prep56: 15, prep78: 20, prep9plus: 25 },
  "2": { instant: 0, nonInstant0: -35, prep1: -10, prep2: 0, prep34: 5, prep56: 10, prep78: 15, prep9plus: 20 },
  "1": { instant: 0, nonInstant0: -45, prep1: -20, prep2: 0, prep34: 5, prep56: 10, prep78: 15, prep9plus: 20 },
  "0": { instant: 0, nonInstant0: -55, prep1: -30, prep2: 0, prep34: 5, prep56: 10, prep78: 15, prep9plus: 20 },
  "-1": { instant: -30, nonInstant0: -85, prep1: -60, prep2: -30, prep34: -25, prep56: -20, prep78: -15, prep9plus: -10 },
  "-2": { instant: -35, nonInstant0: -90, prep1: -65, prep2: -35, prep34: -30, prep56: -25, prep78: -20, prep9plus: -15 },
  "-3": { instant: -40, nonInstant0: -95, prep1: -70, prep2: -40, prep34: -35, prep56: -30, prep78: -25, prep9plus: -20 },
  "-4": { instant: -45, nonInstant0: -100, prep1: -75, prep2: -45, prep34: -40, prep56: -35, prep78: -30, prep9plus: -25 },
  "-5": { instant: -50, nonInstant0: -105, prep1: -80, prep2: -50, prep34: -45, prep56: -40, prep78: -35, prep9plus: -30 },
  "-6--7": { instant: -70, nonInstant0: -125, prep1: -100, prep2: -70, prep34: -65, prep56: -60, prep78: -55, prep9plus: -50 },
  "-8--10": { instant: -95, nonInstant0: -150, prep1: -125, prep2: -95, prep34: -90, prep56: -85, prep78: -80, prep9plus: -75 },
  "-11--15": { instant: -120, nonInstant0: -175, prep1: -150, prep2: -120, prep34: -115, prep56: -110, prep78: -105, prep9plus: -100 },
  "-16--20": { instant: -170, nonInstant0: -225, prep1: -200, prep2: -170, prep34: -165, prep56: -160, prep78: -155, prep9plus: -150 },
  "<=-21": { instant: -220, nonInstant0: -275, prep1: -250, prep2: -220, prep34: -215, prep56: -210, prep78: -205, prep9plus: -200 },
};

function levelPrepBand(delta: number): PrepBandKey {
  if (delta >= 9) return "9+";
  if (delta >= 6) return "6-8";
  if (delta === 5) return "5";
  if (delta === 4) return "4";
  if (delta === 3) return "3";
  if (delta === 2) return "2";
  if (delta === 1) return "1";
  if (delta === 0) return "0";
  if (delta === -1) return "-1";
  if (delta === -2) return "-2";
  if (delta === -3) return "-3";
  if (delta === -4) return "-4";
  if (delta === -5) return "-5";
  if (delta >= -7) return "-6--7";
  if (delta >= -10) return "-8--10";
  if (delta >= -15) return "-11--15";
  if (delta >= -20) return "-16--20";
  return "<=-21";
}

function prepColumn(isInstantaneous: boolean, prepRounds: number): PrepColumn {
  if (isInstantaneous) return "instant";
  if (prepRounds <= 0) return "nonInstant0";
  if (prepRounds === 1) return "prep1";
  if (prepRounds === 2) return "prep2";
  if (prepRounds <= 4) return "prep34";
  if (prepRounds <= 6) return "prep56";
  if (prepRounds <= 8) return "prep78";
  return "prep9plus";
}

export function levelPreparationModifier(levelDelta: number, isInstantaneous: boolean, prepRounds: number): number {
  const band = levelPrepBand(levelDelta);
  const col = prepColumn(isInstantaneous, prepRounds);
  return LEVEL_PREP_TABLE[band][col];
}

export function spellListTypeCastingModifier(listType: SpellListType, listRealm: MagicalRealm, realmsOfPower: string[]): number {
  const ownRealm = realmsOfPower.includes(listRealm);
  if (listType === "Training Package") return 0;
  if (ownRealm) {
    if (listType === "Base") return 10;
    if (listType === "Open") return 5;
    if (listType === "Closed") return 0;
    return -10;
  }
  if (listType === "Open") return -10;
  if (listType === "Closed") return -20;
  return -30;
}

export type FreeHandsMode = "none" | "one" | "two";
export type VoiceMode = "none" | "whisper" | "normal" | "shout";
export type HelmetMode = "none" | "leather" | "leatherMetal" | "metal";

export function freeHandsModifier(realm: MagicalRealm, hands: FreeHandsMode): number {
  if (hands === "one") return 0;
  if (hands === "none") {
    if (realm === "Channeling") return -20;
    if (realm === "Essence") return -30;
    return 0;
  }
  if (realm === "Channeling") return 5;
  if (realm === "Essence") return 10;
  return 0;
}

export function voiceModifier(realm: MagicalRealm, voice: VoiceMode): number {
  if (voice === "whisper") return 0;
  if (voice === "none") {
    if (realm === "Channeling") return -10;
    if (realm === "Essence") return -5;
    return 0;
  }
  if (voice === "normal") {
    if (realm === "Channeling") return 5;
    return 0;
  }
  if (realm === "Channeling") return 10;
  if (realm === "Essence") return 5;
  return 0;
}

export function helmetModifier(realm: MagicalRealm, helmet: HelmetMode): number {
  if (helmet === "none") return 0;
  if (helmet === "leather") {
    if (realm === "Essence") return -20;
    if (realm === "Mentalism") return -30;
    return 0;
  }
  if (helmet === "leatherMetal") {
    if (realm === "Channeling") return -10;
    if (realm === "Essence") return -30;
    if (realm === "Mentalism") return -40;
    return 0;
  }
  if (realm === "Channeling") return -20;
  if (realm === "Essence") return -40;
  if (realm === "Mentalism") return -60;
  return 0;
}

export function equipmentPenaltyByRealm(
  realm: MagicalRealm,
  weights: {
    organicLiving: number;
    organicNonLiving: number;
    inorganic: number;
  },
): number {
  let channelingPenalty = 0;
  let essencePenalty = 0;

  const overLiving = Math.max(0, weights.organicLiving - 50);
  essencePenalty += Math.floor(overLiving / 5);

  const overNonLiving = Math.max(0, weights.organicNonLiving - 10);
  essencePenalty += Math.floor(overNonLiving);

  const overInorganicChanneling = Math.max(0, weights.inorganic - 10);
  channelingPenalty += Math.floor(overInorganicChanneling);

  const overInorganicEssence = Math.max(0, weights.inorganic - 5);
  essencePenalty += Math.floor(overInorganicEssence) * 2;

  if (realm === "Channeling") return -channelingPenalty;
  if (realm === "Essence") return -essencePenalty;
  return 0;
}

export function armorCastingPenalty(realm: MagicalRealm, armorType: number): number {
  const at = Math.max(1, Math.round(armorType));

  if (at <= 4) return 0;
  if (at <= 6) return realm === "Essence" ? -10 : 0;
  if (at <= 8) return realm === "Essence" ? -20 : 0;
  if (at <= 10) return realm === "Essence" ? -25 : 0;
  if (at === 11) return realm === "Essence" ? -40 : 0;
  if (at === 12) return realm === "Essence" ? -50 : 0;
  if (at <= 14) {
    if (realm === "Channeling") return -30;
    if (realm === "Essence") return -40;
    return 0;
  }
  if (at <= 16) {
    if (realm === "Channeling") return -60;
    if (realm === "Essence") return -70;
    return 0;
  }
  if (at <= 18) {
    if (realm === "Channeling") return -35;
    if (realm === "Essence") return -45;
    return 0;
  }
  if (at === 19) {
    if (realm === "Channeling") return -60;
    if (realm === "Essence") return -75;
    return 0;
  }
  if (realm === "Channeling") return -75;
  if (realm === "Essence") return -90;
  return 0;
}

function d100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

export function rollOpenEndedD100(): { total: number; rolls: number[]; mode: "normal" | "high" | "low" } {
  const first = d100();
  const rolls = [first];

  if (first >= 96) {
    let total = first;
    let next = d100();
    rolls.push(next);
    total += next;
    while (next >= 96) {
      next = d100();
      rolls.push(next);
      total += next;
    }
    return { total, rolls, mode: "high" };
  }

  if (first <= 5) {
    let total = first;
    let next = d100();
    rolls.push(next);
    total -= next;
    while (next <= 5) {
      next = d100();
      rolls.push(next);
      total -= next;
    }
    return { total, rolls, mode: "low" };
  }

  return { total: first, rolls, mode: "normal" };
}
