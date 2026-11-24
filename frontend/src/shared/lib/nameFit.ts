// Full names differ a lot in length: "Глеб" and "Константинопольская Александра Викторовна"
// share one card size, so long names get a smaller font instead of being cut off.
export type NameFit = 'short' | 'medium' | 'long';

export function nameFit(name: string): NameFit {
  const longestWord = name.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
  if (name.length > 30 || longestWord > 14) return 'long';
  if (name.length > 16 || longestWord > 10) return 'medium';
  return 'short';
}
