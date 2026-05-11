import { BASE_SKILLS } from "@/data/skills";
import {
  REALM_STAT_MAP,
  STAT_NAMES,
  firstMagicalRealm,
  type MagicalRealm,
  type PackageStatGainSlot,
  type Realm,
  type StatName,
} from "@/lib/types";

export type ChoiceConstraint =
  | { kind: "any" }
  | { kind: "specificCategorySkills"; categoryId: string }
  | { kind: "categoryGroupSkills"; groupNames: string[] }
  | { kind: "specificSkillList"; skillNames: string[] }
  | { kind: "weaponAttackCategoryChoice" }
  | { kind: "spellLists" };

type CategoryLike = { id: string; name: string };
type SkillLike = { id: string; name: string; categoryId: string };
type AllocationLike = { mode: "skill" | "category" | "newSkill" };

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function choiceCountPattern() {
  return "(?:one|two|three|four|five|\\d+)";
}

export function normalizeGrantMatch(input: string) {
  return normalizeText(
    input
      .replace(/•/g, "-")
      .replace(/[/:]/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\bskills?\b/gi, " ")
      .replace(/\bcategory\b/gi, " ")
  );
}

export function isWeaponCategory(catName: string) {
  return catName.startsWith("Weapon •") || ["Martial Arts • Striking", "Martial Arts • Sweeps", "Special Attacks"].includes(catName);
}

export function grantDescriptionCandidates(description: string) {
  const trimmed = description.trim();
  const candidates = new Set<string>();
  candidates.add(trimmed);

  const noChoicePrefix = trimmed.replace(/^choice of\s+/i, "").trim();
  candidates.add(noChoicePrefix);

  const colonParts = trimmed.split(":").map((p) => p.trim()).filter(Boolean);
  if (colonParts.length > 1) {
    candidates.add(colonParts[colonParts.length - 1]);
  }

  const noAnyPrefix = noChoicePrefix.replace(/^any\s+(one\s+)?/i, "").trim();
  candidates.add(noAnyPrefix);

  return [...candidates].filter(Boolean);
}

function parseExplicitChoiceList(description: string) {
  const trimmed = description.trim();
  const match = trimmed.match(/^choice of\s+(.+)$/i);
  if (!match) return null;

  const remainder = match[1].trim();
  if (!/\bor\b/i.test(remainder)) return null;
  if (/\bup to\b/i.test(remainder)) return null;
  if (new RegExp(`^${choiceCountPattern()}\\b`, "i").test(remainder)) return null;

  const normalized = remainder.replace(/,\s*or\s+/gi, ", ").replace(/\s+or\s+/gi, ", ");
  const items = normalized.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length >= 2 ? items : null;
}

function matchStrictChoicePattern(description: string, suffix: string) {
  const countPattern = choiceCountPattern();
  return description.match(new RegExp(`^choice of\\s+(?:up to\\s+)?(${countPattern})\\s+(.+?)\\s+${suffix}$`, "i"));
}

function matchStrictSingleChoicePattern(description: string, suffix: string) {
  return description.match(new RegExp(`^choice of\\s+one\\s+(.+?)\\s+${suffix}$`, "i"));
}

function isWeaponAttackCategoryChoice(description: string) {
  return /weapon\s*\/\s*attack\s*skill\s*category/i.test(description);
}

function isSlashSeparatedSkillList(description: string): boolean {
  if (!description.includes("/")) return false;
  if (isWeaponAttackCategoryChoice(description)) return false;
  if (/\bchoice\b/i.test(description)) return false;
  return true;
}

function isExactDirectGrantTarget(description: string, categories?: CategoryLike[], skills?: SkillLike[]) {
  const needle = normalizeGrantMatch(description);
  if (!needle) return false;

  if (categories?.some((category) => normalizeGrantMatch(category.name) === needle)) return true;
  if (skills?.some((skill) => normalizeGrantMatch(skill.name) === needle)) return true;
  if (BASE_SKILLS.some((skill) => normalizeGrantMatch(skill.name) === needle)) return true;

  return false;
}

export function skillMatchesSlashFragments(skillName: string, fragments: string[]): boolean {
  const normalizedSkill = normalizeGrantMatch(skillName);
  return fragments.some((fragment) => {
    const normalizedFragment = normalizeGrantMatch(fragment);
    if (!normalizedFragment) return false;
    return normalizedSkill.includes(normalizedFragment) || normalizedFragment.includes(normalizedSkill);
  });
}

