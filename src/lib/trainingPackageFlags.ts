import { TRAINING_PACKAGES } from "@/data/trainingPackages";

function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

export function packageSkillListsFromNames(packageNames: string[]) {
  const everyman: string[] = [];
  const occupational: string[] = [];
  const restricted: string[] = [];

  packageNames.forEach((name) => {
    const pkg = TRAINING_PACKAGES.find((p) => p.name === name);
    if (!pkg) return;
    everyman.push(...pkg.everymanSkills);
    occupational.push(...pkg.occupationalSkills);
    restricted.push(...pkg.restrictedSkills);
  });

  return {
    everymanSkills: dedupeCaseInsensitive(everyman),
    occupationalSkills: dedupeCaseInsensitive(occupational),
    restrictedSkills: dedupeCaseInsensitive(restricted),
  };
}
