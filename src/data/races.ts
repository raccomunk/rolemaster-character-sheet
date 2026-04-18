const MEN_PP_CE = [0, 6, 5, 4, 3] as [number, number, number, number, number];
const MEN_PP_M = [0, 7, 6, 5, 4] as [number, number, number, number, number];
const ELF_PP_E = [0, 7, 6, 5, 4] as [number, number, number, number, number];

function mkRace(entry: {
  name: string;
  statBonuses?: Record<string, number>;
  rrBonuses?: { Channeling?: number; Essence?: number; Mentalism?: number; Poison?: number; Disease?: number; Fear?: number };
  body: [number, number, number, number, number];
  ppC: [number, number, number, number, number];
  ppE: [number, number, number, number, number];
  ppM: [number, number, number, number, number];
  soul?: number;
  recovery?: number;
  specialNotes?: string[];
}) {
  return {
    name: entry.name,
    statBonuses: entry.statBonuses ?? {},
    rrBonuses: {
      Channeling: entry.rrBonuses?.Channeling ?? 0,
      Essence: entry.rrBonuses?.Essence ?? 0,
      Mentalism: entry.rrBonuses?.Mentalism ?? 0,
      Poison: entry.rrBonuses?.Poison ?? 0,
      Disease: entry.rrBonuses?.Disease ?? 0,
      Fear: entry.rrBonuses?.Fear ?? 0,
    },
    soulDepartureRounds: entry.soul ?? 0,
    recoveryMultiplier: entry.recovery ?? 1,
    bodyDevelopmentProgression: entry.body,
    ppDevelopmentProgressionByRealm: {
      Channeling: entry.ppC,
      Essence: entry.ppE,
      Mentalism: entry.ppM,
    },
    specialNotes: entry.specialNotes,
  };
}

