import type { TrainingPackage } from "@/data/trainingPackages";
import { packageSkillListsFromNames } from "@/lib/trainingPackageFlags";
import { resolveStatLevelRoll } from "@/lib/statLevelRoll";
import { resolveTrainingGrantTarget } from "@/lib/trainingGrantResolver";
import { CATEGORY_ORDER, CATEGORY_CONFIG } from "@/lib/categoryData";
import {
  categoryOptionsForConstraint,
  effectiveAllocationMode,
  findBaseSkillForFragment,
  getChoiceConstraint,
  isChoiceSkillGrant,
  normalizeGrantMatch,
  skillOptionsForConstraint,
} from "@/lib/trainingPackageRules";
import type {
  CharacterSheet,
  PackageChoiceAllocation,
  PackageRankChange,
  PackageStatChange,
  TrainingPackageApplication,
} from "@/lib/types";

export type { PackageRankChange, PackageStatChange };

/** Minimal pending stat-roll shape accepted by apply. App provides richer objects. */
export type PendingStatRollLike = {
  stat: string;
  die1: number;
  die2: number;
};

export function applyTrainingPackageToSheet(args: {
  prev: CharacterSheet;
  pkg: TrainingPackage;
  pendingChoices: Record<number, PackageChoiceAllocation[]>;
  pendingStatRolls: PendingStatRollLike[];
  selectedSpecials: string[];
  uid: (prefix: string) => string;
  clampNumber: (v: number, min?: number) => number;
}): { nextSheet: CharacterSheet; unresolvedGrants: string[] } {
  const { prev, pkg, pendingChoices, pendingStatRolls, selectedSpecials, uid, clampNumber } = args;

  const rankChanges: PackageRankChange[] = [];
  let nextSkills = [...prev.skills];
  let nextCategories = [...prev.skillCategories];
  const appliedChoiceLabels: string[] = [];
  const unresolvedGrants: string[] = [];

  // Ensure all expected categories from CATEGORY_ORDER exist (migration safety: old saves might not have all)
  for (const categoryName of CATEGORY_ORDER) {
    if (!nextCategories.some((c) => normalizeGrantMatch(c.name) === normalizeGrantMatch(categoryName))) {
      nextCategories = [
        ...nextCategories,
        {
          id: uid("cat"),
          name: categoryName,
          applicableStats: CATEGORY_CONFIG[categoryName]?.applicableStats ?? [],
          developmentCost: CATEGORY_CONFIG[categoryName]?.developmentCost ?? "",
          ranks: 0,
          newRanks: CATEGORY_CONFIG[categoryName]?.newRanks ?? 1,
          progressionType: CATEGORY_CONFIG[categoryName]?.progressionType ?? "standard",
          professionBonus: 0,
          specialBonus: categoryName === "Body Development" ? 10 : 0,
        },
      ];
    }
  }

  const applyToSkillById = (skillId: string, amount: number) => {
    nextSkills = nextSkills.map((skill) => skill.id === skillId
      ? { ...skill, ranks: skill.ranks + amount }
      : skill
    );
    rankChanges.push({ kind: "skill", id: skillId, amount });
  };

  const applyToCategoryById = (categoryId: string, amount: number) => {
    nextCategories = nextCategories.map((category) => category.id === categoryId
      ? { ...category, ranks: category.ranks + amount }
      : category
    );
    rankChanges.push({ kind: "category", id: categoryId, amount });
  };

  pkg.skills.forEach((grant, idx) => {
    if (isChoiceSkillGrant(grant.description, nextCategories, nextSkills)) {
      const constraint = getChoiceConstraint(grant.description, nextCategories);
      const allowedCategoryIds = new Set(categoryOptionsForConstraint(constraint, nextCategories).map((category) => category.id));
      const hasExistingSkillOptions = skillOptionsForConstraint(constraint, nextSkills, nextCategories).length > 0;
      // Single allocation: always apply grant.ranks to wherever the player chose.
      const rawAllocations = pendingChoices[idx] ?? [];
      const allocations = rawAllocations.length === 1
        ? rawAllocations.map((a) => ({ ...a, ranks: grant.ranks }))
        : rawAllocations.filter((allocation) => allocation.ranks > 0);
      allocations.forEach((allocation) => {
        const amount = clampNumber(allocation.ranks);
        if (amount <= 0) return;
        const mode = effectiveAllocationMode(allocation, constraint, hasExistingSkillOptions);

        if (mode === "newSkill") {
          const newSkillId = uid("skill");
          const newSkillName = allocation.newSkillName.trim();
          const newCategoryId = constraint.kind === "specificCategorySkills"
            ? constraint.categoryId
            : allocation.newSkillCategoryId;
          const isGroupConstrained = constraint.kind === "categoryGroupSkills" || constraint.kind === "spellLists";
          if (!newCategoryId && !isGroupConstrained && constraint.kind !== "specificSkillList") {
            unresolvedGrants.push(`${grant.description} (invalid new-skill category)`);
            return;
          }
          if (isGroupConstrained && newCategoryId && !allowedCategoryIds.has(newCategoryId)) {
            unresolvedGrants.push(`${grant.description} (invalid new-skill category)`);
            return;
          }
          nextSkills = [
            ...nextSkills,
            {
              id: newSkillId,
              name: newSkillName,
              categoryId: newCategoryId,
              ranks: amount,
              newRanks: 1,
              itemBonus: 0,
              specialBonus: 0,
              favorite: false,
              fumble: "",
              rangeModifications: "",
            },
          ];
          rankChanges.push({ kind: "skill", id: newSkillId, amount });
          appliedChoiceLabels.push(`${grant.description} -> ${newSkillName} (+${amount})`);
          return;
        }

        if (mode === "skill") {
          if (allocation.targetId.startsWith("base:")) {
            const baseName = allocation.targetId.slice(5);
            const baseEntry = findBaseSkillForFragment(baseName);
            const categoryId = nextCategories.find((c) => c.name === baseEntry?.category)?.id ?? "";
            const existing = nextSkills.find((s) =>
              s.name.toLowerCase() === baseName.toLowerCase()
              && s.categoryId === categoryId
            );
            if (existing) {
              applyToSkillById(existing.id, amount);
              appliedChoiceLabels.push(`${grant.description} -> ${existing.name} (+${amount})`);
              return;
            }
            const newSkillId = uid("skill");
            nextSkills = [
              ...nextSkills,
              { id: newSkillId, name: baseName, categoryId, ranks: amount, newRanks: 1, itemBonus: 0, specialBonus: 0, favorite: false, fumble: "", rangeModifications: "" },
            ];
            rankChanges.push({ kind: "skill", id: newSkillId, amount });
            appliedChoiceLabels.push(`${grant.description} -> ${baseName} (+${amount})`);
            return;
          }
          const targetSkill = nextSkills.find((skill) => skill.id === allocation.targetId);
          if (!targetSkill) {
            unresolvedGrants.push(`${grant.description} (missing skill target)`);
            return;
          }
          if (constraint.kind === "specificCategorySkills" && targetSkill.categoryId !== constraint.categoryId) {
            unresolvedGrants.push(`${grant.description} (skill not in required category)`);
            return;
          }
          if (constraint.kind === "categoryGroupSkills" && !allowedCategoryIds.has(targetSkill.categoryId)) {
            unresolvedGrants.push(`${grant.description} (skill not in required category group)`);
            return;
          }
          if ((constraint.kind === "categoryGroupSkills" || constraint.kind === "spellLists") && !allowedCategoryIds.has(targetSkill.categoryId)) {
            unresolvedGrants.push(`${grant.description} (skill not in allowed category group)`);
            return;
          }
          applyToSkillById(targetSkill.id, amount);
          appliedChoiceLabels.push(`${grant.description} -> ${targetSkill.name} (+${amount})`);
          return;
        }

        const targetCategory = nextCategories.find((category) => category.id === allocation.targetId);
        if (!targetCategory) {
          unresolvedGrants.push(`${grant.description} (missing category target)`);
          return;
        }
        applyToCategoryById(targetCategory.id, amount);
        appliedChoiceLabels.push(`${grant.description} -> ${targetCategory.name} (+${amount})`);
      });
      return;
    }

    if (normalizeGrantMatch(grant.description) === normalizeGrantMatch("Body Development")) {
      const existingBodyDevSkill = nextSkills.find((skill) => normalizeGrantMatch(skill.name) === normalizeGrantMatch("Body Development"));
      if (existingBodyDevSkill) {
        applyToSkillById(existingBodyDevSkill.id, grant.ranks);
        return;
      }

      const bodyDevCategoryId = nextCategories.find((category) => normalizeGrantMatch(category.name) === normalizeGrantMatch("Body Development"))?.id ?? "";
      const newSkillId = uid("skill");
      nextSkills = [
        ...nextSkills,
        {
          id: newSkillId,
          name: "Body Development",
          categoryId: bodyDevCategoryId,
          ranks: grant.ranks,
          newRanks: 1,
          itemBonus: 0,
          specialBonus: 0,
          favorite: false,
          fumble: "",
          rangeModifications: "",
        },
      ];
      rankChanges.push({ kind: "skill", id: newSkillId, amount: grant.ranks });
      return;
    }

    const resolved = resolveTrainingGrantTarget(grant.description, undefined, {
      skills: nextSkills,
      skillCategories: nextCategories,
    });
    if (!resolved) {
      unresolvedGrants.push(grant.description);
      return;
    }

    if (resolved.kind === "skill") {
      nextSkills = nextSkills.map((skill) => skill.id === resolved.id
        ? { ...skill, ranks: skill.ranks + grant.ranks }
        : skill
      );
      rankChanges.push({ kind: "skill", id: resolved.id, amount: grant.ranks });
    } else if (resolved.kind === "baseSkill") {
      const baseCategoryId = nextCategories.find((category) => normalizeGrantMatch(category.name) === normalizeGrantMatch(resolved.categoryName))?.id ?? "";
      const existing = nextSkills.find((skill) =>
        skill.name.toLowerCase() === resolved.name.toLowerCase()
        && skill.categoryId === baseCategoryId
      );
      if (existing) {
        applyToSkillById(existing.id, grant.ranks);
        return;
      }
      const newSkillId = uid("skill");
      nextSkills = [
        ...nextSkills,
        {
          id: newSkillId,
          name: resolved.name,
          categoryId: baseCategoryId,
          ranks: grant.ranks,
          newRanks: 1,
          itemBonus: 0,
          specialBonus: 0,
          favorite: false,
          fumble: "",
          rangeModifications: "",
        },
      ];
      rankChanges.push({ kind: "skill", id: newSkillId, amount: grant.ranks });
    } else {
      nextCategories = nextCategories.map((category) => category.id === resolved.id
        ? { ...category, ranks: category.ranks + grant.ranks }
        : category
      );
      rankChanges.push({ kind: "category", id: resolved.id, amount: grant.ranks });
    }
  });

  const statsBefore = prev.stats;
  const nextStats = { ...prev.stats };
  pendingStatRolls.forEach((roll) => {
    const statKey = roll.stat as PackageStatChange["stat"];
    const current = nextStats[statKey];
    if (!current) return;
    const result = resolveStatLevelRoll(current.temp, current.potential, roll.die1, roll.die2);
    nextStats[statKey] = {
      ...current,
      temp: result.temp,
      potential: result.potential,
    };
  });

  const statChanges: PackageStatChange[] = pendingStatRolls.map((roll) => {
    const statKey = roll.stat as PackageStatChange["stat"];
    const before = statsBefore[statKey];
    const after = nextStats[statKey];
    if (!before || !after) {
      return { stat: statKey, tempDelta: 0, potentialDelta: 0 };
    }
    return {
      stat: statKey,
      tempDelta: after.temp - before.temp,
      potentialDelta: after.potential - before.potential,
    };
  }).filter((change) => change.tempDelta !== 0 || change.potentialDelta !== 0);

  const nextTrainingPackages = [...prev.details.trainingPackages, pkg.name];
  const nextApplications = [...prev.details.trainingPackageApplications, {
    packageName: pkg.name,
    specialGains: selectedSpecials,
    rankChanges,
    statChanges,
    skillChoices: appliedChoiceLabels,
  }];

  const nextFlags = packageSkillListsFromNames(nextTrainingPackages);
  const nextSkillsWithRanks = nextSkills.map((skill) => {
    if (nextFlags.everymanSkills.some((name) => name.toLowerCase() === skill.name.toLowerCase())) {
      return { ...skill, newRanks: Math.max(skill.newRanks, 2) };
    }
    if (nextFlags.occupationalSkills.some((name) => name.toLowerCase() === skill.name.toLowerCase())) {
      return { ...skill, newRanks: Math.max(skill.newRanks, 3) };
    }
    return skill;
  });

  const nextSheet = {
    ...prev,
    stats: nextStats,
    skillCategories: nextCategories,
    skills: nextSkillsWithRanks,
    details: {
      ...prev.details,
      trainingPackages: nextTrainingPackages,
      trainingPackageApplications: nextApplications,
      everymanSkills: nextFlags.everymanSkills,
      occupationalSkills: nextFlags.occupationalSkills,
      restrictedSkills: nextFlags.restrictedSkills,
    },
  };

  return { nextSheet, unresolvedGrants };
}

