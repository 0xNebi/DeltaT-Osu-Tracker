const MATCH_ID_REGEX = /(?:matches\/(\d+)|mp\/(\d+)|^(\d+)$)/i;

export function parseMatchId(input: string): number | null {
  console.log('[matchParser] 🔍 Parsing input:', input);
  
  if (!input) {
    console.log('[matchParser] ❌ Empty input');
    return null;
  }

  const trimmed = input.trim();
  console.log('[matchParser] Trimmed input:', trimmed);
  
  const match = MATCH_ID_REGEX.exec(trimmed);
  console.log('[matchParser] Regex match result:', match);
  
  if (!match) {
    console.log('[matchParser] ❌ No match found with regex');
    return null;
  }

  const id = match[1] || match[2] || match[3];
  console.log('[matchParser] Extracted ID:', id);
  
  const parsed = Number(id);
  console.log('[matchParser] Parsed number:', parsed);
  
  const result = Number.isFinite(parsed) ? parsed : null;
  console.log('[matchParser] Final result:', result);
  
  return result;
}
