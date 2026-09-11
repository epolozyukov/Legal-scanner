import { describe, expect, it } from "vitest";
import { locateQuote } from "@/lib/highlighting/locate-quote";

describe("locateQuote", () => {
  it("finds an exact match", () => {
    const source = "The quick brown fox jumps over the lazy dog.";
    const result = locateQuote(source, "brown fox");
    expect(result).toEqual({ start: 10, end: 19 });
    expect(source.slice(result!.start, result!.end)).toBe("brown fox");
  });

  it("finds a match despite line-break/whitespace differences", () => {
    const source = "Payment terms:\nNet 30\nfrom   invoice date.";
    const result = locateQuote(source, "Net 30 from invoice date");
    expect(result).not.toBeNull();
    const matched = source.slice(result!.start, result!.end);
    expect(matched.replace(/\s+/g, " ")).toBe("Net 30 from invoice date");
  });

  it("returns null for a quote not present in the source", () => {
    const source = "This contract has no such clause.";
    expect(locateQuote(source, "unlimited liability")).toBeNull();
  });

  it("returns null for an empty quote", () => {
    expect(locateQuote("some text", "")).toBeNull();
  });
});