export function removeTrainingPackageAtFromSheet(prev: CharacterSheet, index: number): CharacterSheet {
  const app = prev.details.trainingPackageApplications[index];
  const nextTrainingPackages = prev.details.trainingPackages.filter((_, idx) => idx !== index);
  const nextApplications = prev.details.trainingPackageApplications.filter((_, idx) => idx !== index);

  let nextSkills = [...prev.skills];
  let nextCategories = [...prev.skillCategories];
  let nextStats = { ...prev.stats };

  if (app) {
    app.rankChanges.forEach((change) => {
      if (change.kind === "skill") {
        nextSkills = nextSkills.map((skill) => skill.id === change.id
          ? { ...skill, ranks: Math.max(0, skill.ranks - change.amount) }
          : skill
        );
      } else {
        nextCategories = nextCategories.map((category) => category.id === change.id
          ? { ...category, ranks: Math.max(0, category.ranks - change.amount) }
          : category
        );
      }
    });

    app.statChanges.forEach((change) => {
      const current = nextStats[change.stat];
      if (!current) return;
      nextStats = {
        ...nextStats,
        [change.stat]: {
          ...current,
          temp: Math.max(0, current.temp - change.tempDelta),
          potential: Math.max(0, current.potential - change.potentialDelta),
        },
      };
    });
  }

  const nextFlags = packageSkillListsFromNames(nextTrainingPackages);

  return {
    ...prev,
    stats: nextStats,
    skillCategories: nextCategories,
    skills: nextSkills,
    details: {
      ...prev.details,
      trainingPackages: nextTrainingPackages,
      trainingPackageApplications: nextApplications,
      everymanSkills: nextFlags.everymanSkills,
      occupationalSkills: nextFlags.occupationalSkills,
      restrictedSkills: nextFlags.restrictedSkills,
    },
  };
}
