const KEY = "elan_custom_deal_stages";

export function getCustomDealStages(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addCustomDealStage(name: string): string[] {
  const current = getCustomDealStages();
  const trimmed = name.trim();
  if (!trimmed || current.includes(trimmed)) return current;
  const updated = [...current, trimmed];
  localStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export function removeCustomDealStage(name: string): string[] {
  const updated = getCustomDealStages().filter((s) => s !== name);
  localStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}
