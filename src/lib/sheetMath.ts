import type { ProgressionType, RankProgression } from "@/lib/types";

// ---------------------------------------------------------------------------
// Stat bonuses
// ---------------------------------------------------------------------------

export function statBasicBonus(val: number): number {
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

// ---------------------------------------------------------------------------
// Rank / progression calculations
// ---------------------------------------------------------------------------

export function rankValue(ranks: number, progression: RankProgression): number {
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

export function isZeroProgression(progression: RankProgression): boolean {
  return progression.every((value) => value === 0);
}

export function canEditCategoryNewRanks(progressionType: ProgressionType): boolean {
  return progressionType === "standard";
}

// ---------------------------------------------------------------------------
// Development cost helpers
// ---------------------------------------------------------------------------

function resolveDevelopmentCostByRank(cost: string, currentRanks = 0): string {
  const trimmed = cost.trim();
  if (!trimmed.includes("|") || !trimmed.includes(":")) return trimmed;

  const effectiveRank = Math.max(1, currentRanks);
  const bands = trimmed
    .split("|")
    .map((band) => band.trim())
    .filter(Boolean)
    .map((band) => {
      const [rangePart, bandCost] = band.split(":");
      const range = rangePart?.trim() ?? "";
      const costValue = bandCost?.trim() ?? "";
      if (!range || !costValue) return null;

      if (range.endsWith("+")) {
        const min = Number(range.slice(0, -1));
        return Number.isFinite(min) ? { min, max: Number.POSITIVE_INFINITY, cost: costValue } : null;
      }

      const [minRaw, maxRaw] = range.split("-");
      const min = Number(minRaw);
      const max = Number(maxRaw);
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
      return { min, max, cost: costValue };
    })
    .filter((band): band is { min: number; max: number; cost: string } => band !== null);

  return bands.find((band) => effectiveRank >= band.min && effectiveRank <= band.max)?.cost ?? trimmed;
}

export function isBandedDevelopmentCost(cost: string): boolean {
  const trimmed = cost.trim();
  return trimmed.includes("|") && trimmed.includes(":");
}

export function formatDevelopmentCostSchedule(cost: string): string {
  if (!isBandedDevelopmentCost(cost)) return formatDevelopmentCostPath(cost);

  return cost
    .split("|")
    .map((band) => band.trim())
    .filter(Boolean)
    .map((band) => {
      const [rangePart, bandCost] = band.split(":");
      return `${rangePart?.trim() ?? ""}: ${bandCost?.trim() ?? ""}`.trim();
    })
    .join(" · ");
}

export function parseDevelopmentCost(cost: string, currentRanks = 0): number[] {
  const resolvedCost = resolveDevelopmentCostByRank(cost, currentRanks);
  if (!resolvedCost.trim()) return [];
  return resolvedCost
    .split(/[^0-9]+/)
    .map((part) => Number(part))
    .filter((num) => Number.isFinite(num) && num > 0);
}

export function formatDevelopmentCostPath(cost: string, currentRanks = 0): string {
  const parsed = parseDevelopmentCost(cost, currentRanks);
  return parsed.length > 0 ? parsed.join("/") : "—";
}

export function rankCostOptions(
  developmentCost: string,
  newRanks: number,
  currentRanks = 0,
): Array<{ upgrades: number; rankGain: number; cost: number }> {
  const ranksPerUpgrade = Math.max(1, Math.min(3, Math.floor(newRanks)));
  const options: Array<{ upgrades: number; rankGain: number; cost: number }> = [];

  let runningCost = 0;
  let previousResolvedCost = "";
  let costIndexWithinBand = 0;

  for (let upgrades = 1; upgrades <= 3; upgrades += 1) {
    const ranksBeforeUpgrade = currentRanks + (upgrades - 1) * ranksPerUpgrade;
    const resolvedCost = resolveDevelopmentCostByRank(developmentCost, ranksBeforeUpgrade);
    const costs = parseDevelopmentCost(resolvedCost);

    if (resolvedCost !== previousResolvedCost) {
      previousResolvedCost = resolvedCost;
      costIndexWithinBand = 0;
    }

    const stepCost = costs[costIndexWithinBand];
    if (!Number.isFinite(stepCost) || stepCost <= 0) break;

    runningCost += stepCost;
    options.push({ upgrades, rankGain: upgrades * ranksPerUpgrade, cost: runningCost });
    costIndexWithinBand += 1;
  }

  return options;
}

export function totalCost(costs: number[]): number {
  return costs.reduce((sum, c) => sum + c, 0);
}

// ---------------------------------------------------------------------------
// Pool / penalty helpers
// ---------------------------------------------------------------------------

export function pctUsed(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (current / total) * 100));
}

export function thresholdAt(total: number, percent: number): number {
  return Math.ceil((Math.max(0, total) * percent) / 100);
}

export function healthPenalty(percent: number): number {
  if (percent < 25) return 0;
  if (percent < 50) return -10;
  if (percent < 75) return -20;
  if (percent < 100) return -30;
  return -999;
}

export function magicPenalty(percent: number): number {
  if (percent < 25) return 0;
  if (percent < 50) return -10;
  if (percent < 75) return -20;
  return -30;
}

export function exhaustionPenalty(percent: number): number {
  if (percent < 25) return 0;
  if (percent < 50) return -5;
  if (percent < 75) return -15;
  if (percent < 90) return -30;
  if (percent < 100) return -60;
  return -100;
}

export function parseExhaustionBonusFromRaceNotes(notes?: string[]): number {
  if (!notes || notes.length === 0) return 0;
  return notes.reduce((sum, note) => {
    const match = note.match(/([+-]?\d+)\s*exhaustion\s*points?/i);
    if (!match) return sum;
    return sum + (Number(match[1]) || 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

type WealthShape = {
  mithril: number;
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
  copper: number;
  tin: number;
  iron: number;
};

export function currencyValue(wealth: WealthShape): number {
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

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatProgressionType(progressionType: ProgressionType): string {
  switch (progressionType) {
    case "standard": return "Standard";
    case "combined": return "Combined";
    case "limited": return "Limited";
    case "special": return "Special";
    case "bodyDevelopment": return "Body Dev";
    case "powerPointDevelopment": return "PP Dev";
    default: return "Unknown";
  }
}

export function formatProgression(p: RankProgression): string {
  return `${p[0]} • ${p[1]} • ${p[2]} • ${p[3]} • ${p[4]}`;
}

export const STAT_ABBR: Record<string, string> = {
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

export function abbrStats(stats: string[]): string {
  return stats.map((s) => STAT_ABBR[s] ?? s.slice(0, 2)).join("/") || "—";
}

// ---------------------------------------------------------------------------
// Misc utilities
// ---------------------------------------------------------------------------

export function clampNumber(v: number, min = 0): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, v);
}

export function isValidDie(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 10;
}
