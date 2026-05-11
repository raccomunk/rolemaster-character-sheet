import { STAT_NAMES } from "@/lib/types";
import type { CharacterSheet, StatName } from "@/lib/types";

/** Minimal shape expected from dpSpendEntries for level-up upgrades. */
export type LevelUpSpendEntry = {
  kind: string;
  itemKey?: string;
  upgradeStep?: number;
};

/** Minimal shape expected for the stat level-up preview (temp + potential only). */
export type LevelUpStatPreview = {
  temp: number;
  potential: number;
};

/**
 * Apply a committed level-up to a character sheet.
 * Pure function — no alerts, confirms, or state side-effects.
 *
 * @param prev       The sheet before levelling up.
 * @param spendEntries  DP spend entries used to calculate rank upgrades.
 * @param statPreview   Per-stat resolved temp/potential after all rolls.
 * @returns The updated sheet (level +1, talentPoints +2, updated stats/ranks).
 */
export function applyLevelUpToSheet(
  prev: CharacterSheet,
  spendEntries: LevelUpSpendEntry[],
  statPreview: Record<StatName, LevelUpStatPreview>,
): CharacterSheet {
  const categorySteps = new Map<string, number>();
  const skillSteps = new Map<string, number>();

  spendEntries.forEach((entry) => {
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
      temp: statPreview[stat].temp,
      potential: statPreview[stat].potential,
    };
  });

  const nextCategories = prev.skillCategories.map((cat) => {
    const upgrades = categorySteps.get(cat.id) ?? 0;
    if (upgrades <= 0) return cat;
    return { ...cat, ranks: cat.ranks + upgrades * Math.max(1, cat.newRanks) };
  });

  const nextSkills = prev.skills.map((skill) => {
    const upgrades = skillSteps.get(skill.id) ?? 0;
    if (upgrades <= 0) return skill;
    return { ...skill, ranks: skill.ranks + upgrades * Math.max(1, skill.newRanks) };
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
}