// Resolves a slash-list fragment like "Athletic Games (Gymn.)" to the best
// matching BASE_SKILLS entry. Tries: exact > parenthetical-prefix > stripped.
export function findBaseSkillForFragment(fragment: string): { name: string; category: string } | undefined {
  const trimmed = fragment.trim();

  const exact = BASE_SKILLS.find((b) => b.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const fragParen = trimmed.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (fragParen) {
    const fragBase = normalizeText(fragParen[1]);
    const fragAbbr = normalizeText(fragParen[2]);
    // 2a) Parenthetical abbreviation match: "Athletic Games (Gymn.)" → "Athletic Games (Gymnastics)"
    const match = BASE_SKILLS.find((b) => {
      const bParen = b.name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (!bParen) return false;
      const bBase = normalizeText(bParen[1]);
      const bPart = normalizeText(bParen[2]);
      return bBase === fragBase && (bPart.startsWith(fragAbbr) || fragAbbr.startsWith(bPart));
    });
    if (match) return match;
    // 2b) Specialization: base name without parens matches a BASE_SKILL that has no parenthetical
    //     e.g. "Stone-crafts (Gem Cutting)" → base "Stone-crafts" is a known skill
    //     Return full name (with specialization) in the base skill's category.
    const baseSkill = BASE_SKILLS.find((b) => normalizeText(b.name) === fragBase);
    if (baseSkill) return { name: trimmed, category: baseSkill.category };
  }

  const normalized = normalizeGrantMatch(trimmed);
  return BASE_SKILLS.find((b) => normalizeGrantMatch(b.name) === normalized);
}

function findBestCategoryMatch(raw: string, categories: CategoryLike[]) {
  const needle = normalizeGrantMatch(raw);
  if (!needle) return null;

  const normalized = categories.map((category) => ({
    id: category.id,
    name: category.name,
    key: normalizeGrantMatch(category.name),
  }));

  const exact = normalized.find((entry) => entry.key === needle);
  if (exact) return exact;
  return null;
}

// The "Attack" group has no "Attack •" prefix — it is a named set of categories.
const ATTACK_GROUP_CATEGORIES = ["Martial Arts • Striking", "Martial Arts • Sweeps", "Combat Maneuvers"];

function categoriesForGroup(groupName: string, categories: CategoryLike[]) {
  const gl = groupName.toLowerCase();
  if (gl === "attack") {
    return categories.filter((cat) => ATTACK_GROUP_CATEGORIES.includes(cat.name));
  }
  return categories.filter((cat) => {
    const nl = cat.name.toLowerCase();
    return nl.startsWith(gl + " \u2022") || nl.startsWith(gl + " -");
  });
}

// Split a raw group string (e.g. "Weapon/Attack" or "Awareness/Lore") on "/" and
// return only the parts that resolve to at least one known category.
function resolveGroupNames(raw: string, categories: CategoryLike[]): string[] | null {
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  const resolved = parts.filter((g) => categoriesForGroup(g, categories).length > 0);
  return resolved.length > 0 ? resolved : null;
}

export function getChoiceConstraint(description: string, categories: CategoryLike[]): ChoiceConstraint {
  const trimmed = description.trim();

  if (/^choice of\s+one\s+weapon\s*\/\s*attack\s*skill\s*category$/i.test(trimmed)) {
    return { kind: "weaponAttackCategoryChoice" };
  }
  if (/^choice of\s+(?:up to\s+)?(?:one|two|three|four|five|\d+)\s+spell\s+lists?$/i.test(trimmed)) {
    return { kind: "spellLists" };
  }

  // Labeled weapon category: direct grant ("Weapon skill category A") or choice ("choice of one Weapon skill category A")
  if (/^(?:choice of\s+one\s+)?weapon\s*(?:\/\s*attack\s+)?(?:skill\s+)?category\s+[a-z]$/i.test(trimmed)) {
    return { kind: "weaponAttackCategoryChoice" };
  }
  // Skill within a labeled weapon category: "choice of one category A skill"
  if (/^choice of\s+one\s+category\s+[a-z]\s+skill$/i.test(trimmed)) {
    return { kind: "categoryGroupSkills", groupNames: ["Weapon"] };
  }
  // Multiple skills within a labeled weapon category: "choice of up to N Weapon Skill Category A skills"
  if (/^choice of\s+(?:up to\s+)?(?:one|two|three|four|five|\d+)\s+weapon\s+skill\s+category\s+[a-z]\s+skills?$/i.test(trimmed)) {
    return { kind: "categoryGroupSkills", groupNames: ["Weapon"] };
  }

  const explicitList = parseExplicitChoiceList(trimmed);
  if (explicitList) {
    return { kind: "specificSkillList", skillNames: explicitList };
  }

  // "choice of one X skill" — single target, exact category or group
  const singleCategorySkillMatch = matchStrictSingleChoicePattern(trimmed, "skills?");
  if (singleCategorySkillMatch) {
    const rawGroup = singleCategorySkillMatch[1].trim();
    const catMatch = findBestCategoryMatch(rawGroup, categories);
    if (catMatch) return { kind: "specificCategorySkills", categoryId: catMatch.id };
    const groupNames = resolveGroupNames(rawGroup, categories);
    if (groupNames) return { kind: "categoryGroupSkills", groupNames };
  }

  // "choice of up to N X skills" — multi target, exact category or group
  const categorySkillMatch = matchStrictChoicePattern(trimmed, "skills?");
  if (categorySkillMatch) {
    const rawGroup = categorySkillMatch[2].trim();
    const matched = findBestCategoryMatch(rawGroup, categories);
    if (matched) return { kind: "specificCategorySkills", categoryId: matched.id };
    const groupNames = resolveGroupNames(rawGroup, categories);
    if (groupNames) return { kind: "categoryGroupSkills", groupNames };
  }

  const categoryChoiceMatch = matchStrictChoicePattern(trimmed, "skill\\s+categories?");
  if (categoryChoiceMatch) {
    const groupName = categoryChoiceMatch[2].trim();
    const hasGroup = categories.some((cat) => {
      const nameLower = cat.name.toLowerCase();
      const groupLower = groupName.toLowerCase();
      return nameLower.startsWith(groupLower + " •") || nameLower.startsWith(groupLower + " -") || nameLower === groupLower;
    });
    if (hasGroup) return { kind: "categoryGroupSkills", groupNames: [groupName] };
  }

  // "choice of one/N skill(s) from [any] [category or group] [skill category/categories]"
  const fromMatch = trimmed.match(
    /^choice of\s+(?:up to\s+)?(?:one|two|three|four|five|\d+)\s+skills?\s+from\s+(?:any\s+)?(.+?)(?:\s+skill\s+categor(?:y|ies))?$/i
  );
  if (fromMatch) {
    const rawTarget = fromMatch[1].trim();
    const catMatch2 = findBestCategoryMatch(rawTarget, categories);
    if (catMatch2) return { kind: "specificCategorySkills", categoryId: catMatch2.id };
    const groupNames = resolveGroupNames(rawTarget, categories);
    if (groupNames) return { kind: "categoryGroupSkills", groupNames };
  }

  return { kind: "any" };
}

export function categoryOptionsForConstraint(constraint: ChoiceConstraint, categories: CategoryLike[]) {
  if (constraint.kind === "specificCategorySkills") {
    return categories.filter((category) => category.id === constraint.categoryId);
  }
  if (constraint.kind === "categoryGroupSkills") {
    const seen = new Set<string>();
    const result: CategoryLike[] = [];
    for (const gn of constraint.groupNames) {
      for (const cat of categoriesForGroup(gn, categories)) {
        if (!seen.has(cat.id)) { seen.add(cat.id); result.push(cat); }
      }
    }
    return result;
  }
  if (constraint.kind === "specificSkillList") {
    return categories;
  }
  if (constraint.kind === "weaponAttackCategoryChoice") {
    return categories.filter((category) => isWeaponCategory(category.name));
  }
  if (constraint.kind === "spellLists") {
    return categories.filter((category) => category.name.startsWith("Spells •"));
  }
  return categories;
}

export function skillOptionsForConstraint(
  constraint: ChoiceConstraint,
  skills: SkillLike[],
  categories: CategoryLike[]
) {
  if (constraint.kind === "specificSkillList") {
    return constraint.skillNames.map((slashName) => {
      const baseEntry = findBaseSkillForFragment(slashName);
      const canonicalName = baseEntry?.name ?? slashName.trim();
      const existing = skills.find((s) => s.name.toLowerCase() === canonicalName.toLowerCase());
      if (existing) return existing;
      return { id: `base:${canonicalName}`, name: canonicalName, categoryId: "" };
    });
  }
  const allowedCategoryIds = new Set(categoryOptionsForConstraint(constraint, categories).map((category) => category.id));
  return skills.filter((skill) => allowedCategoryIds.has(skill.categoryId));
}

export function effectiveAllocationMode(
  allocation: AllocationLike,
  constraint: ChoiceConstraint,
  hasExistingSkillOptions: boolean
): AllocationLike["mode"] {
  if (constraint.kind === "weaponAttackCategoryChoice") return "category";
  if (constraint.kind === "specificSkillList") return "skill";
  const constrainedSkillChoice =
    constraint.kind === "spellLists" ||
    constraint.kind === "specificCategorySkills" ||
    constraint.kind === "categoryGroupSkills";
  if (constrainedSkillChoice && !hasExistingSkillOptions) return "newSkill";
  return allocation.mode;
}

export function wordToNumber(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "one") return 1;
  if (normalized === "two") return 2;
  if (normalized === "three") return 3;
  if (normalized === "four") return 4;
  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) ? asNumber : 1;
}

