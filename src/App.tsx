import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, Download, Upload, Star, ChevronDown, ChevronUp } from "lucide-react";
import { RACES_DATA } from "@/data/races";
import { PROFESSIONS_DATA } from "@/data/professions";

const STAT_NAMES = [
  "Agility",
  "Constitution",
  "Memory",
  "Reasoning",
  "Self Discipline",
  "Empathy",
  "Intuition",
  "Presence",
  "Quickness",
  "Strength",
] as const;

type StatName = (typeof STAT_NAMES)[number];

type Realm = "Mentalism" | "Essence" | "Channeling" | "Arms";

type MagicalRealm = Exclude<Realm, "Arms">;

type ProgressionType = "standard" | "bodyDevelopment" | "powerPointDevelopment" | "combined" | "limited" | "special";

type RankProgression = [number, number, number, number, number];

type StatBlock = {
  temp: number;
  potential: number;
  racialBonus: number;
  specialBonus: number;
};

type RaceData = {
  name: string;
  statBonuses: Partial<Record<StatName, number>>;
  rrBonuses: {
    Channeling: number;
    Essence: number;
    Mentalism: number;
    Poison: number;
    Disease: number;
    Fear: number;
  };
  soulDepartureRounds: number;
  recoveryMultiplier: number;
  bodyDevelopmentProgression: RankProgression;
  ppDevelopmentProgressionByRealm: Record<MagicalRealm, RankProgression>;
  specialNotes?: string[];
};

type ProfessionRule = {
  target: string;
  bonus: number;
};

type ProfessionData = {
  name: string;
  realmOfPower: Realm[];
  rules: ProfessionRule[];
};

type SkillCategory = {
  id: string;
  name: string;
  applicableStats: StatName[];
  developmentCost: string;
  ranks: number;
  newRanks: number;
  progressionType: ProgressionType;
  customProgression?: RankProgression;
  professionBonus: number;
  specialBonus: number;
};

type Skill = {
  id: string;
  name: string;
  categoryId: string;
  ranks: number;
  newRanks: number;
  itemBonus: number;
  specialBonus: number;
  favorite: boolean;
  fumble: string;
  rangeModifications: string;
};

type ArmorState = {
  armorType: number;
  weightPenalty: number;
  baseMovementRate: number;
  movingManeuverPenalty: number;
  missilePenalty: number;
  armorQuicknessPenalty: number;
  shieldBonus: number;
  magicBonus: number;
  specialBonus: number;
};

type ResistanceName = "Channeling" | "Essence" | "Mentalism" | "Poison" | "Disease" | "Fear";

type EquipmentItem = {
  id: string;
  name: string;
  description: string;
  location: string;
  weight: number;
};

type InjuryItem = {
  id: string;
  text: string;
};

type CharacterSheet = {
  details: {
    characterName: string;
    level: number;
    race: string;
    culture: string;
    profession: string;
    trainingPackages: string[];
    realmOfPower: string[];
    talents: string[];
    flaws: string[];
    talentPoints: number;
    drivePoints: number;
    heroicPath: number;
  };
  stats: Record<StatName, StatBlock>;
  traits: {
    appearance: number;
    demeanor: string;
    apparentAge: string;
    actualAge: string;
    gender: string;
    skin: string;
    height: string;
    weight: string;
    hair: string;
    eyes: string;
    personality: string;
    motivation: string;
    alignment: string;
  };
  background: {
    nationality: string;
    hometown: string;
    deity: string;
    patronLord: string;
    parents: string;
    spouse: string;
    children: string;
    other: string;
  };
  armor: ArmorState;
  skillCategories: SkillCategory[];
  skills: Skill[];
  equipment: EquipmentItem[];
  wealth: {
    mithril: number;
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
    copper: number;
    tin: number;
    iron: number;
    gems: string;
    jewelry: string;
  };
  health: {
    currentHits: number;
    stunned: string;
    stunNoParry: string;
    downAndOut: string;
    bleedPerRound: string;
  };
  magic: {
    currentPP: number;
    spellAdder: number;
    spellMultiplier: number;
  };
  exhaustion: {
    currentEP: number;
    specialBonus: number;
  };
  injuries: InjuryItem[];
};

const RACES: RaceData[] = RACES_DATA as unknown as RaceData[];

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function groupMatch(categoryName: string, target: string) {
  const cat = normalizeText(categoryName);
  const rule = normalizeText(target);

  if (cat === rule) return true;
  if (rule.includes("all armor")) return cat.startsWith("armor ");
  if (rule.includes("all awareness")) return cat.startsWith("awareness ");
  if (rule.includes("all athletic")) return cat.startsWith("athletic ");
  if (rule.includes("all weapon")) return cat.startsWith("weapon ");
  if (rule.includes("all subterfuge")) return cat.startsWith("subterfuge ");
  if (rule.includes("all lore")) return cat.startsWith("lore ");
  if (rule.includes("all spell")) return cat.startsWith("spells ");
  if (rule.includes("all outdoor")) return cat.startsWith("outdoor ");
  if (rule.includes("all martial arts")) return cat.startsWith("martial arts ");
  if (rule.includes("all science")) return cat.startsWith("science analytic ");
  if (rule.includes("all technical trade")) return cat.startsWith("technical trade ");
  if (rule.includes("athletic gymnastic")) return cat === normalizeText("Athletic • Gymnastics");
  if (rule.includes("outdoor environmental")) return cat === normalizeText("Outdoor • Environmental");
  if (rule.includes("subterfuge stealth")) return cat === normalizeText("Subterfuge • Stealth");
  return cat === rule;
}

function buildCategoryBonuses(rules: ProfessionRule[]) {
  const bonuses: Record<string, number> = {};
  CATEGORY_ORDER.forEach((categoryName) => {
    bonuses[categoryName] = rules.reduce((sum, rule) => {
      return groupMatch(categoryName, rule.target) ? sum + rule.bonus : sum;
    }, 0);
  });
  return bonuses;
}

const PROFESSIONS: ProfessionData[] = PROFESSIONS_DATA as unknown as ProfessionData[];

const CATEGORY_ORDER = [
  "Armor • Heavy", "Armor • Light", "Armor • Medium", "Artistic • Active", "Artistic • Passive", "Athletic • Brawn", "Athletic • Endurance", "Athletic • Gymnastics", "Awareness • Perceptions", "Awareness • Searching", "Awareness • Senses", "Body Development", "Combat Maneuvers", "Communications", "Crafts", "Directed Spells", "Influence", "Lore • General", "Lore • Magical", "Lore • Obscure", "Lore • Technical", "Martial Arts • Striking", "Martial Arts • Sweeps", "Outdoor • Animal", "Outdoor • Environmental", "Power Awareness", "Power Manipulation", "Power Point Development", "Science/Analytic • Basic", "Science/Analytic • Specialized", "Self Control", "Special Attacks", "Special Defenses", "Spells • Own Realm Closed Lists", "Spells • Own Realm Open Lists", "Spells • Own Realm Own Base Lists", "Spells • Own Realm Other Base Lists", "Spells • Other Realm Closed Lists", "Spells • Other Realm Open Lists", "Spells • Other Realm Other Base Lists", "Subterfuge • Attack", "Subterfuge • Mechanics", "Subterfuge • Stealth", "Technical/Trade • General", "Technical/Trade • Professional", "Technical/Trade • Vocational", "Urban", "Weapon • 1-H Concussion", "Weapon • 1-H Edged", "Weapon • 2-Handed", "Weapon • Missile", "Weapon • Missile Artillery", "Weapon • Pole Arms", "Weapon • Thrown"
] as const;

