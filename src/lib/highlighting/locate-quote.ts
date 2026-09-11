export type QuoteLocation = { start: number; end: number } | null;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Locates a model-returned quote within the original extracted text.
 * Tries an exact match first, then falls back to a whitespace-normalized
 * match to absorb line-break/spacing artifacts from PDF/DOCX extraction.
 * Returns null (unlocatable) rather than guessing when the quote isn't
 * found — a wrong highlight is worse than no highlight.
 */
export function locateQuote(sourceText: string, quote: string): QuoteLocation {
  const trimmedQuote = quote.trim();
  if (!trimmedQuote) return null;

  const exactIndex = sourceText.indexOf(trimmedQuote);
  if (exactIndex !== -1) {
    return { start: exactIndex, end: exactIndex + trimmedQuote.length };
  }

  const normalizedQuote = normalizeWhitespace(trimmedQuote);
  const normalizedSource = normalizeWhitespace(sourceText);
  const normalizedIndex = normalizedSource.indexOf(normalizedQuote);
  if (normalizedIndex === -1) return null;

  return mapNormalizedRangeToOriginal(sourceText, normalizedIndex, normalizedIndex + normalizedQuote.length);
}

function mapNormalizedRangeToOriginal(
  sourceText: string,
  normalizedStart: number,
  normalizedEnd: number,
): QuoteLocation {
  let normalizedPos = 0;
  let originalStart = -1;
  let originalEnd = -1;
  let previousWasSpace = true;

  for (let i = 0; i < sourceText.length; i++) {
    const char = sourceText[i];
    const isSpace = /\s/.test(char);

    if (isSpace) {
      if (!previousWasSpace) {
        if (normalizedPos === normalizedStart) originalStart = i;
        normalizedPos += 1;
        if (normalizedPos === normalizedEnd) originalEnd = i;
      }
      previousWasSpace = true;
      continue;
    }

    if (previousWasSpace) {
      if (normalizedPos === normalizedStart) originalStart = i;
    }
    previousWasSpace = false;
    normalizedPos += 1;
    if (normalizedPos === normalizedEnd) {
      originalEnd = i + 1;
    }
  }

  if (originalStart === -1 || originalEnd === -1) return null;
  return { start: originalStart, end: originalEnd };
}