export function isChoiceSkillGrant(description: string, categories?: CategoryLike[], skills?: SkillLike[]) {
  const trimmed = description.trim();

  if (/^choice of\s+one\s+weapon\s*\/\s*attack\s*skill\s*category$/i.test(trimmed)) return true;
  if (/^choice of\s+(?:up to\s+)?(?:one|two|three|four|five|\d+)\s+spell\s+lists?$/i.test(trimmed)) return true;
  // Direct labeled weapon category grant and labeled weapon category choice
  if (/^(?:choice of\s+one\s+)?weapon\s*(?:\/\s*attack\s+)?(?:skill\s+)?category\s+[a-z]$/i.test(trimmed)) return true;
  // Skill within a labeled weapon category: "choice of one category A skill"
  if (/^choice of\s+one\s+category\s+[a-z]\s+skill$/i.test(trimmed)) return true;
  if (matchStrictSingleChoicePattern(trimmed, "skills?")) return true;
  if (matchStrictChoicePattern(trimmed, "skills?")) return true;
  if (matchStrictSingleChoicePattern(trimmed, "skill\\s+categories?")) return true;
  if (matchStrictChoicePattern(trimmed, "skill\\s+categories?")) return true;
  if (parseExplicitChoiceList(trimmed)) return true;

  if (isSlashSeparatedSkillList(description)) {
    // Before treating '/' as a choice separator, verify no known entity has that exact name.
    // e.g. "Technical/Trade - General" is a category; "Demon/Devil Lore" is in BASE_SKILLS.
    if (isExactDirectGrantTarget(description, categories, skills)) return false;
    return true;
  }

  return !isExactDirectGrantTarget(trimmed, categories, skills);
}

