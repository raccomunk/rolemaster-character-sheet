import {
  findBaseSkillForFragment,
  grantDescriptionCandidates,
  normalizeGrantMatch,
} from "@/lib/trainingPackageRules";

type SkillLike = {
  id: string;
  name: string;
};

type CategoryLike = {
  id: string;
  name: string;
};

export type ResolvedTrainingGrantTarget =
  | { kind: "skill"; id: string; name: string; key: string }
  | { kind: "category"; id: string; name: string; key: string }
  | { kind: "baseSkill"; name: string; categoryName: string };

export function resolveTrainingGrantTarget(
  description: string,
  chosenText: string | undefined,
  data: {
    skills: SkillLike[];
    skillCategories: CategoryLike[];
  }
): ResolvedTrainingGrantTarget | null {
  const sourceCandidates = chosenText?.trim()
    ? [chosenText.trim()]
    : grantDescriptionCandidates(description);

  const normalizedSkills = data.skills.map((skill) => ({
    kind: "skill" as const,
    id: skill.id,
    name: skill.name,
    key: normalizeGrantMatch(skill.name),
  }));
  const normalizedCategories = data.skillCategories.map((category) => ({
    kind: "category" as const,
    id: category.id,
    name: category.name,
    key: normalizeGrantMatch(category.name),
  }));

  const hasParentheticalSpecialization = (value: string) => /\([^)]*\)/.test(value);

  // 1a) Exact string match on existing sheet skills (case-insensitive)
  for (let i = 0; i < sourceCandidates.length; i += 1) {
    const candidate = sourceCandidates[i];
    const exactSkill = normalizedSkills.find((skill) => skill.name.toLowerCase() === candidate.toLowerCase());
    if (exactSkill) return exactSkill;
  }

  // 1b) Exact normalized match on existing sheet skills
  for (let i = 0; i < sourceCandidates.length; i += 1) {
    // Keep specialization names distinct from base names.
    // e.g. "Stone-crafts (Gem Cutting)" must not resolve to existing "Stone-crafts".
    if (hasParentheticalSpecialization(sourceCandidates[i])) continue;
    const candidateKey = normalizeGrantMatch(sourceCandidates[i]);
    if (!candidateKey) continue;

    const exactSkill = normalizedSkills.find((skill) => skill.key === candidateKey);
    if (exactSkill) return exactSkill;
  }

  // 2) Exact match on BASE_SKILLS
  for (let i = 0; i < sourceCandidates.length; i += 1) {
    const baseSkill = findBaseSkillForFragment(sourceCandidates[i]);
    if (!baseSkill) continue;
    return {
      kind: "baseSkill",
      name: baseSkill.name,
      categoryName: baseSkill.category,
    };
  }

  // 3a) Exact string match on categories (case-insensitive)
  for (let i = 0; i < sourceCandidates.length; i += 1) {
    const candidate = sourceCandidates[i];
    const exactCategory = normalizedCategories.find((category) => category.name.toLowerCase() === candidate.toLowerCase());
    if (exactCategory) return exactCategory;
  }

  // 3b) Exact normalized match on categories
  for (let i = 0; i < sourceCandidates.length; i += 1) {
    const candidateKey = normalizeGrantMatch(sourceCandidates[i]);
    if (!candidateKey) continue;

    const exactCategory = normalizedCategories.find((category) => category.key === candidateKey);
    if (exactCategory) return exactCategory;
  }

  return null;
}
