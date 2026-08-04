import { describe, it, expect } from "vitest";
import { canTransition } from "../../api/src/models/cart.js";
import type { CartStatus } from "../../api/src/models/cart.js";

describe("canTransition", () => {
  const validTransitions: [CartStatus, CartStatus][] = [
    ["idle",        "abandoned"],
    ["abandoned",   "in_sequence"],
    ["abandoned",   "recovered"],
    ["abandoned",   "closed"],
    ["in_sequence", "recovered"],
    ["in_sequence", "closed"],
  ];
  it.each(validTransitions)(
    "allows %s → %s",
    (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    }
  );
  const invalidTransitions: [CartStatus, CartStatus][] = [
    ["idle",      "recovered"],
    ["idle",      "closed"],
    ["recovered", "abandoned"],
    ["recovered", "in_sequence"],
    ["closed",    "abandoned"],
    ["closed",    "recovered"],
  ];
  it.each(invalidTransitions)(
    "blocks %s → %s",
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    }
  );
});
