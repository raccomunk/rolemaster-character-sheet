import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save, Download, Upload, Star, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { RACES_DATA } from "@/data/races";
import { PROFESSIONS_DATA } from "@/data/professions";
import { PROFESSION_CATEGORY_COSTS } from "@/data/professionCategoryCosts";
import { TRAINING_PACKAGES, type TrainingPackage } from "@/data/trainingPackages";
import {
  categoryOptionsForConstraint,
  effectiveAllocationMode,
  getChoiceConstraint,
  isChoiceSkillGrant,
  isWeaponCategory,
  parseChoiceMaxTargets,
  parsePackageStatGainSlots,
  skillOptionsForConstraint,
  type ChoiceConstraint,
} from "@/lib/trainingPackageRules";
import { validateChoiceSkillGrants } from "@/lib/trainingPackageValidation";
import { resolveStatLevelRoll } from "@/lib/statLevelRoll";
import { applyTrainingPackageToSheet, removeTrainingPackageAtFromSheet } from "@/lib/trainingPackageMutations";
import { SPELL_LISTS, baseSpellListsByProfession } from "@/data/spellLists";
import { migrateSheet } from "@/lib/sheetMigration";
import { applyLevelUpToSheet } from "@/lib/levelUpMutations";
import {
  armorCastingPenalty,
  equipmentPenaltyByRealm,
  freeHandsModifier,
  helmetModifier,
  levelPreparationModifier,
  rollOpenEndedD100,
  spellListTypeCastingModifier,
  voiceModifier,
  type FreeHandsMode,
  type HelmetMode,
  type VoiceMode,
} from "@/lib/spellCasting";
import {
  statBasicBonus,
  rankValue,
  clampNumber,
  pctUsed,
  healthPenalty,
  magicPenalty,
  exhaustionPenalty,
  thresholdAt,
  parseDevelopmentCost,
  formatDevelopmentCostPath,
  formatDevelopmentCostSchedule,
  parseExhaustionBonusFromRaceNotes,
  rankCostOptions,
  isZeroProgression,
  isBandedDevelopmentCost,
  totalCost,
  currencyValue,
  isValidDie,
  canEditCategoryNewRanks,
  formatProgressionType,
  formatProgression,
  STAT_ABBR,
  abbrStats,
} from "@/lib/sheetMath";
import {
  CATEGORY_ORDER,
  CATEGORY_CONFIG,
  DEFAULT_CATEGORY_PROGRESSION,
  DEFAULT_SKILL_PROGRESSIONS,
  ZERO_PROGRESSION,
  normalizeText,
  groupMatch,
  buildCategoryBonuses,
} from "@/lib/categoryData";
import { uid, makeDefaultStats, makeDefaultCategories, makeDefaultSheet } from "@/lib/sheetFactory";
import {
  STAT_NAMES,
  REALM_STAT_MAP,
  firstMagicalRealm,
  type StatName,
  type Realm,
  type MagicalRealm,
  type ProgressionType,
  type RankProgression,
  type StatBlock,
  type SkillCategory,
  type Skill,
  type ArmorState,
  type EquipmentItem,
  type InjuryItem,
  type PackageRankChange,
  type PackageStatChange,
  type TrainingPackageApplication,
  type PackageStatGainSlot,
  type PackageChoiceAllocation,
  type CharacterSheet,
  type SpellListCatalogEntry,
  type SpellListType,
} from "@/lib/types";

type RaceData = {
  name: string;
  statBonuses: Partial<Record<StatName, number>>;
  rrBonuses: {
    Channeling: number;
    Essence: number;
    Mentalism: number;
    Poison: number;
    Disease: number;
    Fear: number;
  };
  soulDepartureRounds: number;
  recoveryMultiplier: number;
  bodyDevelopmentProgression: RankProgression;
  ppDevelopmentProgressionByRealm: Record<MagicalRealm, RankProgression>;
  specialNotes?: string[];
};

type ProfessionRule = {
  target: string;
  bonus: number;
};

type ProfessionData = {
  name: string;
  realmOfPower: Realm[];
  rules: ProfessionRule[];
};

type ProfessionCategoryCostMap = Record<string, Record<string, string>>;

type ResistanceName = "Channeling" | "Essence" | "Mentalism" | "Poison" | "Disease" | "Fear";

const RACES: RaceData[] = RACES_DATA as unknown as RaceData[];

const PROFESSIONS: ProfessionData[] = PROFESSIONS_DATA as unknown as ProfessionData[];
const PROFESSION_COSTS: ProfessionCategoryCostMap = PROFESSION_CATEGORY_COSTS as ProfessionCategoryCostMap;

type DicePair = { die1: number; die2: number };

type DpSpendEntry = {
  id: string;
  label: string;
  cost: number;
  kind: "categoryUpgrade" | "skillUpgrade" | "trainingPackage" | "other";
  itemKey?: string;
  upgradeStep?: number;
};

type ExtraStatRoll = {
  id: string;
  stat: StatName;
  die1: number;
  die2: number;
};

function makeEmptyBaseRolls(): Record<StatName, DicePair> {
  return STAT_NAMES.reduce((acc, stat) => {
    acc[stat] = { die1: 0, die2: 0 };
    return acc;
  }, {} as Record<StatName, DicePair>);
}

function parseSignedNumber(value: string): number {
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const match = String(value ?? "").match(/[+-]?\d+/);
  return match ? Number(match[0]) : 0;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

const NumberInput = React.forwardRef<HTMLInputElement, { value: number; onChange: (v: number) => void; className?: string; min?: number; max?: number; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> }>(function NumberInput({ value, onChange, className = "", min, max, onKeyDown }, ref) {
  const [localValue, setLocalValue] = React.useState<string>("");
  const [focused, setFocused] = React.useState(false);

  const normalizeNumericString = (raw: string) => {
    if (raw === "" || raw === "-") return raw;
    return raw.replace(/^(-?)0+(?=\d)/, "$1");
  };

  const displayValue = focused ? localValue : (Number.isFinite(value) ? String(value) : "0");

  return (
    <Input
      ref={ref}
      type="number"
      value={displayValue}
      min={min}
      max={max}
      className={`h-8 ${className}`.trim()}
      onFocus={(e) => {
        setFocused(true);
        setLocalValue(e.target.value);
      }}
      onWheel={(e) => {
        // Prevent accidental value changes from mouse wheel while allowing page scroll.
        if (document.activeElement === e.currentTarget) {
          e.currentTarget.blur();
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        const normalized = normalizeNumericString(raw);
        setLocalValue(normalized);
        if (normalized === "" || normalized === "-") return;
        onChange(Number(normalized));
      }}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        setFocused(false);
        const raw = e.target.value;
        if (raw === "" || raw === "-") {
          const fallback = min ?? 0;
          setLocalValue(String(fallback));
          onChange(fallback);
          return;
        }
        const normalized = String(Number(normalizeNumericString(raw)));
        setLocalValue(normalized);
        if (raw !== normalized) onChange(Number(normalized));
      }}
    />
  );
});

function RankCheckboxes({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n && n > 1 ? n - 1 : n)}
          className={`h-5 w-5 rounded border-2 transition-colors ${value >= n ? "bg-slate-700 border-slate-700" : "bg-white border-slate-300 hover:border-slate-500"}`}
          title={`${n} rank${n > 1 ? "s" : ""}`}
        />
      ))}
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border-pink-200/50 shadow-sm">
      <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-center">
        <CardTitle className="text-lg">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type CharacterEntry = { id: string; sheet: CharacterSheet };

// ─── Combat round helper types & constants ───────────────────────────────────

type CombatPhaseKey = "snap" | "normal" | "deliberate" | "postDeliberate";
type CombatAttackType = "fullMelee" | "pressMelee" | "reactMelee" | "missile";
type CombatMovementPace = "walk" | "fastWalk" | "run" | "sprint" | "fastSprint" | "dash";

type CombatPhaseState = {
  actionId: string;
  activityPct: number;
  pace: CombatMovementPace;
  attackType: CombatAttackType;
  skillName: string;
  baseOB: number;
  parryOB: number;
  diceResult: number;
  diceBreakdown: string;
  modFlank: boolean;
  modRear: boolean;
  modSurprise: boolean;
  modAdvantage: number;
  modCharging: boolean;
  movementFt: number;
  modStunned: boolean;
  modDowned: boolean;
  modProne: boolean;
  modRange: number;
  modArmorPenalty: number;
  modOther: number;
  resolved: boolean;
  cancelled: boolean;
  accumulatedActivity: number;
};

function makeCombatPhaseState(): CombatPhaseState {
  return {
    actionId: "none", activityPct: 0, pace: "walk",
    attackType: "fullMelee", skillName: "", baseOB: 0,
    parryOB: 0, diceResult: 0, diceBreakdown: "",
    modFlank: false, modRear: false, modSurprise: false, modAdvantage: 0,
    modCharging: false, movementFt: 0,
    modStunned: false, modDowned: false, modProne: false,
    modRange: 0, modArmorPenalty: 0, modOther: 0,
    resolved: false, cancelled: false, accumulatedActivity: 0,
  };
}

const COMBAT_PHASES: readonly { key: CombatPhaseKey; label: string; modifier: number }[] = [
  { key: "snap", label: "Snap", modifier: -20 },
  { key: "normal", label: "Normal", modifier: 0 },
  { key: "deliberate", label: "Deliberate", modifier: 10 },
  { key: "postDeliberate", label: "Post-Deliberate", modifier: 0 },
];

const COMBAT_MOVEMENT_PACES: readonly { key: CombatMovementPace; label: string; multiplier: number }[] = [
  { key: "walk", label: "Walk", multiplier: 1 },
  { key: "fastWalk", label: "Fast Walk", multiplier: 1.5 },
  { key: "run", label: "Run", multiplier: 2 },
  { key: "sprint", label: "Sprint", multiplier: 3 },
  { key: "fastSprint", label: "Fast Sprint", multiplier: 4 },
  { key: "dash", label: "Dash", multiplier: 5 },
];

type CombatActionDef = {
  id: string;
  label: string;
  defaultActivity: number;
  minActivity: number;
  maxActivity: number;
  variable: boolean;
  isAttack: boolean;
  isMovement: boolean;
  attackType?: CombatAttackType;
  attackMaxActivity?: number;
  phase?: CombatPhaseKey;
  group: string;
  totalRequired?: number;
};

