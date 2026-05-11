import { STAT_NAMES, type StatName, type StatBlock, type SkillCategory, type CharacterSheet } from "@/lib/types";
import { CATEGORY_ORDER, CATEGORY_CONFIG } from "@/lib/categoryData";

// ---------------------------------------------------------------------------
// ID generation utility
// ---------------------------------------------------------------------------

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Default sheet structure factories
// ---------------------------------------------------------------------------

export function makeDefaultStats(): Record<StatName, StatBlock> {
  return STAT_NAMES.reduce(
    (acc, name) => {
      acc[name] = { temp: 50, potential: 100, racialBonus: 0, specialBonus: 0 };
      return acc;
    },
    {} as Record<StatName, StatBlock>,
  );
}

export function makeDefaultCategories(): SkillCategory[] {
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

export function makeDefaultSheet(): CharacterSheet {
  return {
    details: {
      characterName: "",
      level: 1,
      race: "Common Men",
      culture: "",
      profession: "Fighter",
      trainingPackages: [],
      trainingPackageApplications: [],
      everymanSkills: [],
      occupationalSkills: [],
      restrictedSkills: [],
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
    spellLists: [],
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
      spellAdder: "",
      spellMultiplier: "",
    },
    exhaustion: {
      currentEP: 0,
      specialBonus: 0,
    },
    injuries: [],
  };
}