export function parseChoiceMaxTargets(description: string) {
  const match = description.toLowerCase().match(/(?:up to\s+)?(one|two|three|four|\d+)\b/i);
  if (!match) return 1;
  return Math.max(1, wordToNumber(match[1]));
}

/**
 * Parse training package stat gain descriptor into typed slots.
 * Example: "Realm" → one slot for the primary realm stat.
 * Example: "choice of two different stats" → two player-choice slots.
 */
export function parsePackageStatGainSlots(statGains: string, realms: string[]): PackageStatGainSlot[] {
  const raw = statGains.trim();
  if (!raw || /^none$/i.test(raw)) return [];

  const realmStat: StatName = REALM_STAT_MAP[firstMagicalRealm(realms as Realm[])];
  const slots: PackageStatGainSlot[] = [];
  const lowerRaw = raw.toLowerCase();

  const choiceMatch = lowerRaw.match(/choice of\s+(one|two|three|four|\d+)\s+(different\s+)?stats?/i);
  if (choiceMatch) {
    const count = Math.max(1, wordToNumber(choiceMatch[1]));
    const different = Boolean(choiceMatch[2]);
    for (let i = 0; i < count; i += 1) {
      slots.push({
        id: `choice_${i + 1}`,
        stat: realmStat,
        allowsChoice: true,
        choiceGroup: different ? "different" : undefined,
      });
    }
    return slots;
  }

  const parts = raw.split(/,|\band\b/i).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (/^realm$/i.test(part)) {
      slots.push({ id: `stat_${i + 1}`, stat: realmStat, allowsChoice: false });
      continue;
    }
    const exactStat = STAT_NAMES.find((s) => s.toLowerCase() === part.toLowerCase());
    if (exactStat) {
      slots.push({ id: `stat_${i + 1}`, stat: exactStat, allowsChoice: false });
      continue;
    }
    if (/\bchoice\b/i.test(part)) {
      slots.push({ id: `choice_${i + 1}`, stat: realmStat, allowsChoice: true });
    }
  }

  return slots;
}
