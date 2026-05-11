import type { CharacterSheet } from "@/lib/types";

/**
 * Migrate a parsed (potentially old-format) save blob to a valid CharacterSheet.
 * Adds missing fields so older saves remain loadable after schema additions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateSheet(parsed: any): CharacterSheet {
  const s = parsed as CharacterSheet;

  if (!Array.isArray((s.details as any).trainingPackages)) {
    (s.details as any).trainingPackages = [];
  }
  if (!Array.isArray((s.details as any).trainingPackageApplications)) {
    (s.details as any).trainingPackageApplications = [];
  }
  if (!Array.isArray((s.details as any).everymanSkills)) {
    (s.details as any).everymanSkills = [];
  }
  if (!Array.isArray((s.details as any).occupationalSkills)) {
    (s.details as any).occupationalSkills = [];
  }
  if (!Array.isArray((s.details as any).restrictedSkills)) {
    (s.details as any).restrictedSkills = [];
  }
  if (!Array.isArray(s.details.talents)) {
    (s.details as any).talents = s.details.talents
      ? [(s.details as any).talents as string]
      : [];
  }
  if (!Array.isArray(s.details.flaws)) {
    (s.details as any).flaws = s.details.flaws
      ? [(s.details as any).flaws as string]
      : [];
  }
  if (typeof s.details.heroicPath !== "number") {
    (s.details as any).heroicPath = Number(s.details.heroicPath) || 0;
  }
  if (!Array.isArray(s.skills)) {
    (s as any).skills = [];
  }
  if (!Array.isArray((s as any).spellLists)) {
    (s as any).spellLists = [];
  }
  if (typeof s.magic?.spellAdder !== "string") {
    (s.magic as any).spellAdder =
      s.magic?.spellAdder == null ? "" : String(s.magic.spellAdder);
  }
  if (typeof s.magic?.spellMultiplier !== "string") {
    (s.magic as any).spellMultiplier =
      s.magic?.spellMultiplier == null ? "" : String(s.magic.spellMultiplier);
  }
  s.skills = s.skills.map((skill) => ({
    ...skill,
    newRanks:
      typeof (skill as any).newRanks === "number" ? (skill as any).newRanks : 1,
  }));
  (s as any).spellLists = ((s as any).spellLists as any[]).map((entry) => ({
    ...entry,
    ranks: typeof entry?.ranks === "number" ? entry.ranks : 0,
    itemBonus: typeof entry?.itemBonus === "number" ? entry.itemBonus : 0,
    specialBonus: typeof entry?.specialBonus === "number" ? entry.specialBonus : 0,
    favorite: Boolean(entry?.favorite),
    notes: typeof entry?.notes === "string" ? entry.notes : "",
  }));

  return s;
}
