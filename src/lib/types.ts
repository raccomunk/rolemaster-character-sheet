// Shared domain types and constants for the Rolemaster character sheet.
// Extracted here so lib modules can use them without importing from App.tsx.

export const STAT_NAMES = [
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

export type StatName = (typeof STAT_NAMES)[number];

export type Realm = "Mentalism" | "Essence" | "Channeling" | "Arms";
export type MagicalRealm = Exclude<Realm, "Arms">;

export type SpellListType = "Open" | "Closed" | "Base" | "Training Package";
export type SpellSpecialCode = "*" | "•" | "‡";
export type SpellTypeCode = "E" | "BE" | "DE" | "F" | "P" | "U" | "I";
export type SpellSubtypeCode = "s" | "m";

export type SpellListSpell = {
  id: string;
  level: number;
  name: string;
  requiredRanks: number;
  specialCodes: SpellSpecialCode[];
  typeCode?: SpellTypeCode;
  subtypeCodes: SpellSubtypeCode[];
  areaOfEffect: string;
  duration: string;
  range: string;
  description: string;
};

export type SpellListCatalogEntry = {
  id: string;
  name: string;
  realm: MagicalRealm;
  type: SpellListType;
  baseProfessions?: string[];
  spells: SpellListSpell[];
};

export type CharacterSpellListProgress = {
  id: string;
  listId: string;
  listName: string;
  realm: MagicalRealm;
  type: SpellListType;
  ranks: number;
  itemBonus: number;
  specialBonus: number;
  favorite: boolean;
  notes: string;
};

export type ProgressionType =
  | "standard"
  | "bodyDevelopment"
  | "powerPointDevelopment"
  | "combined"
  | "limited"
  | "special";

export type RankProgression = [number, number, number, number, number];

export type StatBlock = {
  temp: number;
  potential: number;
  racialBonus: number;
  specialBonus: number;
};

export type SkillCategory = {
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

export type Skill = {
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

export type ArmorState = {
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

export type EquipmentItem = {
  id: string;
  name: string;
  description: string;
  location: string;
  weight: number;
};

export type InjuryItem = {
  id: string;
  text: string;
};

export type PackageRankChange = {
  kind: "skill" | "category";
  id: string;
  amount: number;
};

export type PackageStatChange = {
  stat: StatName;
  tempDelta: number;
  potentialDelta: number;
};

export type TrainingPackageApplication = {
  packageName: string;
  specialGains: string[];
  rankChanges: PackageRankChange[];
  statChanges: PackageStatChange[];
  skillChoices: string[];
};

export type PackageStatGainSlot = {
  id: string;
  stat: StatName;
  allowsChoice: boolean;
  choiceGroup?: "different";
};

export type PackageChoiceAllocation = {
  id: string;
  mode: "skill" | "category" | "newSkill";
  targetId: string;
  newSkillName: string;
  newSkillCategoryId: string;
  ranks: number;
};

export type CharacterSheet = {
  details: {
    characterName: string;
    level: number;
    race: string;
    culture: string;
    profession: string;
    trainingPackages: string[];
    trainingPackageApplications: TrainingPackageApplication[];
    everymanSkills: string[];
    occupationalSkills: string[];
    restrictedSkills: string[];
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
  spellLists: CharacterSpellListProgress[];
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
    spellAdder: string;
    spellMultiplier: string;
  };
  exhaustion: {
    currentEP: number;
    specialBonus: number;
  };
  injuries: InjuryItem[];
};

export const REALM_STAT_MAP: Record<MagicalRealm, StatName> = {
  Channeling: "Intuition",
  Essence: "Empathy",
  Mentalism: "Presence",
};

export function firstMagicalRealm(realms: Realm[]): MagicalRealm {
  const found = realms.find((realm): realm is MagicalRealm => realm !== "Arms");
  return found ?? "Channeling";
}
