import { getAllDbIngredients } from "../services/db";
import { EXCLUSIONS } from "../data/exclusions";

/**
 * Calculates the Levenshtein distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

/**
 * Splits raw OCR text into individual raw ingredient tokens.
 * Splits on commas, semicolons, newlines, and bullet points.
 */
function splitIntoRawTokens(text: string): string[] {
  const cleanText = text
    .replace(/[•▪●*▪\-▪\u2022\u2023\u25E6\u2043]/g, ",")
    .replace(/;/g, ",")
    .replace(/\r\n/g, "\n");

  return cleanText
    .split(/,|\n/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Recursively parses parenthesized sub-ingredients (e.g. "Protein Blend (Whey, Casein)").
 */
function parseParentheses(token: string): string[] {
  const openIndex = token.indexOf("(");
  if (openIndex === -1) {
    return [token];
  }
  const closeIndex = token.lastIndexOf(")");
  if (closeIndex === -1 || closeIndex <= openIndex) {
    return [token];
  }

  const main = token.substring(0, openIndex).trim();
  const sub = token.substring(openIndex + 1, closeIndex).trim();

  const subTokens = splitIntoRawTokens(sub);
  const results: string[] = [];

  if (main.length > 0) {
    results.push(main);
  }

  for (const t of subTokens) {
    results.push(...parseParentheses(t));
  }

  return results;
}

/**
 * Cleans OCR errors by replacing numbers with letters in mostly alphabetical tokens.
 */
function cleanOcrErrors(token: string): string {
  // Replace common OCR character substitutions
  return token
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s");
}

/**
 * Normalizes raw OCR text into a list of clean, database-matched ingredient names.
 */
export async function normalizeOcrText(rawText: string): Promise<string[]> {
  if (!rawText) return [];

  // 1. Split raw OCR into individual raw tokens
  const rawTokens = splitIntoRawTokens(rawText);

  // 2. Parentheses parsing to extract sub-ingredients
  const expandedTokens: string[] = [];
  for (const token of rawTokens) {
    expandedTokens.push(...parseParentheses(token));
  }

  // Fetch local ingredient dictionary from expo-sqlite (or fallback)
  const dbIngredients = await getAllDbIngredients();

  const finalIngredients: string[] = [];

  for (const token of expandedTokens) {
    // 3. Clean token
    let cleaned = token.toLowerCase().trim();

    // Clean OCR misread characters if it looks like word (e.g., contains some letters)
    if (/[a-z]/i.test(cleaned)) {
      cleaned = cleanOcrErrors(cleaned);
    }

    // Remove leading/trailing non-alphanumeric characters except basic spaces
    cleaned = cleaned.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "").trim();

    if (cleaned.length === 0) continue;

    // 4. Exclusion list check
    const isExcluded = EXCLUSIONS.some((phrase) => {
      const p = phrase.toLowerCase().trim();
      return cleaned === p || cleaned.includes(p);
    });

    if (isExcluded) {
      // Keep as-is, bypass Levenshtein matching to prevent false corrections
      finalIngredients.push(cleaned);
      continue;
    }

    // 5. Levenshtein matching against banned/known ingredient dictionary
    let bestMatch: string | null = null;
    let bestDist = Infinity;

    for (const ing of dbIngredients) {
      const targets = [ing.name, ...ing.aliases];
      for (const target of targets) {
        const targetLower = target.toLowerCase().trim();
        if (cleaned === targetLower) {
          bestMatch = ing.name;
          bestDist = 0;
          break;
        }

        const dist = getLevenshteinDistance(cleaned, targetLower);
        const maxAllowedDist = targetLower.length <= 4 ? 1 : 2;

        if (dist <= maxAllowedDist && dist < bestDist) {
          bestDist = dist;
          bestMatch = ing.name;
        }
      }
      if (bestDist === 0) break;
    }

    if (bestMatch) {
      finalIngredients.push(bestMatch);
    } else {
      finalIngredients.push(cleaned);
    }
  }

  // Return unique, non-empty ingredients
  return Array.from(new Set(finalIngredients));
}
