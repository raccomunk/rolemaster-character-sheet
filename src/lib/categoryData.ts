import type { ProgressionType, RankProgression, StatName } from "@/lib/types";

// ---------------------------------------------------------------------------
// Ordered category names (drives UI ordering and default creation)
// ---------------------------------------------------------------------------

export const CATEGORY_ORDER = [
  "Armor • Heavy",
  "Armor • Light",
  "Armor • Medium",
  "Artistic • Active",
  "Artistic • Passive",
  "Athletic • Brawn",
  "Athletic • Endurance",
  "Athletic • Gymnastics",
  "Awareness • Perceptions",
  "Awareness • Searching",
  "Awareness • Senses",
  "Body Development",
  "Combat Maneuvers",
  "Communications",
  "Crafts",
  "Directed Spells",
  "Influence",
  "Lore • General",
  "Lore • Magical",
  "Lore • Obscure",
  "Lore • Technical",
  "Martial Arts • Striking",
  "Martial Arts • Sweeps",
  "Outdoor • Animal",
  "Outdoor • Environmental",
  "Power Awareness",
  "Power Manipulation",
  "Power Point Development",
  "Science/Analytic • Basic",
  "Science/Analytic • Specialized",
  "Self Control",
  "Special Attacks",
  "Special Defenses",
  "Spells • Own Realm Closed Lists",
  "Spells • Own Realm Open Lists",
  "Spells • Own Realm Own Base Lists",
  "Spells • Own Realm Other Base Lists",
  "Spells • Own Realm Training Package",
  "Spells • Other Realm Closed Lists",
  "Spells • Other Realm Open Lists",
  "Spells • Other Realm Other Base Lists",
  "Spells • Other Realm Training Package",
  "Subterfuge • Attack",
  "Subterfuge • Mechanics",
  "Subterfuge • Stealth",
  "Technical/Trade • General",
  "Technical/Trade • Professional",
  "Technical/Trade • Vocational",
  "Urban",
  "Weapon • 1-H Concussion",
  "Weapon • 1-H Edged",
  "Weapon • 2-Handed",
  "Weapon • Missile",
  "Weapon • Missile Artillery",
  "Weapon • Pole Arms",
  "Weapon • Thrown",
] as const;

export type CategoryName = (typeof CATEGORY_ORDER)[number];

// ---------------------------------------------------------------------------
// Per-category static configuration
// ---------------------------------------------------------------------------

export type CategoryConfig = {
  applicableStats: StatName[];
  developmentCost: string;
  progressionType: ProgressionType;
  newRanks: number;
};

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
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
  Communications: { applicableStats: ["Reasoning", "Memory", "Empathy"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  Crafts: { applicableStats: ["Agility", "Memory", "Self Discipline"], developmentCost: "", progressionType: "combined", newRanks: 1 },
  "Directed Spells": { applicableStats: ["Agility", "Self Discipline", "Agility"], developmentCost: "", progressionType: "standard", newRanks: 1 },
  Influence: { applicableStats: ["Presence", "Empathy", "Intuition"], developmentCost: "", progressionType: "standard", newRanks: 1 },
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
  "Spells • Own Realm Training Package": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Closed Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Open Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Other Base Lists": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
  "Spells • Other Realm Training Package": { applicableStats: [], developmentCost: "", progressionType: "limited", newRanks: 1 },
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

// ---------------------------------------------------------------------------
// Default progressions
// ---------------------------------------------------------------------------

export const DEFAULT_CATEGORY_PROGRESSION: RankProgression = [-15, 2, 1, 0.5, 0];

export const DEFAULT_SKILL_PROGRESSIONS: Record<ProgressionType, RankProgression> = {
  standard: [-15, 3, 2, 1, 0.5],
  combined: [-15, 5, 3, 1.5, 0.5],
  limited: [0, 1, 1, 0.5, 0],
  bodyDevelopment: [0, 0, 0, 0, 0],
  powerPointDevelopment: [0, 0, 0, 0, 0],
  special: [0, 6, 5, 4, 3],
};

export const ZERO_PROGRESSION: RankProgression = [0, 0, 0, 0, 0];

// ---------------------------------------------------------------------------
// Category group matching (used for profession bonus rules)
// ---------------------------------------------------------------------------

export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function groupMatch(categoryName: string, target: string): boolean {
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

export function buildCategoryBonuses(
  rules: Array<{ target: string; bonus: number }>,
): Record<string, number> {
  const bonuses: Record<string, number> = {};
  CATEGORY_ORDER.forEach((categoryName) => {
    bonuses[categoryName] = rules.reduce(
      (sum, rule) => (groupMatch(categoryName, rule.target) ? sum + rule.bonus : sum),
      0,
    );
  });
  return bonuses;
}
