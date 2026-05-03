export function isBankingSector(sector: string | null): boolean {
  if (!sector) return false;
  const normalized = sector.toLowerCase();
  return ['banks', 'banking', 'financial services'].some(
    keyword => normalized.includes(keyword)
  );
}

export function isFinancialSector(sector: string | null): boolean {
  if (!sector) return false;
  const normalized = sector.toLowerCase();
  return ['financial', 'banks', 'banking', 'insurance', 'capital markets', 'credit services'].some(
    keyword => normalized.includes(keyword)
  );
}