export const RACES_DATA = [
  mkRace({ name: "Common Men", statBonuses: { "Self Discipline": 2, Strength: 2 }, body: [0, 6, 4, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, soul: 6 }),
  mkRace({ name: "High Men", statBonuses: { Agility: -2, Constitution: 4, Presence: 4, Quickness: -2, Strength: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5 }, body: [0, 7, 5, 3, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Wood Elves", statBonuses: { Agility: 4, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 2, Quickness: 2 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 6, 3, 1, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE, specialNotes: ["+10 Trickery", "+10 Stalking", "+10 Hiding"] }),
  mkRace({ name: "Dwarves", statBonuses: { Agility: -2, Constitution: 6, "Self Discipline": 2, Empathy: -4, Presence: -4, Quickness: -2, Strength: 2 }, rrBonuses: { Essence: 40, Mentalism: 40, Poison: 20, Disease: 15 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: [0, 3, 2, 1, 1], ppM: [0, 3, 2, 1, 1], soul: 10, recovery: 1.25 }),
  mkRace({ name: "Halflings", statBonuses: { Agility: 6, Constitution: 6, "Self Discipline": -4, Empathy: -2, Presence: -6, Quickness: 4, Strength: -8 }, rrBonuses: { Essence: 50, Mentalism: 40, Poison: 30, Disease: 15 }, body: [0, 6, 2, 2, 1], ppC: MEN_PP_CE, ppE: [0, 2, 1, 1, 1], ppM: [0, 2, 1, 1, 1] }),
  mkRace({ name: "Common Orcs", statBonuses: { Constitution: 2, Memory: -4, Reasoning: -2, "Self Discipline": -4, Empathy: -2, Intuition: -4, Presence: -2, Strength: 2 }, rrBonuses: { Disease: 5 }, body: [0, 6, 3, 2, 1], ppC: MEN_PP_CE, ppE: [0, 4, 3, 2, 1], ppM: [0, 4, 3, 2, 1] }),
  mkRace({ name: "Greater Orcs", statBonuses: { Constitution: 4, Memory: -2, Reasoning: -2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Presence: -2, Strength: 4 }, rrBonuses: { Poison: 5, Disease: 10 }, body: [0, 7, 3, 2, 1], ppC: MEN_PP_CE, ppE: [0, 5, 3, 2, 2], ppM: [0, 5, 3, 2, 2] }),
  mkRace({ name: "Grey Elves", statBonuses: { Agility: 2, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 4, Quickness: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 6, 3, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Half-Elves", statBonuses: { Agility: 2, Constitution: 2, "Self Discipline": -3, Presence: 4, Quickness: 4, Strength: 2 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Disease: 50 }, body: [0, 7, 5, 3, 1], ppC: MEN_PP_CE, ppE: [0, 6, 6, 4, 3], ppM: [0, 7, 5, 4, 3] }),
  mkRace({ name: "Half-Orcs", statBonuses: { Constitution: 2, "Self Discipline": 2, Strength: 2 }, rrBonuses: { Poison: 5, Disease: 5 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: [0, 6, 4, 3, 2], ppM: [0, 6, 4, 3, 2] }),
  mkRace({ name: "High Elves", statBonuses: { Agility: 2, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 6, Quickness: 6 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 7, 3, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE, specialNotes: ["+20 Attunement"] }),
  mkRace({ name: "Hillmen", statBonuses: { Constitution: 2, "Self Discipline": 2, Empathy: 2, Presence: 2, Strength: 2 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, specialNotes: ["+20 Scaling", "+20 Acrobatics", "+20 Public Speaking", "+20 Acting"] }),
  mkRace({ name: "Mariners", statBonuses: { Constitution: 2, "Self Discipline": 2, Empathy: 2, Presence: 2, Strength: 2 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, specialNotes: ["+20 Boat Piloting", "+20 Navigation", "+20 Rope Mastery", "+20 Rowing", "+20 Sailing", "+20 Star Gazing", "+20 Weather Watching"] }),
  mkRace({ name: "Nomads", statBonuses: { Constitution: 2, "Self Discipline": 2, Empathy: 2, Presence: 2, Strength: 2 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, specialNotes: ["+20 Mounted Combat", "+20 Outdoor • Animal"] }),
  mkRace({ name: "Urbanmen", statBonuses: { Constitution: 2, "Self Discipline": 2, Empathy: 2, Presence: 2, Strength: 2 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Woodmen", statBonuses: { Constitution: 2, "Self Discipline": 2, Empathy: 2, Presence: 2, Strength: 2 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, specialNotes: ["+20 Climbing", "+20 Acrobatics", "+10 Foraging"] }),
  mkRace({ name: "Horse Centaur", statBonuses: { Agility: -2, Constitution: 2, Intuition: 4, Presence: 4, Quickness: -2, Strength: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 15 }, body: [0, 8, 6, 4, 2], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Lion Centaur", statBonuses: { Constitution: 4, Reasoning: -2, Empathy: -2, Presence: 4, Strength: 6 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 15, Disease: 20 }, body: [0, 9, 6, 5, 3], ppC: [0, 5, 4, 3, 2], ppE: [0, 5, 4, 3, 2], ppM: [0, 6, 5, 4, 3] }),
  mkRace({ name: "Lizard Centaur", statBonuses: { Agility: -2, Constitution: 4, "Self Discipline": 2, Intuition: 2, Presence: 2, Quickness: -2, Strength: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 15 }, body: [0, 9, 6, 5, 3], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Droloi", statBonuses: { Agility: -2, Constitution: 2, Presence: -4, Quickness: -2, Strength: 2 }, rrBonuses: { Poison: -10, Disease: -15 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Dyari", statBonuses: { Agility: 4, Constitution: -2, Memory: 2, Reasoning: 2, "Self Discipline": -5, Empathy: 4, Intuition: -2, Presence: 4, Quickness: 4 }, rrBonuses: { Channeling: -20, Essence: -5, Mentalism: -5, Poison: 10, Disease: 150 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Erlini", statBonuses: { Agility: 4, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 2, Quickness: 2 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 6, 4, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Linaeri", statBonuses: { Agility: 2, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 6, Quickness: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 150 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Loari", statBonuses: { Agility: 2, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 4, Quickness: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Shuluri", statBonuses: { Agility: 4, Constitution: 2, Memory: 2, "Self Discipline": -5, Empathy: 2, Presence: 2, Quickness: 2, Strength: 2 }, rrBonuses: { Channeling: 5, Essence: -10, Mentalism: 10, Poison: 30, Disease: 100 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Dwelf", statBonuses: { Agility: 2, Quickness: 2 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Satyr", statBonuses: { Agility: 2, Constitution: -2, "Self Discipline": -10, Empathy: 2, Presence: 4, Quickness: 4, Strength: -4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 5, 3, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Tylweth Teg", statBonuses: { Agility: 4, Constitution: -2, "Self Discipline": -5, Empathy: 4, Presence: 4, Quickness: 4, Strength: -4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 5, 3, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Lennai", statBonuses: { Agility: 4, Constitution: 2, Reasoning: 2, "Self Discipline": -2, Empathy: 2, Intuition: 2, Quickness: 4, Strength: 2 }, rrBonuses: { Channeling: 5, Essence: 10, Mentalism: 15, Poison: 15, Disease: 100 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_CE }),
  mkRace({ name: "Gark", statBonuses: { Agility: 4, Constitution: 6, Memory: -2, Reasoning: -6, "Self Discipline": -4, Empathy: 2, Presence: -2, Quickness: 2, Strength: 4 }, rrBonuses: { Channeling: 5, Essence: 20, Mentalism: 20, Poison: 20, Disease: 5 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: [0, 2, 1, 1, 1], ppM: [0, 2, 1, 1, 1] }),
  mkRace({ name: "Gnome", statBonuses: { Agility: 2, Memory: 2, Reasoning: 2, Empathy: -2, Intuition: 4, Presence: -2, Quickness: 2, Strength: -8 }, rrBonuses: { Channeling: 30, Essence: 30, Mentalism: 20 }, body: [0, 5, 4, 3, 2], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_CE }),
  mkRace({ name: "Goblin", statBonuses: { Constitution: 2, Memory: -2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Presence: -2, Quickness: -2, Strength: 2 }, rrBonuses: { Poison: 5 }, body: [0, 6, 3, 2, 2], ppC: MEN_PP_CE, ppE: [0, 3, 2, 1, 1], ppM: [0, 3, 2, 1, 1] }),
  mkRace({ name: "Hobgoblin", statBonuses: { Constitution: 4, Memory: -2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Quickness: -2, Strength: 6 }, rrBonuses: { Channeling: 10, Poison: 10, Disease: 5 }, body: [0, 7, 6, 5, 2], ppC: [0, 7, 6, 5, 4], ppE: [0, 5, 4, 3, 2], ppM: [0, 3, 2, 1, 1] }),
  mkRace({ name: "Kobold", statBonuses: { Agility: 2, Memory: -2, Reasoning: 2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Presence: -2, Quickness: 2, Strength: -4 }, rrBonuses: { Channeling: -5, Essence: -5, Disease: -5 }, body: [0, 5, 3, 2, 1], ppC: MEN_PP_CE, ppE: [0, 3, 2, 1, 1], ppM: [0, 3, 2, 1, 1] }),
  mkRace({ name: "Murlogi", statBonuses: { Constitution: 4, Memory: -2, Reasoning: -2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Presence: -2, Quickness: -2, Strength: -2 }, rrBonuses: { Poison: 5, Disease: 5 }, body: [0, 6, 3, 2, 1], ppC: MEN_PP_CE, ppE: [0, 3, 2, 1, 1], ppM: [0, 3, 2, 1, 1] }),
  mkRace({ name: "Black Gratar", statBonuses: { Agility: -2, Constitution: 6, Empathy: -2, Intuition: 2, Strength: 6 }, rrBonuses: { Poison: 10, Disease: 10 }, body: [0, 7, 4, 2, 1], ppC: [0, 5, 3, 2, 2], ppE: [0, 5, 3, 2, 2], ppM: [0, 5, 3, 2, 2] }),
  mkRace({ name: "Green Gratar", statBonuses: { Agility: -2, Constitution: 2, Memory: -2, Reasoning: -2, Empathy: -2, Intuition: -2, Presence: -6 }, rrBonuses: { Channeling: -10, Essence: -10, Mentalism: -10 }, body: [0, 5, 4, 2, 1], ppC: [0, 2, 1, 1, 1], ppE: [0, 2, 1, 1, 1], ppM: [0, 2, 1, 1, 1] }),
  mkRace({ name: "Grey Gratar", statBonuses: { Agility: 4, "Self Discipline": 2, Empathy: -4, Intuition: 4, Quickness: 4, Strength: 2 }, rrBonuses: { Channeling: -10, Essence: -10, Mentalism: -10 }, body: [0, 7, 4, 2, 1], ppC: [0, 5, 3, 2, 2], ppE: [0, 5, 3, 2, 2], ppM: [0, 6, 5, 4, 3] }),
  mkRace({ name: "Yellow Gratar", statBonuses: { Constitution: 2, Empathy: -2, Presence: -2, Strength: 2 }, rrBonuses: { Disease: 10 }, body: [0, 6, 5, 2, 1], ppC: [0, 2, 1, 1, 1], ppE: [0, 2, 1, 1, 1], ppM: [0, 2, 1, 1, 1] }),
  mkRace({ name: "Eritari", statBonuses: { Agility: 2, Constitution: 2, Reasoning: -2, "Self Discipline": -1, Presence: 4, Quickness: 4, Strength: 2 }, rrBonuses: { Mentalism: 10, Poison: 20, Disease: 60 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Ky'taari", statBonuses: { Agility: 2, Constitution: 2, "Self Discipline": -1, Presence: 4, Quickness: 4, Strength: 2 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: 10, Poison: 20, Disease: 80 }, body: [0, 7, 5, 3, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Punkari", statBonuses: { Agility: 4, Constitution: 2, "Self Discipline": -1, Presence: 2, Quickness: 2, Strength: 2 }, rrBonuses: { Mentalism: 5, Poison: 20, Disease: 60 }, body: [0, 7, 5, 3, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Sulini", statBonuses: { Agility: 2, Constitution: 2, Reasoning: -2, "Self Discipline": -3, Empathy: 2, Intuition: 2, Presence: 2, Quickness: 4 }, rrBonuses: { Mentalism: 10, Poison: 20, Disease: 60 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Vorloi", statBonuses: { Agility: 6, Constitution: 2, "Self Discipline": -3, Empathy: 4, Intuition: 2, Quickness: 6, Strength: -2 }, rrBonuses: { Poison: 20, Disease: 5 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Hira'razhir", statBonuses: { Agility: 4, Constitution: -2, Empathy: 2, Quickness: 4, Strength: -4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: -5, Disease: -10 }, body: [0, 6, 2, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, specialNotes: ["+12 Exhaustion points"] }),
  mkRace({ name: "Hirazi", statBonuses: { Agility: 6, Constitution: -4, Empathy: 2, Quickness: 2, Strength: -2 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: -10, Disease: -20 }, body: [0, 6, 2, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M, specialNotes: ["+12 Exhaustion points"] }),
  mkRace({ name: "Idivya", statBonuses: { Agility: 2, Memory: -2, Empathy: -2, Quickness: 2, Strength: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 20 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_CE }),
  mkRace({ name: "Jhordi", statBonuses: { Constitution: 2, "Self Discipline": 2, Empathy: -2, Presence: 6, Strength: 6 }, rrBonuses: { Mentalism: 20, Disease: 10 }, body: [0, 7, 4, 2, 1], ppC: [0, 2, 1, 1, 1], ppE: [0, 2, 1, 1, 1], ppM: MEN_PP_M }),
  mkRace({ name: "Laan", statBonuses: { Agility: 2, Constitution: 2, Memory: 2, "Self Discipline": 2, Empathy: 2, Presence: 4, Quickness: -2, Strength: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 50 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Umli", statBonuses: { Constitution: 6, Reasoning: 2, "Self Discipline": 4, Intuition: 2, Presence: 2, Quickness: -2, Strength: 2 }, rrBonuses: { Poison: 10, Disease: 20 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Mermen", statBonuses: { Constitution: 2, Memory: 2, Reasoning: 2, Empathy: -2, Presence: 2, Strength: 2 }, body: [0, 7, 3, 2, 1], ppC: MEN_PP_CE, ppE: MEN_PP_CE, ppM: MEN_PP_M }),
  mkRace({ name: "Lesser Lugroki", statBonuses: { Constitution: 2, Memory: -4, Reasoning: -2, "Self Discipline": -4, Empathy: -2, Intuition: -4, Presence: -2, Strength: 2 }, rrBonuses: { Disease: 5 }, body: [0, 6, 3, 2, 1], ppC: [0, 2, 1, 1, 1], ppE: [0, 2, 1, 1, 1], ppM: [0, 2, 1, 1, 1] }),
  mkRace({ name: "Greater Lugroki", statBonuses: { Constitution: 4, Memory: -2, Reasoning: -2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Presence: -2, Strength: 4 }, rrBonuses: { Poison: 5, Disease: 10 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: [0, 5, 3, 2, 2], ppM: MEN_PP_M }),
  mkRace({ name: "Quishadi", statBonuses: { Agility: 2, Reasoning: 2, "Self Discipline": -2, Empathy: 2, Intuition: 2, Presence: 2, Quickness: -2, Strength: 4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 6, 5, 2, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_CE }),
  mkRace({ name: "Shuikmar", statBonuses: { Agility: -2, Memory: 2, Reasoning: 4, Intuition: 4, Presence: -2, Strength: 4 }, rrBonuses: { Poison: 5, Disease: 5 }, body: [0, 7, 5, 3, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_M }),
  mkRace({ name: "Sohleugir", statBonuses: { Agility: -4, Constitution: 4, Empathy: 2, Intuition: 2, Strength: 8 }, rrBonuses: { Poison: 10, Disease: 50 }, body: [0, 8, 6, 4, 2], ppC: [0, 5, 3, 2, 2], ppE: [0, 5, 3, 2, 2], ppM: [0, 5, 3, 2, 2] }),
  mkRace({ name: "Saurkur", statBonuses: { Agility: -4, Constitution: 4, Empathy: 2, Intuition: 2, Strength: 8 }, rrBonuses: { Poison: 10, Disease: 50 }, body: [0, 8, 6, 4, 2], ppC: [0, 5, 3, 2, 2], ppE: [0, 5, 3, 2, 2], ppM: [0, 5, 3, 2, 2] }),
  mkRace({ name: "Troglodyte", statBonuses: { Constitution: 4, Memory: -2, Reasoning: -2, "Self Discipline": -2, Empathy: -2, Intuition: -2, Presence: -2, Strength: 4 }, rrBonuses: { Channeling: 20, Essence: 10, Mentalism: 20, Poison: 10, Disease: 10 }, body: [0, 7, 4, 2, 1], ppC: MEN_PP_CE, ppE: [0, 3, 2, 1, 1], ppM: [0, 3, 2, 1, 1], specialNotes: ["+10 Weapon • Thrown", "+20 Contortions"] }),
  mkRace({ name: "Urloc", statBonuses: { Memory: 6, Reasoning: 6, "Self Discipline": -2, Empathy: 2, Intuition: 2, Presence: 2, Quickness: -2, Strength: -4 }, rrBonuses: { Channeling: -5, Essence: -5, Mentalism: -5, Poison: 10, Disease: 100 }, body: [0, 5, 3, 2, 1], ppC: MEN_PP_M, ppE: MEN_PP_M, ppM: MEN_PP_M }),
  mkRace({ name: "Vulfen", statBonuses: { Constitution: 2, "Self Discipline": -2, Empathy: -4, Presence: -2, Quickness: 2, Strength: 4 }, rrBonuses: { Disease: 10 }, body: [0, 7, 5, 3, 1], ppC: MEN_PP_CE, ppE: ELF_PP_E, ppM: MEN_PP_M }),
] as const;