const CATEGORY_CONFIG: Record<string, { applicableStats: StatName[]; developmentCost: string; progressionType: ProgressionType; newRanks: number }> = {
  "Armor • Heavy": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Armor • Light": { applicableStats: ["Agility", "Strength", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Armor • Medium": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Artistic • Active": { applicableStats: ["Presence", "Empathy", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Artistic • Passive": { applicableStats: ["Empathy", "Intuition", "Presence"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Athletic • Brawn": { applicableStats: ["Strength", "Constitution", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Athletic • Endurance": { applicableStats: ["Constitution", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Athletic • Gymnastics": { applicableStats: ["Agility", "Quickness", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Awareness • Perceptions": { applicableStats: ["Intuition", "Self Discipline", "Intuition"], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Awareness • Searching": { applicableStats: ["Intuition", "Reasoning", "Self Discipline"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Awareness • Senses": { applicableStats: ["Intuition", "Self Discipline", "Intuition"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Body Development": { applicableStats: ["Constitution", "Self Discipline", "Constitution"], developmentCost: "", progressionType: "bodyDevelopment", newRanks: 1 },
  "Combat Maneuvers": { applicableStats: ["Agility", "Quickness", "Self Discipline"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  "Communications": { applicableStats: ["Reasoning", "Memory", "Empathy"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Crafts": { applicableStats: ["Agility", "Memory", "Self Discipline"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  "Directed Spells": { applicableStats: ["Agility", "Self Discipline", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Influence": { applicableStats: ["Presence", "Empathy", "Intuition"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Lore • General": { applicableStats: ["Memory", "Reasoning", "Memory"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Lore • Magical": { applicableStats: ["Memory", "Reasoning", "Memory"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Lore • Obscure": { applicableStats: ["Memory", "Reasoning", "Memory"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Lore • Technical": { applicableStats: ["Memory", "Reasoning", "Memory"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Martial Arts • Striking": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Martial Arts • Sweeps": { applicableStats: ["Agility", "Strength", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Outdoor • Animal": { applicableStats: ["Empathy", "Agility", "Empathy"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Outdoor • Environmental": { applicableStats: ["Self Discipline", "Intuition", "Memory"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Power Awareness": { applicableStats: ["Empathy", "Intuition", "Presence"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Power Manipulation": { applicableStats: ["Empathy", "Intuition", "Presence"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Power Point Development": { applicableStats: [], developmentCost: "", progressionType: "powerPointDevelopment", newRanks: 1 },
  "Science/Analytic • Basic": { applicableStats: ["Reasoning", "Memory", "Reasoning"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Science/Analytic • Specialized": { applicableStats: ["Reasoning", "Memory", "Reasoning"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  "Self Control": { applicableStats: ["Self Discipline", "Presence", "Self Discipline"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Special Attacks": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  "Special Defenses": { applicableStats: [], developmentCost: "", progressionType: "special", newRanks: 1 },
  "Spells • Own Realm Closed Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Own Realm Open Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Own Realm Own Base Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Own Realm Other Base Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Closed Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Open Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Other Base Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Subterfuge • Attack": { applicableStats: ["Agility", "Self Discipline", "Intuition"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Subterfuge • Mechanics": { applicableStats: ["Intuition", "Agility", "Reasoning"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Subterfuge • Stealth": { applicableStats: ["Agility", "Self Discipline", "Intuition"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Technical/Trade • General": { applicableStats: ["Reasoning", "Memory", "Self Discipline"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Technical/Trade • Professional": { applicableStats: ["Reasoning", "Memory", "Intuition"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  "Technical/Trade • Vocational": { applicableStats: ["Memory", "Intuition", "Reasoning"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  Urban: { applicableStats: ["Intuition", "Presence", "Reasoning"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • 1-H Concussion": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • 1-H Edged": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • 2-Handed": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • Missile": { applicableStats: ["Agility", "Strength", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • Missile Artillery": { applicableStats: ["Intuition", "Agility", "Reasoning"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • Pole Arms": { applicableStats: ["Strength", "Agility", "Strength"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  "Weapon • Thrown": { applicableStats: ["Agility", "Strength", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
};

const DEFAULT_CATEGORY_PROGRESSION: RankProgression = [-15, 2, 1, 0.5, 0];
const DEFAULT_SKILL_PROGRESSIONS: Record<ProgressionType, RankProgression> = {
  standard: [-15, 3, 2, 1, 0.5],
  combined: [-15, 5, 3, 1.5, 0.5],
  limited: [0, 1, 1, 0.5, 0],
  bodyDevelopment: [0, 0, 0, 0, 0],
  powerPointDevelopment: [0, 0, 0, 0, 0],
  special: [0, 6, 5, 4, 3],
};
const ZERO_PROGRESSION: RankProgression = [0, 0, 0, 0, 0];

const REALM_STAT_MAP: Record<MagicalRealm, StatName> = {
  Channeling: "Intuition",
  Essence: "Empathy",
  Mentalism: "Presence",
};

function firstMagicalRealm(realms: Realm[]): MagicalRealm {
  const found = realms.find((realm): realm is MagicalRealm => realm !== "Arms");
  return found ?? "Channeling";
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function statBasicBonus(val: number) {
  if (val <= 1) return -10;
  if (val <= 3) return -9;
  if (val <= 5) return -8;
  if (val <= 7) return -7;
  if (val <= 9) return -6;
  if (val === 10) return -5;
  if (val <= 15) return -4;
  if (val <= 20) return -3;
  if (val <= 25) return -2;
  if (val <= 30) return -1;
  if (val <= 69) return 0;
  if (val <= 74) return 1;
  if (val <= 79) return 2;
  if (val <= 84) return 3;
  if (val <= 89) return 4;
  if (val <= 91) return 5;
  if (val <= 93) return 6;
  if (val <= 95) return 7;
  if (val <= 97) return 8;
  if (val <= 99) return 9;
  if (val === 100) return 10;
  if (val === 101) return 12;
  return 14;
}

function rankValue(ranks: number, progression: RankProgression) {
  const effectiveRanks = Math.max(0, ranks);
  if (effectiveRanks === 0) return progression[0];

  let total = 0;
  let remaining = effectiveRanks;

  const brackets = [10, 10, 10, Infinity];
  const perRank = [progression[1], progression[2], progression[3], progression[4]];

  for (let i = 0; i < brackets.length && remaining > 0; i += 1) {
    const used = Math.min(remaining, brackets[i]);
    total += used * perRank[i];
    remaining -= used;
  }

  return Math.floor(total * 2) / 2;
}

function canEditCategoryNewRanks(progressionType: ProgressionType) {
  return progressionType === "standard";
}

function formatProgressionType(progressionType: ProgressionType) {
  switch (progressionType) {
    case "standard":
      return "Standard";
    case "combined":
      return "Combined";
    case "limited":
      return "Limited";
    case "special":
      return "Special";
    case "bodyDevelopment":
      return "Body Dev";
    case "powerPointDevelopment":
      return "PP Dev";
    default:
      return "Unknown";
  }
}

function clampNumber(v: number, min = 0) {
  if (Number.isNaN(v)) return min;
  return Math.max(min, v);
}

function formatProgression(p: RankProgression) {
  return `${p[0]} • ${p[1]} • ${p[2]} • ${p[3]} • ${p[4]}`;
}

const STAT_ABBR: Record<string, string> = {
  Agility: "Ag",
  Constitution: "Co",
  Memory: "Me",
  Reasoning: "Re",
  "Self Discipline": "SD",
  Empathy: "Em",
  Intuition: "In",
  Presence: "Pr",
  Quickness: "Qu",
  Strength: "St",
};
function abbrStats(stats: string[]) {
  return stats.map((s) => STAT_ABBR[s] ?? s.slice(0, 2)).join("/") || "—";
}

function isWeaponCategory(catName: string) {
  return catName.startsWith("Weapon •") || ["Martial Arts • Striking", "Martial Arts • Sweeps", "Special Attacks"].includes(catName);
}

function pctUsed(current: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (current / total) * 100));
}

function healthPenalty(percent: number) {
  if (percent < 25) return 0;
  if (percent < 50) return -10;
  if (percent < 75) return -20;
  if (percent < 100) return -30;
  return -999;
}

function magicPenalty(percent: number) {
  if (percent < 25) return 0;
  if (percent < 50) return -10;
  if (percent < 75) return -20;
  return -30;
}

function exhaustionPenalty(percent: number) {
  if (percent < 25) return 0;
  if (percent < 50) return -5;
  if (percent < 75) return -15;
  if (percent < 90) return -30;
  if (percent < 100) return -60;
  return -100;
}

type DicePair = { die1: number; die2: number };

type DpSpendEntry = {
  id: string;
  label: string;
  cost: number;
  kind: "categoryUpgrade" | "skillUpgrade" | "trainingPackage" | "other";
  itemKey?: string;
  upgradeStep?: number;
};

type ExtraStatRoll = {
  id: string;
  stat: StatName;
  die1: number;
  die2: number;
};

function makeEmptyBaseRolls(): Record<StatName, DicePair> {
  return STAT_NAMES.reduce((acc, stat) => {
    acc[stat] = { die1: 0, die2: 0 };
    return acc;
  }, {} as Record<StatName, DicePair>);
}

function isValidDie(value: number) {
  return Number.isFinite(value) && value >= 1 && value <= 10;
}

function parseDevelopmentCost(cost: string) {
  if (!cost.trim()) return [] as number[];
  return cost
    .split(/[^0-9]+/)
    .map((part) => Number(part))
    .filter((num) => Number.isFinite(num) && num > 0);
}

function formatDevelopmentCostPath(cost: string) {
  const parsed = parseDevelopmentCost(cost);
  return parsed.length > 0 ? parsed.join("/") : "—";
}

function parseExhaustionBonusFromRaceNotes(notes?: string[]) {
  if (!notes || notes.length === 0) return 0;
  return notes.reduce((sum, note) => {
    const match = note.match(/([+-]?\d+)\s*exhaustion\s*points?/i);
    if (!match) return sum;
    return sum + (Number(match[1]) || 0);
  }, 0);
}

function rankCostOptions(developmentCost: string, newRanks: number) {
  const costs = parseDevelopmentCost(developmentCost);
  const allowedUpgrades = Math.max(0, Math.min(3, costs.length));
  const ranksPerUpgrade = Math.max(1, Math.min(3, Math.floor(newRanks)));
  const options: Array<{ upgrades: number; rankGain: number; cost: number }> = [];

  let runningCost = 0;
  for (let upgrades = 1; upgrades <= allowedUpgrades; upgrades += 1) {
    runningCost += costs[upgrades - 1];
    options.push({
      upgrades,
      rankGain: upgrades * ranksPerUpgrade,
      cost: runningCost,
    });
  }

  return options;
}

function isZeroProgression(progression: RankProgression) {
  return progression.every((value) => value === 0);
}

function totalCost(costs: number[]) {
  return costs.reduce((sum, c) => sum + c, 0);
}

function resolveStatLevelRoll(temp: number, potential: number, die1: number, die2: number) {
  const sum = die1 + die2;
  const isDouble = die1 === die2;
  const gap = potential - temp;
  let nextTemp = temp;
  let nextPotential = potential;
  let explanation = "";

  if (isDouble && die1 <= 5) {
    nextTemp = temp - sum;
    explanation = `Double ${die1}: temp -${sum}`;
  } else if (isDouble && die1 >= 6) {
    if (temp >= potential) {
      nextPotential = potential + 1;
      explanation = `Double ${die1} at cap: potential +1`;
    } else {
      nextTemp = temp + sum;
      explanation = `Double ${die1}: temp +${sum}`;
    }
  } else if (gap > 20) {
    nextTemp = temp + sum;
    explanation = `Gap ${gap}: temp +${sum} (both dice)`;
  } else if (gap >= 11) {
    const added = Math.max(die1, die2);
    nextTemp = temp + added;
    explanation = `Gap ${gap}: temp +${added} (higher die)`;
  } else {
    const added = Math.min(die1, die2);
    nextTemp = temp + added;
    explanation = `Gap ${gap}: temp +${added} (lower die)`;
  }

  if (nextTemp > nextPotential) nextTemp = nextPotential;

  return {
    temp: nextTemp,
    potential: nextPotential,
    explanation,
  };
}

function currencyValue(wealth: CharacterSheet["wealth"]) {
  return (
    wealth.iron +
    wealth.tin * 10 +
    wealth.copper * 100 +
    wealth.bronze * 1000 +
    wealth.silver * 10000 +
    wealth.gold * 100000 +
    wealth.platinum * 1000000 +
    wealth.mithril * 10000000
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateSheet(parsed: any): CharacterSheet {
  const s = parsed as CharacterSheet;
  if (!Array.isArray(s.details.talents)) {
    (s.details as any).talents = s.details.talents ? [(s.details as any).talents as string] : [];
  }
  if (!Array.isArray(s.details.flaws)) {
    (s.details as any).flaws = s.details.flaws ? [(s.details as any).flaws as string] : [];
  }
  if (typeof s.details.heroicPath !== "number") {
    (s.details as any).heroicPath = Number(s.details.heroicPath) || 0;
  }
  if (!Array.isArray(s.skills)) {
    (s as any).skills = [];
  }
  s.skills = s.skills.map((skill) => ({
    ...skill,
    newRanks: typeof (skill as any).newRanks === "number" ? (skill as any).newRanks : 1,
  }));
  return s;
}

function makeDefaultStats(): Record<StatName, StatBlock> {
  return STAT_NAMES.reduce((acc, name) => {
    acc[name] = { temp: 50, potential: 100, racialBonus: 0, specialBonus: 0 };
    return acc;
  }, {} as Record<StatName, StatBlock>);
}

function makeDefaultCategories(): SkillCategory[] {
  return CATEGORY_ORDER.map((name) => ({
    id: uid("cat"),
    name,
    applicableStats: CATEGORY_CONFIG[name]?.applicableStats ?? [],
    developmentCost: CATEGORY_CONFIG[name]?.developmentCost ?? "",
    ranks: 0,
    newRanks: CATEGORY_CONFIG[name]?.newRanks ?? 1,
    progressionType: CATEGORY_CONFIG[name]?.progressionType ?? "standard",
    professionBonus: 0,
    specialBonus: name === "Body Development" ? 10 : 0,
  }));
}

function makeDefaultSheet(): CharacterSheet {
  return {
    details: {
      characterName: "",
      level: 1,
      race: "Common Men",
      culture: "",
      profession: "Fighter",
      trainingPackages: [],
      realmOfPower: ["Arms"],
      talents: [],
      flaws: [],
      talentPoints: 0,
      drivePoints: 0,
      heroicPath: 0,
    },
    stats: makeDefaultStats(),
    traits: {
      appearance: 50,
      demeanor: "",
      apparentAge: "",
      actualAge: "",
      gender: "",
      skin: "",
      height: "",
      weight: "",
      hair: "",
      eyes: "",
      personality: "",
      motivation: "",
      alignment: "",
    },
    background: {
      nationality: "",
      hometown: "",
      deity: "",
      patronLord: "",
      parents: "",
      spouse: "",
      children: "",
      other: "",
    },
    armor: {
      armorType: 1,
      weightPenalty: 0,
      baseMovementRate: 100,
      movingManeuverPenalty: 0,
      missilePenalty: 0,
      armorQuicknessPenalty: 0,
      shieldBonus: 0,
      magicBonus: 0,
      specialBonus: 0,
    },
    skillCategories: makeDefaultCategories(),
    skills: [
      {
        id: uid("skill"),
        name: "Perception",
        categoryId: "",
        ranks: 0,
        newRanks: 1,
        itemBonus: 0,
        specialBonus: 0,
        favorite: true,
        fumble: "",
        rangeModifications: "",
      },
    ],
    equipment: [],
    wealth: {
      mithril: 0,
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      copper: 0,
      tin: 0,
      iron: 0,
      gems: "",
      jewelry: "",
    },
    health: {
      currentHits: 0,
      stunned: "",
      stunNoParry: "",
      downAndOut: "",
      bleedPerRound: "",
    },
    magic: {
      currentPP: 0,
      spellAdder: 0,
      spellMultiplier: 1,
    },
    exhaustion: {
      currentEP: 0,
      specialBonus: 0,
    },
    injuries: [],
  };
}

function NumberInput({ value, onChange, className = "", min }: { value: number; onChange: (v: number) => void; className?: string; min?: number }) {
  const [localValue, setLocalValue] = React.useState<string>("");
  const [focused, setFocused] = React.useState(false);

  const normalizeNumericString = (raw: string) => {
    if (raw === "" || raw === "-") return raw;
    return raw.replace(/^(-?)0+(?=\d)/, "$1");
  };

  const displayValue = focused ? localValue : (Number.isFinite(value) ? String(value) : "0");

  return (
    <Input
      type="number"
      value={displayValue}
      min={min}
      className={`h-8 ${className}`.trim()}
      onFocus={(e) => {
        setFocused(true);
        setLocalValue(e.target.value);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const normalized = normalizeNumericString(raw);
        setLocalValue(normalized);
        if (normalized === "" || normalized === "-") return;
        onChange(Number(normalized));
      }}
      onBlur={(e) => {
        setFocused(false);
        const raw = e.target.value;
        if (raw === "" || raw === "-") {
          const fallback = min ?? 0;
          setLocalValue(String(fallback));
          onChange(fallback);
          return;
        }
        const normalized = String(Number(normalizeNumericString(raw)));
        setLocalValue(normalized);
        if (raw !== normalized) onChange(Number(normalized));
      }}
    />
  );
}

function RankCheckboxes({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n && n > 1 ? n - 1 : n)}
          className={`h-5 w-5 rounded border-2 transition-colors ${value >= n ? "bg-slate-700 border-slate-700" : "bg-white border-slate-300 hover:border-slate-500"}`}
          title={`${n} rank${n > 1 ? "s" : ""}`}
        />
      ))}
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border-pink-200/50 shadow-sm">
      <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-center">
        <CardTitle className="text-lg">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type CharacterEntry = { id: string; sheet: CharacterSheet };

const TAB_OPTIONS = [
  { value: "front", label: "Front" },
  { value: "details", label: "Details" },
  { value: "stats", label: "Stats" },
  { value: "combat", label: "Combat" },
  { value: "categories", label: "Skill Categories" },
  { value: "skills", label: "Skills" },
  { value: "gear", label: "Gear" },
  { value: "status", label: "Status" },
  { value: "backup", label: "Backup" },
] as const;

type TabValue = (typeof TAB_OPTIONS)[number]["value"];
type ActiveView = TabValue | "levelUp";

export default function RolemasterCharacterSheetEngine() {
  const [characters, setCharacters] = useState<CharacterEntry[]>(() => [{ id: uid("char"), sheet: makeDefaultSheet() }]);
  const [activeId, setActiveId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveView>("front");
  const [lastNonHelperTab, setLastNonHelperTab] = useState<TabValue>("front");
  const [expandedMobileSkillId, setExpandedMobileSkillId] = useState<string | null>(null);
  const [expandedMobileStat, setExpandedMobileStat] = useState<StatName | null>(null);
  const [expandedMobileCategoryId, setExpandedMobileCategoryId] = useState<string | null>(null);
  const [baseStatRolls, setBaseStatRolls] = useState<Record<StatName, DicePair>>(() => makeEmptyBaseRolls());
  const [dpSpendEntries, setDpSpendEntries] = useState<DpSpendEntry[]>([]);
  const [extraStatRolls, setExtraStatRolls] = useState<ExtraStatRoll[]>([]);
  const [newLevelUpSkillName, setNewLevelUpSkillName] = useState("");
  const [newLevelUpSkillCategoryId, setNewLevelUpSkillCategoryId] = useState("");
  const [trainingPackageSpendName, setTrainingPackageSpendName] = useState("");
  const [trainingPackageSpendCost, setTrainingPackageSpendCost] = useState(0);
  const [trainingPackageInput, setTrainingPackageInput] = useState("");
  const [talentInput, setTalentInput] = useState("");
  const [flawInput, setFlawInput] = useState("");
  const [transitionKey, setTransitionKey] = useState(0);
  const transitionDir = React.useRef<"left" | "right" | "fade">("fade");
  const [draggedSkillIndex, setDraggedSkillIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const mobileCharacterTabsRef = useRef<HTMLDivElement | null>(null);

  // Derive active sheet (fall back to first character)
  const activeCharacter = characters.find((c) => c.id === activeId) ?? characters[0];
  const sheet = activeCharacter.sheet;
  const activeTabIndex = TAB_OPTIONS.findIndex((tab) => tab.value === activeTab);

  useEffect(() => {
    if (activeTab !== "levelUp") setLastNonHelperTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const exists = sheet.skillCategories.some((cat) => cat.id === newLevelUpSkillCategoryId);
    if (!exists && sheet.skillCategories[0]?.id) {
      setNewLevelUpSkillCategoryId(sheet.skillCategories[0].id);
    }
  }, [newLevelUpSkillCategoryId, sheet.skillCategories]);

  useEffect(() => {
    const sectionTabs = document.getElementById("section-tabs-strip");
    if (!sectionTabs) return;
    const activeEl = sectionTabs.querySelector<HTMLElement>(`[data-tab-value="${activeTab}"]`);
    if (!activeEl) return;
    const containerRect = sectionTabs.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const targetScroll = sectionTabs.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
    sectionTabs.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [activeTab]);

  useEffect(() => {
    const container = mobileCharacterTabsRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-char-id="${activeCharacter.id}"]`);
    if (!activeEl) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const targetScroll = container.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [activeCharacter.id]);

  useEffect(() => {
    setExpandedMobileSkillId(null);
    setExpandedMobileStat(null);
    setExpandedMobileCategoryId(null);
    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
  }, [activeCharacter.id]);

  useEffect(() => {
    const rawParty = localStorage.getItem("rolemaster-party");
    const rawLegacy = rawParty ? null : localStorage.getItem("rolemaster-sheet-engine");
    const raw = rawParty ?? rawLegacy;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const migrated: CharacterEntry[] = data.map((e: CharacterEntry) => ({ id: e.id, sheet: migrateSheet(e.sheet) }));
          setCharacters(migrated);
          setActiveId(migrated[0].id);
        } else {
          // migrate old single-sheet save
          const entry = { id: uid("char"), sheet: migrateSheet(data) };
          setCharacters([entry]);
          setActiveId(entry.id);
        }
      } catch {
        // ignore corrupt save
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("rolemaster-party", JSON.stringify(characters));
  }, [characters, loaded]);

  const selectedRace = useMemo(
    () => RACES.find((r) => r.name === sheet.details.race) ?? RACES[0],
    [sheet.details.race]
  );

  const selectedProfession = useMemo(
    () => PROFESSIONS.find((p) => p.name === sheet.details.profession) ?? PROFESSIONS[0],
    [sheet.details.profession]
  );

  const professionCategoryBonuses = useMemo(() => buildCategoryBonuses(selectedProfession.rules), [selectedProfession]);

  useEffect(() => {
    setSheet((prev) => {
      const nextStats = { ...prev.stats };
      STAT_NAMES.forEach((name) => {
        nextStats[name] = {
          ...nextStats[name],
          racialBonus: selectedRace.statBonuses[name] ?? 0,
        };
      });
      const nextCategories = prev.skillCategories.map((cat) => ({
        ...cat,
        professionBonus: professionCategoryBonuses[cat.name] ?? 0,
      }));
      return {
        ...prev,
        stats: nextStats,
        skillCategories: nextCategories,
        details: {
          ...prev.details,
          realmOfPower: selectedProfession.realmOfPower,
        },
      };
    });
  }, [selectedRace, selectedProfession, professionCategoryBonuses, activeId]);

  const statTotals = useMemo(() => {
    return STAT_NAMES.reduce((acc, name) => {
      const stat = sheet.stats[name];
      const basic = statBasicBonus(stat.temp);
      const total = basic + stat.racialBonus + stat.specialBonus;
      acc[name] = { basic, racial: stat.racialBonus, special: stat.specialBonus, total };
      return acc;
    }, {} as Record<StatName, { basic: number; racial: number; special: number; total: number }>);
  }, [sheet.stats]);

  const developmentPoints = useMemo(() => {
    const keys: StatName[] = ["Agility", "Constitution", "Memory", "Reasoning", "Self Discipline"];
    const avg = keys.reduce((sum, k) => sum + sheet.stats[k].temp, 0) / keys.length;
    return Math.floor(avg);
  }, [sheet.stats]);

  const armorQuicknessBonus = statTotals["Quickness"].total * 3;
  const totalNormalDB = armorQuicknessBonus + sheet.armor.armorQuicknessPenalty + sheet.armor.shieldBonus + sheet.armor.magicBonus + sheet.armor.specialBonus;

  const resistanceRolls = useMemo(() => {
    return {
      Channeling: {
        raceBonus: selectedRace.rrBonuses.Channeling,
        statBonus: statTotals["Intuition"].total * 3,
      },
      Essence: {
        raceBonus: selectedRace.rrBonuses.Essence,
        statBonus: statTotals["Empathy"].total * 3,
      },
      Mentalism: {
        raceBonus: selectedRace.rrBonuses.Mentalism,
        statBonus: statTotals["Presence"].total * 3,
      },
      Poison: {
        raceBonus: selectedRace.rrBonuses.Poison,
        statBonus: statTotals["Constitution"].total * 3,
      },
      Disease: {
        raceBonus: selectedRace.rrBonuses.Disease,
        statBonus: statTotals["Constitution"].total * 3,
      },
      Fear: {
        raceBonus: selectedRace.rrBonuses.Fear,
        statBonus: statTotals["Self Discipline"].total * 3,
      },
    } as Record<ResistanceName, { raceBonus: number; statBonus: number }>;
  }, [selectedRace, statTotals]);

  const categoryDerived = useMemo(() => {
    const primaryRealm = firstMagicalRealm(sheet.details.realmOfPower as Realm[]);
    return sheet.skillCategories.map((cat) => {
      const progression = cat.progressionType === "bodyDevelopment"
        ? selectedRace.bodyDevelopmentProgression
        : cat.progressionType === "powerPointDevelopment"
          ? selectedRace.ppDevelopmentProgressionByRealm[primaryRealm]
          : cat.progressionType === "combined" || cat.progressionType === "limited" || cat.progressionType === "special"
            ? ZERO_PROGRESSION
            : cat.customProgression ?? DEFAULT_CATEGORY_PROGRESSION;

      const realmStatName = cat.name.startsWith("Spells • ") || cat.name === "Power Point Development"
        ? REALM_STAT_MAP[primaryRealm]
        : null;
      const stat = realmStatName
        ? statTotals[realmStatName].total
        : cat.applicableStats.reduce((sum, statName) => sum + (statTotals[statName]?.total ?? 0), 0);
      const rank = rankValue(cat.ranks, progression);
      const total = rank + stat + cat.professionBonus + cat.specialBonus;
      return {
        ...cat,
        applicableStatsDisplay: realmStatName ? abbrStats([realmStatName]) : abbrStats(cat.applicableStats),
        progression,
        stat,
        rank,
        total,
      };
    });
  }, [sheet.skillCategories, selectedRace, statTotals, sheet.details.realmOfPower]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categoryDerived)[number]>();
    categoryDerived.forEach((c) => map.set(c.id, c));
    return map;
  }, [categoryDerived]);

  useEffect(() => {
    setSheet((prev) => {
      const fixedSkills = prev.skills.map((skill, idx) => {
        if (skill.categoryId) return skill;
        const defaultCat = prev.skillCategories.find((cat) => cat.name === "Awareness • Perceptions") ?? prev.skillCategories[0];
        return idx === 0 ? { ...skill, categoryId: defaultCat?.id ?? "" } : skill;
      });
      return { ...prev, skills: fixedSkills };
    });
  }, []);

  const skillDerived = useMemo(() => {
    const primaryRealm = firstMagicalRealm(sheet.details.realmOfPower as Realm[]);
    return sheet.skills.map((skill) => {
      const category = categoryMap.get(skill.categoryId);
      const progressionType = category?.progressionType ?? "standard";
      const progression = progressionType === "bodyDevelopment"
        ? selectedRace.bodyDevelopmentProgression
        : progressionType === "powerPointDevelopment"
          ? selectedRace.ppDevelopmentProgressionByRealm[primaryRealm]
          : DEFAULT_SKILL_PROGRESSIONS[progressionType] ?? DEFAULT_SKILL_PROGRESSIONS.standard;
      const rank = rankValue(skill.ranks, progression);
      const categoryTotal = category?.total ?? 0;
      const total = rank + categoryTotal + skill.itemBonus + skill.specialBonus;
      return {
        ...skill,
        category,
        progression,
        rank,
        categoryTotal,
        total,
      };
    });
  }, [sheet.skills, categoryMap, selectedRace, sheet.details.realmOfPower]);

  const bodyDevelopmentCategoryTotal = categoryDerived.find((c) => c.name === "Body Development")?.total ?? 0;
  const powerPointCategoryTotal = categoryDerived.find((c) => c.name === "Power Point Development")?.total ?? 0;
  const bodyDevelopmentSkill = skillDerived.find((s) => s.category?.name === "Body Development");
  const powerPointSkill = skillDerived.find((s) => s.category?.name === "Power Point Development");

  const bodyDevelopmentTotal = bodyDevelopmentSkill
    ? bodyDevelopmentCategoryTotal + bodyDevelopmentSkill.rank
    : bodyDevelopmentCategoryTotal;
  const powerPointTotal = powerPointSkill
    ? powerPointCategoryTotal + powerPointSkill.rank
    : powerPointCategoryTotal;

  const raceExhaustionBonus = parseExhaustionBonusFromRaceNotes(selectedRace.specialNotes);
  const totalHits = Math.max(0, bodyDevelopmentTotal);
  const totalPP = Math.max(0, (powerPointTotal + sheet.magic.spellAdder) * Math.max(1, sheet.magic.spellMultiplier));
  const totalEP = Math.max(0, 40 + statTotals["Constitution"].total * 3 + raceExhaustionBonus + sheet.exhaustion.specialBonus);

  const currentHitsPool = Math.max(0, totalHits - sheet.health.currentHits);
  const currentPPPool = Math.max(0, totalPP - sheet.magic.currentPP);
  const currentEPPool = Math.max(0, totalEP - sheet.exhaustion.currentEP);

  const healthPercent = pctUsed(sheet.health.currentHits, totalHits);
  const magicPercent = pctUsed(sheet.magic.currentPP, totalPP);
  const exhaustionPercent = pctUsed(sheet.exhaustion.currentEP, totalEP);

  const sortByCatThenName = (a: { name: string; category?: { name: string } | null }, b: { name: string; category?: { name: string } | null }) => {
    const catA = a.category?.name ?? "";
    const catB = b.category?.name ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  };

  const commonlyUsedSkills = skillDerived.filter((s) => {
    if (!s.favorite) return false;
    const catName = s.category?.name ?? "";
    return !isWeaponCategory(catName);
  }).sort(sortByCatThenName);

  const commonlyUsedAttacks = skillDerived.filter((s) => {
    if (!s.favorite) return false;
    const catName = s.category?.name ?? "";
    return isWeaponCategory(catName);
  }).sort(sortByCatThenName);

  const levelUpPreview = useMemo(() => {
    const extraByStat = new Map<StatName, ExtraStatRoll[]>();
    STAT_NAMES.forEach((stat) => extraByStat.set(stat, []));
    extraStatRolls.forEach((roll) => {
      extraByStat.get(roll.stat)?.push(roll);
    });

    return STAT_NAMES.reduce((acc, stat) => {
      const startTemp = sheet.stats[stat].temp;
      const startPotential = sheet.stats[stat].potential;
      let nextTemp = startTemp;
      let nextPotential = startPotential;
      const logs: string[] = [];

      const base = baseStatRolls[stat];
      if (isValidDie(base.die1) && isValidDie(base.die2)) {
        const result = resolveStatLevelRoll(nextTemp, nextPotential, base.die1, base.die2);
        nextTemp = result.temp;
        nextPotential = result.potential;
        logs.push(`Base: ${result.explanation}`);
      } else {
        logs.push("Base roll pending");
      }

      const extras = extraByStat.get(stat) ?? [];
      extras.forEach((roll, idx) => {
        if (isValidDie(roll.die1) && isValidDie(roll.die2)) {
          const result = resolveStatLevelRoll(nextTemp, nextPotential, roll.die1, roll.die2);
          nextTemp = result.temp;
          nextPotential = result.potential;
          logs.push(`Extra ${idx + 1}: ${result.explanation}`);
        } else {
          logs.push(`Extra ${idx + 1}: pending`);
        }
      });

      acc[stat] = {
        temp: nextTemp,
        potential: nextPotential,
        deltaTemp: nextTemp - startTemp,
        deltaPotential: nextPotential - startPotential,
        logs,
      };
      return acc;
    }, {} as Record<StatName, { temp: number; potential: number; deltaTemp: number; deltaPotential: number; logs: string[] }>);
  }, [sheet.stats, baseStatRolls, extraStatRolls]);

  const dpSpent = useMemo(() => {
    const manualSpend = dpSpendEntries.reduce((sum, entry) => sum + clampNumber(entry.cost), 0);
    const extraRollSpend = extraStatRolls.length * 8;
    return manualSpend + extraRollSpend;
  }, [dpSpendEntries, extraStatRolls]);

  const selectedUpgradeCounts = useMemo(() => {
    return dpSpendEntries.reduce((acc, entry) => {
      if (!entry.itemKey) return acc;
      const step = Math.max(0, entry.upgradeStep ?? 1);
      acc[entry.itemKey] = Math.max(acc[entry.itemKey] ?? 0, step);
      return acc;
    }, {} as Record<string, number>);
  }, [dpSpendEntries]);

  const projectedDevelopmentPoints = useMemo(() => {
    const keys: StatName[] = ["Agility", "Constitution", "Memory", "Reasoning", "Self Discipline"];
    const avg = keys.reduce((sum, key) => sum + levelUpPreview[key].temp, 0) / keys.length;
    return Math.floor(avg);
  }, [levelUpPreview]);

  const categorySpendSuggestions = useMemo(() => {
    return categoryDerived
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        ranks: cat.ranks,
        ranksPerUpgrade: cat.newRanks,
        progression: cat.progression,
        options: rankCostOptions(cat.developmentCost, cat.newRanks),
        selectedUpgrades: selectedUpgradeCounts[`cat:${cat.id}`] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryDerived, selectedUpgradeCounts]);

  const skillSpendSuggestions = useMemo(() => {
    return skillDerived
      .map((skill) => ({
        id: skill.id,
        name: skill.name || "(Unnamed Skill)",
        categoryName: skill.category?.name ?? "Unassigned",
        ranks: skill.ranks,
        ranksPerUpgrade: skill.newRanks,
        options: skill.category
          ? rankCostOptions(skill.category.developmentCost, skill.newRanks)
          : [],
        selectedUpgrades: selectedUpgradeCounts[`skill:${skill.id}`] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skillDerived, selectedUpgradeCounts]);

  const dpRemaining = projectedDevelopmentPoints - dpSpent;

  const setSheet = (updaterOrSheet: CharacterSheet | ((prev: CharacterSheet) => CharacterSheet)) => {
    setCharacters((prev) => prev.map((c) => c.id === activeCharacter.id
      ? { ...c, sheet: typeof updaterOrSheet === "function" ? updaterOrSheet(c.sheet) : updaterOrSheet }
      : c
    ));
  };

  const updateSheet = (updater: (prev: CharacterSheet) => CharacterSheet) => setSheet(updater);

  const addCharacter = () => {
    const entry: CharacterEntry = { id: uid("char"), sheet: makeDefaultSheet() };
    setCharacters((prev) => [...prev, entry]);
    setActiveId(entry.id);
    setExpandedMobileSkillId(null);
    setExpandedMobileStat(null);
    setExpandedMobileCategoryId(null);
    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    setTrainingPackageInput(""); setTalentInput(""); setFlawInput(""); setDraggedSkillIndex(null);
  };

  const removeCharacter = (id: string) => {
    setCharacters((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) return prev;
      if (id === activeCharacter.id) setActiveId(next[0].id);
      return next;
    });
  };

  const switchCharacter = (id: string) => {
    transitionDir.current = "fade";
    setTransitionKey((k) => k + 1);
    setActiveId(id);
    setExpandedMobileSkillId(null);
    setExpandedMobileStat(null);
    setExpandedMobileCategoryId(null);
    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    setTrainingPackageInput(""); setTalentInput(""); setFlawInput(""); setDraggedSkillIndex(null);
  };

  const confirmRemoveCharacter = (id: string, name: string) => {
    const ok = window.confirm(`Delete character "${name}"? This cannot be undone.`);
    if (!ok) return;
    removeCharacter(id);
  };

  const openLevelUpHelper = () => {
    setActiveTab("levelUp");
  };

  const closeLevelUpHelper = () => {
    setActiveTab(lastNonHelperTab);
  };

  const addQuickSpend = (label: string, cost: number) => {
    setDpSpendEntries((prev) => [...prev, { id: uid("dp"), label, cost: clampNumber(cost), kind: "other" }]);
  };

  const addExtraStatRoll = () => {
    setExtraStatRolls((prev) => [...prev, { id: uid("xroll"), stat: STAT_NAMES[0], die1: 0, die2: 0 }]);
  };

  const addCategoryUpgradeSpend = (categoryId: string, categoryName: string, ranksPerUpgrade: number, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const next = options[selectedUpgrades];
    if (!next) return;
    const itemKey = `cat:${categoryId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Category Upgrade ${next.upgrades}: ${categoryName}`,
        cost: next.cost,
        kind: "categoryUpgrade",
        itemKey,
        upgradeStep: next.upgrades,
      }];
    });
  };

  const addSkillUpgradeSpend = (skillId: string, skillName: string, ranksPerUpgrade: number, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const next = options[selectedUpgrades];
    if (!next) return;
    const itemKey = `skill:${skillId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Skill Upgrade ${next.upgrades}: ${skillName}`,
        cost: next.cost,
        kind: "skillUpgrade",
        itemKey,
        upgradeStep: next.upgrades,
      }];
    });
  };

  const removeCategoryUpgradeSpend = (categoryId: string, categoryName: string, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const itemKey = `cat:${categoryId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      const nextStep = Math.max(0, selectedUpgrades - 1);
      if (nextStep === 0) return withoutCurrent;
      const target = options[nextStep - 1];
      if (!target) return withoutCurrent;
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Category Upgrade ${target.upgrades}: ${categoryName}`,
        cost: target.cost,
        kind: "categoryUpgrade",
        itemKey,
        upgradeStep: target.upgrades,
      }];
    });
  };

  const removeSkillUpgradeSpend = (skillId: string, skillName: string, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const itemKey = `skill:${skillId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      const nextStep = Math.max(0, selectedUpgrades - 1);
      if (nextStep === 0) return withoutCurrent;
      const target = options[nextStep - 1];
      if (!target) return withoutCurrent;
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Skill Upgrade ${target.upgrades}: ${skillName}`,
        cost: target.cost,
        kind: "skillUpgrade",
        itemKey,
        upgradeStep: target.upgrades,
      }];
    });
  };

  const addTrainingPackageSpend = () => {
    const name = trainingPackageSpendName.trim();
    const cost = clampNumber(trainingPackageSpendCost);
    if (!name || cost <= 0) return;
    setDpSpendEntries((prev) => [...prev, { id: uid("dp"), label: `Training Package: ${name}`, cost, kind: "trainingPackage" }]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
  };

  const addNewSkillFromLevelUp = () => {
    const name = newLevelUpSkillName.trim();
    if (!name) return;
    const categoryId = newLevelUpSkillCategoryId || sheet.skillCategories[0]?.id;
    if (!categoryId) return;

    const category = sheet.skillCategories.find((cat) => cat.id === categoryId);
    updateSheet((prev) => ({
      ...prev,
      skills: [
        ...prev.skills,
        {
          id: uid("skill"),
          name,
          categoryId,
          ranks: 0,
          newRanks: 1,
          itemBonus: 0,
          specialBonus: 0,
          favorite: false,
          fumble: "",
          rangeModifications: "",
        },
      ],
    }));

    const firstUpgradeCost = parseDevelopmentCost(category?.developmentCost ?? "")[0];
    if (firstUpgradeCost) {
      const rankGain = 1 * 1;
      addQuickSpend(`New Skill Upgrade x1: ${name} (+${rankGain} ranks)`, firstUpgradeCost);
    }
    setNewLevelUpSkillName("");
  };

  const commitLevelUp = () => {
    if (dpRemaining < 0) {
      alert("You are spending more DP than available.");
      return;
    }

    const ok = window.confirm("Apply level up now? This updates stats, rank upgrades, level, and talent points.");
    if (!ok) return;

    updateSheet((prev) => {
      const categorySteps = new Map<string, number>();
      const skillSteps = new Map<string, number>();

      dpSpendEntries.forEach((entry) => {
        if (!entry.itemKey) return;
        const step = Math.max(0, entry.upgradeStep ?? 1);
        if (entry.kind === "categoryUpgrade" && entry.itemKey.startsWith("cat:")) {
          const id = entry.itemKey.slice(4);
          categorySteps.set(id, Math.max(categorySteps.get(id) ?? 0, step));
        }
        if (entry.kind === "skillUpgrade" && entry.itemKey.startsWith("skill:")) {
          const id = entry.itemKey.slice(6);
          skillSteps.set(id, Math.max(skillSteps.get(id) ?? 0, step));
        }
      });

      const nextStats = { ...prev.stats };
      STAT_NAMES.forEach((stat) => {
        nextStats[stat] = {
          ...nextStats[stat],
          temp: levelUpPreview[stat].temp,
          potential: levelUpPreview[stat].potential,
        };
      });

      const nextCategories = prev.skillCategories.map((cat) => {
        const upgrades = categorySteps.get(cat.id) ?? 0;
        if (upgrades <= 0) return cat;
        return {
          ...cat,
          ranks: cat.ranks + upgrades * Math.max(1, cat.newRanks),
        };
      });

      const nextSkills = prev.skills.map((skill) => {
        const upgrades = skillSteps.get(skill.id) ?? 0;
        if (upgrades <= 0) return skill;
        return {
          ...skill,
          ranks: skill.ranks + upgrades * Math.max(1, skill.newRanks),
        };
      });

      return {
        ...prev,
        stats: nextStats,
        skillCategories: nextCategories,
        skills: nextSkills,
        details: {
          ...prev.details,
          level: prev.details.level + 1,
          talentPoints: prev.details.talentPoints + 2,
        },
      };
    });

    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    setActiveTab("details");
  };

  const moveTab = (offset: -1 | 1) => {
    if (activeTab === "levelUp") return;
    const nextIndex = activeTabIndex + offset;
    if (nextIndex < 0 || nextIndex >= TAB_OPTIONS.length) return;
    transitionDir.current = offset > 0 ? "left" : "right";
    setTransitionKey((k) => k + 1);
    setActiveTab(TAB_OPTIONS[nextIndex].value);
  };

  const isSwipeBlocked = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest("[data-no-tab-swipe='true']"));
  };

  const handleTabSwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isSwipeBlocked(event.target)) return;
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTabSwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || isSwipeBlocked(event.target)) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    if (elapsed > 900) return;
    if (Math.abs(deltaX) < 65) return;
    if (Math.abs(deltaY) > 120) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0) moveTab(1);
    if (deltaX > 0) moveTab(-1);
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.details.characterName || "rolemaster-character"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = migrateSheet(JSON.parse(String(reader.result)));
        setSheet(parsed);  // replaces active character's sheet
      } catch {
        alert("Could not load file. JSON is being dramatic.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-gradient-to-b from-pink-50 via-white to-fuchsia-50 p-3 pb-24 md:p-6 md:pb-6"
      onTouchStart={handleTabSwipeStart}
      onTouchEnd={handleTabSwipeEnd}
      onTouchCancel={() => { touchStartRef.current = null; }}
    >
      <style>{`
        @keyframes rmSlideLeft { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes rmSlideRight { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes rmFade { from { opacity: 0; } to { opacity: 1; } }
        .rm-slide-left { animation: rmSlideLeft 0.18s ease-out both; }
        .rm-slide-right { animation: rmSlideRight 0.18s ease-out both; }
        .rm-fade { animation: rmFade 0.18s ease-out both; }
      `}</style>
      <div className="mx-auto min-w-0 max-w-7xl space-y-4">
        <div className="hidden space-y-2 md:block">
          <div className="px-1 text-sm font-semibold tracking-wide text-slate-500">Rolemaster Character Sheet Engine</div>
          <div className="overflow-x-auto pb-1" data-no-tab-swipe="true">
            <div className="flex min-w-max items-end gap-1">
            {characters.map((c, idx) => {
              const name = c.sheet.details.characterName || `Character ${idx + 1}`;
              const isActive = c.id === activeCharacter.id;
              return (
                <div key={c.id} data-char-id={c.id} className={`flex max-w-[220px] items-center gap-2 rounded-t-2xl border border-b-0 px-3 py-2 text-sm shadow-sm transition-colors ${
                  isActive ? "bg-white text-slate-900" : "bg-white/60 text-slate-600 hover:bg-white/80"
                }`}>
                  <button className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => switchCharacter(c.id)}>{name}</button>
                  {characters.length > 1 && (
                    <button className="opacity-50 hover:opacity-100" onClick={() => confirmRemoveCharacter(c.id, name)} title="Remove character">×</button>
                  )}
                </div>
              );
            })}
            <button type="button" className="flex h-10 items-center rounded-t-2xl border border-b-0 bg-white/60 px-4 text-sm text-slate-600 shadow-sm hover:bg-white/80" onClick={addCharacter}><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="front" value={activeTab} onValueChange={(next) => { transitionDir.current = "fade"; setTransitionKey((k) => k + 1); setActiveTab(next as ActiveView); }} className="min-w-0 space-y-4">
          <TabsList id="section-tabs-strip" className="flex h-auto w-full min-w-0 gap-2 overflow-x-auto rounded-3xl bg-white/80 p-2 shadow-sm" data-no-tab-swipe="true">
            {TAB_OPTIONS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} data-tab-value={tab.value} className="whitespace-nowrap rounded-2xl">{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          <div
            key={transitionKey}
            style={{ overflow: "hidden" }}
            className={transitionDir.current === "left" ? "rm-slide-left" : transitionDir.current === "right" ? "rm-slide-right" : "rm-fade"}
          >
          <TabsContent value="front">
            <div className="grid gap-4 xl:grid-cols-[280px_1fr_1fr]">
              {/* Left sidebar: overview + pools */}
              <div className="flex flex-col gap-4">
                <Card className="rounded-3xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{sheet.details.characterName || "Unnamed hero"}</CardTitle>
                    <div className="text-sm text-slate-500">Level {sheet.details.level} · {sheet.details.race} / {sheet.details.profession}</div>
                    <div className="text-xs text-slate-400">{sheet.details.realmOfPower.join(", ") || "—"}</div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm pt-0">
                    <div className="flex justify-between"><span className="text-slate-500">Dev Points</span><span className="font-medium">{developmentPoints}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Talent / Drive / Heroic</span><span className="font-medium">{sheet.details.talentPoints} / {sheet.details.drivePoints} / {sheet.details.heroicPath}</span></div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Pools</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm pt-0">
                    <div className="flex items-center justify-between"><span>Hits</span><Badge>{currentHitsPool} / {totalHits}</Badge></div>
                    <div className="flex items-center justify-between"><span>PP</span><Badge>{currentPPPool} / {totalPP}</Badge></div>
                    <div className="flex items-center justify-between"><span>EP</span><Badge>{currentEPPool} / {totalEP}</Badge></div>
                    <Separator />
                    <div className="flex items-center justify-between"><span>Total Normal DB</span><Badge>{totalNormalDB}</Badge></div>
                    <div className="flex items-center justify-between"><span>Quickness ×3</span><Badge>{armorQuicknessBonus}</Badge></div>
                  </CardContent>
                </Card>
              </div>

              {/* Middle: skills */}
              <SectionCard title="Commonly Used Skills">
                {commonlyUsedSkills.length === 0
                  ? <div className="text-sm text-slate-500">No favorite skills yet.</div>
                  : <div className="overflow-y-auto md:max-h-[calc(100vh-340px)]">
                      <div className="space-y-2 md:hidden">
                        {commonlyUsedSkills.map((skill) => (
                          <div key={skill.id} className="rounded-2xl border p-3 text-sm">
                            <div className="font-medium">{skill.name}</div>
                            {skill.category && <div className="text-xs text-slate-400">{skill.category.name}</div>}
                            <div className="mt-2 flex items-center justify-between text-slate-600">
                              <span>Ranks {skill.ranks}</span>
                              <span className="font-semibold text-slate-900">{skill.total >= 0 ? "+" : ""}{skill.total}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <table className="hidden w-full text-sm md:table">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b text-left text-slate-500">
                            <th className="pb-2 font-normal">Skill</th>
                            <th className="pb-2 font-normal text-right pr-4">Ranks</th>
                            <th className="pb-2 font-normal text-right">Bonus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commonlyUsedSkills.map((skill) => (
                            <tr key={skill.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-4">
                                <div className="font-medium">{skill.name}</div>
                                {skill.category && <div className="text-xs text-slate-400">{skill.category.name}</div>}
                              </td>
                              <td className="py-1.5 text-right pr-4 tabular-nums">{skill.ranks}</td>
                              <td className="py-1.5 text-right tabular-nums font-semibold">{skill.total >= 0 ? "+" : ""}{skill.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </SectionCard>

              {/* Right: attacks */}
              <SectionCard title="Commonly Used Attacks">
                {commonlyUsedAttacks.length === 0
                  ? <div className="text-sm text-slate-500">No favorite attacks yet.</div>
                  : <div className="overflow-y-auto md:max-h-[calc(100vh-340px)]">
                      <div className="space-y-2 md:hidden">
                        {commonlyUsedAttacks.map((skill) => (
                          <div key={skill.id} className="rounded-2xl border p-3 text-sm">
                            <div className="font-medium">{skill.name}</div>
                            {skill.category && <div className="text-xs text-slate-400">{skill.category.name}</div>}
                            <div className="mt-2 grid gap-1 text-sm text-slate-600">
                              <div className="flex items-center justify-between"><span>Ranks</span><span>{skill.ranks}</span></div>
                              <div className="flex items-center justify-between"><span>Bonus</span><span className="font-semibold text-slate-900">{skill.total >= 0 ? "+" : ""}{skill.total}</span></div>
                              <div className="flex items-center justify-between"><span>Fumble</span><span>{skill.fumble || "—"}</span></div>
                              <div className="flex items-center justify-between"><span>Range</span><span>{skill.rangeModifications || "—"}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <table className="hidden w-full text-sm md:table">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b text-left text-slate-500">
                            <th className="pb-2 font-normal">Attack</th>
                            <th className="pb-2 font-normal text-right pr-4">Ranks</th>
                            <th className="pb-2 font-normal text-right pr-4">Bonus</th>
                            <th className="pb-2 font-normal text-right pr-4">Fumble</th>
                            <th className="pb-2 font-normal text-right">Range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commonlyUsedAttacks.map((skill) => (
                            <tr key={skill.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-4">
                                <div className="font-medium">{skill.name}</div>
                                {skill.category && <div className="text-xs text-slate-400">{skill.category.name}</div>}
                              </td>
                              <td className="py-1.5 text-right pr-4 tabular-nums">{skill.ranks}</td>
                              <td className="py-1.5 text-right pr-4 tabular-nums font-semibold">{skill.total >= 0 ? "+" : ""}{skill.total}</td>
                              <td className="py-1.5 text-right pr-4">{skill.fumble || "—"}</td>
                              <td className="py-1.5 text-right">{skill.rangeModifications || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Character Details">                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm">Character Name</label>
                    <Input value={sheet.details.characterName} onChange={(e) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, characterName: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Level</label>
                    <div className="flex gap-2">
                      <NumberInput value={sheet.details.level} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, level: clampNumber(v, 1) } }))} min={1} />
                      <Button type="button" variant="outline" className="h-8 rounded-2xl px-3 text-sm" onClick={openLevelUpHelper}>Level Up</Button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Race</label>
                    <Select value={sheet.details.race} onValueChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, race: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[...RACES].sort((a, b) => a.name.localeCompare(b.name)).map((race) => <SelectItem key={race.name} value={race.name}>{race.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Culture</label>
                    <Input value={sheet.details.culture} onChange={(e) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, culture: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Profession</label>
                    <Select value={sheet.details.profession} onValueChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, profession: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[...PROFESSIONS].sort((a, b) => a.name.localeCompare(b.name)).map((profession) => <SelectItem key={profession.name} value={profession.name}>{profession.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Realm of Power</label>
                    <Input value={sheet.details.realmOfPower.join(", ")} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Development Points</label>
                    <Input value={developmentPoints} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Talent Points</label>
                    <NumberInput value={sheet.details.talentPoints} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, talentPoints: clampNumber(v) } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Drive Points</label>
                    <div className="flex gap-2">
                      <NumberInput value={sheet.details.drivePoints} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, drivePoints: clampNumber(v) } }))} />
                      <Button type="button" variant="outline" disabled={sheet.details.drivePoints <= 0} onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, drivePoints: Math.max(0, prev.details.drivePoints - 1), heroicPath: prev.details.heroicPath + 1 } }))}>Use</Button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Heroic Path</label>
                    <NumberInput value={sheet.details.heroicPath} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, heroicPath: clampNumber(v) } }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Training Packages</label>
                    <div className="flex gap-2">
                      <Input value={trainingPackageInput} onChange={(e) => setTrainingPackageInput(e.target.value)} placeholder="Add a package" />
                      <Button type="button" variant="outline" onClick={() => {
                        const trimmed = trainingPackageInput.trim();
                        if (!trimmed) return;
                        updateSheet((prev) => ({ ...prev, details: { ...prev.details, trainingPackages: [...prev.details.trainingPackages, trimmed] } }));
                        setTrainingPackageInput("");
                      }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sheet.details.trainingPackages.map((pkg, i) => (
                        <Badge key={`${pkg}_${i}`} className="rounded-2xl px-3 py-1">{pkg} <button className="ml-2" onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, trainingPackages: prev.details.trainingPackages.filter((_, idx) => idx !== i) } }))}>×</button></Badge>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Talents</label>
                    <div className="flex gap-2">
                      <Input value={talentInput} onChange={(e) => setTalentInput(e.target.value)} placeholder="Add a talent" />
                      <Button type="button" variant="outline" onClick={() => {
                        const trimmed = talentInput.trim();
                        if (!trimmed) return;
                        updateSheet((prev) => ({ ...prev, details: { ...prev.details, talents: [...prev.details.talents, trimmed] } }));
                        setTalentInput("");
                      }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sheet.details.talents.map((t, i) => (
                        <Badge key={`${t}_${i}`} className="rounded-2xl px-3 py-1">{t} <button className="ml-2" onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, talents: prev.details.talents.filter((_, idx) => idx !== i) } }))}>×</button></Badge>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Flaws</label>
                    <div className="flex gap-2">
                      <Input value={flawInput} onChange={(e) => setFlawInput(e.target.value)} placeholder="Add a flaw" />
                      <Button type="button" variant="outline" onClick={() => {
                        const trimmed = flawInput.trim();
                        if (!trimmed) return;
                        updateSheet((prev) => ({ ...prev, details: { ...prev.details, flaws: [...prev.details.flaws, trimmed] } }));
                        setFlawInput("");
                      }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sheet.details.flaws.map((f, i) => (
                        <Badge key={`${f}_${i}`} className="rounded-2xl px-3 py-1">{f} <button className="ml-2" onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, flaws: prev.details.flaws.filter((_, idx) => idx !== i) } }))}>×</button></Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Traits + Background">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["appearance", "Appearance"], ["demeanor", "Demeanor"], ["apparentAge", "Apparent Age"], ["actualAge", "Actual Age"], ["gender", "Gender"], ["skin", "Skin"], ["height", "Height"], ["weight", "Weight"], ["hair", "Hair"], ["eyes", "Eyes"], ["personality", "Personality"], ["motivation", "Motivation"], ["alignment", "Alignment"],
                  ].map(([key, label]) => (
                    <div key={key} className={key === "personality" || key === "motivation" || key === "alignment" ? "md:col-span-2" : ""}>
                      <label className="mb-1 block text-sm">{label}</label>
                      {key === "appearance" ? (
                        <NumberInput value={sheet.traits.appearance} onChange={(v) => updateSheet((prev) => ({ ...prev, traits: { ...prev.traits, appearance: clampNumber(v) } }))} />
                      ) : (
                        <Input value={(sheet.traits as any)[key]} onChange={(e) => updateSheet((prev) => ({ ...prev, traits: { ...prev.traits, [key]: e.target.value } }))} />
                      )}
                    </div>
                  ))}
                  <Separator className="md:col-span-2" />
                  {[
                    ["nationality", "Nationality"], ["hometown", "Home town/city"], ["deity", "Deity"], ["patronLord", "Patron/lord"], ["parents", "Parents"], ["spouse", "Spouse"], ["children", "Children"], ["other", "Other"],
                  ].map(([key, label]) => (
                    <div key={key} className={key === "other" || key === "parents" || key === "children" ? "md:col-span-2" : ""}>
                      <label className="mb-1 block text-sm">{label}</label>
                      <Input value={(sheet.background as any)[key]} onChange={(e) => updateSheet((prev) => ({ ...prev, background: { ...prev.background, [key]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Race Data">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span>Soul Departure</span><Badge>{selectedRace.soulDepartureRounds} rounds</Badge></div>
                  <div className="flex items-center justify-between"><span>Recovery Multiplier</span><Badge>{selectedRace.recoveryMultiplier}</Badge></div>
                  <div><div className="mb-1 text-slate-500">Body Development</div><div>{formatProgression(selectedRace.bodyDevelopmentProgression)}</div></div>
                  <div><div className="mb-1 text-slate-500">PP Development (Channeling)</div><div>{formatProgression(selectedRace.ppDevelopmentProgressionByRealm.Channeling)}</div></div>
                  <div><div className="mb-1 text-slate-500">PP Development (Essence)</div><div>{formatProgression(selectedRace.ppDevelopmentProgressionByRealm.Essence)}</div></div>
                  <div><div className="mb-1 text-slate-500">PP Development (Mentalism)</div><div>{formatProgression(selectedRace.ppDevelopmentProgressionByRealm.Mentalism)}</div></div>
                  {selectedRace.specialNotes && selectedRace.specialNotes.length > 0 && (
                    <div><div className="mb-1 text-slate-500">Race Specials</div><div className="text-xs">{selectedRace.specialNotes.join(", ")}</div></div>
                  )}
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="levelUp" className="space-y-4" data-no-tab-swipe="true">
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <SectionCard title="Stat Increase Rolls" action={<Button type="button" variant="outline" className="rounded-2xl h-8 px-3 text-sm" onClick={closeLevelUpHelper}>Close</Button>}>
                <div className="mb-3 text-sm text-slate-500">Enter 2d10 rolls if using the assistant. You can leave these blank and commit level up using manually updated stats.</div>
                <div className="space-y-3">
                  {STAT_NAMES.map((stat) => {
                    const baseRoll = baseStatRolls[stat];
                    const preview = levelUpPreview[stat];
                    return (
                      <div key={stat} className="rounded-2xl border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">{stat}</div>
                          <Badge>{sheet.stats[stat].temp}{" -> "}{preview.temp} / {preview.potential}</Badge>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Die 1</label>
                            <NumberInput
                              value={baseRoll.die1}
                              min={0}
                              onChange={(v) => setBaseStatRolls((prev) => ({ ...prev, [stat]: { ...prev[stat], die1: v } }))}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Die 2</label>
                            <NumberInput
                              value={baseRoll.die2}
                              min={0}
                              onChange={(v) => setBaseStatRolls((prev) => ({ ...prev, [stat]: { ...prev[stat], die2: v } }))}
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{preview.logs[0]}</div>
                        {preview.logs.slice(1).map((line, idx) => (
                          <div key={`${stat}_extra_${idx}`} className="mt-1 text-xs text-slate-500">{line}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Development" action={<Badge>{dpRemaining} DP left</Badge>}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-8 rounded-2xl px-3 text-sm" onClick={addExtraStatRoll}><Plus className="mr-1 h-3 w-3" />Buy Extra Stat Roll (8 DP)</Button>
                  </div>

                  <div className="rounded-2xl border p-3 text-sm">
                    <div className="flex items-center justify-between"><span>Available DP</span><span className="font-semibold">{projectedDevelopmentPoints}</span></div>
                    <div className="mt-1 flex items-center justify-between"><span>Spent DP</span><span className="font-semibold">{dpSpent}</span></div>
                    <div className="mt-1 flex items-center justify-between"><span>Remaining DP</span><span className={`font-semibold ${dpRemaining < 0 ? "text-red-600" : ""}`}>{dpRemaining}</span></div>
                  </div>

                  <div className="space-y-2">
                    {dpSpendEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 rounded-2xl border p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="break-words font-medium">{entry.label}</div>
                          <div className="text-xs text-slate-500">Cost {entry.cost} DP</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setDpSpendEntries((prev) => prev.filter((x) => x.id !== entry.id))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {dpSpendEntries.length === 0 && <div className="text-sm text-slate-500">No assisted purchases selected yet.</div>}
                  </div>

                  <div className="space-y-2">
                    {extraStatRolls.map((roll) => (
                      <div key={roll.id} className="rounded-2xl border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-medium">Extra Stat Roll</div>
                          <div className="flex items-center gap-2">
                            <Badge>8 DP</Badge>
                            <Button variant="ghost" size="icon" onClick={() => setExtraStatRolls((prev) => prev.filter((x) => x.id !== roll.id))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Select value={roll.stat} onValueChange={(v) => setExtraStatRolls((prev) => prev.map((x) => x.id === roll.id ? { ...x, stat: v as StatName } : x))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STAT_NAMES.map((stat) => <SelectItem key={stat} value={stat}>{stat}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <NumberInput value={roll.die1} min={0} onChange={(v) => setExtraStatRolls((prev) => prev.map((x) => x.id === roll.id ? { ...x, die1: v } : x))} />
                          <NumberInput value={roll.die2} min={0} onChange={(v) => setExtraStatRolls((prev) => prev.map((x) => x.id === roll.id ? { ...x, die2: v } : x))} />
                        </div>
                      </div>
                    ))}
                    {extraStatRolls.length === 0 && <div className="text-sm text-slate-500">No extra stat rolls purchased.</div>}
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="min-w-0">
                        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Skill Categories</div>
                        <ScrollArea className="max-h-56 rounded-xl border p-2">
                          <div className="space-y-2">
                            {categorySpendSuggestions.map((cat) => (
                              <div key={cat.id} className="rounded-xl border p-2 text-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="break-words font-medium">{cat.name}</div>
                                  <div className="break-words text-xs text-slate-500">Ranks {cat.ranks} · Dev Cost {formatDevelopmentCostPath(categoryDerived.find((x) => x.id === cat.id)?.developmentCost ?? "")}</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 rounded-lg px-2 text-xs"
                                    disabled={
                                      cat.selectedUpgrades >= cat.options.length
                                      || cat.options.length === 0
                                      || isZeroProgression(cat.progression)
                                    }
                                    onClick={() => addCategoryUpgradeSpend(cat.id, cat.name, cat.ranksPerUpgrade, cat.options, cat.selectedUpgrades)}
                                  >
                                    {isZeroProgression(cat.progression)
                                      ? "No upgrades"
                                      : cat.options[cat.selectedUpgrades]
                                      ? `Upgrade (${cat.options[cat.selectedUpgrades].cost - (cat.options[cat.selectedUpgrades - 1]?.cost ?? 0)} DP)`
                                      : "Max Upgrades Reached"}
                                  </Button>
                                  {cat.selectedUpgrades > 0 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 rounded-lg px-2 text-xs"
                                      onClick={() => removeCategoryUpgradeSpend(cat.id, cat.name, cat.options, cat.selectedUpgrades)}
                                    >
                                      Undo
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Known Skills</div>
                        <ScrollArea className="max-h-56 rounded-xl border p-2">
                          <div className="space-y-2">
                            {skillSpendSuggestions.map((skill) => (
                              <div key={skill.id} className="rounded-xl border p-2 text-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="break-words font-medium">{skill.name}</div>
                                  <div className="break-words text-xs text-slate-500">{skill.categoryName} · Ranks {skill.ranks} · Dev Cost {formatDevelopmentCostPath(skillDerived.find((x) => x.id === skill.id)?.category?.developmentCost ?? "")}</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 rounded-lg px-2 text-xs"
                                    disabled={skill.selectedUpgrades >= skill.options.length || skill.options.length === 0}
                                    onClick={() => addSkillUpgradeSpend(skill.id, skill.name, skill.ranksPerUpgrade, skill.options, skill.selectedUpgrades)}
                                  >
                                    {skill.options[skill.selectedUpgrades]
                                      ? `Upgrade (${skill.options[skill.selectedUpgrades].cost - (skill.options[skill.selectedUpgrades - 1]?.cost ?? 0)} DP)`
                                      : "Max Upgrades Reached"}
                                  </Button>
                                  {skill.selectedUpgrades > 0 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 rounded-lg px-2 text-xs"
                                      onClick={() => removeSkillUpgradeSpend(skill.id, skill.name, skill.options, skill.selectedUpgrades)}
                                    >
                                      Undo
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-[1fr_220px_90px]">
                      <Input placeholder="New skill name" value={newLevelUpSkillName} onChange={(e) => setNewLevelUpSkillName(e.target.value)} />
                      <Select value={newLevelUpSkillCategoryId} onValueChange={(v) => setNewLevelUpSkillCategoryId(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[...sheet.skillCategories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={addNewSkillFromLevelUp}>Add</Button>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Training Package</div>
                      <div className="grid gap-2 lg:grid-cols-[1fr_120px_90px]">
                        <Input placeholder="Package name" value={trainingPackageSpendName} onChange={(e) => setTrainingPackageSpendName(e.target.value)} />
                        <NumberInput value={trainingPackageSpendCost} min={0} onChange={(v) => setTrainingPackageSpendCost(clampNumber(v))} />
                        <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={addTrainingPackageSpend}>Add</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Apply Level Up" action={<Button type="button" className="rounded-2xl" onClick={commitLevelUp}>Commit Level Up</Button>}>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-2xl border p-3"><div className="text-slate-500">Current Level</div><div className="text-lg font-semibold">{sheet.details.level}</div></div>
                <div className="rounded-2xl border p-3"><div className="text-slate-500">New Level</div><div className="text-lg font-semibold">{sheet.details.level + 1}</div></div>
                <div className="rounded-2xl border p-3"><div className="text-slate-500">Talent Points</div><div className="text-lg font-semibold">{sheet.details.talentPoints}{" -> "}{sheet.details.talentPoints + 2}</div></div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4">
              <SectionCard title="Stats">
                <div className="grid gap-3 md:hidden">
                  {STAT_NAMES.map((name) => (
                    <div key={name} className="rounded-2xl border p-3">
                      <button type="button" className="w-full text-left" onClick={() => setExpandedMobileStat((prev) => prev === name ? null : name)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">{name}</div>
                          {expandedMobileStat === name ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                          <div><div className="text-xs text-slate-500">Temp</div><div className="font-semibold">{sheet.stats[name].temp}</div></div>
                          <div><div className="text-xs text-slate-500">Potential</div><div className="font-semibold">{sheet.stats[name].potential}</div></div>
                          <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{statTotals[name].total}</div></div>
                        </div>
                      </button>
                      {expandedMobileStat === name && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Temp</label>
                            <NumberInput value={sheet.stats[name].temp} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], temp: clampNumber(v) } } }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Potential</label>
                            <NumberInput value={sheet.stats[name].potential} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], potential: clampNumber(v) } } }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special</label>
                            <NumberInput value={sheet.stats[name].specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], specialBonus: v } } }))} />
                          </div>
                          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                            <div><div className="text-xs text-slate-500">Basic</div><div className="font-semibold">{statTotals[name].basic}</div></div>
                            <div><div className="text-xs text-slate-500">Racial</div><div className="font-semibold">{statTotals[name].racial}</div></div>
                            <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{statTotals[name].total}</div></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2">Stat</th>
                      <th>Temp</th>
                      <th>Potential</th>
                      <th>Basic</th>
                      <th>Racial</th>
                      <th>Special</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAT_NAMES.map((name) => (
                      <tr key={name} className="border-b align-middle">
                        <td className="py-2 font-medium">{name}</td>
                        <td className="py-2"><NumberInput value={sheet.stats[name].temp} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], temp: clampNumber(v) } } }))} /></td>
                        <td><NumberInput value={sheet.stats[name].potential} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], potential: clampNumber(v) } } }))} /></td>
                        <td>{statTotals[name].basic}</td>
                        <td>{statTotals[name].racial}</td>
                        <td><NumberInput value={sheet.stats[name].specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], specialBonus: v } } }))} /></td>
                        <td className="font-semibold">{statTotals[name].total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="combat" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Armor">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["armorType", "Armor Type"], ["weightPenalty", "Weight Penalty"], ["baseMovementRate", "Base Movement Rate"], ["movingManeuverPenalty", "Moving Maneuver Penalty"], ["missilePenalty", "Missile Penalty"], ["armorQuicknessPenalty", "Armor Quickness Penalty"], ["shieldBonus", "Shield Bonus"], ["magicBonus", "Magic Bonus"], ["specialBonus", "Special"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1 block text-sm">{label}</label>
                      <NumberInput value={(sheet.armor as any)[key]} onChange={(v) => updateSheet((prev) => ({ ...prev, armor: { ...prev.armor, [key]: v } }))} />
                    </div>
                  ))}
                  <div>
                    <label className="mb-1 block text-sm">Quickness Bonus</label>
                    <Input value={armorQuicknessBonus} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Total Normal DB</label>
                    <Input value={totalNormalDB} readOnly />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Resistance Rolls">
                <div className="space-y-3">
                  {(["Channeling", "Essence", "Mentalism", "Poison", "Disease", "Fear"] as ResistanceName[]).map((rr) => (
                    <div key={rr} className="grid items-center gap-2 rounded-2xl border p-3 md:grid-cols-4">
                      <div className="font-medium">{rr}</div>
                      <div>Race: {resistanceRolls[rr].raceBonus}</div>
                      <div>Stat: {resistanceRolls[rr].statBonus}</div>
                      <div className="font-semibold">Total: {resistanceRolls[rr].raceBonus + resistanceRolls[rr].statBonus}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Movement Rates" action={<Badge>{sheet.armor.baseMovementRate} base</Badge>}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Pace</th>
                        <th>Multiplier</th>
                        <th>Movement Rate</th>
                        <th>Exhaustion</th>
                        <th>Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Walk", 1, "1/60 per round", "None"],
                        ["Fast Walk", 1.5, "1/30 per round", "None"],
                        ["Run", 2, "1/12 per round", "None"],
                        ["Sprint", 3, "2 per round", "Easy"],
                        ["Fast Sprint", 4, "6 per round", "Light"],
                        ["Dash", 5, "50 per round", "Medium"],
                      ].map(([pace, multiplier, exhaustion, difficulty]) => (
                        <tr key={String(pace)} className="border-b">
                          <td className="py-2 font-medium">{pace}</td>
                          <td>x{multiplier}</td>
                          <td>{Math.round(sheet.armor.baseMovementRate * Number(multiplier))}</td>
                          <td>{String(exhaustion)}</td>
                          <td>{String(difficulty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4">
              <SectionCard title="Skill Categories">
                <div className="space-y-3 md:hidden">
                  {categoryDerived.map((cat) => (
                    <div key={cat.id} className="rounded-2xl border p-3">
                      <button type="button" className="w-full text-left" onClick={() => setExpandedMobileCategoryId((prev) => prev === cat.id ? null : cat.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{cat.name}</div>
                            <div className="text-xs text-slate-500">{cat.applicableStatsDisplay}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="rounded-md px-2 py-0 text-[11px]">{formatProgressionType(cat.progressionType)}</Badge>
                            {expandedMobileCategoryId === cat.id ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                          <div><div className="text-xs text-slate-500">Stats</div><div className="font-semibold">{cat.applicableStatsDisplay}</div></div>
                          <div><div className="text-xs text-slate-500">Dev</div><div className="font-semibold">{cat.developmentCost || "—"}</div></div>
                          <div><div className="text-xs text-slate-500">Ranks</div><div className="font-semibold">{canEditCategoryNewRanks(cat.progressionType) ? cat.ranks : "—"}</div></div>
                          <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{cat.total}</div></div>
                        </div>
                      </button>
                      {expandedMobileCategoryId === cat.id && (
                      <div className="mt-3 grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Dev Cost</label>
                            <Input value={cat.developmentCost} className="h-10" placeholder="2/5" onChange={(e) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, developmentCost: e.target.value } : c) }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Profession</label>
                            <NumberInput value={cat.professionBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, professionBonus: v } : c) }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special</label>
                            <NumberInput value={cat.specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, specialBonus: v } : c) }))} />
                          </div>
                          {canEditCategoryNewRanks(cat.progressionType) ? (
                            <div>
                              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Ranks</label>
                              <NumberInput value={cat.ranks} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, ranks: clampNumber(v) } : c) }))} />
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Ranks are fixed by progression type.</div>
                          )}
                        </div>
                        {canEditCategoryNewRanks(cat.progressionType) && (
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">New Ranks</label>
                            <RankCheckboxes value={cat.newRanks} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, newRanks: v } : c) }))} />
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                          <div><div className="text-xs text-slate-500">Rank</div><div className="font-semibold">{cat.rank}</div></div>
                          <div><div className="text-xs text-slate-500">Stat</div><div className="font-semibold">{cat.stat}</div></div>
                          <div><div className="text-xs text-slate-500">Prof</div><div className="font-semibold">{cat.professionBonus}</div></div>
                          <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{cat.total}</div></div>
                        </div>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
                <ScrollArea className="hidden rounded-2xl border md:block md:h-[calc(100vh-360px)]">
                <div className="min-w-[1050px] p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-2">Category</th>
                        <th className="px-2">Applicable Stats</th>
                        <th className="px-2">Dev Cost</th>
                        <th className="px-2"># Ranks</th>
                        <th className="px-2">New Ranks</th>
                        <th className="px-2">Type</th>
                        <th className="px-2">Rank</th>
                        <th className="px-2">Stat</th>
                        <th className="px-2">Profession</th>
                        <th className="px-2">Special</th>
                        <th className="px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryDerived.map((cat) => (
                        <tr key={cat.id} className="border-b align-middle">
                          <td className="py-2 px-2 font-medium">{cat.name}<div className="mt-1 text-xs text-slate-500">{formatProgression(cat.progression)}</div></td>
                          <td className="px-2 text-xs font-mono">{cat.applicableStatsDisplay}</td>
                          <td className="px-2"><Input value={cat.developmentCost} className="w-16 h-8" placeholder="2/5" onChange={(e) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, developmentCost: e.target.value } : c) }))} /></td>
                          <td className="px-2">
                            {canEditCategoryNewRanks(cat.progressionType) ? (
                              <NumberInput value={cat.ranks} className="w-14" onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, ranks: clampNumber(v) } : c) }))} />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2">
                            {canEditCategoryNewRanks(cat.progressionType) ? (
                              <RankCheckboxes value={cat.newRanks} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, newRanks: v } : c) }))} />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2"><Badge className="rounded-md px-2 py-0 text-[11px]">{formatProgressionType(cat.progressionType)}</Badge></td>
                          <td className="px-2">{cat.rank}</td>
                          <td className="px-2">{cat.stat}</td>
                          <td className="px-2"><NumberInput value={cat.professionBonus} className="w-14" onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, professionBonus: v } : c) }))} /></td>
                          <td className="px-2"><NumberInput value={cat.specialBonus} className="w-14" onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, specialBonus: v } : c) }))} /></td>
                          <td className="px-2 font-semibold">{cat.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            <div className="grid gap-4">
              <SectionCard title="Skills" action={<Button variant="outline" className="rounded-2xl h-8 px-3 text-sm" onClick={() => {
                const newSkill = { id: uid("skill"), name: "", categoryId: sheet.skillCategories[0]?.id ?? "", ranks: 0, newRanks: 1, itemBonus: 0, specialBonus: 0, favorite: false, fumble: "", rangeModifications: "" };
                updateSheet((prev) => ({ ...prev, skills: [...prev.skills, newSkill] }));
                setExpandedMobileSkillId(newSkill.id);
              }}><Plus className="mr-1 h-3 w-3" />Add Skill</Button>}>
                <div className="space-y-3 md:hidden">
                  {skillDerived.map((skill, idx) => (
                    <div key={skill.id} className="rounded-2xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setExpandedMobileSkillId((prev) => prev === skill.id ? null : skill.id)}
                        >
                          <div className="font-medium">{skill.name || `Skill ${idx + 1}`}</div>
                          <div className="mt-1 text-xs text-slate-500">{skill.category?.name || "No category"}</div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>Ranks {skill.ranks}</span>
                            <span>Bonus {skill.total >= 0 ? "+" : ""}{skill.total}</span>
                            {isWeaponCategory(skill.category?.name ?? "") && <span>Fumble {skill.fumble || "—"}</span>}
                          </div>
                        </button>
                        <button type="button" className="rounded-full p-1" onClick={() => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, favorite: !s.favorite } : s) }))}>
                          <Star className={`h-5 w-5 ${skill.favorite ? "fill-current text-yellow-500" : "text-slate-300"}`} />
                        </button>
                      </div>
                      {expandedMobileSkillId === skill.id && (
                        <>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Skill Name</label>
                          <Input value={skill.name} placeholder="Skill name" onChange={(e) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, name: e.target.value } : s) }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category</label>
                          <Select value={skill.categoryId} onValueChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, categoryId: v } : s) }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[...sheet.skillCategories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Ranks</label>
                          <NumberInput value={skill.ranks} onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, ranks: clampNumber(v) } : s) }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Item Bonus</label>
                          <NumberInput value={skill.itemBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, itemBonus: v } : s) }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special Bonus</label>
                          <NumberInput value={skill.specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, specialBonus: v } : s) }))} />
                        </div>
                      </div>
                      {isWeaponCategory(skill.category?.name ?? "") && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Fumble</label>
                            <Input value={skill.fumble} onChange={(e) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, fumble: e.target.value } : s) }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Range Mods</label>
                            <Input value={skill.rangeModifications} onChange={(e) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, rangeModifications: e.target.value } : s) }))} />
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">New Ranks</label>
                          <RankCheckboxes value={skill.newRanks} onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, newRanks: v } : s) }))} />
                        </div>
                        <div className="ml-auto grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                          <div><div className="text-xs text-slate-500">Rank</div><div className="font-semibold">{skill.rank}</div></div>
                          <div><div className="text-xs text-slate-500">Category</div><div className="font-semibold">{skill.categoryTotal}</div></div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-2xl px-3 text-sm"
                          disabled={idx === 0}
                          onClick={() => updateSheet((prev) => {
                            const next = [...prev.skills];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return { ...prev, skills: next };
                          })}
                        ><ChevronUp className="mr-1 h-4 w-4" />Up</Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-2xl px-3 text-sm"
                          disabled={idx === skillDerived.length - 1}
                          onClick={() => updateSheet((prev) => {
                            const next = [...prev.skills];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            return { ...prev, skills: next };
                          })}
                        ><ChevronDown className="mr-1 h-4 w-4" />Down</Button>
                        <Button type="button" variant="ghost" className="ml-auto h-9 rounded-2xl px-3 text-sm text-red-600" onClick={() => {
                          setExpandedMobileSkillId((prev) => prev === skill.id ? null : prev);
                          updateSheet((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== skill.id) }));
                        }}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
                      </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <ScrollArea className="hidden rounded-2xl border md:block md:h-[calc(100vh-360px)]">
                <div className="min-w-[1100px] p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-2"></th>
                        <th className="py-2 px-2">Fav</th>
                        <th className="px-2">Skill</th>
                        <th className="px-2">Category</th>
                        <th className="px-2"># Ranks</th>
                        <th className="px-2">New Ranks</th>
                        <th className="px-2">Rank</th>
                        <th className="px-2">Category</th>
                        <th className="px-2">Item</th>
                        <th className="px-2">Special</th>
                        <th className="px-2">Total</th>
                        <th className="px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillDerived.map((skill, idx) => (
                        <tr
                          key={skill.id}
                          className={`border-b align-middle${draggedSkillIndex === idx ? " opacity-50" : ""}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedSkillIndex === null || draggedSkillIndex === idx) return;
                            updateSheet((prev) => {
                              const next = [...prev.skills];
                              const [removed] = next.splice(draggedSkillIndex, 1);
                              next.splice(idx, 0, removed);
                              return { ...prev, skills: next };
                            });
                            setDraggedSkillIndex(null);
                          }}
                          onDragEnd={() => setDraggedSkillIndex(null)}
                        >
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              draggable
                              className="cursor-grab text-slate-400 hover:text-slate-700"
                              title="Drag to reorder"
                              onDragStart={() => setDraggedSkillIndex(idx)}
                              onDragEnd={() => setDraggedSkillIndex(null)}
                            >
                              ::
                            </button>
                          </td>
                          <td className="py-2 px-2"><button onClick={() => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, favorite: !s.favorite } : s) }))}><Star className={`h-4 w-4 ${skill.favorite ? "fill-current text-yellow-500" : "text-slate-300"}`} /></button></td>
                          <td className="px-2">
                            <Input value={skill.name} onChange={(e) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, name: e.target.value } : s) }))} />
                            {isWeaponCategory(skill.category?.name ?? "") && (
                              <div className="mt-1 flex gap-1">
                                <Input className="h-6 text-xs px-1" placeholder="Fumble" value={skill.fumble} onChange={(e) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, fumble: e.target.value } : s) }))} />
                                <Input className="h-6 text-xs px-1" placeholder="Range mods" value={skill.rangeModifications} onChange={(e) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, rangeModifications: e.target.value } : s) }))} />
                              </div>
                            )}
                          </td>
                          <td className="px-2">
                            <Select value={skill.categoryId} onValueChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, categoryId: v } : s) }))}>
                              <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[...sheet.skillCategories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2"><NumberInput value={skill.ranks} className="w-20" onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, ranks: clampNumber(v) } : s) }))} /></td>
                          <td className="px-2"><RankCheckboxes value={skill.newRanks} onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, newRanks: v } : s) }))} /></td>
                          <td className="px-2">{skill.rank}</td>
                          <td className="px-2">{skill.categoryTotal}</td>
                          <td className="px-2"><NumberInput value={skill.itemBonus} className="w-20" onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, itemBonus: v } : s) }))} /></td>
                          <td className="px-2"><NumberInput value={skill.specialBonus} className="w-20" onChange={(v) => updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, specialBonus: v } : s) }))} /></td>
                          <td className="px-2 font-semibold">{skill.total}</td>
                          <td className="px-2"><Button variant="ghost" size="icon" onClick={() => updateSheet((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== skill.id) }))}><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="gear" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Equipment and Gear" action={<Button variant="outline" className="rounded-2xl h-8 px-3 text-sm" onClick={() => updateSheet((prev) => ({ ...prev, equipment: [...prev.equipment, { id: uid("gear"), name: "", description: "", location: "", weight: 0 }] }))}><Plus className="mr-1 h-3 w-3" />Add Item</Button>}>
                <div className="space-y-3">
                  {sheet.equipment.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl border p-3 md:grid-cols-[1fr_2fr_1fr_120px_48px]">
                      <Input placeholder="Item name" value={item.name} onChange={(e) => updateSheet((prev) => ({ ...prev, equipment: prev.equipment.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x) }))} />
                      <Input placeholder="Description" value={item.description} onChange={(e) => updateSheet((prev) => ({ ...prev, equipment: prev.equipment.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x) }))} />
                      <Input placeholder="Location" value={item.location} onChange={(e) => updateSheet((prev) => ({ ...prev, equipment: prev.equipment.map((x) => x.id === item.id ? { ...x, location: e.target.value } : x) }))} />
                      <NumberInput value={item.weight} onChange={(v) => updateSheet((prev) => ({ ...prev, equipment: prev.equipment.map((x) => x.id === item.id ? { ...x, weight: v } : x) }))} />
                      <Button variant="ghost" size="icon" onClick={() => updateSheet((prev) => ({ ...prev, equipment: prev.equipment.filter((x) => x.id !== item.id) }))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Coins and Wealth">
                <div className="grid gap-3 md:grid-cols-2">
                  {(["mithril", "platinum", "gold", "silver", "bronze", "copper", "tin", "iron"] as const).map((coin) => (
                    <div key={coin}>
                      <label className="mb-1 block text-sm capitalize">{coin}</label>
                      <NumberInput value={sheet.wealth[coin]} onChange={(v) => updateSheet((prev) => ({ ...prev, wealth: { ...prev.wealth, [coin]: clampNumber(v) } }))} />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Gems</label>
                    <Textarea value={sheet.wealth.gems} onChange={(e) => updateSheet((prev) => ({ ...prev, wealth: { ...prev.wealth, gems: e.target.value } }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Jewelry</label>
                    <Textarea value={sheet.wealth.jewelry} onChange={(e) => updateSheet((prev) => ({ ...prev, wealth: { ...prev.wealth, jewelry: e.target.value } }))} />
                  </div>
                  <div className="md:col-span-2 rounded-2xl border p-3 text-sm">
                    Total base value (in iron units): <span className="font-semibold">{currencyValue(sheet.wealth)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <div className="grid gap-4">
              <SectionCard title="Backup and Transfer">
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Use JSON export/import to move characters between devices or keep manual backups outside this browser.</p>
                  <Button variant="outline" className="h-10 w-full rounded-2xl" onClick={saveFile}><Download className="mr-2 h-4 w-4" />Export JSON</Button>
                  <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-2xl border px-4 py-2 text-sm shadow-sm">
                    <Upload className="mr-2 h-4 w-4" />Import JSON
                    <input type="file" accept="application/json" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
                  </label>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-1">
            <div className="grid gap-3 xl:grid-cols-3">
              <SectionCard title="Health">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Concussion Hits</label>
                    <Input value={totalHits} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Current Hits Taken</label>
                    <NumberInput value={sheet.health.currentHits} onChange={(v) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, currentHits: clampNumber(v) } }))} />
                  </div>
                  <div className="rounded-2xl border p-3 text-sm">
                    Penalty: {healthPenalty(healthPercent) === -999 ? "Unconscious" : healthPenalty(healthPercent)}
                  </div>
                  {(["stunned", "stunNoParry", "downAndOut", "bleedPerRound"] as const).map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-sm">{key === "stunNoParry" ? "Stun no parry" : key === "downAndOut" ? "Down & Out" : key === "bleedPerRound" ? "Bleed/round" : "Stunned"}</label>
                      <Input value={sheet.health[key]} onChange={(e) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, [key]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Magic">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Power Points</label>
                    <Input value={totalPP} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Current PP Used</label>
                    <NumberInput value={sheet.magic.currentPP} onChange={(v) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, currentPP: clampNumber(v) } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Spell Adder</label>
                    <NumberInput value={sheet.magic.spellAdder} onChange={(v) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, spellAdder: v } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Spell Multiplier</label>
                    <NumberInput value={sheet.magic.spellMultiplier} onChange={(v) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, spellMultiplier: clampNumber(v, 1) } }))} min={1} />
                  </div>
                  <div className="rounded-2xl border p-3 text-sm">Magic penalty: {magicPenalty(magicPercent)}</div>
                </div>
              </SectionCard>

              <SectionCard title="Exhaustion">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Exhaustion Points</label>
                    <Input value={totalEP} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Race Bonus</label>
                    <Input value={raceExhaustionBonus} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Current EP Used</label>
                    <NumberInput value={sheet.exhaustion.currentEP} onChange={(v) => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, currentEP: clampNumber(v) } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Special Bonus</label>
                    <NumberInput value={sheet.exhaustion.specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, specialBonus: v } }))} />
                  </div>
                  <div className="rounded-2xl border p-3 text-sm">Exhaustion penalty: {exhaustionPenalty(exhaustionPercent)}</div>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Injuries" action={<Button variant="outline" className="rounded-2xl" onClick={() => updateSheet((prev) => ({ ...prev, injuries: [...prev.injuries, { id: uid("inj"), text: "" }] }))}><Plus className="mr-2 h-4 w-4" />Add Injury</Button>}>
              <div className="space-y-2">
                {sheet.injuries.map((injury) => (
                  <div key={injury.id} className="grid gap-2 rounded-2xl border p-3 md:grid-cols-[1fr_48px]">
                    <Input value={injury.text} onChange={(e) => updateSheet((prev) => ({ ...prev, injuries: prev.injuries.map((i) => i.id === injury.id ? { ...i, text: e.target.value } : i) }))} placeholder="Write injury details" />
                    <Button variant="ghost" size="icon" onClick={() => updateSheet((prev) => ({ ...prev, injuries: prev.injuries.filter((i) => i.id !== injury.id) }))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {sheet.injuries.length === 0 && <div className="text-sm text-slate-500">No injuries recorded.</div>}
              </div>
            </SectionCard>
          </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-2 backdrop-blur md:hidden" data-no-tab-swipe="true">
        <div ref={mobileCharacterTabsRef} className="overflow-x-auto">
          <div className="flex min-w-max items-end gap-1">
            {characters.map((c, idx) => {
              const name = c.sheet.details.characterName || `Character ${idx + 1}`;
              const isActive = c.id === activeCharacter.id;
              return (
                <div key={c.id} data-char-id={c.id} className={`flex max-w-[200px] items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2 text-sm shadow-sm transition-colors ${
                  isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700"
                }`}>
                  <button className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => switchCharacter(c.id)}>{name}</button>
                  {characters.length > 1 && (
                    <button className="opacity-70" onClick={() => confirmRemoveCharacter(c.id, name)} title="Remove character">×</button>
                  )}
                </div>
              );
            })}
            <button type="button" className="flex h-10 items-center rounded-t-xl border border-b-0 bg-white px-4 text-sm text-slate-700 shadow-sm" onClick={addCharacter}><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
