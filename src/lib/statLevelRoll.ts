export function resolveStatLevelRoll(temp: number, potential: number, die1: number, die2: number) {
  const sum = die1 + die2;
  const isDouble = die1 === die2;
  const gap = potential - temp;
  let nextTemp = temp;
  let nextPotential = potential;
  let explanation = "";

  if (isDouble && die1 <= 5) {
    nextTemp = temp - sum;
    explanation = `Double ${die1}: temp -${sum}`;
  } else if (isDouble && die1 >= 6) {
    if (temp >= potential) {
      nextPotential = potential + 1;
      explanation = `Double ${die1} at cap: potential +1`;
    } else {
      nextTemp = temp + sum;
      explanation = `Double ${die1}: temp +${sum}`;
    }
  } else if (gap > 20) {
    nextTemp = temp + sum;
    explanation = `Gap ${gap}: temp +${sum} (both dice)`;
  } else if (gap >= 11) {
    const added = Math.max(die1, die2);
    nextTemp = temp + added;
    explanation = `Gap ${gap}: temp +${added} (higher die)`;
  } else {
    const added = Math.min(die1, die2);
    nextTemp = temp + added;
    explanation = `Gap ${gap}: temp +${added} (lower die)`;
  }

  if (nextTemp > nextPotential) nextTemp = nextPotential;

  return {
    temp: Math.max(0, nextTemp),
    potential: Math.max(0, nextPotential),
    explanation,
  };
}
