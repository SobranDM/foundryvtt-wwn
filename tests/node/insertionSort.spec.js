import { describe, it } from "mocha";
import { expect } from "chai";
import insertionSort from "../../module/insertionSort.js";

const { byString } = Object;

describe("module/insertionSort.js", () => {
  describe("Object.byString", () => {
    it("returns top-level property", () => {
      expect(byString({ a: 1 }, "a")).to.equal(1);
    });
    it("returns nested property", () => {
      expect(byString({ a: { b: 2 } }, "a.b")).to.equal(2);
    });
    it("handles bracket notation", () => {
      expect(byString({ a: { b: 3 } }, "a[b]")).to.equal(3);
    });
    it("returns undefined for missing key", () => {
      expect(byString({ a: 1 }, "b")).to.equal(undefined);
    });
    it("returns undefined for missing nested key", () => {
      expect(byString({ a: { b: 1 } }, "a.c")).to.equal(undefined);
    });
    it("strips leading dot in path", () => {
      expect(byString({ a: 1 }, ".a")).to.equal(1);
    });
  });

  describe("insertionSort", () => {
    it("sorts by string property", () => {
      const arr = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }];
      insertionSort(arr, "name");
      expect(arr.map((o) => o.name)).to.deep.equal(["Alice", "Bob", "Charlie"]);
    });
    it("sorts by nested string property", () => {
      const arr = [
        { system: { name: "Charlie" } },
        { system: { name: "Alice" } },
        { system: { name: "Bob" } },
      ];
      insertionSort(arr, "system.name");
      expect(arr.map((o) => o.system.name)).to.deep.equal(["Alice", "Bob", "Charlie"]);
    });
    it("sorts case-insensitively", () => {
      const arr = [{ name: "a" }, { name: "B" }, { name: "C" }];
      insertionSort(arr, "name");
      expect(arr.map((o) => o.name)).to.deep.equal(["a", "B", "C"]);
    });
    it("returns same array reference", () => {
      const arr = [{ name: "b" }, { name: "a" }];
      const out = insertionSort(arr, "name");
      expect(out).to.equal(arr);
    });
    it("handles empty and single-element arrays", () => {
      expect(insertionSort([], "name")).to.deep.equal([]);
      expect(insertionSort([{ name: "x" }], "name")).to.deep.equal([{ name: "x" }]);
    });
  });
});
