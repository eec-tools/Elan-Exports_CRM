import { Gender } from "@prisma/client";

/**
 * Calculate Professional Tax (Maharashtra slab rules)
 */
export function calculatePT(
  monthlySalary: number,
  gender: Gender | null | undefined,
  month: number,
): number {
  const isFemale = gender === "female";

  // February: higher rate for applicable employees
  if (month === 2) {
    if (isFemale && monthlySalary <= 25000) return 0;
    if (!isFemale && monthlySalary <= 7500) return 0;
    return 300;
  }

  if (isFemale) {
    if (monthlySalary <= 25000) return 0;
    return 200;
  }

  // Male (or unspecified gender — treat as male)
  if (monthlySalary <= 7500) return 0;
  if (monthlySalary <= 10000) return 175;
  return 200;
}
