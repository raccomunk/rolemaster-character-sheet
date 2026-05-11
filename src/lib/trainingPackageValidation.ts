import {
  categoryOptionsForConstraint,
  effectiveAllocationMode,
  getChoiceConstraint,
  isChoiceSkillGrant,
  parseChoiceMaxTargets,
  skillMatchesSlashFragments,
  skillOptionsForConstraint,
} from "@/lib/trainingPackageRules";

type SkillGrant = {
  description: string;
  ranks: number;
};

type ChoiceAllocation = {
  mode: "skill" | "category" | "newSkill";
  targetId: string;
  newSkillName: string;
  newSkillCategoryId: string;
  ranks: number;
};

type CategoryLike = {
  id: string;
  name: string;
};

type SkillLike = {
  id: string;
  name: string;
  categoryId: string;
};

function clampChoiceRank(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, v);
}

export function validateChoiceSkillGrants(input: {
  grants: SkillGrant[];
  pendingChoices: Record<number, ChoiceAllocation[]>;
  categories: CategoryLike[];
  skills: SkillLike[];
}): string | null {
  for (let i = 0; i < input.grants.length; i += 1) {
    const grant = input.grants[i];
    if (!isChoiceSkillGrant(grant.description, input.categories, input.skills)) continue;

    const constraint = getChoiceConstraint(grant.description, input.categories);
    const rawAllocations = input.pendingChoices[i] ?? [];
    const isSingle = rawAllocations.length <= 1;
    // For a single allocation the ranks are auto-set to grant.ranks; skip the rank-split check.
    const used = isSingle
      ? rawAllocations.map((a) => ({ ...a, ranks: grant.ranks }))
      : rawAllocations.filter((allocation) => allocation.ranks > 0);

    if (used.length === 0) {
      return `Please allocate ranks for: ${grant.description}`;
    }

    if (!isSingle) {
      const totalAllocated = used.reduce((sum, allocation) => sum + clampChoiceRank(allocation.ranks), 0);
      if (totalAllocated !== grant.ranks) {
        return `Grant "${grant.description}" must allocate exactly ${grant.ranks} total ranks (currently ${totalAllocated}).`;
      }
    }

    const maxTargets = parseChoiceMaxTargets(grant.description);
    if (used.length > maxTargets) {
      return `Grant "${grant.description}" allows at most ${maxTargets} selected target(s).`;
    }

    const allowedCategoryIds = new Set(categoryOptionsForConstraint(constraint, input.categories).map((category) => category.id));
    const hasExistingSkillOptions = skillOptionsForConstraint(constraint, input.skills, input.categories).length > 0;

    const invalid = used.find((allocation) => {
      const mode = effectiveAllocationMode(allocation, constraint, hasExistingSkillOptions);

      if (constraint.kind === "weaponAttackCategoryChoice") {
        if (mode !== "category") return true;
      }
      if (constraint.kind === "spellLists") {
        if (mode === "category") return true;
      }
      if (constraint.kind === "specificCategorySkills" || constraint.kind === "categoryGroupSkills" || constraint.kind === "specificSkillList") {
        if (mode === "category") return true;
      }
      if (constraint.kind === "specificSkillList") {
        if (mode === "newSkill") return true;
        if (!allocation.targetId) return true;
        if (allocation.targetId.startsWith("base:")) return false;
        const skill = input.skills.find((entry) => entry.id === allocation.targetId);
        if (!skill) return true;
        return !skillMatchesSlashFragments(skill.name, constraint.skillNames);
      }
      if (mode === "newSkill") {
        if (!allocation.newSkillName.trim()) return true;
        if (constraint.kind === "specificCategorySkills") return false;
        if (constraint.kind === "categoryGroupSkills") {
          return false;
        }
        if (!allocation.newSkillCategoryId) return true;
        if (constraint.kind === "spellLists") {
          return !allowedCategoryIds.has(allocation.newSkillCategoryId);
        }
        return false;
      }
      if (!allocation.targetId) return true;
      if (mode === "skill") {
        const skill = input.skills.find((entry) => entry.id === allocation.targetId);
        if (!skill) return true;
        if (constraint.kind === "specificCategorySkills") return skill.categoryId !== constraint.categoryId;
        if (constraint.kind === "categoryGroupSkills") return !allowedCategoryIds.has(skill.categoryId);
        if (constraint.kind === "spellLists") {
          return !allowedCategoryIds.has(skill.categoryId);
        }
        return false;
      }
      if (mode === "category") {
        if (constraint.kind === "weaponAttackCategoryChoice") {
          return !allowedCategoryIds.has(allocation.targetId);
        }
        if (constraint.kind !== "any") return true;
        return !input.categories.some((entry) => entry.id === allocation.targetId);
      }
      return true;
    });

    if (invalid) {
      return `Please complete all selected targets for: ${grant.description}`;
    }
  }

  return null;
}
