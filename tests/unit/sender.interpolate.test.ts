import { describe, it, expect } from "vitest";
import { interpolate } from "../../api/src/services/sender.js";

describe("interpolate", () => {
  it("replaces known variables", () => {
    const result = interpolate(
      "Hi {{customer_name}}, your cart total is {{total_price}}.",
      { customer_name: "Ana", total_price: "$89.00" }
    );
    expect(result).toBe("Hi Ana, your cart total is $89.00.");
  });
  it("leaves unknown variables untouched", () => {
    const result = interpolate("Hello {{name}}!", {});
    expect(result).toBe("Hello {{name}}!");
  });
  it("handles empty template", () => {
    expect(interpolate("", { name: "test" })).toBe("");
  });
  it("replaces multiple occurrences", () => {
    const result = interpolate("{{name}} is {{name}}.", { name: "Marco" });
    expect(result).toBe("Marco is Marco.");
  });
});
