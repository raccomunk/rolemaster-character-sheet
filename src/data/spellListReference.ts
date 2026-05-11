import type {
  SpellSpecialCode,
  SpellSubtypeCode,
  SpellTypeCode,
} from "@/lib/types";

export const SPELL_SPECIAL_CODE_INFO: Record<SpellSpecialCode, string> = {
  "*": "Instantaneous; spell does not require preparation rounds.",
  "•": "Spell does not require power points.",
  "‡": "Part of a set of spells that must be thrown continuously with related spells to be effective.",
};

export const SPELL_TYPE_CODE_INFO: Record<SpellTypeCode, string> = {
  E: "Elemental spell; manipulates physical elements and typically allows no RR because effects are real.",
  BE: "Ball Elemental spell; resolves on Ball Spell Attack Table A-10.9.10.",
  DE: "Directed Elemental spell; resolves on Bolt Spell Attack Table A-10.9.9.",
  F: "Force spell; resolves attack and RR using Basic Spell Attack Table A-10.9.11 when target can resist.",
  P: "Passive spell; RR (if any) is usually only to determine awareness.",
  U: "Utility spell; affects caster, willing targets, or targets incapable of resistance.",
  I: "Informational spell; gathers information through means that do not normally require RRs.",
};

export const SPELL_SUBTYPE_CODE_INFO: Record<SpellSubtypeCode, string> = {
  s: "Subconscious spell; can be triggered while unconscious/asleep/tranced under valid conditions.",
  m: "Mental attack spell; subject to mental defenses and ineffective vs creatures without minds.",
};

export const SPELL_AREA_OF_EFFECT_CODES = {
  targets: "x target(s)",
  targetsPerLevel: "x target(s)/lvl",
  radius: "distance R",
  radiusPerLevel: "distance R / lvl",
  area: "area",
  caster: "caster",
  none: "-",
  varies: "varies",
} as const;

export const SPELL_DURATION_CODES = {
  fixed: "time",
  concentration: "C",
  concentrationBounded: "duration (C)",
  permanent: "P",
  none: "-",
  varies: "varies",
  perLevel: "time / level",
  perFailMargin: "time / #fail",
} as const;

export const SPELL_RANGE_CODES = {
  self: "self",
  touch: "touch",
  distance: "distance",
  distancePerLevel: "distance / lvl",
  unlimited: "unlimited",
  varies: "varies",
} as const;

export const SPELL_LIST_TYPE_INFO = {
  Open: "Open spell list",
  Closed: "Closed spell list",
  Base: "Base list",
  "Training Package": "Training package spell list",
} as const;

export const SPELL_DEFINITION_INFO = {
  basicAttack: "A spell that attacks a target, but is not an elemental attack spell.",
  mass: "A spell whose target count or area is based on caster level.",
  elementalAttack: "A spell that uses real fire, cold, water, ice, or electricity to attack a target.",
  lord: "A spell keyed to a 20th-level effect.",
  trueSpell: "Highest-level version of a specific spell type; sets upper potency limit for derived effects.",
} as const;