const COMBAT_ACTION_DEFS: CombatActionDef[] = [
  { id: "none", label: "— No action —", defaultActivity: 0, minActivity: 0, maxActivity: 0, variable: false, isAttack: false, isMovement: false, group: "" },
  // Attacks
  { id: "fullMelee", label: "Full melee attack (+10 OB)", defaultActivity: 100, minActivity: 60, maxActivity: 100, variable: true, isAttack: true, attackType: "fullMelee", attackMaxActivity: 100, isMovement: false, group: "Attacks" },
  { id: "pressMelee", label: "Press & melee attack", defaultActivity: 100, minActivity: 80, maxActivity: 100, variable: true, isAttack: true, attackType: "pressMelee", attackMaxActivity: 100, isMovement: false, group: "Attacks" },
  { id: "reactMelee", label: "React & melee attack (–10 OB)", defaultActivity: 100, minActivity: 80, maxActivity: 100, variable: true, isAttack: true, attackType: "reactMelee", attackMaxActivity: 100, isMovement: false, group: "Attacks" },
  { id: "missile", label: "Missile attack (30–60%)", defaultActivity: 50, minActivity: 30, maxActivity: 60, variable: true, isAttack: true, attackType: "missile", attackMaxActivity: 60, isMovement: false, group: "Attacks" },
  { id: "parryMissile", label: "Parry a missile (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Attacks" },
  // Movement (phase-specific)
  { id: "movSnap", label: "Movement (1–20%)", defaultActivity: 10, minActivity: 1, maxActivity: 20, variable: true, isAttack: false, isMovement: true, phase: "snap", group: "Movement" },
  { id: "movNormal", label: "Movement (1–50%)", defaultActivity: 25, minActivity: 1, maxActivity: 50, variable: true, isAttack: false, isMovement: true, phase: "normal", group: "Movement" },
  { id: "movDelib", label: "Movement (1–80%)", defaultActivity: 40, minActivity: 1, maxActivity: 80, variable: true, isAttack: false, isMovement: true, phase: "deliberate", group: "Movement" },
  { id: "movPost", label: "Movement (any%)", defaultActivity: 50, minActivity: 1, maxActivity: 100, variable: true, isAttack: false, isMovement: true, phase: "postDeliberate", group: "Movement" },
  // Spells
  { id: "prepSpell", label: "Prepare a spell (90%)", defaultActivity: 90, minActivity: 90, maxActivity: 90, variable: false, isAttack: false, isMovement: false, group: "Spells" },
  { id: "castNonInstant", label: "Cast — non-instantaneous (75%)", defaultActivity: 75, minActivity: 75, maxActivity: 75, variable: false, isAttack: false, isMovement: false, group: "Spells" },
  { id: "castInstant", label: "Cast — instantaneous (10%)", defaultActivity: 10, minActivity: 10, maxActivity: 10, variable: false, isAttack: false, isMovement: false, group: "Spells" },
  { id: "concentration", label: "Concentration (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Spells" },
  // Maneuvers
  { id: "movingManeuver", label: "Moving maneuver (1–100%)", defaultActivity: 50, minActivity: 1, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "staticManeuver", label: "Static maneuver (1–100%)", defaultActivity: 50, minActivity: 1, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "awarenessManeuver", label: "Awareness maneuver (10%)", defaultActivity: 10, minActivity: 10, maxActivity: 10, variable: false, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "disengage", label: "Disengage from melee (25%)", defaultActivity: 25, minActivity: 25, maxActivity: 25, variable: false, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "hiding", label: "Hiding (20%)", defaultActivity: 20, minActivity: 20, maxActivity: 20, variable: false, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "stalking", label: "Stalking (50–100%)", defaultActivity: 75, minActivity: 50, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "climbing", label: "Climbing (60–100%)", defaultActivity: 80, minActivity: 60, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Maneuvers" },
  { id: "controlMount", label: "Control a mount (10–100%)", defaultActivity: 50, minActivity: 10, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Maneuvers" },
  // Observation
  { id: "obsRapid", label: "Rapid Observation (30%, –40 mod)", defaultActivity: 30, minActivity: 30, maxActivity: 30, variable: false, isAttack: false, isMovement: false, group: "Observation" },
  { id: "obsHalf", label: "Half Observation (50%, –20 mod)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Observation" },
  { id: "obsFull", label: "Full Observation (70%)", defaultActivity: 70, minActivity: 70, maxActivity: 70, variable: false, isAttack: false, isMovement: false, group: "Observation" },
  // Gear
  { id: "shiftWeapon", label: "Shift a weapon (10%)", defaultActivity: 10, minActivity: 10, maxActivity: 10, variable: false, isAttack: false, isMovement: false, group: "Gear" },
  { id: "drawWeapon", label: "Draw a weapon (20%)", defaultActivity: 20, minActivity: 20, maxActivity: 20, variable: false, isAttack: false, isMovement: false, group: "Gear" },
  { id: "changeWeapon", label: "Change weapons (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Gear" },
  { id: "pickUp", label: "Pick something up (30%)", defaultActivity: 30, minActivity: 30, maxActivity: 30, variable: false, isAttack: false, isMovement: false, group: "Gear" },
  { id: "drop", label: "Drop something (0%)", defaultActivity: 0, minActivity: 0, maxActivity: 0, variable: false, isAttack: false, isMovement: false, group: "Gear" },
  // Posture
  { id: "standSeated", label: "Stand from seated (10%)", defaultActivity: 10, minActivity: 10, maxActivity: 10, variable: false, isAttack: false, isMovement: false, group: "Posture" },
  { id: "standKnees", label: "Stand from knees/crouch (20%)", defaultActivity: 20, minActivity: 20, maxActivity: 20, variable: false, isAttack: false, isMovement: false, group: "Posture" },
  { id: "kneelProne", label: "Kneel from prone (30%)", defaultActivity: 30, minActivity: 30, maxActivity: 30, variable: false, isAttack: false, isMovement: false, group: "Posture" },
  { id: "standProne", label: "Stand from prone (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Posture" },
  { id: "dropRapid", label: "Rapid drop to ground (10%)", defaultActivity: 10, minActivity: 10, maxActivity: 10, variable: false, isAttack: false, isMovement: false, group: "Posture" },
  { id: "dropCareful", label: "Careful drop to ground (20%)", defaultActivity: 20, minActivity: 20, maxActivity: 20, variable: false, isAttack: false, isMovement: false, group: "Posture" },
  // Mounted
  { id: "dismountRapid", label: "Rapid dismount (20%)", defaultActivity: 20, minActivity: 20, maxActivity: 20, variable: false, isAttack: false, isMovement: false, group: "Mounted" },
  { id: "dismountCareful", label: "Careful dismount (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Mounted" },
  { id: "mount", label: "Mount an animal (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Mounted" },
  // Other
  { id: "swimRelaxed", label: "Relaxed swim (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Other" },
  { id: "swimHard", label: "Hard swim (90%)", defaultActivity: 90, minActivity: 90, maxActivity: 90, variable: false, isAttack: false, isMovement: false, group: "Other" },
  // Reloads
  { id: "reloadSling", label: "Sling (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Reloads" },
  { id: "reloadShortBow", label: "Short bow (50%)", defaultActivity: 50, minActivity: 50, maxActivity: 50, variable: false, isAttack: false, isMovement: false, group: "Reloads" },
  { id: "reloadCompBow", label: "Composite bow (60%)", defaultActivity: 60, minActivity: 60, maxActivity: 60, variable: false, isAttack: false, isMovement: false, group: "Reloads" },
  { id: "reloadLongBow", label: "Long bow (70%)", defaultActivity: 70, minActivity: 70, maxActivity: 70, variable: false, isAttack: false, isMovement: false, group: "Reloads" },
  { id: "reloadLightXbow", label: "Light crossbow (160% total)", defaultActivity: 50, minActivity: 1, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Reloads", totalRequired: 160 },
  { id: "reloadHeavyXbow", label: "Heavy crossbow (220% total)", defaultActivity: 50, minActivity: 1, maxActivity: 100, variable: true, isAttack: false, isMovement: false, group: "Reloads", totalRequired: 220 },
];

const MISSILE_WEAPON_CATS = ["Weapon • Missile", "Weapon • Missile Artillery", "Weapon • Thrown"];

// ─────────────────────────────────────────────────────────────────────────────

const TAB_OPTIONS = [
  { value: "front", label: "Main" },
  { value: "details", label: "Details" },
  { value: "stats", label: "Stats" },
  { value: "combat", label: "Combat" },
  { value: "categories", label: "Skills" },
  { value: "spells", label: "Spells" },
  { value: "gear", label: "Gear" },
  { value: "status", label: "Status" },
  { value: "backup", label: "Backup" },
] as const;

type TabValue = (typeof TAB_OPTIONS)[number]["value"];
type ActiveView = TabValue | "levelUp";

export default function RolemasterCharacterSheetEngine() {
  const [characters, setCharacters] = useState<CharacterEntry[]>(() => [{ id: uid("char"), sheet: makeDefaultSheet() }]);
  const [activeId, setActiveId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ActiveView>("front");
  const [lastNonHelperTab, setLastNonHelperTab] = useState<TabValue>("front");
  const [expandedMobileSkillId, setExpandedMobileSkillId] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [expandedMobileStat, setExpandedMobileStat] = useState<StatName | null>(null);
  const [expandedMobileCategoryId, setExpandedMobileCategoryId] = useState<string | null>(null);
  const [hideEmptyCategories, setHideEmptyCategories] = useState(false);
  const [alwaysShowSkills, setAlwaysShowSkills] = useState(false);
  const [expandedSpellListIds, setExpandedSpellListIds] = useState<Set<string>>(() => new Set());
  const [expandedGearItemId, setExpandedGearItemId] = useState<string | null>(null);
  const [editingGearItemId, setEditingGearItemId] = useState<string | null>(null);
  const [baseStatRolls, setBaseStatRolls] = useState<Record<StatName, DicePair>>(() => makeEmptyBaseRolls());
  const [dpSpendEntries, setDpSpendEntries] = useState<DpSpendEntry[]>([]);
  const [extraStatRolls, setExtraStatRolls] = useState<ExtraStatRoll[]>([]);
  const [newLevelUpSkillName, setNewLevelUpSkillName] = useState("");
  const [newLevelUpSkillCategoryId, setNewLevelUpSkillCategoryId] = useState("");
  const [showNewSkillForm, setShowNewSkillForm] = useState(false);
  const [showTrainingPackageForm, setShowTrainingPackageForm] = useState(false);
  const [trainingPackageSpendName, setTrainingPackageSpendName] = useState("");
  const [trainingPackageSpendCost, setTrainingPackageSpendCost] = useState(0);
  const [selectedPackageName, setSelectedPackageName] = useState("");
  const [pendingPackageSkillChoices, setPendingPackageSkillChoices] = useState<Record<number, PackageChoiceAllocation[]>>({});
  const [pendingPackageSpecials, setPendingPackageSpecials] = useState<Record<number, boolean>>({});
  const [pendingPackageStatRolls, setPendingPackageStatRolls] = useState<Array<{ slotId: string; stat: StatName; die1: number; die2: number; allowsChoice: boolean; choiceGroup?: "different" }>>([]);
  const [selectedCastListId, setSelectedCastListId] = useState("");
  const [selectedCastSpellId, setSelectedCastSpellId] = useState("");
  const [isCastAssistantOpen, setIsCastAssistantOpen] = useState(false);
  const [castPrepRounds, setCastPrepRounds] = useState(0);
  const [castSnapAction, setCastSnapAction] = useState(false);
  const [castFreeHands, setCastFreeHands] = useState<FreeHandsMode>("one");
  const [castVoice, setCastVoice] = useState<VoiceMode>("whisper");
  const [castHelmet, setCastHelmet] = useState<HelmetMode>("none");
  const [castOrganicLivingWeight, setCastOrganicLivingWeight] = useState(0);
  const [castOrganicNonLivingWeight, setCastOrganicNonLivingWeight] = useState(0);
  const [castInorganicWeight, setCastInorganicWeight] = useState(0);
  const [castManualModifier, setCastManualModifier] = useState(0);
  const [castUseFreeSpell, setCastUseFreeSpell] = useState(false);
  const [castOpenEndedRoll, setCastOpenEndedRoll] = useState(0);
  const [castRollBreakdown, setCastRollBreakdown] = useState("");
  const [lastCastSummary, setLastCastSummary] = useState("");
  const [selectedUseAction, setSelectedUseAction] = useState<{ label: string; name: string; bonus: number } | null>(null);
  const [poolEditModal, setPoolEditModal] = useState<"hits" | "pp" | "ep" | null>(null);
  const [isHealingModalOpen, setIsHealingModalOpen] = useState(false);
  const [healingHours, setHealingHours] = useState(0);
  const [healingActivity, setHealingActivity] = useState<"active" | "resting" | "sleeping">("active");
  const [combatInitDie1, setCombatInitDie1] = useState(0);
  const [combatInitDie2, setCombatInitDie2] = useState(0);
  const [combatInitBreakdown, setCombatInitBreakdown] = useState("");
  const [combatPhases, setCombatPhases] = useState<Record<CombatPhaseKey, CombatPhaseState>>(() => ({
    snap: makeCombatPhaseState(),
    normal: makeCombatPhaseState(),
    deliberate: makeCombatPhaseState(),
    postDeliberate: makeCombatPhaseState(),
  }));
  const [combatCancelledInfo, setCombatCancelledInfo] = useState<{ total: number; high: boolean } | null>(null);
  const [useActionDiceResult, setUseActionDiceResult] = useState(0);
  const [useActionRollBreakdown, setUseActionRollBreakdown] = useState("");
  const [useActionExtraModifier, setUseActionExtraModifier] = useState(0);
  const [talentInput, setTalentInput] = useState("");
  const [flawInput, setFlawInput] = useState("");
  const [transitionKey, setTransitionKey] = useState(0);
  const transitionDir = React.useRef<"left" | "right" | "fade">("fade");
  const activeTabRef = useRef<ActiveView>("front");
  const [draggedSkillId, setDraggedSkillId] = useState<string | null>(null);
  const [draggedGearIndex, setDraggedGearIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const mobileCharacterTabsRef = useRef<HTMLDivElement | null>(null);
  const trainingPackageRef = useRef<HTMLDivElement | null>(null);
  const castModalBackdropMouseDownRef = useRef(false);
  const skillModalBackdropMouseDownRef = useRef(false);
  const gearModalBackdropMouseDownRef = useRef(false);
  const useActionModalBackdropMouseDownRef = useRef(false);

  // Derive active sheet (fall back to first character)
  const activeCharacter = characters.find((c) => c.id === activeId) ?? characters[0];
  const sheet = activeCharacter.sheet;
  const activeTabIndex = TAB_OPTIONS.findIndex((tab) => tab.value === activeTab);

  useEffect(() => {
    if (activeTab !== "levelUp") setLastNonHelperTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const exists = sheet.skillCategories.some((cat) => cat.id === newLevelUpSkillCategoryId);
    if (!exists && sheet.skillCategories[0]?.id) {
      setNewLevelUpSkillCategoryId(sheet.skillCategories[0].id);
    }
  }, [newLevelUpSkillCategoryId, sheet.skillCategories]);

  useEffect(() => {
    const sectionTabs = document.getElementById("section-tabs-strip");
    if (!sectionTabs) return;
    const activeEl = sectionTabs.querySelector<HTMLElement>(`[data-tab-value="${activeTab}"]`);
    if (!activeEl) return;
    const containerRect = sectionTabs.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const targetScroll = sectionTabs.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
    sectionTabs.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [activeTab]);

  useEffect(() => {
    const container = mobileCharacterTabsRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-char-id="${activeCharacter.id}"]`);
    if (!activeEl) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const targetScroll = container.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [activeCharacter.id]);

  useEffect(() => {
    setExpandedMobileSkillId(null);
    setEditingSkillId(null);
    setExpandedMobileStat(null);
    setExpandedMobileCategoryId(null);
    setExpandedGearItemId(null);
    setEditingGearItemId(null);
    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    setSelectedPackageName("");
    setPendingPackageSkillChoices({});
    setPendingPackageSpecials({});
    setPendingPackageStatRolls([]);
    setIsCastAssistantOpen(false);
    setSelectedCastListId("");
    setSelectedCastSpellId("");
    setCastPrepRounds(0);
    setCastSnapAction(false);
    setCastFreeHands("one");
    setCastVoice("whisper");
    setCastHelmet("none");
    setCastOrganicLivingWeight(0);
    setCastOrganicNonLivingWeight(0);
    setCastInorganicWeight(0);
    setCastManualModifier(0);
    setCastUseFreeSpell(false);
    setCastOpenEndedRoll(0);
    setCastRollBreakdown("");
    setLastCastSummary("");
    setSelectedUseAction(null);
    setUseActionDiceResult(0);
    setUseActionRollBreakdown("");
    setUseActionExtraModifier(0);
    setPoolEditModal(null);
    setIsHealingModalOpen(false);
    setHealingHours(0);
    setHealingActivity("active");
    setCombatInitDie1(0);
    setCombatInitDie2(0);
    setCombatInitBreakdown("");
    setCombatCancelledInfo(null);
    setCombatPhases({
      snap: makeCombatPhaseState(),
      normal: makeCombatPhaseState(),
      deliberate: makeCombatPhaseState(),
      postDeliberate: makeCombatPhaseState(),
    });
  }, [activeCharacter.id]);

  useEffect(() => {
    const rawParty = localStorage.getItem("rolemaster-party");
    const rawLegacy = rawParty ? null : localStorage.getItem("rolemaster-sheet-engine");
    const raw = rawParty ?? rawLegacy;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          const migrated: CharacterEntry[] = data.map((e: CharacterEntry) => ({ id: e.id, sheet: migrateSheet(e.sheet) }));
          setCharacters(migrated);
          setActiveId(migrated[0].id);
        } else {
          // migrate old single-sheet save
          const entry = { id: uid("char"), sheet: migrateSheet(data) };
          setCharacters([entry]);
          setActiveId(entry.id);
        }
      } catch {
        // ignore corrupt save
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("rolemaster-party", JSON.stringify(characters));
  }, [characters, loaded]);

  const isAnyModalOpen = isCastAssistantOpen || Boolean(editingSkillId) || Boolean(editingGearItemId) || Boolean(selectedUseAction) || Boolean(poolEditModal) || isHealingModalOpen;

  useEffect(() => {
    if (!isAnyModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isAnyModalOpen]);

  // Sync activeTabRef so hashchange handler never has a stale closure
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Runs after the new tab's content has committed, so scroll anchoring can't undo it
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Hash-based navigation: back/forward works on all platforms incl. Android back button + iOS edge swipe
  useEffect(() => {
    const initial = window.location.hash.slice(1) as ActiveView;
    if (TAB_OPTIONS.some((t) => t.value === initial)) {
      setActiveTab(initial);
    }

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as ActiveView;
      if (!TAB_OPTIONS.some((t) => t.value === hash)) return;
      if (hash === activeTabRef.current) return;
      transitionDir.current = "fade";
      setTransitionKey((k) => k + 1);
      setActiveTab(hash);
    };

    // Desktop: mouse side-buttons (button 3 = back, button 4 = forward)
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); history.back(); }
      else if (e.button === 4) { e.preventDefault(); history.forward(); }
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateToTab = (tab: ActiveView, dir: "left" | "right" | "fade" = "fade") => {
    transitionDir.current = dir;
    setTransitionKey((k) => k + 1);
    setActiveTab(tab);
    if (TAB_OPTIONS.some((t) => t.value === (tab as string))) {
      window.location.hash = tab as string;
    }
  };

  const selectedRace = useMemo(
    () => RACES.find((r) => r.name === sheet.details.race) ?? RACES[0],
    [sheet.details.race]
  );

  const selectedProfession = useMemo(
    () => PROFESSIONS.find((p) => p.name === sheet.details.profession) ?? PROFESSIONS[0],
    [sheet.details.profession]
  );

  const selectedProfessionCosts = useMemo(
    () => PROFESSION_COSTS[sheet.details.profession] ?? {},
    [sheet.details.profession]
  );

  const primaryRealm = useMemo(
    () => firstMagicalRealm(sheet.details.realmOfPower as Realm[]),
    [sheet.details.realmOfPower]
  );

  const professionCategoryBonuses = useMemo(() => buildCategoryBonuses(selectedProfession.rules), [selectedProfession]);

  useEffect(() => {
    setSheet((prev) => {
      const nextStats = { ...prev.stats };
      STAT_NAMES.forEach((name) => {
        nextStats[name] = {
          ...nextStats[name],
          racialBonus: selectedRace.statBonuses[name] ?? 0,
        };
      });
      const nextCategories = prev.skillCategories.map((cat) => ({
        ...cat,
        professionBonus: professionCategoryBonuses[cat.name] ?? 0,
        developmentCost: Object.prototype.hasOwnProperty.call(selectedProfessionCosts, cat.name)
          ? selectedProfessionCosts[cat.name]
          : cat.developmentCost,
      }));
      return {
        ...prev,
        stats: nextStats,
        skillCategories: nextCategories,
        details: {
          ...prev.details,
          realmOfPower: selectedProfession.realmOfPower,
        },
      };
    });
  }, [selectedRace, selectedProfession, selectedProfessionCosts, professionCategoryBonuses, activeId]);

  const statTotals = useMemo(() => {
    return STAT_NAMES.reduce((acc, name) => {
      const stat = sheet.stats[name];
      const basic = statBasicBonus(stat.temp);
      const total = basic + stat.racialBonus + stat.specialBonus;
      acc[name] = { basic, racial: stat.racialBonus, special: stat.specialBonus, total };
      return acc;
    }, {} as Record<StatName, { basic: number; racial: number; special: number; total: number }>);
  }, [sheet.stats]);

  const developmentPoints = useMemo(() => {
    const keys: StatName[] = ["Agility", "Constitution", "Memory", "Reasoning", "Self Discipline"];
    const avg = keys.reduce((sum, k) => sum + sheet.stats[k].temp, 0) / keys.length;
    return Math.floor(avg);
  }, [sheet.stats]);

  const armorQuicknessBonus = statTotals["Quickness"].total * 3;
  const totalNormalDB = Math.max(0, armorQuicknessBonus + sheet.armor.armorQuicknessPenalty + sheet.armor.shieldBonus + sheet.armor.magicBonus + sheet.armor.specialBonus);

  const resistanceRolls = useMemo(() => {
    return {
      Channeling: {
        raceBonus: selectedRace.rrBonuses.Channeling,
        statBonus: statTotals["Intuition"].total * 3,
      },
      Essence: {
        raceBonus: selectedRace.rrBonuses.Essence,
        statBonus: statTotals["Empathy"].total * 3,
      },
      Mentalism: {
        raceBonus: selectedRace.rrBonuses.Mentalism,
        statBonus: statTotals["Presence"].total * 3,
      },
      Poison: {
        raceBonus: selectedRace.rrBonuses.Poison,
        statBonus: statTotals["Constitution"].total * 3,
      },
      Disease: {
        raceBonus: selectedRace.rrBonuses.Disease,
        statBonus: statTotals["Constitution"].total * 3,
      },
      Fear: {
        raceBonus: selectedRace.rrBonuses.Fear,
        statBonus: statTotals["Self Discipline"].total * 3,
      },
    } as Record<ResistanceName, { raceBonus: number; statBonus: number }>;
  }, [selectedRace, statTotals]);

  const categoryDerived = useMemo(() => {
    const primaryRealm = firstMagicalRealm(sheet.details.realmOfPower as Realm[]);
    return sheet.skillCategories.map((cat) => {
      const devBonus = cat.developmentPointBonus ?? 0;
      const progression = cat.progressionType === "bodyDevelopment"
        ? (devBonus ? [selectedRace.bodyDevelopmentProgression[0], ...selectedRace.bodyDevelopmentProgression.slice(1).map((v) => v + devBonus)] as [number,number,number,number,number] : selectedRace.bodyDevelopmentProgression)
        : cat.progressionType === "powerPointDevelopment"
          ? (devBonus ? [selectedRace.ppDevelopmentProgressionByRealm[primaryRealm][0], ...selectedRace.ppDevelopmentProgressionByRealm[primaryRealm].slice(1).map((v) => v + devBonus)] as [number,number,number,number,number] : selectedRace.ppDevelopmentProgressionByRealm[primaryRealm])
          : cat.progressionType === "combined" || cat.progressionType === "limited" || cat.progressionType === "special"
            ? ZERO_PROGRESSION
            : cat.customProgression ?? DEFAULT_CATEGORY_PROGRESSION;

      const realmStatName = cat.name.startsWith("Spells • ") || cat.name === "Power Point Development"
        ? REALM_STAT_MAP[primaryRealm]
        : null;
      const stat = realmStatName
        ? statTotals[realmStatName].total
        : cat.applicableStats.reduce((sum, statName) => sum + (statTotals[statName]?.total ?? 0), 0);
      const rank = rankValue(cat.ranks, progression);
      const total = rank + stat + cat.professionBonus + cat.specialBonus;
      return {
        ...cat,
        applicableStatsDisplay: realmStatName ? abbrStats([realmStatName]) : abbrStats(cat.applicableStats),
        progression,
        stat,
        rank,
        total,
      };
    });
  }, [sheet.skillCategories, selectedRace, statTotals, sheet.details.realmOfPower]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categoryDerived)[number]>();
    categoryDerived.forEach((c) => map.set(c.id, c));
    return map;
  }, [categoryDerived]);

  useEffect(() => {
    setSheet((prev) => {
      const fixedSkills = prev.skills.map((skill, idx) => {
        if (skill.categoryId) return skill;
        const defaultCat = prev.skillCategories.find((cat) => cat.name === "Awareness • Perceptions") ?? prev.skillCategories[0];
        return idx === 0 ? { ...skill, categoryId: defaultCat?.id ?? "" } : skill;
      });
      return { ...prev, skills: fixedSkills };
    });
  }, []);

  const skillDerived = useMemo(() => {
    const primaryRealm = firstMagicalRealm(sheet.details.realmOfPower as Realm[]);
    return sheet.skills.map((skill) => {
      const category = categoryMap.get(skill.categoryId);
      const progressionType = category?.progressionType ?? "standard";
      const devBonus = category?.developmentPointBonus ?? 0;
      const progression = progressionType === "bodyDevelopment"
        ? (devBonus ? [selectedRace.bodyDevelopmentProgression[0], ...selectedRace.bodyDevelopmentProgression.slice(1).map((v) => v + devBonus)] as [number,number,number,number,number] : selectedRace.bodyDevelopmentProgression)
        : progressionType === "powerPointDevelopment"
          ? (devBonus ? [selectedRace.ppDevelopmentProgressionByRealm[primaryRealm][0], ...selectedRace.ppDevelopmentProgressionByRealm[primaryRealm].slice(1).map((v) => v + devBonus)] as [number,number,number,number,number] : selectedRace.ppDevelopmentProgressionByRealm[primaryRealm])
          : DEFAULT_SKILL_PROGRESSIONS[progressionType] ?? DEFAULT_SKILL_PROGRESSIONS.standard;
      const rank = rankValue(skill.ranks, progression);
      const categoryTotal = category?.total ?? 0;
      const total = rank + categoryTotal + skill.itemBonus + skill.specialBonus;
      return {
        ...skill,
        category,
        progression,
        rank,
        categoryTotal,
        total,
      };
    });
  }, [sheet.skills, categoryMap, selectedRace, sheet.details.realmOfPower]);

  const editingSkill = useMemo(
    () => skillDerived.find((skill) => skill.id === editingSkillId) ?? null,
    [skillDerived, editingSkillId],
  );

  const editingGearItem = useMemo(
    () => sheet.equipment.find((item) => item.id === editingGearItemId) ?? null,
    [sheet.equipment, editingGearItemId],
  );

  const bodyDevelopmentCategoryTotal = categoryDerived.find((c) => c.name === "Body Development")?.total ?? 0;

  const spellTabLists = useMemo(() => {
    const profession = sheet.details.profession;
    const spellCatIds = new Set(
      sheet.skillCategories.filter((c) => c.name.startsWith("Spells •")).map((c) => c.id)
    );
    const ranksByName = new Map<string, number>();
    for (const skill of sheet.skills) {
      if (spellCatIds.has(skill.categoryId) && skill.name.trim()) {
        ranksByName.set(skill.name.trim().toLowerCase(), skill.ranks);
      }
    }
    const baseLists = baseSpellListsByProfession(profession);
    const baseListIds = new Set(baseLists.map((l) => l.id));
    const otherLists = SPELL_LISTS.filter(
      (l) => !baseListIds.has(l.id) && ranksByName.has(l.name.toLowerCase())
    );
    return [...baseLists, ...otherLists].map((l) => ({
      entry: l,
      ranks: ranksByName.get(l.name.toLowerCase()) ?? 0,
    }));
  }, [sheet.skillCategories, sheet.skills, sheet.details.profession]);

  const spellSkillBonusByListId = useMemo(() => {
    const spellCategoryIds = new Set(
      sheet.skillCategories.filter((category) => category.name.startsWith("Spells •")).map((category) => category.id),
    );
    const bonusByName = new Map<string, number>();
    for (const skill of skillDerived) {
      if (!spellCategoryIds.has(skill.categoryId)) continue;
      const key = skill.name.trim().toLowerCase();
      if (!key) continue;
      bonusByName.set(key, skill.total);
    }

    return spellTabLists.reduce((acc, list) => {
      acc[list.entry.id] = bonusByName.get(list.entry.name.trim().toLowerCase()) ?? 0;
      return acc;
    }, {} as Record<string, number>);
  }, [sheet.skillCategories, skillDerived, spellTabLists]);

  useEffect(() => {
    if (spellTabLists.length === 0) {
      setSelectedCastListId("");
      return;
    }
    const exists = spellTabLists.some((list) => list.entry.id === selectedCastListId);
    if (!exists) {
      setSelectedCastListId("");
    }
  }, [spellTabLists, selectedCastListId]);

  const selectedCastList = useMemo(
    () => spellTabLists.find((list) => list.entry.id === selectedCastListId) ?? null,
    [selectedCastListId, spellTabLists],
  );

  const availableCastSpells = useMemo(() => {
    if (!selectedCastList) return [];
    return selectedCastList.entry.spells.filter((spell) => spell.requiredRanks <= selectedCastList.ranks);
  }, [selectedCastList]);

  useEffect(() => {
    if (availableCastSpells.length === 0) {
      setSelectedCastSpellId("");
      return;
    }
    const exists = availableCastSpells.some((spell) => spell.id === selectedCastSpellId);
    if (!exists) {
      setSelectedCastSpellId("");
    }
  }, [availableCastSpells, selectedCastSpellId]);

  const selectedCastSpell = useMemo(
    () => availableCastSpells.find((spell) => spell.id === selectedCastSpellId) ?? null,
    [availableCastSpells, selectedCastSpellId],
  );

  const castRealm = selectedCastList?.entry.realm ?? firstMagicalRealm(sheet.details.realmOfPower as Realm[]);
  const castSpellBonus = selectedCastList ? (spellSkillBonusByListId[selectedCastList.entry.id] ?? 0) : 0;
  const castLevelDelta = selectedCastSpell ? sheet.details.level - selectedCastSpell.level : 0;
  const castIsInstantaneous = Boolean(selectedCastSpell?.specialCodes.includes("*"));
  const castPreparationModifier = selectedCastSpell
    ? levelPreparationModifier(castLevelDelta, castIsInstantaneous, castPrepRounds)
    : 0;
  const castSnapActionModifier = selectedCastSpell && !castIsInstantaneous && castSnapAction ? -20 : 0;
  const castListTypeModifier = selectedCastList
    ? spellListTypeCastingModifier(selectedCastList.entry.type, selectedCastList.entry.realm, sheet.details.realmOfPower)
    : 0;
  const castFreeHandsModifier = freeHandsModifier(castRealm, castFreeHands);
  const castVoiceModifier = voiceModifier(castRealm, castVoice);
  const castHelmetModifier = helmetModifier(castRealm, castHelmet);
  const castEquipmentModifier = equipmentPenaltyByRealm(castRealm, {
    organicLiving: castOrganicLivingWeight,
    organicNonLiving: castOrganicNonLivingWeight,
    inorganic: castInorganicWeight,
  });
  const castArmorModifier = armorCastingPenalty(castRealm, sheet.armor.armorType);
  const castPpCost = selectedCastSpell
    ? (selectedCastSpell.specialCodes.includes("•") ? 0 : selectedCastSpell.level)
    : 0;

  const powerPointCategoryTotal = categoryDerived.find((c) => c.name === "Power Point Development")?.total ?? 0;
  const bodyDevelopmentSkill = skillDerived.find((s) => s.category?.name === "Body Development");
  const powerPointSkill = skillDerived.find((s) => s.category?.name === "Power Point Development");

  const bodyDevelopmentTotal = bodyDevelopmentSkill
    ? bodyDevelopmentCategoryTotal + bodyDevelopmentSkill.rank
    : bodyDevelopmentCategoryTotal;
  const powerPointTotal = powerPointSkill
    ? powerPointCategoryTotal + powerPointSkill.rank
    : powerPointCategoryTotal;

  const raceExhaustionBonus = parseExhaustionBonusFromRaceNotes(selectedRace.specialNotes);
  const totalHits = Math.max(0, bodyDevelopmentTotal);
  const spellMultiplierValue = parseFloat(sheet.magic.spellMultiplier) || 1;
  const spellAdderValue = parseInt(sheet.magic.spellAdder, 10) || 0;
  const totalPP = Math.max(0, Math.round(powerPointTotal * spellMultiplierValue));
  const totalEP = Math.max(0, 40 + statTotals["Constitution"].total * 3 + raceExhaustionBonus + sheet.exhaustion.specialBonus);

  const currentHitsPool = totalHits - sheet.health.currentHits;
  const currentPPPool = Math.max(0, totalPP - sheet.magic.currentPP);
  const currentEPPool = Math.max(0, totalEP - sheet.exhaustion.currentEP);

  const healingPrimaryRealm = firstMagicalRealm(sheet.details.realmOfPower as Realm[]);
  const healingRealmStatBonus = statTotals[REALM_STAT_MAP[healingPrimaryRealm]].total;
  const healingConBonus = statTotals["Constitution"].total;
  const healingThreeHourPeriods = Math.floor(healingHours / 3);
  const healingOneHourPeriods = Math.floor(healingHours);
  const healingTier1Hits = healingThreeHourPeriods * 1;
  const healingTier1PP = healingThreeHourPeriods * 1;
  const healingTier2Hits = healingActivity !== "active" ? healingOneHourPeriods * Math.max(1, Math.round(healingConBonus / 2)) : 0;
  const healingTier2PP = healingActivity !== "active" ? healingOneHourPeriods * Math.max(1, Math.round(healingRealmStatBonus / 2)) : 0;
  const healingTier3Hits = healingActivity === "sleeping" ? healingThreeHourPeriods * Math.max(3, healingConBonus * 2) : 0;
  const healingTier3PP = healingActivity === "sleeping" ? healingThreeHourPeriods * Math.round(totalPP / 2) : 0;
  const healingTotalHits = healingTier1Hits + healingTier2Hits + healingTier3Hits;
  const healingTotalPP = healingTier1PP + healingTier2PP + healingTier3PP;

  const healthPercent = pctUsed(sheet.health.currentHits, totalHits);
  const magicPercent = pctUsed(sheet.magic.currentPP, totalPP);
  const exhaustionPercent = pctUsed(sheet.exhaustion.currentEP, totalEP);

  const castPowerPointUsedPenalty = magicPenalty(magicPercent);

  const castTotalModifier =
    castPreparationModifier +
    castSnapActionModifier +
    castPowerPointUsedPenalty +
    castListTypeModifier +
    castFreeHandsModifier +
    castVoiceModifier +
    castHelmetModifier +
    castEquipmentModifier +
    castArmorModifier +
    castSpellBonus +
    castManualModifier +
    castOpenEndedRoll;

  const castModifierRows = [
    { label: "Level and Preparation", value: castPreparationModifier },
    { label: "Snap Action", value: castSnapActionModifier },
    { label: "Power Point Used Penalty", value: castPowerPointUsedPenalty },
    { label: "Spell List Type", value: castListTypeModifier },
    { label: "Free Hands", value: castFreeHandsModifier },
    { label: "Voice", value: castVoiceModifier },
    { label: "Helmet", value: castHelmetModifier },
    { label: "Equipment", value: castEquipmentModifier },
    { label: "Armor Status", value: castArmorModifier },
    { label: "Spell Bonus", value: castSpellBonus },
    { label: "Manual Modifier", value: castManualModifier },
    { label: "Open Ended 1d100", value: castOpenEndedRoll },
  ];

  const healthThreshold25 = thresholdAt(totalHits, 25);
  const healthThreshold50 = thresholdAt(totalHits, 50);
  const healthThreshold75 = thresholdAt(totalHits, 75);
  const healthThreshold100 = thresholdAt(totalHits, 100);

  const magicThreshold25 = thresholdAt(totalPP, 25);
  const magicThreshold50 = thresholdAt(totalPP, 50);
  const magicThreshold75 = thresholdAt(totalPP, 75);

  const exhaustionThreshold25 = thresholdAt(totalEP, 25);
  const exhaustionThreshold50 = thresholdAt(totalEP, 50);
  const exhaustionThreshold75 = thresholdAt(totalEP, 75);
  const exhaustionThreshold90 = thresholdAt(totalEP, 90);
  const exhaustionThreshold100 = thresholdAt(totalEP, 100);

  const selectedUseActionTotal = selectedUseAction ? useActionDiceResult + selectedUseAction.bonus + useActionExtraModifier : 0;

  const sortByCatThenName = (a: { name: string; category?: { name: string } | null }, b: { name: string; category?: { name: string } | null }) => {
    const catA = a.category?.name ?? "";
    const catB = b.category?.name ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  };

  const commonlyUsedSkills = skillDerived.filter((s) => {
    if (!s.favorite) return false;
    const catName = s.category?.name ?? "";
    return !isWeaponCategory(catName);
  }).sort(sortByCatThenName);

  const commonlyUsedAttacks = skillDerived.filter((s) => {
    if (!s.favorite) return false;
    const catName = s.category?.name ?? "";
    return isWeaponCategory(catName);
  }).sort(sortByCatThenName);

  const levelUpPreview = useMemo(() => {
    const extraByStat = new Map<StatName, ExtraStatRoll[]>();
    STAT_NAMES.forEach((stat) => extraByStat.set(stat, []));
    extraStatRolls.forEach((roll) => {
      extraByStat.get(roll.stat)?.push(roll);
    });

    return STAT_NAMES.reduce((acc, stat) => {
      const startTemp = sheet.stats[stat].temp;
      const startPotential = sheet.stats[stat].potential;
      let nextTemp = startTemp;
      let nextPotential = startPotential;
      const logs: string[] = [];

      const base = baseStatRolls[stat];
      if (isValidDie(base.die1) && isValidDie(base.die2)) {
        const result = resolveStatLevelRoll(nextTemp, nextPotential, base.die1, base.die2);
        nextTemp = result.temp;
        nextPotential = result.potential;
        logs.push(`Base: ${result.explanation}`);
      } else {
        logs.push("Base roll pending");
      }

      const extras = extraByStat.get(stat) ?? [];
      extras.forEach((roll, idx) => {
        if (isValidDie(roll.die1) && isValidDie(roll.die2)) {
          const result = resolveStatLevelRoll(nextTemp, nextPotential, roll.die1, roll.die2);
          nextTemp = result.temp;
          nextPotential = result.potential;
          logs.push(`Extra ${idx + 1}: ${result.explanation}`);
        } else {
          logs.push(`Extra ${idx + 1}: pending`);
        }
      });

      acc[stat] = {
        temp: nextTemp,
        potential: nextPotential,
        deltaTemp: nextTemp - startTemp,
        deltaPotential: nextPotential - startPotential,
        logs,
      };
      return acc;
    }, {} as Record<StatName, { temp: number; potential: number; deltaTemp: number; deltaPotential: number; logs: string[] }>);
  }, [sheet.stats, baseStatRolls, extraStatRolls]);

  const dpSpent = useMemo(() => {
    const manualSpend = dpSpendEntries.reduce((sum, entry) => sum + clampNumber(entry.cost), 0);
    const extraRollSpend = extraStatRolls.length * 8;
    return manualSpend + extraRollSpend;
  }, [dpSpendEntries, extraStatRolls]);

  const selectedUpgradeCounts = useMemo(() => {
    return dpSpendEntries.reduce((acc, entry) => {
      if (!entry.itemKey) return acc;
      const step = Math.max(0, entry.upgradeStep ?? 1);
      acc[entry.itemKey] = Math.max(acc[entry.itemKey] ?? 0, step);
      return acc;
    }, {} as Record<string, number>);
  }, [dpSpendEntries]);

  const projectedDevelopmentPoints = useMemo(() => {
    const keys: StatName[] = ["Agility", "Constitution", "Memory", "Reasoning", "Self Discipline"];
    const avg = keys.reduce((sum, key) => sum + levelUpPreview[key].temp, 0) / keys.length;
    return Math.floor(avg);
  }, [levelUpPreview]);

  const categorySpendSuggestions = useMemo(() => {
    return categoryDerived
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        ranks: cat.ranks,
        ranksPerUpgrade: cat.newRanks,
        currentTotal: cat.total,
        progression: cat.progression,
        options: rankCostOptions(cat.developmentCost, cat.newRanks, cat.ranks),
        selectedUpgrades: selectedUpgradeCounts[`cat:${cat.id}`] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryDerived, selectedUpgradeCounts]);

  const projectedCategoryBonuses = useMemo(() => {
    return categorySpendSuggestions.reduce((acc, category) => {
      const selectedOption = category.options[category.selectedUpgrades - 1];
      const rankGain = selectedOption?.rankGain ?? 0;
      const projectedRanks = category.ranks + rankGain;
      const current = categoryDerived.find((item) => item.id === category.id);
      const projectedRank = rankValue(projectedRanks, category.progression);
      const projectedTotal = current
        ? projectedRank + current.stat + current.professionBonus + current.specialBonus
        : projectedRank;

      acc[category.id] = {
        projectedRanks,
        projectedTotal,
      };
      return acc;
    }, {} as Record<string, { projectedRanks: number; projectedTotal: number }>);
  }, [categoryDerived, categorySpendSuggestions]);

  const skillSpendSuggestions = useMemo(() => {
    return skillDerived
      .map((skill) => ({
        id: skill.id,
        name: skill.name || "(Unnamed Skill)",
        categoryName: skill.category?.name ?? "Unassigned",
        ranks: skill.ranks,
        ranksPerUpgrade: skill.newRanks,
        currentTotal: skill.total,
        options: skill.category
          ? rankCostOptions(skill.category.developmentCost, skill.newRanks, skill.ranks)
          : [],
        selectedUpgrades: selectedUpgradeCounts[`skill:${skill.id}`] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skillDerived, selectedUpgradeCounts]);

  const projectedSkillBonuses = useMemo(() => {
    return skillSpendSuggestions.reduce((acc, skill) => {
      const current = skillDerived.find((item) => item.id === skill.id);
      const selectedOption = skill.options[skill.selectedUpgrades - 1];
      const rankGain = selectedOption?.rankGain ?? 0;
      const projectedRanks = skill.ranks + rankGain;

      if (!current) {
        acc[skill.id] = {
          projectedRanks,
          projectedTotal: skill.currentTotal,
        };
        return acc;
      }

      const projectedRank = rankValue(projectedRanks, current.progression);
      const projectedCategoryTotal = current.category
        ? (projectedCategoryBonuses[current.category.id]?.projectedTotal ?? current.categoryTotal)
        : current.categoryTotal;

      acc[skill.id] = {
        projectedRanks,
        projectedTotal: projectedRank + projectedCategoryTotal + current.itemBonus + current.specialBonus,
      };
      return acc;
    }, {} as Record<string, { projectedRanks: number; projectedTotal: number }>);
  }, [projectedCategoryBonuses, skillDerived, skillSpendSuggestions]);

  const dpRemaining = projectedDevelopmentPoints - dpSpent;

  const availableTrainingPackages = useMemo(
    () => TRAINING_PACKAGES.filter((p) => sheet.details.profession in p.professionCosts),
    [sheet.details.profession]
  );

  const weaponAttackCategoryOptions = useMemo(
    () => sheet.skillCategories.filter((category) => isWeaponCategory(category.name)),
    [sheet.skillCategories]
  );

  useEffect(() => {
    if (availableTrainingPackages.length === 0) {
      setSelectedPackageName("");
      return;
    }
    if (!selectedPackageName) return;
    const stillValid = availableTrainingPackages.some((pkg) => pkg.name === selectedPackageName);
    if (!stillValid) setSelectedPackageName("");
  }, [availableTrainingPackages, selectedPackageName]);

  const selectedPackage = useMemo(
    () => TRAINING_PACKAGES.find((p) => p.name === selectedPackageName) ?? null,
    [selectedPackageName]
  );

  const selectedPackageStatSlots = useMemo(
    () => (selectedPackage ? parsePackageStatGainSlots(selectedPackage.statGains, sheet.details.realmOfPower) : []),
    [selectedPackage, sheet.details.realmOfPower]
  );

  useEffect(() => {
    if (!selectedPackage) {
      setPendingPackageSkillChoices({});
      setPendingPackageSpecials({});
      setPendingPackageStatRolls([]);
      return;
    }

    const nextSpecials: Record<number, boolean> = {};
    selectedPackage.special.forEach((_, idx) => {
      nextSpecials[idx] = idx === selectedPackage.special.length - 1;
    });

    const nextChoices: Record<number, PackageChoiceAllocation[]> = {};
    selectedPackage.skills.forEach((grant, idx) => {
      if (!isChoiceSkillGrant(grant.description, sheet.skillCategories, sheet.skills)) return;
      const constraint = getChoiceConstraint(grant.description, sheet.skillCategories);
      const categoryOptions = categoryOptionsForConstraint(constraint, sheet.skillCategories);
      const existingSkillOptions = skillOptionsForConstraint(constraint, sheet.skills, sheet.skillCategories);
      const defaultMode: PackageChoiceAllocation["mode"] = constraint.kind === "weaponAttackCategoryChoice"
        ? "category"
        : constraint.kind === "any"
          ? "skill"
          : existingSkillOptions.length > 0
            ? "skill"
            : "newSkill";
      const defaultCategoryId = categoryOptions[0]?.id ?? sheet.skillCategories[0]?.id ?? "";
      nextChoices[idx] = [{
        id: uid("choice"),
        mode: defaultMode,
        targetId: "",
        newSkillName: "",
        newSkillCategoryId: defaultCategoryId,
        ranks: grant.ranks,
      }];
    });

    setPendingPackageSkillChoices(nextChoices);
    setPendingPackageSpecials(nextSpecials);
    setPendingPackageStatRolls(
      selectedPackageStatSlots.map((slot) => ({
        slotId: slot.id,
        stat: slot.stat,
        die1: 0,
        die2: 0,
        allowsChoice: slot.allowsChoice,
        choiceGroup: slot.choiceGroup,
      }))
    );
  }, [selectedPackage, selectedPackageStatSlots, sheet.skillCategories]);

  const setSheet = (updaterOrSheet: CharacterSheet | ((prev: CharacterSheet) => CharacterSheet)) => {
    setCharacters((prev) => prev.map((c) => c.id === activeCharacter.id
      ? { ...c, sheet: typeof updaterOrSheet === "function" ? updaterOrSheet(c.sheet) : updaterOrSheet }
      : c
    ));
  };

  const updateSheet = (updater: (prev: CharacterSheet) => CharacterSheet) => setSheet(updater);

  const applyPassiveHealing = () => {
    updateSheet((prev) => ({
      ...prev,
      health: { ...prev.health, currentHits: clampNumber(prev.health.currentHits - healingTotalHits) },
      magic: { ...prev.magic, currentPP: clampNumber(prev.magic.currentPP - healingTotalPP) },
    }));
    setIsHealingModalOpen(false);
    setHealingHours(0);
  };


  const updateSkill = (skillId: string, patch: Partial<Skill>) => {
    updateSheet((prev) => ({
      ...prev,
      skills: prev.skills.map((entry) => (entry.id === skillId ? { ...entry, ...patch } : entry)),
    }));
  };

  const closeEditingSkillModal = () => {
    if (editingSkillId) {
      const skill = sheet.skills.find((s) => s.id === editingSkillId);
      // discard skills created via "New Skill"/"Add Skill" that were closed before naming them
      if (skill && !skill.name.trim()) {
        updateSheet((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== editingSkillId) }));
      }
    }
    setEditingSkillId(null);
  };

  const addSkillFromSkillsTab = (categoryId?: string) => {
    const newSkill: Skill = {
      id: uid("skill"),
      name: "",
      categoryId: categoryId ?? sheet.skillCategories[0]?.id ?? "",
      ranks: 0,
      newRanks: 1,
      itemBonus: 0,
      specialBonus: 0,
      favorite: false,
      fumble: "",
      rangeModifications: "",
    };
    updateSheet((prev) => ({ ...prev, skills: [...prev.skills, newSkill] }));
    setExpandedMobileSkillId(newSkill.id);
    setEditingSkillId(newSkill.id);
  };

  const updateGearItem = (itemId: string, patch: Partial<EquipmentItem>) => {
    updateSheet((prev) => ({
      ...prev,
      equipment: prev.equipment.map((entry) => (entry.id === itemId ? { ...entry, ...patch } : entry)),
    }));
  };

  const addGearItem = () => {
    const newItem: EquipmentItem = { id: uid("gear"), name: "", description: "", location: "", weight: 0 };
    updateSheet((prev) => ({ ...prev, equipment: [...prev.equipment, newItem] }));
    setExpandedGearItemId(newItem.id);
    setEditingGearItemId(newItem.id);
  };

  const addCharacter = () => {
    const entry: CharacterEntry = { id: uid("char"), sheet: makeDefaultSheet() };
    setCharacters((prev) => [...prev, entry]);
    // marker-add
    setActiveId(entry.id);
    setExpandedMobileSkillId(null);
    setEditingSkillId(null);
    setExpandedMobileStat(null);
    setExpandedMobileCategoryId(null);
    setExpandedGearItemId(null);
    setEditingGearItemId(null);
    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    setTalentInput(""); setFlawInput(""); setDraggedSkillId(null);
    setDraggedGearIndex(null);
  };

  const removeCharacter = (id: string) => {
    setCharacters((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) return prev;
      if (id === activeCharacter.id) setActiveId(next[0].id);
      return next;
    });
  };

  const switchCharacter = (id: string) => {
    // marker-switch
    transitionDir.current = "fade";
    setTransitionKey((k) => k + 1);
    setActiveId(id);
    setExpandedMobileSkillId(null);
    setEditingSkillId(null);
    setExpandedMobileStat(null);
    setExpandedMobileCategoryId(null);
    setExpandedGearItemId(null);
    setEditingGearItemId(null);
    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    setTalentInput(""); setFlawInput(""); setDraggedSkillId(null);
    setDraggedGearIndex(null);
  };

  const confirmRemoveCharacter = (id: string, name: string) => {
    const ok = window.confirm(`Delete character "${name}"? This cannot be undone.`);
    if (!ok) return;
    removeCharacter(id);
  };

  const openLevelUpHelper = () => {
    setActiveTab("levelUp");
  };

  const closeLevelUpHelper = () => {
    navigateToTab(lastNonHelperTab);
  };

  const addQuickSpend = (label: string, cost: number) => {
    setDpSpendEntries((prev) => [...prev, { id: uid("dp"), label, cost: clampNumber(cost), kind: "other" }]);
  };

  const addExtraStatRoll = () => {
    setExtraStatRolls((prev) => [...prev, { id: uid("xroll"), stat: STAT_NAMES[0], die1: 0, die2: 0 }]);
  };

  const addCategoryUpgradeSpend = (categoryId: string, categoryName: string, ranksPerUpgrade: number, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const next = options[selectedUpgrades];
    if (!next) return;
    const itemKey = `cat:${categoryId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Category Upgrade ${next.upgrades}: ${categoryName}`,
        cost: next.cost,
        kind: "categoryUpgrade",
        itemKey,
        upgradeStep: next.upgrades,
      }];
    });
  };

  const addSkillUpgradeSpend = (skillId: string, skillName: string, ranksPerUpgrade: number, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const next = options[selectedUpgrades];
    if (!next) return;
    const itemKey = `skill:${skillId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Skill Upgrade ${next.upgrades}: ${skillName}`,
        cost: next.cost,
        kind: "skillUpgrade",
        itemKey,
        upgradeStep: next.upgrades,
      }];
    });
  };

  const removeCategoryUpgradeSpend = (categoryId: string, categoryName: string, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const itemKey = `cat:${categoryId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      const nextStep = Math.max(0, selectedUpgrades - 1);
      if (nextStep === 0) return withoutCurrent;
      const target = options[nextStep - 1];
      if (!target) return withoutCurrent;
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Category Upgrade ${target.upgrades}: ${categoryName}`,
        cost: target.cost,
        kind: "categoryUpgrade",
        itemKey,
        upgradeStep: target.upgrades,
      }];
    });
  };

  const removeSkillUpgradeSpend = (skillId: string, skillName: string, options: Array<{ upgrades: number; rankGain: number; cost: number }>, selectedUpgrades: number) => {
    const itemKey = `skill:${skillId}`;
    setDpSpendEntries((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.itemKey !== itemKey);
      const nextStep = Math.max(0, selectedUpgrades - 1);
      if (nextStep === 0) return withoutCurrent;
      const target = options[nextStep - 1];
      if (!target) return withoutCurrent;
      return [...withoutCurrent, {
        id: uid("dp"),
        label: `Skill Upgrade ${target.upgrades}: ${skillName}`,
        cost: target.cost,
        kind: "skillUpgrade",
        itemKey,
        upgradeStep: target.upgrades,
      }];
    });
  };

  const addTrainingPackageSpend = () => {
    const name = trainingPackageSpendName.trim();
    const cost = clampNumber(trainingPackageSpendCost);
    if (!name || cost <= 0) return;
    setDpSpendEntries((prev) => [...prev, { id: uid("dp"), label: `Training Package: ${name}`, cost, kind: "trainingPackage" }]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
  };

  const rollCastingOpenEnded = () => {
    const result = rollOpenEndedD100();
    setCastOpenEndedRoll(result.total);
    setCastRollBreakdown(`${result.mode}: ${result.rolls.join(", ")}`);
  };

  const openSpellList = (skillName: string) => {
    const listEntry = spellTabLists.find((l) => l.entry.name.toLowerCase() === skillName.toLowerCase());
    if (listEntry) {
      setExpandedSpellListIds((prev) => { const next = new Set(prev); next.add(listEntry.entry.id); return next; });
    }
    navigateToTab("spells");
  };

  const openUseActionModal = (label: string, name: string, bonus: number) => {
    setSelectedUseAction({ label, name, bonus });
    setUseActionDiceResult(0);
    setUseActionRollBreakdown("");
    setUseActionExtraModifier(0);
  };

  const rollUseActionDice = () => {
    const result = rollOpenEndedD100();
    setUseActionDiceResult(result.total);
    setUseActionRollBreakdown(`${result.mode}: ${result.rolls.join(", ")}`);
  };

  const updateCombatPhase = (key: CombatPhaseKey, update: Partial<CombatPhaseState>) => {
    setCombatPhases((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  };

  const rollCombatInit = () => {
    const d1 = Math.floor(Math.random() * 10) + 1;
    const d2 = Math.floor(Math.random() * 10) + 1;
    setCombatInitDie1(d1);
    setCombatInitDie2(d2);
    setCombatInitBreakdown(`Rolled: ${d1} + ${d2}`);
  };

  const rollCombatAttack = (key: CombatPhaseKey) => {
    const result = rollOpenEndedD100();
    updateCombatPhase(key, { diceResult: result.total, diceBreakdown: `${result.mode}: ${result.rolls.join(", ")}` });
  };

  const resetCombatRound = () => {
    setCombatInitDie1(0);
    setCombatInitDie2(0);
    setCombatInitBreakdown("");
    setCombatCancelledInfo(null);
    setCombatPhases((prev) => {
      const nextPhase = (key: CombatPhaseKey): CombatPhaseState => {
        const ps = prev[key];
        if (ps.cancelled) return makeCombatPhaseState();
        const def = COMBAT_ACTION_DEFS.find((a) => a.id === ps.actionId);
        if (def?.totalRequired !== undefined) {
          const newAccumulated = ps.accumulatedActivity + ps.activityPct;
          if (newAccumulated < def.totalRequired) {
            return { ...makeCombatPhaseState(), actionId: ps.actionId, activityPct: ps.activityPct, accumulatedActivity: newAccumulated, attackType: ps.attackType };
          }
        }
        return makeCombatPhaseState();
      };
      return { snap: nextPhase("snap"), normal: nextPhase("normal"), deliberate: nextPhase("deliberate"), postDeliberate: nextPhase("postDeliberate") };
    });
  };

  const openSpellCastingAssistant = (listId: string, spellId: string) => {
    setSelectedCastListId(listId);
    setSelectedCastSpellId(spellId);
    setCastUseFreeSpell(false);
    setIsCastAssistantOpen(true);
  };

  const castSelectedSpell = () => {
    if (!selectedCastSpell) return;
    const ppSpent = castUseFreeSpell ? 0 : castPpCost;
    updateSheet((prev) => ({
      ...prev,
      magic: {
        ...prev.magic,
        currentPP: clampNumber(prev.magic.currentPP + ppSpent),
      },
    }));
    setLastCastSummary(
      `${selectedCastSpell.name} cast at ${signed(castTotalModifier)}. PP spent: ${ppSpent}${castUseFreeSpell ? " (free spell used)" : ""}.`,
    );
    setIsCastAssistantOpen(false);
  };

  const addPackageChoiceAllocation = (grantIndex: number, defaultMode: PackageChoiceAllocation["mode"], defaultCategoryId: string) => {
    setPendingPackageSkillChoices((prev) => {
      const existing = prev[grantIndex] ?? [];
      // Going from 1 to 2 allocations: clear the auto-ranks from the first so the user splits explicitly.
      const updatedExisting = existing.length === 1
        ? [{ ...existing[0], ranks: 0 }]
        : existing;
      const next: PackageChoiceAllocation = {
        id: uid("choice"),
        mode: defaultMode,
        targetId: "",
        newSkillName: "",
        newSkillCategoryId: defaultCategoryId,
        ranks: 0,
      };
      return { ...prev, [grantIndex]: [...updatedExisting, next] };
    });
  };

  const updatePackageChoiceAllocation = (grantIndex: number, allocationId: string, patch: Partial<PackageChoiceAllocation>) => {
    setPendingPackageSkillChoices((prev) => ({
      ...prev,
      [grantIndex]: (prev[grantIndex] ?? []).map((allocation) => allocation.id === allocationId ? { ...allocation, ...patch } : allocation),
    }));
  };

  const removePackageChoiceAllocation = (grantIndex: number, allocationId: string) => {
    setPendingPackageSkillChoices((prev) => ({
      ...prev,
      [grantIndex]: (prev[grantIndex] ?? []).filter((allocation) => allocation.id !== allocationId),
    }));
  };

  const applyTrainingPackage = (pkg: TrainingPackage) => {
    if (pkg.type === "L") {
      const hasLifestyle = sheet.details.trainingPackages.some((name) => {
        const existing = TRAINING_PACKAGES.find((p) => p.name === name);
        return existing?.type === "L";
      });
      if (hasLifestyle) {
        alert(`Cannot apply "${pkg.name}": a Lifestyle package is already applied. You can only have one Lifestyle package.`);
        return;
      }
    }

    const pendingChoices = pendingPackageSkillChoices;
    const choiceValidationError = validateChoiceSkillGrants({
      grants: pkg.skills,
      pendingChoices,
      categories: sheet.skillCategories,
      skills: sheet.skills,
    });
    if (choiceValidationError) {
      alert(choiceValidationError);
      return;
    }

    const differentGroupStats = pendingPackageStatRolls
      .filter((roll) => roll.choiceGroup === "different")
      .map((roll) => roll.stat.toLowerCase());
    if (differentGroupStats.length > 1 && new Set(differentGroupStats).size !== differentGroupStats.length) {
      alert("Stat gain choices marked as different must not repeat the same stat.");
      return;
    }

    const invalidRoll = pendingPackageStatRolls.find((roll) => !isValidDie(roll.die1) || !isValidDie(roll.die2));
    if (invalidRoll) {
      alert("Please enter valid 1-10 dice rolls for each training package stat gain.");
      return;
    }

    const selectedSpecials = pkg.special
      .map((item, idx) => ({ item, idx }))
      .filter(({ idx }) => pendingPackageSpecials[idx])
      .map(({ item }) => item.description);

    const unresolvedGrants: string[] = [];

    updateSheet((prev) => {
      const applied = applyTrainingPackageToSheet({
        prev,
        pkg,
        pendingChoices,
        pendingStatRolls: pendingPackageStatRolls,
        selectedSpecials,
        uid,
        clampNumber,
      });
      unresolvedGrants.push(...applied.unresolvedGrants);
      return applied.nextSheet;
    });

    if (unresolvedGrants.length > 0) {
      alert(`Some grants could not be matched and were skipped:\n- ${unresolvedGrants.join("\n- ")}`);
    }

    setSelectedPackageName("");
    setPendingPackageSkillChoices({});
    setPendingPackageSpecials({});
    setPendingPackageStatRolls([]);
    trainingPackageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const removeTrainingPackageAt = (index: number) => {
    updateSheet((prev) => removeTrainingPackageAtFromSheet(prev, index));
  };

  const addNewSkillFromLevelUp = () => {
    const name = newLevelUpSkillName.trim();
    if (!name) return;
    const categoryId = newLevelUpSkillCategoryId || sheet.skillCategories[0]?.id;
    if (!categoryId) return;

    const category = sheet.skillCategories.find((cat) => cat.id === categoryId);
    updateSheet((prev) => {
      const isEveryman = prev.details.everymanSkills.some((entry) => entry.toLowerCase() === name.toLowerCase());
      const isOccupational = prev.details.occupationalSkills.some((entry) => entry.toLowerCase() === name.toLowerCase());
      const nextNewRanks = isOccupational ? 3 : isEveryman ? 2 : 1;

      return {
        ...prev,
        skills: [
          ...prev.skills,
          {
            id: uid("skill"),
            name,
            categoryId,
            ranks: 0,
            newRanks: nextNewRanks,
            itemBonus: 0,
            specialBonus: 0,
            favorite: false,
            fumble: "",
            rangeModifications: "",
          },
        ],
      };
    });

    setNewLevelUpSkillName("");
  };

  const commitLevelUp = () => {
    if (dpRemaining < 0) {
      alert("You are spending more DP than available.");
      return;
    }

    const ok = window.confirm("Apply level up now? This updates stats, rank upgrades, level, and talent points.");
    if (!ok) return;

    updateSheet((prev) => applyLevelUpToSheet(prev, dpSpendEntries, levelUpPreview));

    setBaseStatRolls(makeEmptyBaseRolls());
    setDpSpendEntries([]);
    setExtraStatRolls([]);
    setTrainingPackageSpendName("");
    setTrainingPackageSpendCost(0);
    navigateToTab("details");
  };

  const moveTab = (offset: -1 | 1) => {
    if (activeTab === "levelUp") return;
    const nextIndex = activeTabIndex + offset;
    if (nextIndex < 0 || nextIndex >= TAB_OPTIONS.length) return;
    navigateToTab(TAB_OPTIONS[nextIndex].value, offset > 0 ? "left" : "right");
  };

  const isSwipeBlocked = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest("[data-no-tab-swipe='true']") || target.closest("textarea") || target.closest("[data-scroll-container='true']"));
  };

  const handleTabSwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isSwipeBlocked(event.target)) return;
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTabSwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || isSwipeBlocked(event.target)) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    if (elapsed > 900) return;
    if (Math.abs(deltaX) < 65) return;
    if (Math.abs(deltaY) > 120) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0) moveTab(1);
    if (deltaX > 0) moveTab(-1);
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.details.characterName || "rolemaster-character"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = migrateSheet(JSON.parse(String(reader.result)));
        setSheet(parsed);  // replaces active character's sheet
      } catch {
        alert("Could not load file. JSON is being dramatic.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-fuchsia-50 p-3 pb-24 md:p-6 md:pb-6"
      onTouchStart={handleTabSwipeStart}
      onTouchEnd={handleTabSwipeEnd}
      onTouchCancel={() => { touchStartRef.current = null; }}
    >
      <style>{`
        @keyframes rmSlideLeft { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes rmSlideRight { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes rmFade { from { opacity: 0; } to { opacity: 1; } }
        .rm-slide-left { animation: rmSlideLeft 0.18s ease-out both; }
        .rm-slide-right { animation: rmSlideRight 0.18s ease-out both; }
        .rm-fade { animation: rmFade 0.18s ease-out both; }
      `}</style>
      <div className="mx-auto min-w-0 max-w-7xl space-y-4">
        <div className="hidden space-y-2 md:block">
          <div className="px-1 text-sm font-semibold tracking-wide text-slate-500">Rolemaster Character Sheet Engine</div>
          <div className="overflow-x-auto pb-1" data-no-tab-swipe="true">
            <div className="flex min-w-max items-end gap-1">
            {characters.map((c, idx) => {
              const name = c.sheet.details.characterName || `Character ${idx + 1}`;
              const isActive = c.id === activeCharacter.id;
              return (
                <div key={c.id} data-char-id={c.id} className={`flex max-w-[220px] items-center gap-2 rounded-t-2xl border border-b-0 px-3 py-2 text-sm shadow-sm transition-colors ${
                  isActive ? "bg-white text-slate-900" : "bg-white/60 text-slate-600 hover:bg-white/80"
                }`}>
                  <button className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => switchCharacter(c.id)}>{name}</button>
                  {characters.length > 1 && (
                    <button className="opacity-50 hover:opacity-100" onClick={() => confirmRemoveCharacter(c.id, name)} title="Remove character">×</button>
                  )}
                </div>
              );
            })}
            <button type="button" className="flex h-10 items-center rounded-t-2xl border border-b-0 bg-white/60 px-4 text-sm text-slate-600 shadow-sm hover:bg-white/80" onClick={addCharacter}><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="front" value={activeTab} onValueChange={(next) => navigateToTab(next as ActiveView)} className="min-w-0 space-y-4">
          <TabsList id="section-tabs-strip" className="sticky top-0 z-40 flex h-auto w-full min-w-0 gap-2 overflow-x-auto rounded-3xl bg-white/95 p-2 shadow-sm backdrop-blur" data-no-tab-swipe="true">
            {TAB_OPTIONS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} data-tab-value={tab.value} className="whitespace-nowrap rounded-2xl">{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          <div
            key={transitionKey}
            style={{ overflow: "hidden" }}
            className={transitionDir.current === "left" ? "rm-slide-left" : transitionDir.current === "right" ? "rm-slide-right" : "rm-fade"}
          >
          <TabsContent value="front">
            <div className="space-y-4">
              <div className="sticky top-3 z-20 rounded-3xl border border-slate-200/80 bg-white/95 p-3 shadow-md backdrop-blur">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-slate-900">{sheet.details.characterName || "Unnamed hero"}</div>
                    <div className="text-sm text-slate-500">Level {sheet.details.level} · {sheet.details.race} / {sheet.details.profession}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-3xl border border-slate-200/80 bg-slate-50/90 p-2 shadow-inner">
                  <div className="grid w-full grid-cols-3 gap-1 sm:gap-2" data-no-tab-swipe="true">
                    <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm sm:flex-row sm:gap-2 sm:px-3 sm:py-2">
                      <button type="button" className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 sm:text-xs" onClick={() => setPoolEditModal("hits")}>Hits</button>
                      <div className="min-w-0 text-center sm:flex-1">
                        <span className="text-xs font-medium tabular-nums text-slate-900 sm:text-sm">{currentHitsPool}</span>
                        <span className="text-[9px] text-slate-400 sm:text-[10px]">/{totalHits}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="outline" className="h-6 rounded-xl px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs" onClick={() => updateSheet((prev) => ({ ...prev, health: { ...prev.health, currentHits: prev.health.currentHits + 1 } }))}>-</Button>
                        <Button type="button" variant="outline" className="h-6 rounded-xl px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs" onClick={() => updateSheet((prev) => ({ ...prev, health: { ...prev.health, currentHits: Math.max(0, prev.health.currentHits - 1) } }))}>+</Button>
                      </div>
                    </div>
                    <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm sm:flex-row sm:gap-2 sm:px-3 sm:py-2">
                      <button type="button" className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 sm:text-xs" onClick={() => setPoolEditModal("pp")}>PP</button>
                      <div className="min-w-0 text-center sm:flex-1">
                        <span className="text-xs font-medium tabular-nums text-slate-900 sm:text-sm">{currentPPPool}</span>
                        <span className="text-[9px] text-slate-400 sm:text-[10px]">/{totalPP}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="outline" className="h-6 rounded-xl px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs" onClick={() => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, currentPP: prev.magic.currentPP + 1 } }))}>-</Button>
                        <Button type="button" variant="outline" className="h-6 rounded-xl px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs" onClick={() => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, currentPP: Math.max(0, prev.magic.currentPP - 1) } }))}>+</Button>
                      </div>
                    </div>
                    <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm sm:flex-row sm:gap-2 sm:px-3 sm:py-2">
                      <button type="button" className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 sm:text-xs" onClick={() => setPoolEditModal("ep")}>EP</button>
                      <div className="min-w-0 text-center sm:flex-1">
                        <span className="text-xs font-medium tabular-nums text-slate-900 sm:text-sm">{currentEPPool}</span>
                        <span className="text-[9px] text-slate-400 sm:text-[10px]">/{totalEP}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="outline" className="h-6 rounded-xl px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs" onClick={() => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, currentEP: prev.exhaustion.currentEP + 1 } }))}>-</Button>
                        <Button type="button" variant="outline" className="h-6 rounded-xl px-1.5 text-[10px] sm:h-7 sm:px-2 sm:text-xs" onClick={() => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, currentEP: Math.max(0, prev.exhaustion.currentEP - 1) } }))}>+</Button>
                      </div>
                    </div>
                    <div className="col-span-3 mt-1 flex items-center gap-2 px-1 text-sm text-slate-600 sm:justify-end">
                      <span className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">DB</span>
                      <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-slate-900">{totalNormalDB}</span>
                      <span className="min-w-0 whitespace-nowrap text-[10px] text-slate-500 sm:text-xs">subtracted from attacks</span>
                      <Button type="button" variant="outline" className="ml-auto h-7 rounded-xl px-2 text-xs" onClick={() => setIsHealingModalOpen(true)}>Passive Healing</Button>
                    </div>
                  </div>
                </div>
              </div>


              <div className="grid gap-4 xl:grid-cols-[280px_1fr_1fr]">
              {/* Left sidebar: overview + pools */}
              <div className="flex flex-col gap-4">
              </div>

              {/* Middle: skills */}
              <SectionCard title="Commonly Used Skills">
                {commonlyUsedSkills.length === 0
                  ? <div className="text-sm text-slate-500">No favorite skills yet.</div>
                  : <div className="overflow-y-auto md:max-h-[calc(100vh-340px)]">
                      <div className="space-y-2 md:hidden">
                        {commonlyUsedSkills.map((skill) => (
                          <div
                            key={skill.id}
                            className="cursor-pointer rounded-2xl border px-2 py-2 text-xs active:bg-slate-50"
                            onClick={() => skill.category?.name.startsWith("Spells •") ? openSpellList(skill.name) : openUseActionModal("Use Skill", skill.name, skill.total)}
                          >
                            <div className="truncate font-medium leading-tight text-slate-900">{skill.name}</div>
                            {skill.category && <div className="truncate text-[10px] leading-tight text-slate-400">{skill.category.name}</div>}
                            <div className="mt-1 text-[11px] text-slate-600">
                              Ranks {skill.ranks} · Bonus {skill.total >= 0 ? "+" : ""}{skill.total}
                            </div>
                          </div>
                        ))}
                      </div>
                      <table className="hidden w-full text-sm md:table">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b text-left text-slate-500">
                            <th className="pb-2 font-normal">Skill</th>
                            <th className="pb-2 font-normal text-right pr-4">Ranks</th>
                            <th className="pb-2 font-normal text-right">Bonus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commonlyUsedSkills.map((skill) => (
                            <tr
                              key={skill.id}
                              className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
                              onClick={() => skill.category?.name.startsWith("Spells •") ? openSpellList(skill.name) : openUseActionModal("Use Skill", skill.name, skill.total)}
                            >
                              <td className="py-1 pr-4">
                                <div className="font-medium">{skill.name}</div>
                                {skill.category && <div className="text-xs text-slate-400">{skill.category.name}</div>}
                              </td>
                              <td className="py-1 text-right pr-4 tabular-nums">{skill.ranks}</td>
                              <td className="py-1 text-right tabular-nums font-semibold">{skill.total >= 0 ? "+" : ""}{skill.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </SectionCard>

              {/* Right: attacks */}
              <SectionCard title="Commonly Used Attacks">
                {commonlyUsedAttacks.length === 0
                  ? <div className="text-sm text-slate-500">No favorite attacks yet.</div>
                  : <div className="overflow-y-auto md:max-h-[calc(100vh-340px)]">
                      <div className="space-y-2 md:hidden">
                        {commonlyUsedAttacks.map((skill) => (
                          <div
                            key={skill.id}
                            className="cursor-pointer rounded-2xl border px-2 py-2 text-xs active:bg-slate-50"
                            onClick={() => openUseActionModal("Use Attack", skill.name, skill.total)}
                          >
                            <div className="truncate font-medium leading-tight text-slate-900">{skill.name}</div>
                            {skill.category && <div className="truncate text-[10px] leading-tight text-slate-400">{skill.category.name}</div>}
                            <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-slate-600">
                              <span>Ranks {skill.ranks}</span>
                              <span className="text-slate-300">·</span>
                              <span>Bonus {skill.total >= 0 ? "+" : ""}{skill.total}</span>
                              <span className="text-slate-300">·</span>
                              <span>Fumble {skill.fumble || "—"}</span>
                              <span className="text-slate-300">·</span>
                              <span>Range {skill.rangeModifications || "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <table className="hidden w-full text-sm md:table">
                        <thead className="sticky top-0 bg-white">
                          <tr className="border-b text-left text-slate-500">
                            <th className="pb-2 font-normal">Attack</th>
                            <th className="pb-2 font-normal text-right pr-4">Ranks</th>
                            <th className="pb-2 font-normal text-right pr-4">Bonus</th>
                            <th className="pb-2 font-normal text-right pr-4">Fumble</th>
                            <th className="pb-2 font-normal text-right">Range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commonlyUsedAttacks.map((skill) => (
                            <tr
                              key={skill.id}
                              className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
                              onClick={() => openUseActionModal("Use Attack", skill.name, skill.total)}
                            >
                              <td className="py-1.5 pr-4">
                                <div className="font-medium">{skill.name}</div>
                                {skill.category && <div className="text-xs text-slate-400">{skill.category.name}</div>}
                              </td>
                              <td className="py-1.5 text-right pr-4 tabular-nums">{skill.ranks}</td>
                              <td className="py-1.5 text-right pr-4 tabular-nums font-semibold">{skill.total >= 0 ? "+" : ""}{skill.total}</td>
                              <td className="py-1.5 text-right pr-4">{skill.fumble || "—"}</td>
                              <td className="py-1.5 text-right">{skill.rangeModifications || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </SectionCard>
            </div>
            </div>
            {selectedUseAction && (
              <div
                className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 px-3 pb-28 pt-8 sm:px-6 sm:pb-32 sm:pt-10 md:p-6"
                onMouseDown={(event) => {
                  useActionModalBackdropMouseDownRef.current = event.target === event.currentTarget;
                }}
                onMouseUp={(event) => {
                  const shouldClose = useActionModalBackdropMouseDownRef.current && event.target === event.currentTarget;
                  useActionModalBackdropMouseDownRef.current = false;
                  if (shouldClose) setSelectedUseAction(null);
                }}
                onMouseLeave={() => {
                  useActionModalBackdropMouseDownRef.current = false;
                }}
              >
                <div className="mx-auto w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
                  <SectionCard
                    title={selectedUseAction.label}
                    action={(
                      <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => setSelectedUseAction(null)}>
                        Close
                      </Button>
                    )}
                  >
                    <div className="space-y-3">
                      <div className="rounded-2xl border bg-white p-3 text-sm">
                        <div className="font-semibold text-slate-800">{selectedUseAction.name}</div>
                        <div className="mt-1 text-xs text-slate-500">Modifier: {signed(selectedUseAction.bonus)}</div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Additional Modifier</label>
                        <NumberInput value={useActionExtraModifier} onChange={setUseActionExtraModifier} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <div>
                          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Dice Result</label>
                          <NumberInput
                            value={useActionDiceResult}
                            onChange={setUseActionDiceResult}
                            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                rollUseActionDice();
                              }
                            }}
                          />
                          {useActionRollBreakdown && <div className="mt-1 text-xs text-slate-500">{useActionRollBreakdown}</div>}
                        </div>
                        <div className="flex items-end">
                          <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={rollUseActionDice}>Roll d100</Button>
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Total</span>
                          <span className="font-semibold text-slate-900">{signed(selectedUseActionTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Character Details">                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm">Character Name</label>
                    <Input value={sheet.details.characterName} onChange={(e) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, characterName: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Level</label>
                    <div className="flex gap-2">
                      <NumberInput value={sheet.details.level} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, level: clampNumber(v, 1) } }))} min={1} />
                      <Button type="button" variant="outline" className="h-8 rounded-2xl px-3 text-sm" onClick={openLevelUpHelper}>Level Up</Button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Race</label>
                    <Select value={sheet.details.race} onValueChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, race: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[...RACES].sort((a, b) => a.name.localeCompare(b.name)).map((race) => <SelectItem key={race.name} value={race.name}>{race.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Culture</label>
                    <Input value={sheet.details.culture} onChange={(e) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, culture: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Profession</label>
                    <Select value={sheet.details.profession} onValueChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, profession: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[...PROFESSIONS].sort((a, b) => a.name.localeCompare(b.name)).map((profession) => <SelectItem key={profession.name} value={profession.name}>{profession.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Realm of Power</label>
                    <Input value={sheet.details.realmOfPower.join(", ")} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Development Points</label>
                    <Input value={developmentPoints} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Talent Points</label>
                    <NumberInput value={sheet.details.talentPoints} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, talentPoints: clampNumber(v) } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Drive Points</label>
                    <div className="flex gap-2">
                      <NumberInput value={sheet.details.drivePoints} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, drivePoints: clampNumber(v) } }))} />
                      <Button type="button" variant="outline" disabled={sheet.details.drivePoints <= 0} onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, drivePoints: Math.max(0, prev.details.drivePoints - 1), heroicPath: prev.details.heroicPath + 1 } }))}>Use</Button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Heroic Path</label>
                    <NumberInput value={sheet.details.heroicPath} onChange={(v) => updateSheet((prev) => ({ ...prev, details: { ...prev.details, heroicPath: clampNumber(v) } }))} />
                  </div>
                  <div className="md:col-span-2" ref={trainingPackageRef}>
                    <label className="mb-1 block text-sm">Training Packages</label>
                    <div className="flex gap-2">
                      <Select value={selectedPackageName} onValueChange={(v) => setSelectedPackageName(v)}>
                        <SelectTrigger><SelectValue placeholder="Select a package…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Select a package…</SelectItem>
                          {availableTrainingPackages.map((p) => (
                            <SelectItem key={p.name} value={p.name}>
                              {p.name} [{p.type === "L" ? "Lifestyle" : "Vocational"}, {p.professionCosts[sheet.details.profession]} DP]
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedPackage && (
                      <div className="mt-3 space-y-3 rounded-2xl border bg-slate-50 p-3 text-sm">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                          <span><span className="font-medium text-slate-700">Type:</span> {selectedPackage.type === "L" ? "Lifestyle" : "Vocational"}</span>
                          <span><span className="font-medium text-slate-700">Time:</span> {selectedPackage.time} months</span>
                          <span><span className="font-medium text-slate-700">Money:</span> {selectedPackage.money} (creation-only)</span>
                          {selectedPackage.statGains !== "none" && <span><span className="font-medium text-slate-700">Stat gain:</span> {selectedPackage.statGains}</span>}
                        </div>

                        {pendingPackageStatRolls.length > 0 && (
                          <div className="space-y-2">
                            <div className="font-medium text-slate-700">Stat Gain Rolls (2d10 each)</div>
                            {pendingPackageStatRolls.map((roll, idx) => (
                              <div key={roll.slotId} className="grid gap-2 rounded-xl border bg-white p-2 md:grid-cols-[1fr_100px_100px]">
                                {roll.allowsChoice ? (
                                  <Select
                                    value={roll.stat}
                                    onValueChange={(v) => setPendingPackageStatRolls((prev) => prev.map((entry) => entry.slotId === roll.slotId ? { ...entry, stat: v as StatName } : entry))}
                                  >
                                    <SelectTrigger><SelectValue placeholder={`Choose stat ${idx + 1}`} /></SelectTrigger>
                                    <SelectContent>
                                      {STAT_NAMES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center rounded-lg border bg-slate-100 px-3 text-sm font-medium text-slate-700">{roll.stat}</div>
                                )}
                                <NumberInput value={roll.die1} min={0} onChange={(v) => setPendingPackageStatRolls((prev) => prev.map((entry) => entry.slotId === roll.slotId ? { ...entry, die1: v } : entry))} />
                                <NumberInput value={roll.die2} min={0} onChange={(v) => setPendingPackageStatRolls((prev) => prev.map((entry) => entry.slotId === roll.slotId ? { ...entry, die2: v } : entry))} />
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedPackage.special.length > 0 && (
                          <div>
                            <div className="font-medium text-slate-700">Special Gains</div>
                            <div className="mt-1 space-y-1">
                              {selectedPackage.special.map((special, idx) => {
                                const alwaysGranted = idx === selectedPackage.special.length - 1;
                                const checked = alwaysGranted ? true : Boolean(pendingPackageSpecials[idx]);
                                return (
                                  <label key={`${special.description}_${idx}`} className="flex items-start gap-2 rounded-lg border bg-white px-2 py-1">
                                    <Checkbox
                                      checked={checked}
                                      disabled={alwaysGranted}
                                      onChange={(e) => setPendingPackageSpecials((prev) => ({ ...prev, [idx]: e.target.checked }))}
                                    />
                                    <span className="text-slate-700">
                                      {special.description} <span className="font-medium">(+{special.bonus})</span>{alwaysGranted ? " (always granted)" : ""}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedPackage.skills.length > 0 && (
                          <div>
                            <div className="font-medium text-slate-700">Skill / Category Grants</div>
                            <div className="mt-1 space-y-2">
                              {selectedPackage.skills.map((grant, idx) => {
                                const needsChoice = isChoiceSkillGrant(grant.description, sheet.skillCategories, sheet.skills);
                                const maxTargets = parseChoiceMaxTargets(grant.description);
                                const choiceAllocations = pendingPackageSkillChoices[idx] ?? [];
                                const allocatedRanks = choiceAllocations.reduce((sum, allocation) => sum + clampNumber(allocation.ranks), 0);
                                const constraint = getChoiceConstraint(grant.description, sheet.skillCategories);
                                const categoryChoiceOptions = categoryOptionsForConstraint(constraint, sheet.skillCategories);
                                const constrainedCategory = constraint.kind === "specificCategorySkills"
                                  ? sheet.skillCategories.find((category) => category.id === constraint.categoryId) ?? null
                                  : null;
                                const skillChoiceOptions = skillOptionsForConstraint(constraint, sheet.skills, sheet.skillCategories);
                                const hasExistingSkillOptions = skillChoiceOptions.length > 0;
                                return (
                                  <div key={`${grant.description}_${idx}`} className="rounded-lg border bg-white px-2 py-2">
                                    <div className="text-slate-700">{grant.description}: <span className="font-medium">+{grant.ranks} ranks</span></div>
                                    {needsChoice && (
                                      <div className="mt-2 space-y-2">
                                        {choiceAllocations.length > 1
                                          ? <div className="text-xs text-slate-500">Allocate exactly {grant.ranks} ranks across up to {maxTargets} target(s). Currently: {allocatedRanks}.</div>
                                          : maxTargets > 1
                                            ? <div className="text-xs text-slate-500">Choose a target to receive all {grant.ranks} ranks, or add more targets to split them.</div>
                                            : null
                                        }
                                        {constraint.kind === "specificCategorySkills" && constrainedCategory && (
                                          <div className="text-xs text-slate-500">Targets must belong to {constrainedCategory.name}.</div>
                                        )}
                                        {constraint.kind === "categoryGroupSkills" && (
                                          <div className="text-xs text-slate-500">Targets must belong to the {constraint.groupNames.join(" / ")} group.</div>
                                        )}
                                        {constraint.kind === "specificSkillList" && (
                                          <div className="text-xs text-slate-500">Choose one of: {constraint.skillNames.join(" / ")}.</div>
                                        )}
                                        {choiceAllocations.map((allocation) => (
                                          <div key={allocation.id} className={`grid gap-2 rounded-lg border bg-slate-50 p-2 ${choiceAllocations.length === 1 ? "md:grid-cols-[150px_1fr_40px]" : "md:grid-cols-[150px_1fr_120px_40px]"}`}>
                                            {(() => {
                                              const effectiveMode = effectiveAllocationMode(allocation, constraint, hasExistingSkillOptions);
                                              return (
                                                <>
                                            {constraint.kind === "weaponAttackCategoryChoice" ? (
                                              <div className="flex items-center rounded-md border bg-slate-100 px-2 text-xs font-medium text-slate-600">Attack Category</div>
                                            ) : constraint.kind === "specificSkillList" ? (
                                              <div className="flex items-center rounded-md border bg-slate-100 px-2 text-xs font-medium text-slate-600">Skill</div>
                                            ) : constraint.kind === "spellLists" || constraint.kind === "specificCategorySkills" || constraint.kind === "categoryGroupSkills" ? (
                                              hasExistingSkillOptions ? (
                                                <Select
                                                  value={effectiveMode === "newSkill" ? "newSkill" : "skill"}
                                                  onValueChange={(v) => updatePackageChoiceAllocation(idx, allocation.id, { mode: v as "skill" | "newSkill", targetId: "" })}
                                                >
                                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="skill">Existing Skill</SelectItem>
                                                    <SelectItem value="newSkill">New Skill</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              ) : (
                                                <div className="flex items-center rounded-md border bg-slate-100 px-2 text-xs font-medium text-slate-600">New Skill</div>
                                              )
                                            ) : (
                                              <Select
                                                value={allocation.mode}
                                                onValueChange={(v) => updatePackageChoiceAllocation(idx, allocation.id, { mode: v as PackageChoiceAllocation["mode"], targetId: "" })}
                                              >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="skill">Existing Skill</SelectItem>
                                                  <SelectItem value="category">Skill Category</SelectItem>
                                                  <SelectItem value="newSkill">New Skill</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            )}

                                            {effectiveMode === "category" ? (
                                              <Select
                                                value={allocation.targetId}
                                                onValueChange={(v) => updatePackageChoiceAllocation(idx, allocation.id, { targetId: v })}
                                              >
                                                <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="">Choose category</SelectItem>
                                                  {categoryChoiceOptions.map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : effectiveMode === "skill" ? (
                                              <Select
                                                value={allocation.targetId}
                                                onValueChange={(v) => updatePackageChoiceAllocation(idx, allocation.id, { targetId: v })}
                                              >
                                                <SelectTrigger><SelectValue placeholder="Choose skill" /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="">Choose skill</SelectItem>
                                                  {[...skillChoiceOptions]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((skill) => <SelectItem key={skill.id} value={skill.id}>{skill.name || "(Unnamed Skill)"}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                                                <Input
                                                  placeholder="New skill name"
                                                  value={allocation.newSkillName}
                                                  onChange={(e) => updatePackageChoiceAllocation(idx, allocation.id, { newSkillName: e.target.value })}
                                                />
                                                {constraint.kind === "specificCategorySkills" ? (
                                                  <div className="flex items-center rounded-md border bg-slate-100 px-2 text-xs font-medium text-slate-600">{constrainedCategory?.name ?? "Category"}</div>
                                                ) : (
                                                  <Select
                                                    value={allocation.newSkillCategoryId}
                                                    onValueChange={(v) => updatePackageChoiceAllocation(idx, allocation.id, { newSkillCategoryId: v })}
                                                  >
                                                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="">Choose category</SelectItem>
                                                      {categoryChoiceOptions.map((category) => (
                                                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                )}
                                              </div>
                                            )}

                                            {choiceAllocations.length > 1 && (
                                            <NumberInput
                                              value={allocation.ranks}
                                              min={0}
                                              onChange={(v) => updatePackageChoiceAllocation(idx, allocation.id, { ranks: clampNumber(v) })}
                                            />
                                            )}
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              disabled={choiceAllocations.length <= 1}
                                              onClick={() => removePackageChoiceAllocation(idx, allocation.id)}
                                            ><Trash2 className="h-4 w-4" /></Button>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        ))}
                                        {maxTargets > 1 && choiceAllocations.length < maxTargets && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 rounded-xl px-3 text-xs"
                                            onClick={() => addPackageChoiceAllocation(
                                              idx,
                                              constraint.kind === "weaponAttackCategoryChoice"
                                                ? "category"
                                                : hasExistingSkillOptions
                                                  ? "skill"
                                                  : "newSkill",
                                              constraint.kind === "specificCategorySkills"
                                                ? constraint.categoryId
                                                : categoryChoiceOptions[0]?.id ?? sheet.skillCategories[0]?.id ?? ""
                                            )}
                                          >Add Choice Target</Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedPackage.everymanSkills.length > 0 && (
                          <div><span className="font-medium text-slate-700">Everyman skills (newRanks → 2):</span> {selectedPackage.everymanSkills.join(", ")}</div>
                        )}
                        {selectedPackage.occupationalSkills.length > 0 && (
                          <div><span className="font-medium text-slate-700">Occupational skills (newRanks → 3):</span> {selectedPackage.occupationalSkills.join(", ")}</div>
                        )}
                        {selectedPackage.restrictedSkills.length > 0 && (
                          <div><span className="font-medium text-red-600">Restricted skills (rank assignment disabled):</span> {selectedPackage.restrictedSkills.join(", ")}</div>
                        )}
                        <div className="flex justify-end border-t pt-3">
                          <Button
                            type="button"
                            disabled={!selectedPackage}
                            onClick={() => { if (selectedPackage) applyTrainingPackage(selectedPackage); }}
                          >Apply</Button>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sheet.details.trainingPackages.map((pkg, i) => {
                        const pkgData = TRAINING_PACKAGES.find((p) => p.name === pkg);
                        return (
                          <Badge key={`${pkg}_${i}`} className="rounded-2xl px-3 py-1">
                            {pkg}{pkgData ? ` [${pkgData.type === "L" ? "L" : "V"}]` : ""}
                            {" "}<button className="ml-2" onClick={() => removeTrainingPackageAt(i)}>×</button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Talents</label>
                    <div className="flex gap-2">
                      <Input value={talentInput} onChange={(e) => setTalentInput(e.target.value)} placeholder="Add a talent" />
                      <Button type="button" variant="outline" onClick={() => {
                        const trimmed = talentInput.trim();
                        if (!trimmed) return;
                        updateSheet((prev) => ({ ...prev, details: { ...prev.details, talents: [...prev.details.talents, trimmed] } }));
                        setTalentInput("");
                      }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sheet.details.talents.map((t, i) => (
                        <Badge key={`${t}_${i}`} className="rounded-2xl px-3 py-1">{t} <button className="ml-2" onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, talents: prev.details.talents.filter((_, idx) => idx !== i) } }))}>×</button></Badge>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Flaws</label>
                    <div className="flex gap-2">
                      <Input value={flawInput} onChange={(e) => setFlawInput(e.target.value)} placeholder="Add a flaw" />
                      <Button type="button" variant="outline" onClick={() => {
                        const trimmed = flawInput.trim();
                        if (!trimmed) return;
                        updateSheet((prev) => ({ ...prev, details: { ...prev.details, flaws: [...prev.details.flaws, trimmed] } }));
                        setFlawInput("");
                      }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sheet.details.flaws.map((f, i) => (
                        <Badge key={`${f}_${i}`} className="rounded-2xl px-3 py-1">{f} <button className="ml-2" onClick={() => updateSheet((prev) => ({ ...prev, details: { ...prev.details, flaws: prev.details.flaws.filter((_, idx) => idx !== i) } }))}>×</button></Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Traits + Background">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["appearance", "Appearance"], ["demeanor", "Demeanor"], ["apparentAge", "Apparent Age"], ["actualAge", "Actual Age"], ["gender", "Gender"], ["skin", "Skin"], ["height", "Height"], ["weight", "Weight"], ["hair", "Hair"], ["eyes", "Eyes"], ["personality", "Personality"], ["motivation", "Motivation"], ["alignment", "Alignment"],
                  ].map(([key, label]) => (
                    <div key={key} className={key === "personality" || key === "motivation" || key === "alignment" ? "md:col-span-2" : ""}>
                      <label className="mb-1 block text-sm">{label}</label>
                      {key === "appearance" ? (
                        <NumberInput value={sheet.traits.appearance} onChange={(v) => updateSheet((prev) => ({ ...prev, traits: { ...prev.traits, appearance: clampNumber(v) } }))} />
                      ) : (
                        <Input value={(sheet.traits as any)[key]} onChange={(e) => updateSheet((prev) => ({ ...prev, traits: { ...prev.traits, [key]: e.target.value } }))} />
                      )}
                    </div>
                  ))}
                  <Separator className="md:col-span-2" />
                  {[
                    ["nationality", "Nationality"], ["hometown", "Home town/city"], ["deity", "Deity"], ["patronLord", "Patron/lord"], ["parents", "Parents"], ["spouse", "Spouse"], ["children", "Children"],
                  ].map(([key, label]) => (
                    <div key={key} className={key === "parents" || key === "children" ? "md:col-span-2" : ""}>
                      <label className="mb-1 block text-sm">{label}</label>
                      <Input value={(sheet.background as any)[key]} onChange={(e) => updateSheet((prev) => ({ ...prev, background: { ...prev.background, [key]: e.target.value } }))} />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Notes</label>
                    <Textarea rows={5} value={sheet.background.other} onChange={(e) => updateSheet((prev) => ({ ...prev, background: { ...prev.background, other: e.target.value } }))} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Race Data">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span>Soul Departure</span><Badge>{selectedRace.soulDepartureRounds} rounds</Badge></div>
                  <div className="flex items-center justify-between"><span>Recovery Multiplier</span><Badge>{selectedRace.recoveryMultiplier}</Badge></div>
                  <div><div className="mb-1 text-slate-500">Body Development</div><div>{formatProgression(selectedRace.bodyDevelopmentProgression)}</div></div>
                  <div><div className="mb-1 text-slate-500">PP Development (Channeling)</div><div>{formatProgression(selectedRace.ppDevelopmentProgressionByRealm.Channeling)}</div></div>
                  <div><div className="mb-1 text-slate-500">PP Development (Essence)</div><div>{formatProgression(selectedRace.ppDevelopmentProgressionByRealm.Essence)}</div></div>
                  <div><div className="mb-1 text-slate-500">PP Development (Mentalism)</div><div>{formatProgression(selectedRace.ppDevelopmentProgressionByRealm.Mentalism)}</div></div>
                  {selectedRace.specialNotes && selectedRace.specialNotes.length > 0 && (
                    <div><div className="mb-1 text-slate-500">Race Specials</div><div className="text-xs">{selectedRace.specialNotes.join(", ")}</div></div>
                  )}
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="levelUp" className="space-y-4" data-no-tab-swipe="true">
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <SectionCard title="Stat Increase Rolls" action={<Button type="button" variant="outline" className="rounded-2xl h-8 px-3 text-sm" onClick={closeLevelUpHelper}>Close</Button>}>
                <div className="mb-2 text-xs text-slate-500">Enter 2d10 rolls to calculate stat gains. Leave blank to skip.</div>
                <div className="space-y-1">
                  {STAT_NAMES.map((stat) => {
                    const baseRoll = baseStatRolls[stat];
                    const preview = levelUpPreview[stat];
                    return (
                      <div key={stat} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                        <div className="w-36 shrink-0">
                          <div className="text-sm font-medium">{stat}</div>
                          <div className="text-[10px] text-slate-500">{sheet.stats[stat].temp}→{preview.temp}/{preview.potential}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                          <NumberInput className="flex-1 sm:w-20" value={baseRoll.die1} min={0} max={10} onChange={(v) => setBaseStatRolls((prev) => ({ ...prev, [stat]: { ...prev[stat], die1: v } }))} />
                          <NumberInput className="flex-1 sm:w-20" value={baseRoll.die2} min={0} max={10} onChange={(v) => setBaseStatRolls((prev) => ({ ...prev, [stat]: { ...prev[stat], die2: v } }))} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Development" action={<Badge>{dpRemaining} DP left</Badge>}>
                <div className="space-y-3">
                  <div className="rounded-2xl border p-3 text-sm">
                    <div className="flex items-center justify-between"><span>Available DP</span><span className="font-semibold">{projectedDevelopmentPoints}</span></div>
                    <div className="mt-1 flex items-center justify-between"><span>Spent DP</span><span className="font-semibold">{dpSpent}</span></div>
                    <div className="mt-1 flex items-center justify-between"><span>Remaining DP</span><span className={`font-semibold ${dpRemaining < 0 ? "text-red-600" : ""}`}>{dpRemaining}</span></div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="min-w-0">
                        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Skill Categories</div>
                        <ScrollArea className="max-h-56 rounded-xl border p-2">
                          <div className="space-y-2">
                            {categorySpendSuggestions.map((cat) => (
                              <div key={cat.id} className="rounded-xl border p-2 text-sm">
                                {(() => {
                                  const projected = projectedCategoryBonuses[cat.id];
                                  const bonusDisplay = projected && projected.projectedTotal !== cat.currentTotal
                                    ? `${cat.currentTotal} -> ${projected.projectedTotal}`
                                    : `${cat.currentTotal}`;
                                  const rankDisplay = projected && projected.projectedRanks !== cat.ranks
                                    ? `${cat.ranks} -> ${projected.projectedRanks}`
                                    : `${cat.ranks}`;

                                  return (
                                    <>
                                <div className="min-w-0 flex-1">
                                  <div className="break-words font-medium">{cat.name}</div>
                                  <div className="break-words text-xs text-slate-500">Ranks {rankDisplay} · Bonus {bonusDisplay} · Dev Cost {formatDevelopmentCostPath(categoryDerived.find((x) => x.id === cat.id)?.developmentCost ?? "", cat.ranks)}</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 rounded-lg px-2 text-xs"
                                    disabled={
                                      cat.selectedUpgrades >= cat.options.length
                                      || cat.options.length === 0
                                      || isZeroProgression(cat.progression)
                                    }
                                    onClick={() => addCategoryUpgradeSpend(cat.id, cat.name, cat.ranksPerUpgrade, cat.options, cat.selectedUpgrades)}
                                  >
                                    {isZeroProgression(cat.progression)
                                      ? "No upgrades"
                                      : cat.options[cat.selectedUpgrades]
                                      ? `Upgrade (${cat.options[cat.selectedUpgrades].cost - (cat.options[cat.selectedUpgrades - 1]?.cost ?? 0)} DP)`
                                      : "Max Upgrades Reached"}
                                  </Button>
                                  {cat.selectedUpgrades > 0 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 rounded-lg px-2 text-xs"
                                      onClick={() => removeCategoryUpgradeSpend(cat.id, cat.name, cat.options, cat.selectedUpgrades)}
                                    >
                                      Undo
                                    </Button>
                                  )}
                                </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Known Skills</div>
                        <ScrollArea className="max-h-56 rounded-xl border p-2">
                          <div className="space-y-2">
                            {skillSpendSuggestions.map((skill) => (
                              <div key={skill.id} className="rounded-xl border p-2 text-sm">
                                {(() => {
                                  const projected = projectedSkillBonuses[skill.id];
                                  const bonusDisplay = projected && projected.projectedTotal !== skill.currentTotal
                                    ? `${skill.currentTotal} -> ${projected.projectedTotal}`
                                    : `${skill.currentTotal}`;
                                  const rankDisplay = projected && projected.projectedRanks !== skill.ranks
                                    ? `${skill.ranks} -> ${projected.projectedRanks}`
                                    : `${skill.ranks}`;

                                  return (
                                    <>
                                <div className="min-w-0 flex-1">
                                  <div className="break-words font-medium">{skill.name}</div>
                                  <div className="break-words text-xs text-slate-500">{skill.categoryName} · Ranks {rankDisplay} · Bonus {bonusDisplay} · Dev Cost {formatDevelopmentCostPath(skillDerived.find((x) => x.id === skill.id)?.category?.developmentCost ?? "", skill.ranks)}</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 rounded-lg px-2 text-xs"
                                    disabled={skill.selectedUpgrades >= skill.options.length || skill.options.length === 0}
                                    onClick={() => addSkillUpgradeSpend(skill.id, skill.name, skill.ranksPerUpgrade, skill.options, skill.selectedUpgrades)}
                                  >
                                    {skill.options[skill.selectedUpgrades]
                                      ? `Upgrade (${skill.options[skill.selectedUpgrades].cost - (skill.options[skill.selectedUpgrades - 1]?.cost ?? 0)} DP)`
                                      : "Max Upgrades Reached"}
                                  </Button>
                                  {skill.selectedUpgrades > 0 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 rounded-lg px-2 text-xs"
                                      onClick={() => removeSkillUpgradeSpend(skill.id, skill.name, skill.options, skill.selectedUpgrades)}
                                    >
                                      Undo
                                    </Button>
                                  )}
                                </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                    <div>
                      <Button type="button" variant="outline" className="h-8 rounded-2xl px-3 text-sm" onClick={() => setShowNewSkillForm((p) => !p)}>
                        <Plus className="mr-1 h-3 w-3" />{showNewSkillForm ? "Cancel" : "Add New Skill"}
                      </Button>
                      {showNewSkillForm && (
                        <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_220px_90px]">
                          <Input placeholder="New skill name" value={newLevelUpSkillName} onChange={(e) => setNewLevelUpSkillName(e.target.value)} />
                          <Select value={newLevelUpSkillCategoryId} onValueChange={(v) => setNewLevelUpSkillCategoryId(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[...sheet.skillCategories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={() => { addNewSkillFromLevelUp(); setShowNewSkillForm(false); }}>Add</Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <Button type="button" variant="outline" className="h-8 rounded-2xl px-3 text-sm" onClick={() => {
                        if (showTrainingPackageForm) {
                          setTrainingPackageSpendName("");
                          setTrainingPackageSpendCost(0);
                          setShowTrainingPackageForm(false);
                        } else {
                          const firstPkg = TRAINING_PACKAGES.find((p) => sheet.details.profession in p.professionCosts);
                          if (firstPkg) {
                            setTrainingPackageSpendName(firstPkg.name);
                            setTrainingPackageSpendCost(firstPkg.professionCosts[sheet.details.profession] ?? 0);
                          }
                          setShowTrainingPackageForm(true);
                        }
                      }}>
                        <Plus className="mr-1 h-3 w-3" />{showTrainingPackageForm ? "Cancel" : "Add Training Package"}
                      </Button>
                      {showTrainingPackageForm && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_90px]">
                          <Select value={trainingPackageSpendName} onValueChange={(v) => {
                            setTrainingPackageSpendName(v);
                            const pkg = TRAINING_PACKAGES.find((p) => p.name === v);
                            const cost = pkg?.professionCosts[sheet.details.profession];
                            if (cost !== undefined) setTrainingPackageSpendCost(cost);
                          }}>
                            <SelectTrigger><SelectValue placeholder="Select package…" /></SelectTrigger>
                            <SelectContent>
                              {TRAINING_PACKAGES.filter((p) => sheet.details.profession in p.professionCosts).map((p) => (
                                <SelectItem key={p.name} value={p.name}>{p.name} [{p.professionCosts[sheet.details.profession]} DP]</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={() => { addTrainingPackageSpend(); setShowTrainingPackageForm(false); }}>Add</Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <Button type="button" variant="outline" className="h-8 rounded-2xl px-3 text-sm" onClick={addExtraStatRoll}>
                        <Plus className="mr-1 h-3 w-3" />Buy Extra Stat Roll (8 DP)
                      </Button>
                      {extraStatRolls.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {extraStatRolls.map((roll) => (
                            <div key={roll.id} className="rounded-2xl border p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="text-sm font-medium">Extra Stat Roll</div>
                                <div className="flex items-center gap-2">
                                  <Badge>8 DP</Badge>
                                  <Button variant="ghost" size="icon" onClick={() => setExtraStatRolls((prev) => prev.filter((x) => x.id !== roll.id))}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <Select value={roll.stat} onValueChange={(v) => setExtraStatRolls((prev) => prev.map((x) => x.id === roll.id ? { ...x, stat: v as StatName } : x))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {STAT_NAMES.map((stat) => <SelectItem key={stat} value={stat}>{stat}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <NumberInput value={roll.die1} min={0} onChange={(v) => setExtraStatRolls((prev) => prev.map((x) => x.id === roll.id ? { ...x, die1: v } : x))} />
                                <NumberInput value={roll.die2} min={0} onChange={(v) => setExtraStatRolls((prev) => prev.map((x) => x.id === roll.id ? { ...x, die2: v } : x))} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Apply Level Up" action={<Button type="button" className="rounded-2xl" onClick={commitLevelUp}>Commit Level Up</Button>}>
              <div className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border p-3">
                    <div className="text-slate-500">Level</div>
                    <div className="text-lg font-semibold">{sheet.details.level} → {sheet.details.level + 1}</div>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <div className="text-slate-500">Talent Points</div>
                    <div className="text-lg font-semibold">{sheet.details.talentPoints} → {sheet.details.talentPoints + 2}</div>
                  </div>
                  <div className="rounded-2xl border p-3">
                    <div className="text-slate-500">Development Points</div>
                    <div className="font-semibold">{projectedDevelopmentPoints} available</div>
                    <div className={`text-xs ${dpRemaining < 0 ? "text-red-600" : "text-slate-500"}`}>{dpSpent} spent · {dpRemaining} remaining</div>
                  </div>
                </div>

                {(dpSpendEntries.length > 0 || extraStatRolls.length > 0) && (
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Purchases</div>
                    <div className="space-y-1">
                      {dpSpendEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                          <span className="break-words font-medium">{entry.label}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge>{entry.cost} DP</Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDpSpendEntries((prev) => prev.filter((x) => x.id !== entry.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                      {extraStatRolls.map((roll) => (
                        <div key={roll.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                          <span className="font-medium">Extra Stat Roll: {roll.stat}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge>8 DP</Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExtraStatRolls((prev) => prev.filter((x) => x.id !== roll.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Stat Preview</div>
                  <div className="space-y-1">
                    {STAT_NAMES.map((stat) => {
                      const preview = levelUpPreview[stat];
                      const changed = preview.temp !== sheet.stats[stat].temp;
                      return (
                        <div key={stat} className="flex items-center gap-2 rounded-xl border px-3 py-1.5">
                          <span className="w-28 shrink-0 font-medium">{stat}</span>
                          <Badge className={`shrink-0 text-xs ${!changed ? "opacity-50" : ""}`}>{sheet.stats[stat].temp}→{preview.temp}/{preview.potential}</Badge>
                          {preview.logs[0] && <span className="min-w-0 truncate text-xs text-slate-500">{preview.logs[0]}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4">
              <SectionCard title="Stats">
                <div className="grid gap-3 md:hidden">
                  {STAT_NAMES.map((name) => (
                    <div key={name} className="rounded-2xl border p-3">
                      <button type="button" className="w-full text-left" onClick={() => setExpandedMobileStat((prev) => prev === name ? null : name)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">{name}</div>
                          {expandedMobileStat === name ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                          <div><div className="text-xs text-slate-500">Temp</div><div className="font-semibold">{sheet.stats[name].temp}</div></div>
                          <div><div className="text-xs text-slate-500">Potential</div><div className="font-semibold">{sheet.stats[name].potential}</div></div>
                          <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{statTotals[name].total}</div></div>
                        </div>
                      </button>
                      {expandedMobileStat === name && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Temp</label>
                            <NumberInput value={sheet.stats[name].temp} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], temp: clampNumber(v) } } }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Potential</label>
                            <NumberInput value={sheet.stats[name].potential} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], potential: clampNumber(v) } } }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special</label>
                            <NumberInput value={sheet.stats[name].specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], specialBonus: v } } }))} />
                          </div>
                          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                            <div><div className="text-xs text-slate-500">Basic</div><div className="font-semibold">{statTotals[name].basic}</div></div>
                            <div><div className="text-xs text-slate-500">Racial</div><div className="font-semibold">{statTotals[name].racial}</div></div>
                            <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{statTotals[name].total}</div></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2">Stat</th>
                      <th>Temp</th>
                      <th>Potential</th>
                      <th>Basic</th>
                      <th>Racial</th>
                      <th>Special</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STAT_NAMES.map((name) => (
                      <tr key={name} className="border-b align-middle">
                        <td className="py-2 font-medium">{name}</td>
                        <td className="py-2"><NumberInput value={sheet.stats[name].temp} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], temp: clampNumber(v) } } }))} /></td>
                        <td><NumberInput value={sheet.stats[name].potential} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], potential: clampNumber(v) } } }))} /></td>
                        <td>{statTotals[name].basic}</td>
                        <td>{statTotals[name].racial}</td>
                        <td><NumberInput value={sheet.stats[name].specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, stats: { ...prev.stats, [name]: { ...prev.stats[name], specialBonus: v } } }))} /></td>
                        <td className="font-semibold">{statTotals[name].total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="combat" className="space-y-4">
            {(() => {
              const quiBonus = statTotals["Quickness"].total;
              const initTotal = combatInitDie1 + combatInitDie2 + quiBonus;
              const totalActivity = Object.values(combatPhases).reduce((sum, ps) => sum + (ps.cancelled ? 0 : ps.activityPct), 0);
              const activityOver = totalActivity > 100;
              const missileAttacks = commonlyUsedAttacks.filter((s) => MISSILE_WEAPON_CATS.includes(s.category?.name ?? ""));
              const meleeAttacks = commonlyUsedAttacks.filter((s) => !MISSILE_WEAPON_CATS.includes(s.category?.name ?? ""));

              const computeAttackTotals = (ps: CombatPhaseState, phaseMod: number, actionDef: CombatActionDef, extraMod = 0) => {
                const isMissile = ps.attackType === "missile";
                const attackTypeOBMod = ps.attackType === "fullMelee" ? 10 : ps.attackType === "reactMelee" ? -10 : 0;
                const attackMaxActivity = actionDef.attackMaxActivity ?? 100;
                const activityPenalty = -(attackMaxActivity - Math.min(ps.activityPct, attackMaxActivity));
                const flankMod = !isMissile && ps.modFlank ? 15 : 0;
                const rearMod = !isMissile && ps.modRear ? 20 : 0;
                const surpriseMod = !isMissile && ps.modSurprise ? 20 : 0;
                const advantageMod = !isMissile ? ps.modAdvantage : 0;
                const stunnedMod = ps.modStunned ? 20 : 0;
                const downedMod = ps.modDowned ? 30 : 0;
                const proneMod = ps.modProne ? 50 : 0;
                const chargingMod = !isMissile && ps.modCharging && ps.movementFt >= 10 ? Math.floor(ps.movementFt / 10) : 0;
                const rangeMod = isMissile ? ps.modRange : 0;
                const armorMod = isMissile ? ps.modArmorPenalty : 0;
                const hp = healthPenalty(healthPercent);
                const hitsMod = hp === -999 ? -100 : hp;
                const epMod = exhaustionPenalty(exhaustionPercent);
                const parryOB = Math.min(ps.parryOB, Math.max(0, ps.baseOB));
                const obForAttack = ps.baseOB - parryOB;
                const rows: { label: string; value: number }[] = [
                  { label: "OB (after parry)", value: obForAttack },
                  { label: "Attack type bonus", value: attackTypeOBMod },
                  { label: "Phase modifier", value: phaseMod },
                  { label: "Activity penalty", value: activityPenalty },
                ];
                if (flankMod) rows.push({ label: "Flank attack", value: flankMod });
                if (rearMod) rows.push({ label: "Rear attack", value: rearMod });
                if (surpriseMod) rows.push({ label: "Surprise attack", value: surpriseMod });
                if (advantageMod) rows.push({ label: "Advantageous position", value: advantageMod });
                if (stunnedMod) rows.push({ label: "Target stunned", value: stunnedMod });
                if (downedMod) rows.push({ label: "Target downed", value: downedMod });
                if (proneMod) rows.push({ label: "Target prone", value: proneMod });
                if (chargingMod) rows.push({ label: `Charging (${ps.movementFt}')`, value: chargingMod });
                if (rangeMod) rows.push({ label: "Range modifier", value: rangeMod });
                if (armorMod) rows.push({ label: "Armor penalty", value: armorMod });
                if (hitsMod !== 0) rows.push({ label: "Hits taken", value: hitsMod });
                if (epMod !== 0) rows.push({ label: "Exhaustion", value: epMod });
                if (extraMod !== 0) rows.push({ label: "Cancellation penalty", value: extraMod });
                if (ps.modOther !== 0) rows.push({ label: "Other", value: ps.modOther });
                const totalMod = rows.slice(1).reduce((s, r) => s + r.value, 0);
                const total = ps.diceResult + obForAttack + totalMod;
                return { rows, totalMod, total, parryOB, obForAttack, activityPenalty };
              };

              return (
                <>
                  {/* ── Initiative ─────────────────────────────────── */}
                  <SectionCard title="Initiative" action={
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={rollCombatInit}>Roll 2d10</Button>
                      <Button type="button" variant="ghost" className="h-8 rounded-xl px-3 text-xs text-slate-500" onClick={resetCombatRound}>New Round</Button>
                    </div>
                  }>
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Die 1</label>
                        <NumberInput value={combatInitDie1} min={1} max={10} onChange={(v) => { setCombatInitDie1(v); setCombatInitBreakdown(""); }} className="w-20" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Die 2</label>
                        <NumberInput value={combatInitDie2} min={1} max={10} onChange={(v) => { setCombatInitDie2(v); setCombatInitBreakdown(""); }} className="w-20" />
                      </div>
                      <div className="text-sm text-slate-500">
                        Quickness bonus: <span className="font-medium text-slate-800">{signed(quiBonus)}</span>
                      </div>
                      {combatInitBreakdown && <div className="text-xs text-slate-400">{combatInitBreakdown}</div>}
                      {(combatInitDie1 + combatInitDie2) > 0 && (
                        <div className="rounded-2xl bg-slate-900 px-5 py-2 text-white">
                          <div className="text-[10px] uppercase tracking-widest text-slate-400">Initiative</div>
                          <div className="text-2xl font-bold tabular-nums">{initTotal}</div>
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  {/* ── Activity Budget ─────────────────────────────── */}
                  <div className="rounded-2xl border bg-white px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Activity Budget</span>
                      <span className={`text-sm font-semibold tabular-nums ${activityOver ? "text-red-600" : "text-slate-700"}`}>{totalActivity}% / 100%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${activityOver ? "bg-red-500" : totalActivity >= 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(totalActivity, 100)}%` }}
                      />
                    </div>
                    {activityOver && <div className="mt-1 text-xs text-red-600">Over budget by {totalActivity - 100}%</div>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {COMBAT_PHASES.map((ph) => {
                        const ps = combatPhases[ph.key];
                        if (ps.actionId === "none" && !ps.cancelled) return null;
                        if (ps.cancelled) {
                          const def = COMBAT_ACTION_DEFS.find((a) => a.id === ps.actionId);
                          return (
                            <span key={ph.key} className="line-through text-rose-400">
                              <span className="font-medium">{ph.label}:</span> {ps.activityPct}% — {def?.label ?? ps.actionId}
                            </span>
                          );
                        }
                        const def = COMBAT_ACTION_DEFS.find((a) => a.id === ps.actionId);
                        return (
                          <span key={ph.key}>
                            <span className="font-medium text-slate-700">{ph.label}:</span> {ps.activityPct}% — {def?.label ?? ps.actionId}
                            {ps.resolved && <span className="ml-1 text-emerald-600">✓</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Phase Cards ─────────────────────────────────── */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {COMBAT_PHASES.map((ph) => {
                      const ps = combatPhases[ph.key];
                      const actionDef = COMBAT_ACTION_DEFS.find((a) => a.id === ps.actionId) ?? COMBAT_ACTION_DEFS[0];
                      const isMissile = actionDef.attackType === "missile";
                      const movPaceDef = COMBAT_MOVEMENT_PACES.find((p) => p.key === ps.pace) ?? COMBAT_MOVEMENT_PACES[0];
                      const movDistance = actionDef.isMovement && ps.activityPct > 0
                        ? Math.round(sheet.armor.baseMovementRate * movPaceDef.multiplier * ps.activityPct / 100) : 0;
                      const isReplacementMelee = combatCancelledInfo !== null && ph.key === "deliberate" && actionDef.id === "fullMelee";
                      const attackTotals = actionDef.isAttack ? computeAttackTotals(ps, ph.modifier, actionDef, isReplacementMelee ? -40 : 0) : null;

                      // Actions available for this phase
                      const postCancelAllowedIds = combatCancelledInfo?.high
                        ? ["none", "movDelib", "fullMelee", "movingManeuver", "staticManeuver"]
                        : ["none", "movDelib"];
                      const phaseActions = ph.key === "postDeliberate"
                        ? COMBAT_ACTION_DEFS.filter((a) => a.id === "none" || a.id === "movPost")
                        : combatCancelledInfo !== null && ph.key === "deliberate"
                          ? COMBAT_ACTION_DEFS.filter((a) => postCancelAllowedIds.includes(a.id))
                          : COMBAT_ACTION_DEFS.filter((a) => !a.phase || a.phase === ph.key);
                      // Build ordered group list (preserving insertion order)
                      const seenGroups: string[] = [];
                      phaseActions.forEach((a) => { if (!seenGroups.includes(a.group)) seenGroups.push(a.group); });

                      // ── Resolved view ────────────────────────────
                      if (ps.resolved) {
                        return (
                          <div key={ph.key} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span className="font-semibold text-slate-700">{ph.label}</span>
                              {actionDef.id !== "none" && (
                                <span className="text-sm text-slate-500">{actionDef.label} · {ps.activityPct}%</span>
                              )}
                              {actionDef.isAttack && ps.diceResult !== 0 && attackTotals && (
                                <span className="text-sm font-bold text-slate-800">→ {attackTotals.total}</span>
                              )}
                              <Button
                                type="button" variant="ghost"
                                className="ml-auto h-7 rounded-xl px-2 text-xs text-slate-500"
                                onClick={() => updateCombatPhase(ph.key, { resolved: false })}
                              >
                                Unresolve
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      // ── Cancelled view ───────────────────────────
                      if (ps.cancelled && !(combatCancelledInfo !== null && ph.key === "deliberate")) {
                        return (
                          <div key={ph.key} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-rose-700 line-through">{ph.label}</span>
                              {actionDef.id !== "none" && (
                                <span className="text-sm text-rose-500 line-through">{actionDef.label} · {ps.activityPct}%</span>
                              )}
                              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Cancelled</span>
                              {combatCancelledInfo === null && (
                                <Button
                                  type="button" variant="ghost"
                                  className="ml-auto h-7 rounded-xl px-2 text-xs text-rose-600"
                                  onClick={() => updateCombatPhase(ph.key, { cancelled: false })}
                                >
                                  Uncancel
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // ── Post-cancellation lock (non-deliberate) ──
                      if (combatCancelledInfo !== null && ph.key !== "deliberate") {
                        return (
                          <div key={ph.key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 opacity-60">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-500">{ph.label}</span>
                              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">Locked</span>
                            </div>
                          </div>
                        );
                      }

                      // ── Normal view ──────────────────────────────
                      return (
                        <div key={ph.key} className="rounded-2xl border bg-white p-4 shadow-sm">
                          {/* Phase header */}
                          <div className="mb-3 flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{ph.label}</span>
                            {ph.key === "postDeliberate" ? (
                              <Badge className="rounded-lg px-2 py-0 text-[11px] bg-slate-100 text-slate-600">Movement only</Badge>
                            ) : (
                              <Badge className={`rounded-lg px-2 py-0 text-[11px] ${ph.modifier < 0 ? "bg-red-100 text-red-700" : ph.modifier > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {ph.modifier > 0 ? `+${ph.modifier}` : ph.modifier === 0 ? "±0" : ph.modifier} to all rolls
                              </Badge>
                            )}
                            {combatCancelledInfo !== null && ph.key === "deliberate" && (
                              <Badge className="rounded-lg px-2 py-0 text-[11px] bg-amber-100 text-amber-800">Replacement action only</Badge>
                            )}
                            {ps.actionId !== "none" && (
                              <span className="ml-auto text-sm font-medium tabular-nums text-slate-600">{ps.activityPct}%</span>
                            )}
                          </div>

                          {/* Action selector */}
                          <div className="mb-3">
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Action</label>
                            <Select value={ps.actionId} onValueChange={(v) => {
                              const def = COMBAT_ACTION_DEFS.find((a) => a.id === v);
                              updateCombatPhase(ph.key, {
                                actionId: v,
                                activityPct: def?.defaultActivity ?? 0,
                                attackType: def?.attackType ?? ps.attackType,
                              });
                            }}>
                              <SelectContent>
                                {seenGroups.map((group) => {
                                  const items = phaseActions.filter((a) => a.group === group);
                                  if (group === "") {
                                    return items.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>);
                                  }
                                  return (
                                    <SelectGroup key={group} label={group}>
                                      {items.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                                    </SelectGroup>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Activity % for variable actions */}
                          {ps.actionId !== "none" && actionDef.variable && (
                            <div className="mb-3">
                              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                                Activity % ({actionDef.minActivity}–{actionDef.maxActivity}%)
                              </label>
                              <NumberInput
                                value={ps.activityPct}
                                min={actionDef.minActivity}
                                max={actionDef.maxActivity}
                                onChange={(v) => updateCombatPhase(ph.key, { activityPct: Math.max(actionDef.minActivity, Math.min(v, actionDef.maxActivity)) })}
                              />
                            </div>
                          )}

                          {/* Movement pace */}
                          {actionDef.isMovement && (
                            <div className="mb-3">
                              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Pace</label>
                              <Select value={ps.pace} onValueChange={(v) => updateCombatPhase(ph.key, { pace: v as CombatMovementPace })}>
                                <SelectContent>
                                  {COMBAT_MOVEMENT_PACES.map((p) => (
                                    <SelectItem key={p.key} value={p.key}>{p.label} (×{p.multiplier})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {movDistance > 0 && (
                                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                                  Distance: <span className="font-semibold">{movDistance} ft</span>
                                  <span className="ml-1 text-slate-500">({movPaceDef.label}, {ps.activityPct}%)</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Multi-round action indicator */}
                          {ps.actionId !== "none" && actionDef.totalRequired !== undefined && (
                            <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                              <div className="mb-2 text-xs font-semibold text-blue-800">Multi-Round Action — {actionDef.totalRequired}% total required</div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs text-blue-700">Accumulated from previous rounds (%)</label>
                                  <NumberInput
                                    value={ps.accumulatedActivity}
                                    min={0}
                                    onChange={(v) => updateCombatPhase(ph.key, { accumulatedActivity: clampNumber(v) })}
                                  />
                                </div>
                                <div className="flex items-center justify-center rounded-xl bg-white p-2 text-center">
                                  {(() => {
                                    const tot = ps.accumulatedActivity + ps.activityPct;
                                    const needed = actionDef.totalRequired!;
                                    return (
                                      <div>
                                        <div className="text-sm font-semibold tabular-nums">{tot}% / {needed}%</div>
                                        {tot >= needed
                                          ? <div className="text-xs font-medium text-emerald-700">Completes this round!</div>
                                          : <div className="text-xs text-blue-700">Need {needed - tot}% more</div>
                                        }
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── Attack sub-panel ────────────────────── */}
                          {actionDef.isAttack && attackTotals && (
                            <div className="mt-1 space-y-3 border-t pt-3">
                              {/* Weapon / OB */}
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Weapon / Skill</label>
                                  <Select value={ps.skillName || "__manual__"} onValueChange={(v) => {
                                    if (v === "__manual__") {
                                      updateCombatPhase(ph.key, { skillName: "" });
                                    } else {
                                      const pool = isMissile ? missileAttacks : meleeAttacks;
                                      const atk = pool.find((a) => a.name === v);
                                      updateCombatPhase(ph.key, { skillName: v, baseOB: atk?.total ?? ps.baseOB });
                                    }
                                  }}>
                                    <SelectContent>
                                      <SelectItem value="__manual__">— Enter OB manually —</SelectItem>
                                      {(isMissile ? missileAttacks : meleeAttacks).map((a) => (
                                        <SelectItem key={a.id} value={a.name}>{a.name} ({a.total >= 0 ? "+" : ""}{a.total})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Base OB</label>
                                  <NumberInput value={ps.baseOB} onChange={(v) => updateCombatPhase(ph.key, { baseOB: v })} />
                                </div>
                              </div>

                              {/* Parry (melee only) */}
                              {!isMissile && (
                                <div>
                                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Parry (OB converted to DB)</label>
                                  <NumberInput
                                    value={ps.parryOB}
                                    min={0}
                                    max={Math.max(0, ps.baseOB)}
                                    onChange={(v) => updateCombatPhase(ph.key, { parryOB: Math.max(0, Math.min(v, ps.baseOB)) })}
                                  />
                                  {ps.parryOB > 0 && (
                                    <div className="mt-1 text-xs text-slate-500">
                                      Remaining OB: {attackTotals.obForAttack} · DB bonus this round: +{attackTotals.parryOB}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Activity penalty display */}
                              {attackTotals.activityPenalty !== 0 && (
                                <div className="text-xs text-red-600">Activity penalty: {attackTotals.activityPenalty}</div>
                              )}

                              {/* OB Modifiers */}
                              <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Situational OB Modifiers</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                    <Checkbox checked={ps.modStunned} onChange={(e) => updateCombatPhase(ph.key, { modStunned: e.target.checked })} />
                                    Stunned <span className="font-medium text-emerald-600">+20</span>
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                    <Checkbox checked={ps.modDowned} onChange={(e) => updateCombatPhase(ph.key, { modDowned: e.target.checked })} />
                                    Downed <span className="font-medium text-emerald-600">+30</span>
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                    <Checkbox checked={ps.modProne} onChange={(e) => updateCombatPhase(ph.key, { modProne: e.target.checked })} />
                                    Prone <span className="font-medium text-emerald-600">+50</span>
                                  </label>
                                </div>
                                {!isMissile && (
                                  <>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <Checkbox checked={ps.modFlank} onChange={(e) => updateCombatPhase(ph.key, { modFlank: e.target.checked })} />
                                        Flank <span className="font-medium text-emerald-600">+15</span>
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <Checkbox checked={ps.modRear} onChange={(e) => updateCombatPhase(ph.key, { modRear: e.target.checked })} />
                                        Rear <span className="font-medium text-emerald-600">+20</span>
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <Checkbox checked={ps.modSurprise} onChange={(e) => updateCombatPhase(ph.key, { modSurprise: e.target.checked })} />
                                        Surprise <span className="font-medium text-emerald-600">+20</span>
                                      </label>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <label className="mb-1 block text-xs text-slate-500">Advantageous position</label>
                                        <NumberInput value={ps.modAdvantage} onChange={(v) => updateCombatPhase(ph.key, { modAdvantage: v })} />
                                      </div>
                                      <div>
                                        <label className="mb-1 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                                          <Checkbox checked={ps.modCharging} onChange={(e) => updateCombatPhase(ph.key, { modCharging: e.target.checked })} />
                                          Charging (≥10' movement)
                                        </label>
                                        {ps.modCharging && (
                                          <div className="flex items-center gap-2">
                                            <NumberInput value={ps.movementFt} min={0} onChange={(v) => updateCombatPhase(ph.key, { movementFt: clampNumber(v) })} className="w-24" />
                                            <span className="text-xs text-slate-500">ft → <span className="font-medium text-emerald-600">+{ps.movementFt >= 10 ? Math.floor(ps.movementFt / 10) : 0}</span></span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                                {isMissile && (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className="mb-1 block text-xs text-slate-500">Range modifier</label>
                                      <NumberInput value={ps.modRange} onChange={(v) => updateCombatPhase(ph.key, { modRange: v })} />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-xs text-slate-500">Armor penalty</label>
                                      <NumberInput value={ps.modArmorPenalty} onChange={(v) => updateCombatPhase(ph.key, { modArmorPenalty: v })} />
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500">Other modifier</label>
                                  <NumberInput value={ps.modOther} onChange={(v) => updateCombatPhase(ph.key, { modOther: v })} />
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                                  <span>Hits penalty (auto): <span className="font-medium text-slate-600">{healthPenalty(healthPercent) === -999 ? "Unconscious" : signed(healthPenalty(healthPercent))}</span></span>
                                  <span>EP penalty (auto): <span className="font-medium text-slate-600">{signed(exhaustionPenalty(exhaustionPercent))}</span></span>
                                </div>
                              </div>

                              {/* Dice roll */}
                              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <div>
                                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Open-Ended 1d100 Result</label>
                                  <NumberInput value={ps.diceResult} onChange={(v) => updateCombatPhase(ph.key, { diceResult: v, diceBreakdown: "" })} />
                                  {ps.diceBreakdown && <div className="mt-1 text-xs text-slate-400">{ps.diceBreakdown}</div>}
                                </div>
                                <div className="flex items-end">
                                  <Button type="button" variant="outline" className="h-10 rounded-2xl whitespace-nowrap" onClick={() => rollCombatAttack(ph.key)}>
                                    Roll d100 OE
                                  </Button>
                                </div>
                              </div>

                              {/* Result breakdown */}
                              <div className="overflow-hidden rounded-2xl border text-sm">
                                <div className="grid grid-cols-[1fr_auto] border-b bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  <span>Modifier</span><span>Value</span>
                                </div>
                                <div className="grid grid-cols-[1fr_auto] border-b px-3 py-2">
                                  <span className="text-slate-600">Dice roll</span>
                                  <span className="font-semibold tabular-nums">{ps.diceResult !== 0 ? signed(ps.diceResult) : "—"}</span>
                                </div>
                                {attackTotals.rows.map((row) => (
                                  <div key={row.label} className="grid grid-cols-[1fr_auto] border-b px-3 py-1.5 text-xs last:border-0">
                                    <span className="text-slate-600">{row.label}</span>
                                    <span className={`font-semibold tabular-nums ${row.value > 0 ? "text-emerald-600" : row.value < 0 ? "text-red-600" : "text-slate-400"}`}>{signed(row.value)}</span>
                                  </div>
                                ))}
                                <div className="grid grid-cols-[1fr_auto] border-t bg-slate-50 px-3 py-2 font-bold">
                                  <span>Attack Total</span>
                                  <span className="text-lg tabular-nums">{ps.diceResult !== 0 ? attackTotals.total : "—"}</span>
                                </div>
                              </div>

                              {/* Parry DB reminder */}
                              {!isMissile && ps.parryOB > 0 && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                                  Parry active: <span className="font-semibold">+{attackTotals.parryOB} DB</span> against one incoming attack this round
                                </div>
                              )}
                            </div>
                          )}

                          {/* Resolve button */}
                          {ps.actionId !== "none" && (
                            <div className="mt-3 flex justify-end border-t pt-3">
                              <Button
                                type="button" variant="outline"
                                className="h-8 rounded-xl px-3 text-xs"
                                onClick={() => updateCombatPhase(ph.key, { resolved: true })}
                              >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Resolved
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Cancel Remaining Actions ─────────────────────── */}
                  {(() => {
                    const unresolvedActive = COMBAT_PHASES
                      .filter((ph) => !combatPhases[ph.key].resolved && !combatPhases[ph.key].cancelled && combatPhases[ph.key].actionId !== "none")
                      .map((ph) => ({ ph, ps: combatPhases[ph.key], def: COMBAT_ACTION_DEFS.find((a) => a.id === combatPhases[ph.key].actionId) }));

                    // After committing a cancellation — show persistent reminder only
                    if (combatCancelledInfo !== null) {
                      const { total, high } = combatCancelledInfo;
                      return (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-semibold text-amber-900">Actions Cancelled — Allowed replacements:</span>
                            <Button type="button" variant="ghost" className="h-7 rounded-xl px-2 text-xs text-amber-700"
                              onClick={() => {
                                setCombatCancelledInfo(null);
                                setCombatPhases((prev) => {
                                  const next = { ...prev } as Record<CombatPhaseKey, CombatPhaseState>;
                                  (Object.keys(next) as CombatPhaseKey[]).forEach((k) => {
                                    if (next[k].cancelled) next[k] = { ...next[k], cancelled: false };
                                  });
                                  return next;
                                });
                              }}
                            >
                              Undo cancellation
                            </Button>
                          </div>
                          <div className="mb-2 text-sm text-amber-800">Cancelled activity: <strong>{total}%</strong></div>
                          <div className="text-sm text-amber-900">
                            {!high ? (
                              <ul className="list-disc pl-5">
                                <li>A <strong>10% movement</strong> as a deliberate action</li>
                              </ul>
                            ) : (
                              <ul className="list-disc pl-5 space-y-0.5">
                                <li>A <strong>50% movement</strong> as a deliberate action</li>
                                <li>A <strong>full melee attack</strong> as a deliberate action (–40 OB penalty)</li>
                                <li>Any <strong>maneuver</strong> as a deliberate action (–40 modifier)</li>
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (unresolvedActive.length === 0) return null;
                    const cancelledTotal = unresolvedActive.reduce((s, x) => s + x.ps.activityPct, 0);
                    const highCancel = cancelledTotal >= 60;
                    return (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-amber-900">Cancel Remaining Actions</span>
                          <Button type="button" variant="ghost" className="h-7 rounded-xl px-2 text-xs text-amber-700"
                            onClick={() => {
                              unresolvedActive.forEach((x) => {
                                if (x.ph.key === "deliberate") {
                                  updateCombatPhase("deliberate", makeCombatPhaseState());
                                } else {
                                  updateCombatPhase(x.ph.key, { cancelled: true });
                                }
                              });
                              setCombatCancelledInfo({ total: cancelledTotal, high: highCancel });
                            }}
                          >
                            Cancel all
                          </Button>
                        </div>
                        <div className="mb-3 text-sm text-amber-800">
                          Unresolved: {unresolvedActive.map((x) => `${x.ph.label} (${x.ps.activityPct}%)`).join(", ")} = <strong>{cancelledTotal}%</strong>
                        </div>
                        <div className="text-sm text-amber-900">
                          <span className="font-medium">If cancelled now, you may take:</span>
                          {!highCancel ? (
                            <ul className="mt-1 list-disc pl-5">
                              <li>A <strong>10% movement</strong> as a deliberate action</li>
                            </ul>
                          ) : (
                            <ul className="mt-1 list-disc pl-5 space-y-0.5">
                              <li>A <strong>50% movement</strong> as a deliberate action</li>
                              <li>A <strong>full melee attack</strong> as a deliberate action (–40 OB penalty)</li>
                              <li>Any <strong>maneuver</strong> as a deliberate action (–40 modifier)</li>
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Armor / Movement / Resistance ───────────────── */}
                  <div className="grid gap-4 xl:grid-cols-3">
                    <SectionCard title="Armor">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["armorType", "Armor Type"], ["weightPenalty", "Weight Penalty"], ["baseMovementRate", "Base Movement Rate"], ["movingManeuverPenalty", "Moving Maneuver Penalty"], ["missilePenalty", "Missile Penalty"], ["armorQuicknessPenalty", "Armor Quickness Penalty"], ["shieldBonus", "Shield Bonus"], ["magicBonus", "Magic Bonus"], ["specialBonus", "Special"],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <label className="mb-1 block text-sm">{label}</label>
                            <NumberInput value={(sheet.armor as any)[key]} onChange={(v) => updateSheet((prev) => ({ ...prev, armor: { ...prev.armor, [key]: v } }))} />
                          </div>
                        ))}
                        <div>
                          <label className="mb-1 block text-sm">Quickness Bonus</label>
                          <Input value={armorQuicknessBonus} readOnly />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm">Total Normal DB</label>
                          <Input value={totalNormalDB} readOnly />
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Movement Rates" action={<Badge>{sheet.armor.baseMovementRate} base</Badge>}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="py-2">Pace</th>
                              <th>Mult.</th>
                              <th>Rate (ft)</th>
                              <th>Exhaustion</th>
                              <th>Difficulty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["Walk", 1, "1/60 per round", "None"],
                              ["Fast Walk", 1.5, "1/30 per round", "None"],
                              ["Run", 2, "1/12 per round", "None"],
                              ["Sprint", 3, "2 per round", "Easy"],
                              ["Fast Sprint", 4, "6 per round", "Light"],
                              ["Dash", 5, "50 per round", "Medium"],
                            ].map(([pace, multiplier, exhaustion, difficulty]) => (
                              <tr key={String(pace)} className="border-b">
                                <td className="py-2 font-medium">{pace}</td>
                                <td>×{multiplier}</td>
                                <td>{Math.round(sheet.armor.baseMovementRate * Number(multiplier))}</td>
                                <td>{String(exhaustion)}</td>
                                <td>{String(difficulty)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>

                    <SectionCard title="Resistance Rolls">
                      <div className="space-y-3">
                        {(["Channeling", "Essence", "Mentalism", "Poison", "Disease", "Fear"] as ResistanceName[]).map((rr) => (
                          <div key={rr} className="grid items-center gap-2 rounded-2xl border p-3 md:grid-cols-4">
                            <div className="font-medium">{rr}</div>
                            <div>Race: {resistanceRolls[rr].raceBonus}</div>
                            <div>Stat: {resistanceRolls[rr].statBonus}</div>
                            <div className="font-semibold">Total: {resistanceRolls[rr].raceBonus + resistanceRolls[rr].statBonus}</div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <Checkbox checked={hideEmptyCategories} onChange={(e) => setHideEmptyCategories(e.target.checked)} />
                  Hide categories without skills
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <Checkbox checked={alwaysShowSkills} onChange={(e) => setAlwaysShowSkills(e.target.checked)} />
                  Always show skills
                </label>
              </div>
              <Button type="button" variant="outline" className="rounded-2xl h-8 px-3 text-sm" onClick={() => addSkillFromSkillsTab()}><Plus className="mr-1 h-3 w-3" />New Skill</Button>
            </div>
            <div className="space-y-3">
              {categoryDerived.map((cat) => {
                const isExpanded = expandedMobileCategoryId === cat.id;
                const catSkills = skillDerived.filter((skill) => skill.categoryId === cat.id);
                if (hideEmptyCategories && catSkills.length === 0) return null;
                return (
                  <div
                    key={cat.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${draggedSkillId ? "ring-1 ring-emerald-200" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedSkillId) return;
                      updateSkill(draggedSkillId, { categoryId: cat.id });
                      setDraggedSkillId(null);
                    }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      onClick={() => setExpandedMobileCategoryId((prev) => prev === cat.id ? null : cat.id)}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800">{cat.name}</div>
                        <div className="text-xs text-slate-500">{cat.applicableStatsDisplay} · {formatProgressionType(cat.progressionType)} · {catSkills.length} skill{catSkills.length === 1 ? "" : "s"}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
                        <span>Total: <span className="font-semibold text-slate-900">{cat.total}</span></span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>
                    {(isExpanded || alwaysShowSkills) && (
                      <div className="space-y-4 border-t p-3">
                        {isExpanded && (
                        <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Dev Cost</label>
                            {isBandedDevelopmentCost(cat.developmentCost) ? (
                              <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
                                <div className="font-semibold">Current: {formatDevelopmentCostPath(cat.developmentCost, cat.ranks)}</div>
                                <div className="mt-1 text-xs text-slate-500">{formatDevelopmentCostSchedule(cat.developmentCost)}</div>
                              </div>
                            ) : (
                              <Input value={cat.developmentCost} className="h-10" placeholder="2/5" onChange={(e) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, developmentCost: e.target.value } : c) }))} />
                            )}
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Profession</label>
                            <NumberInput value={cat.professionBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, professionBonus: v } : c) }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special</label>
                            <NumberInput value={cat.specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, specialBonus: v } : c) }))} />
                          </div>
                          {(cat.progressionType === "bodyDevelopment" || cat.progressionType === "powerPointDevelopment") && (
                            <div>
                              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Point Bonus / Rank</label>
                              <NumberInput value={cat.developmentPointBonus ?? 0} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, developmentPointBonus: v || undefined } : c) }))} />
                              <div className="mt-1 text-xs text-slate-400">
                                Race default: {formatProgression(cat.progressionType === "bodyDevelopment" ? selectedRace.bodyDevelopmentProgression : selectedRace.ppDevelopmentProgressionByRealm[primaryRealm])}
                                {(cat.developmentPointBonus ?? 0) !== 0 && <span className="ml-1">→ effective: {formatProgression(cat.progression)}</span>}
                              </div>
                            </div>
                          )}
                          {canEditCategoryNewRanks(cat.progressionType) ? (
                            <div>
                              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Ranks</label>
                              <NumberInput value={cat.ranks} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, ranks: clampNumber(v) } : c) }))} />
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Ranks are fixed by progression type.</div>
                          )}
                        </div>
                        {canEditCategoryNewRanks(cat.progressionType) && (
                          <div>
                            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">New Ranks</label>
                            <RankCheckboxes value={cat.newRanks} onChange={(v) => updateSheet((prev) => ({ ...prev, skillCategories: prev.skillCategories.map((c) => c.id === cat.id ? { ...c, newRanks: v } : c) }))} />
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                          <div><div className="text-xs text-slate-500">Rank</div><div className="font-semibold">{cat.rank}</div></div>
                          <div><div className="text-xs text-slate-500">Stat</div><div className="font-semibold">{cat.stat}</div></div>
                          <div><div className="text-xs text-slate-500">Prof</div><div className="font-semibold">{cat.professionBonus}</div></div>
                          <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{cat.total}</div></div>
                        </div>

                        <Separator />
                        </>
                        )}

                        {catSkills.length === 0
                          ? <div className="text-sm text-slate-500">No skills yet. Drag a skill here to move it into this category.</div>
                          : (
                            <div className="space-y-2">
                              {catSkills.map((skill) => (
                                <div
                                  key={skill.id}
                                  draggable
                                  onDragStart={() => setDraggedSkillId(skill.id)}
                                  onDragEnd={() => setDraggedSkillId(null)}
                                  onClick={() => setEditingSkillId(skill.id)}
                                  className={`flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50 ${draggedSkillId === skill.id ? "opacity-50" : ""}`}
                                >
                                  <span className="shrink-0 cursor-grab text-slate-400" title="Drag to move to another category">::</span>
                                  <button
                                    type="button"
                                    className="rounded-full p-1"
                                    onClick={(e) => { e.stopPropagation(); updateSheet((prev) => ({ ...prev, skills: prev.skills.map((s) => s.id === skill.id ? { ...s, favorite: !s.favorite } : s) })); }}
                                    title="Favorite"
                                  >
                                    <Star className={`h-4 w-4 ${skill.favorite ? "fill-current text-yellow-500" : "text-slate-300"}`} />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium text-slate-800">{skill.name || "(Unnamed Skill)"}</div>
                                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                                      <span>Ranks {skill.ranks}</span>
                                      <span>New Ranks {sheet.details.restrictedSkills.some((r) => r.toLowerCase() === skill.name.toLowerCase()) ? "Restricted" : skill.newRanks}</span>
                                      <span>Bonus {skill.total >= 0 ? "+" : ""}{skill.total}</span>
                                      {isWeaponCategory(skill.category?.name ?? "") && <span>Fumble {skill.fumble || "—"}</span>}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button type="button" variant="ghost" size="icon" onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSkillId((prev) => prev === skill.id ? null : prev);
                                      updateSheet((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== skill.id) }));
                                    }}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="spells" className="space-y-4">
            {(() => {
              const hasMagicalRealm = sheet.details.realmOfPower.some((r) => r !== "Arms");
              if (!hasMagicalRealm) {
                return (
                  <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">
                    This character has no magical realm and cannot cast spells.
                  </div>
                );
              }
              const LIST_TYPE_ORDER: SpellListType[] = ["Base", "Open", "Closed", "Training Package"];
              const groups = LIST_TYPE_ORDER
                .map((type) => ({ type, lists: spellTabLists.filter((l) => l.entry.type === type) }))
                .filter((g) => g.lists.length > 0);
              const modifiersCard = (
                <div className="rounded-2xl border bg-white p-3">
                  <div className="mb-2 text-sm font-medium text-slate-700">Spell Casting Modifiers</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm">Spell Adder (free spells per day)</label>
                      <Input
                        type="text"
                        value={sheet.magic.spellAdder}
                        onChange={(e) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, spellAdder: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm">Spell Multiplier (applied to total PP)</label>
                      <Input
                        type="text"
                        value={sheet.magic.spellMultiplier}
                        onChange={(e) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, spellMultiplier: e.target.value } }))}
                      />
                    </div>
                  </div>
                </div>
              );
              if (groups.length === 0) {
                return (
                  <div className="space-y-4">
                    {modifiersCard}
                    <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-500">
                      No spell lists yet. Add spell list skills under the Skills tab to see them here.
                    </div>
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  {modifiersCard}
                  {groups.map(({ type, lists }) => (
                    <div key={type} className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{type} Lists</h3>
                      {lists.map(({ entry, ranks }) => {
                        const isExpanded = expandedSpellListIds.has(entry.id);
                        return (
                          <div key={entry.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                              onClick={() => setExpandedSpellListIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(entry.id)) next.delete(entry.id);
                                else next.add(entry.id);
                                return next;
                              })}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="font-semibold text-slate-800">{entry.name}</span>
                                <Badge className="shrink-0 text-xs">{entry.realm}</Badge>
                              </div>
                              <div className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
                                <span>Ranks: <span className={`font-semibold ${ranks === 0 ? "text-slate-400" : "text-slate-800"}`}>{ranks}</span></span>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t">
                                {/* Desktop table */}
                                <div className="hidden overflow-x-auto md:block">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                        <th className="w-12 px-3 py-2 text-center">Lvl</th>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">AoE</th>
                                        <th className="px-3 py-2">Duration</th>
                                        <th className="px-3 py-2">Range</th>
                                        <th className="w-14 px-3 py-2 text-center">Type</th>
                                        <th className="px-3 py-2">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {entry.spells.map((spell) => {
                                        const castable = spell.level <= ranks;
                                        return (
                                          <tr
                                            key={spell.id}
                                            className={`border-b last:border-0 ${castable ? "cursor-pointer hover:bg-emerald-50/50" : "opacity-40"}`}
                                            onClick={castable ? () => openSpellCastingAssistant(entry.id, spell.id) : undefined}
                                          >
                                            <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">{spell.level}</td>
                                            <td className="px-3 py-2 font-medium">{spell.name}{spell.specialCodes.length > 0 ? ` ${spell.specialCodes.join("")}` : ""}</td>
                                            <td className="px-3 py-2 text-xs text-slate-600">{spell.areaOfEffect}</td>
                                            <td className="px-3 py-2 text-xs text-slate-600">{spell.duration}</td>
                                            <td className="px-3 py-2 text-xs text-slate-600">{spell.range}</td>
                                            <td className="px-3 py-2 text-center font-mono text-xs">{spell.typeCode ?? ""}{spell.subtypeCodes.length > 0 ? `(${spell.subtypeCodes.join("")})` : ""}</td>
                                            <td className="px-3 py-2 text-xs text-slate-600">{spell.description}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                {/* Mobile cards */}
                                <div className="space-y-2 p-3 md:hidden">
                                  {entry.spells.map((spell) => {
                                    const castable = spell.level <= ranks;
                                    return (
                                      <div
                                        key={spell.id}
                                        className={`rounded-xl border p-3 ${castable ? "cursor-pointer bg-white active:bg-emerald-50" : "bg-slate-50 opacity-50"}`}
                                        onClick={castable ? () => openSpellCastingAssistant(entry.id, spell.id) : undefined}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <span className="font-medium">{spell.name}{spell.specialCodes.length > 0 ? ` ${spell.specialCodes.join("")}` : ""}</span>
                                            <span className="ml-2 font-mono text-xs text-slate-400">Lv.{spell.level}</span>
                                          </div>
                                          <span className="shrink-0 font-mono text-xs text-slate-500">{spell.typeCode ?? ""}{spell.subtypeCodes.length > 0 ? `(${spell.subtypeCodes.join("")})` : ""}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                                          <span>AoE: {spell.areaOfEffect}</span>
                                          <span>Dur: {spell.duration}</span>
                                          <span>Rng: {spell.range}</span>
                                        </div>
                                        <p className="mt-1 text-xs text-slate-600">{spell.description}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="gear" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Equipment and Gear" action={<Button variant="outline" className="rounded-2xl h-8 px-3 text-sm" onClick={addGearItem}><Plus className="mr-1 h-3 w-3" />Add Item</Button>}>
                <div className="space-y-3">
                  {sheet.equipment.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border bg-white p-3 ${draggedGearIndex === idx ? "opacity-50" : ""}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedGearIndex === null || draggedGearIndex === idx) return;
                        updateSheet((prev) => {
                          const next = [...prev.equipment];
                          const [removed] = next.splice(draggedGearIndex, 1);
                          next.splice(idx, 0, removed);
                          return { ...prev, equipment: next };
                        });
                        setDraggedGearIndex(null);
                      }}
                      onDragEnd={() => setDraggedGearIndex(null)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setExpandedGearItemId((prev) => prev === item.id ? null : item.id)}
                        >
                          <div className="font-medium">{item.name.trim() || "Unnamed item"}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>Location {item.location.trim() || "—"}</span>
                            <span>Weight {item.weight}</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            draggable
                            className="h-8 rounded-xl px-2 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Drag to reorder"
                            onDragStart={() => setDraggedGearIndex(idx)}
                            onDragEnd={() => setDraggedGearIndex(null)}
                          >
                            ::
                          </button>
                          <Button type="button" variant="outline" className="h-8 rounded-xl px-2 text-xs" onClick={() => setEditingGearItemId(item.id)}>Edit</Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (editingGearItemId === item.id) setEditingGearItemId(null);
                              if (expandedGearItemId === item.id) setExpandedGearItemId(null);
                              updateSheet((prev) => ({ ...prev, equipment: prev.equipment.filter((x) => x.id !== item.id) }));
                            }}
                          ><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      {expandedGearItemId === item.id && (
                        <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">Description</div>
                            <div className="mt-1 text-slate-700">{item.description.trim() || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">Location</div>
                            <div className="mt-1 text-slate-700">{item.location.trim() || "—"}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {sheet.equipment.length === 0 && <div className="text-sm text-slate-500">No equipment yet.</div>}
                  {sheet.details.trainingPackageApplications.some((app) => app.specialGains.length > 0) && (
                    <div className="rounded-2xl border bg-white p-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">Gained Specials</div>
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        {sheet.details.trainingPackageApplications.flatMap((app, appIdx) =>
                          app.specialGains.map((special, specialIdx) => (
                            <li key={`special_${appIdx}_${specialIdx}`}>{app.packageName}: {special}</li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Coins and Wealth">
                <div className="grid gap-3 md:grid-cols-2">
                  {(["mithril", "platinum", "gold", "silver", "bronze", "copper", "tin", "iron"] as const).map((coin) => (
                    <div key={coin}>
                      <label className="mb-1 block text-sm capitalize">{coin}</label>
                      <NumberInput value={sheet.wealth[coin]} onChange={(v) => updateSheet((prev) => ({ ...prev, wealth: { ...prev.wealth, [coin]: clampNumber(v) } }))} />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Gems</label>
                    <Textarea value={sheet.wealth.gems} onChange={(e) => updateSheet((prev) => ({ ...prev, wealth: { ...prev.wealth, gems: e.target.value } }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm">Jewelry</label>
                    <Textarea value={sheet.wealth.jewelry} onChange={(e) => updateSheet((prev) => ({ ...prev, wealth: { ...prev.wealth, jewelry: e.target.value } }))} />
                  </div>
                  <div className="md:col-span-2 rounded-2xl border p-3 text-sm">
                    Total base value (in iron units): <span className="font-semibold">{currencyValue(sheet.wealth)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <div className="grid gap-4">
              <SectionCard title="Backup and Transfer">
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Use JSON export/import to move characters between devices or keep manual backups outside this browser.</p>
                  <Button variant="outline" className="h-10 w-full rounded-2xl" onClick={saveFile}><Download className="mr-2 h-4 w-4" />Export JSON</Button>
                  <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-2xl border px-4 py-2 text-sm shadow-sm">
                    <Upload className="mr-2 h-4 w-4" />Import JSON
                    <input type="file" accept="application/json" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
                  </label>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-1">
            <div className="grid gap-3 xl:grid-cols-3">
              <SectionCard title="Health">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Concussion Hits</label>
                    <Input value={totalHits} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Current Hits Taken</label>
                    <NumberInput value={sheet.health.currentHits} onChange={(v) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, currentHits: clampNumber(v) } }))} />
                  </div>
                  {(["stunned", "stunNoParry", "downAndOut", "bleedPerRound"] as const).map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-sm">{key === "stunNoParry" ? "Stun no parry" : key === "downAndOut" ? "Down & Out" : key === "bleedPerRound" ? "Bleed/round" : "Stunned"}</label>
                      <Input value={sheet.health[key]} onChange={(e) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, [key]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Magic">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Power Points</label>
                    <Input value={totalPP} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Current PP Used</label>
                    <NumberInput value={sheet.magic.currentPP} onChange={(v) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, currentPP: clampNumber(v) } }))} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Exhaustion">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm">Exhaustion Points</label>
                    <Input value={totalEP} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Special Bonus</label>
                    <NumberInput value={sheet.exhaustion.specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, specialBonus: v } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm">Current EP Used</label>
                    <NumberInput value={sheet.exhaustion.currentEP} onChange={(v) => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, currentEP: clampNumber(v) } }))} />
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              <div className="rounded-2xl border bg-white p-3 text-sm">
                Concussion penalty: {healthPenalty(healthPercent) === -999 ? "Unconscious" : healthPenalty(healthPercent)}
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <div>Thresholds (hits taken):</div>
                  <div>&ge; {healthThreshold25}: -10</div>
                  <div>&ge; {healthThreshold50}: -20</div>
                  <div>&ge; {healthThreshold75}: -30</div>
                  <div>&ge; {healthThreshold100}: Unconscious</div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-3 text-sm">
                Magic penalty: {magicPenalty(magicPercent)}
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <div>Thresholds (PP used):</div>
                  <div>&ge; {magicThreshold25}: -10</div>
                  <div>&ge; {magicThreshold50}: -20</div>
                  <div>&ge; {magicThreshold75}: -30</div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-3 text-sm">
                Exhaustion penalty: {exhaustionPenalty(exhaustionPercent)}
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <div>Thresholds (EP used):</div>
                  <div>&ge; {exhaustionThreshold25}: -5</div>
                  <div>&ge; {exhaustionThreshold50}: -15</div>
                  <div>&ge; {exhaustionThreshold75}: -30</div>
                  <div>&ge; {exhaustionThreshold90}: -60</div>
                  <div>&ge; {exhaustionThreshold100}: -100</div>
                </div>
              </div>
            </div>

            <SectionCard title="Injuries" action={<Button variant="outline" className="rounded-2xl" onClick={() => updateSheet((prev) => ({ ...prev, injuries: [...prev.injuries, { id: uid("inj"), text: "" }] }))}><Plus className="mr-2 h-4 w-4" />Add Injury</Button>}>
              <div className="space-y-2">
                {sheet.injuries.map((injury) => (
                  <div key={injury.id} className="grid gap-2 rounded-2xl border p-3 md:grid-cols-[1fr_48px]">
                    <Input value={injury.text} onChange={(e) => updateSheet((prev) => ({ ...prev, injuries: prev.injuries.map((i) => i.id === injury.id ? { ...i, text: e.target.value } : i) }))} placeholder="Write injury details" />
                    <Button variant="ghost" size="icon" onClick={() => updateSheet((prev) => ({ ...prev, injuries: prev.injuries.filter((i) => i.id !== injury.id) }))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {sheet.injuries.length === 0 && <div className="text-sm text-slate-500">No injuries recorded.</div>}
              </div>
            </SectionCard>
          </TabsContent>
          </div>
        </Tabs>
      </div>

      {editingSkill && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 px-3 pb-28 pt-8 sm:px-6 sm:pb-32 sm:pt-10 md:p-6"
          onMouseDown={(event) => {
            skillModalBackdropMouseDownRef.current = event.target === event.currentTarget;
          }}
          onMouseUp={(event) => {
            const shouldClose = skillModalBackdropMouseDownRef.current && event.target === event.currentTarget;
            skillModalBackdropMouseDownRef.current = false;
            if (shouldClose) closeEditingSkillModal();
          }}
          onMouseLeave={() => {
            skillModalBackdropMouseDownRef.current = false;
          }}
        >
          <div className="mx-auto w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <SectionCard
              title="Edit Skill"
              action={(
                <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={closeEditingSkillModal}>
                  Close
                </Button>
              )}
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Skill Name</label>
                  <Input value={editingSkill.name} placeholder="Skill name" onChange={(e) => updateSkill(editingSkill.id, { name: e.target.value })} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Category</label>
                    <Select value={editingSkill.categoryId} onValueChange={(v) => updateSkill(editingSkill.id, { categoryId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...sheet.skillCategories].sort((a, b) => a.name.localeCompare(b.name)).map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Ranks</label>
                    <NumberInput value={editingSkill.ranks} onChange={(v) => updateSkill(editingSkill.id, { ranks: clampNumber(v) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Item Bonus</label>
                    <NumberInput value={editingSkill.itemBonus} onChange={(v) => updateSkill(editingSkill.id, { itemBonus: v })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special Bonus</label>
                    <NumberInput value={editingSkill.specialBonus} onChange={(v) => updateSkill(editingSkill.id, { specialBonus: v })} />
                  </div>
                </div>
                {isWeaponCategory(editingSkill.category?.name ?? "") && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Fumble</label>
                      <Input value={editingSkill.fumble} onChange={(e) => updateSkill(editingSkill.id, { fumble: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Range Mods</label>
                      <Input value={editingSkill.rangeModifications} onChange={(e) => updateSkill(editingSkill.id, { rangeModifications: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">New Ranks</label>
                    {sheet.details.restrictedSkills.some((r) => r.toLowerCase() === editingSkill.name.toLowerCase()) ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Restricted</span>
                    ) : (
                      <RankCheckboxes value={editingSkill.newRanks} onChange={(v) => updateSkill(editingSkill.id, { newRanks: v })} />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                    <div><div className="text-xs text-slate-500">Rank</div><div className="font-semibold">{editingSkill.rank}</div></div>
                    <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">{editingSkill.total >= 0 ? "+" : ""}{editingSkill.total}</div></div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {editingGearItem && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 px-3 pb-28 pt-8 sm:px-6 sm:pb-32 sm:pt-10 md:p-6"
          onMouseDown={(event) => {
            gearModalBackdropMouseDownRef.current = event.target === event.currentTarget;
          }}
          onMouseUp={(event) => {
            const shouldClose = gearModalBackdropMouseDownRef.current && event.target === event.currentTarget;
            gearModalBackdropMouseDownRef.current = false;
            if (shouldClose) setEditingGearItemId(null);
          }}
          onMouseLeave={() => {
            gearModalBackdropMouseDownRef.current = false;
          }}
        >
          <div className="mx-auto w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <SectionCard
              title="Edit Equipment Item"
              action={(
                <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => setEditingGearItemId(null)}>
                  Close
                </Button>
              )}
            >
              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Item Name</label>
                  <Input placeholder="Item name" value={editingGearItem.name} onChange={(e) => updateGearItem(editingGearItem.id, { name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Description</label>
                  <Textarea placeholder="Description" value={editingGearItem.description} onChange={(e) => updateGearItem(editingGearItem.id, { description: e.target.value })} />
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Location</label>
                    <Input placeholder="Location" value={editingGearItem.location} onChange={(e) => updateGearItem(editingGearItem.id, { location: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Weight</label>
                    <NumberInput value={editingGearItem.weight} onChange={(v) => updateGearItem(editingGearItem.id, { weight: v })} />
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {poolEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          data-no-tab-swipe="true"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setPoolEditModal(null); }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {poolEditModal === "hits" && (
              <>
                <div className="mb-4 text-base font-semibold text-slate-900">Concussion Hits</div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Total Hits (read-only)</label>
                    <Input value={totalHits} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Hits Taken</label>
                    <NumberInput value={sheet.health.currentHits} onChange={(v) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, currentHits: clampNumber(v) } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Stunned</label>
                    <Input value={sheet.health.stunned} onChange={(e) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, stunned: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Stun No Parry</label>
                    <Input value={sheet.health.stunNoParry} onChange={(e) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, stunNoParry: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Down & Out</label>
                    <Input value={sheet.health.downAndOut} onChange={(e) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, downAndOut: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Bleed / Round</label>
                    <Input value={sheet.health.bleedPerRound} onChange={(e) => updateSheet((prev) => ({ ...prev, health: { ...prev.health, bleedPerRound: e.target.value } }))} />
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    Penalty: {healthPenalty(healthPercent) === -999 ? "Unconscious" : healthPenalty(healthPercent)}
                  </div>
                </div>
              </>
            )}
            {poolEditModal === "pp" && (
              <>
                <div className="mb-4 text-base font-semibold text-slate-900">Power Points</div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Total PP (read-only)</label>
                    <Input value={totalPP} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">PP Used</label>
                    <NumberInput value={sheet.magic.currentPP} onChange={(v) => updateSheet((prev) => ({ ...prev, magic: { ...prev.magic, currentPP: clampNumber(v) } }))} />
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    Penalty: {magicPenalty(magicPercent)}
                  </div>
                </div>
              </>
            )}
            {poolEditModal === "ep" && (
              <>
                <div className="mb-4 text-base font-semibold text-slate-900">Exhaustion Points</div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Total EP (read-only)</label>
                    <Input value={totalEP} readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Special Bonus</label>
                    <NumberInput value={sheet.exhaustion.specialBonus} onChange={(v) => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, specialBonus: v } }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">EP Used</label>
                    <NumberInput value={sheet.exhaustion.currentEP} onChange={(v) => updateSheet((prev) => ({ ...prev, exhaustion: { ...prev.exhaustion, currentEP: clampNumber(v) } }))} />
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    Penalty: {exhaustionPenalty(exhaustionPercent)}
                  </div>
                </div>
              </>
            )}
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setPoolEditModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {isHealingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          data-no-tab-swipe="true"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setIsHealingModalOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-base font-semibold text-slate-900">Passive Healing</div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Hours Passed</label>
                <NumberInput value={healingHours} min={0} onChange={(v) => setHealingHours(Math.max(0, v))} />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Activity</label>
                <div className="flex gap-2">
                  {(["active", "resting", "sleeping"] as const).map((level) => (
                    <Button
                      key={level}
                      type="button"
                      variant={healingActivity === level ? "default" : "outline"}
                      className="flex-1 rounded-2xl capitalize"
                      onClick={() => setHealingActivity(level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 space-y-1">
                <div className="flex justify-between"><span>Hits healed</span><span className="font-semibold text-slate-900">{healingTotalHits}</span></div>
                <div className="flex justify-between"><span>PP healed</span><span className="font-semibold text-slate-900">{healingTotalPP}</span></div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsHealingModalOpen(false)}>Cancel</Button>
              <Button type="button" className="rounded-2xl" onClick={applyPassiveHealing}>Apply Healing</Button>
            </div>
          </div>
        </div>
      )}

      {isCastAssistantOpen && selectedCastList && selectedCastSpell && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 px-3 pb-28 pt-8 sm:px-6 sm:pb-32 sm:pt-10 md:p-6"
          data-no-tab-swipe="true"
          onMouseDown={(event) => {
            castModalBackdropMouseDownRef.current = event.target === event.currentTarget;
          }}
          onMouseUp={(event) => {
            const shouldClose = castModalBackdropMouseDownRef.current && event.target === event.currentTarget;
            castModalBackdropMouseDownRef.current = false;
            if (shouldClose) setIsCastAssistantOpen(false);
          }}
          onMouseLeave={() => {
            castModalBackdropMouseDownRef.current = false;
          }}
        >
          <div className="mx-auto w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <SectionCard
              title="Spell Casting Assistant"
              action={(
                <div className="flex items-center gap-2">
                  <Badge>{signed(castTotalModifier)}</Badge>
                  <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => setIsCastAssistantOpen(false)}>
                    Close
                  </Button>
                </div>
              )}
            >
              <div className="space-y-3">
                <div className="rounded-2xl border bg-white p-3 text-sm">
                  <div className="font-semibold text-slate-800">{selectedCastSpell.name}{selectedCastSpell.specialCodes.length > 0 ? ` ${selectedCastSpell.specialCodes.join("")}` : ""}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedCastList.entry.name} • {selectedCastList.entry.realm} {selectedCastList.entry.type} • Level {selectedCastSpell.level}
                  </div>
                </div>

                <div className="grid gap-2 rounded-2xl border bg-slate-50 p-3 text-sm md:grid-cols-4">
                  <div>Realm: <span className="font-semibold">{castRealm}</span></div>
                  <div>Level Delta: <span className="font-semibold">{castLevelDelta}</span></div>
                  <div>Instant: <span className="font-semibold">{castIsInstantaneous ? "Yes" : "No"}</span></div>
                  <div>PP Cost: <span className="font-semibold">{castUseFreeSpell ? 0 : castPpCost}</span></div>
                </div>

                {spellAdderValue > 0 && castPpCost > 0 && (
                  <label className="flex items-center gap-2 rounded-2xl border bg-white p-3 text-sm">
                    <Checkbox checked={castUseFreeSpell} onChange={(e) => setCastUseFreeSpell(e.target.checked)} />
                    Use a free spell from Spell Adder ({spellAdderValue}/day) instead of spending PP
                  </label>
                )}

                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Prep Rounds</label>
                    <NumberInput value={castPrepRounds} min={0} onChange={(v) => setCastPrepRounds(clampNumber(v))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Free Hands</label>
                    <Select value={castFreeHands} onValueChange={(v) => setCastFreeHands(v as FreeHandsMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="one">One</SelectItem>
                        <SelectItem value="two">Two</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Voice</label>
                    <Select value={castVoice} onValueChange={(v) => setCastVoice(v as VoiceMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="whisper">Whisper</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="shout">Shout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Helmet</label>
                    <Select value={castHelmet} onValueChange={(v) => setCastHelmet(v as HelmetMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="leather">Leather</SelectItem>
                        <SelectItem value="leatherMetal">Leather and Metal</SelectItem>
                        <SelectItem value="metal">Metal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Organic Living Weight</label>
                    <NumberInput value={castOrganicLivingWeight} min={0} onChange={(v) => setCastOrganicLivingWeight(clampNumber(v))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Organic Non-Living Weight</label>
                    <NumberInput value={castOrganicNonLivingWeight} min={0} onChange={(v) => setCastOrganicNonLivingWeight(clampNumber(v))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Inorganic Weight</label>
                    <NumberInput value={castInorganicWeight} min={0} onChange={(v) => setCastInorganicWeight(clampNumber(v))} />
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Open Ended 1d100</label>
                    <NumberInput value={castOpenEndedRoll} onChange={setCastOpenEndedRoll} />
                    {castRollBreakdown && <div className="mt-1 text-xs text-slate-500">{castRollBreakdown}</div>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Manual Modifier</label>
                    <NumberInput value={castManualModifier} onChange={setCastManualModifier} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="h-10 rounded-2xl" onClick={rollCastingOpenEnded}>Roll d100 OE</Button>
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <Checkbox checked={castSnapAction} onChange={(e) => setCastSnapAction(e.target.checked)} disabled={castIsInstantaneous} />
                  Cast as Snap Action (non-instantaneous only)
                </label>

                <div className="rounded-2xl border">
                  <div className="grid grid-cols-[1fr_auto] border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Modifier</span>
                    <span>Total</span>
                  </div>
                  {castModifierRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto] px-3 py-2 text-sm border-b last:border-b-0">
                      <span>{row.label}</span>
                      <span className="font-semibold">{signed(row.value)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_auto] px-3 py-2 text-sm font-bold">
                    <span>Casting Modifier</span>
                    <span>{signed(castTotalModifier)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-600">PP used: {sheet.magic.currentPP} / {totalPP}</div>
                  <Button type="button" className="rounded-2xl" disabled={!selectedCastSpell} onClick={castSelectedSpell}>
                    {castUseFreeSpell ? "Cast Spell (Free)" : `Cast Spell and Spend ${castPpCost} PP`}
                  </Button>
                </div>
                {lastCastSummary && <div className="text-sm text-slate-600">{lastCastSummary}</div>}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-2 backdrop-blur md:hidden" data-no-tab-swipe="true">
        <div ref={mobileCharacterTabsRef} className="overflow-x-auto">
          <div className="flex min-w-max items-end gap-1">
            {characters.map((c, idx) => {
              const name = c.sheet.details.characterName || `Character ${idx + 1}`;
              const isActive = c.id === activeCharacter.id;
              return (
                <div key={c.id} data-char-id={c.id} className={`flex max-w-[200px] items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2 text-sm shadow-sm transition-colors ${
                  isActive ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700"
                }`}>
                  <button className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => switchCharacter(c.id)}>{name}</button>
                  {characters.length > 1 && (
                    <button className="opacity-70" onClick={() => confirmRemoveCharacter(c.id, name)} title="Remove character">×</button>
                  )}
                </div>
              );
            })}
            <button type="button" className="flex h-10 items-center rounded-t-xl border border-b-0 bg-white px-4 text-sm text-slate-700 shadow-sm" onClick={addCharacter}><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
