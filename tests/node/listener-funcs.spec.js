import { describe, it } from "mocha";
import { expect } from "chai";
import { JSDOM } from "jsdom";
import { addEventListener } from "../../module/utils/listener-funcs.js";

describe("module/utils/listener-funcs.js", () => {
  describe("addEventListener", () => {
    it("registers handler when no selector and calls it with element as this", () => {
      const dom = new JSDOM(`<div id="root"></div>`, { url: "http://localhost" });
      const doc = dom.window.document;
      const el = doc.getElementById("root");
      let called = false;
      let receivedEl = null;
      const handler = function () {
        called = true;
        receivedEl = this;
      };
      const returned = addEventListener(el, "click", handler);
      expect(returned).to.be.a("function");
      el.dispatchEvent(new dom.window.Event("click"));
      expect(called).to.equal(true);
      expect(receivedEl).to.equal(el);
    });

    it("when selector provided, calls handler only when event target matches selector", () => {
      const dom = new JSDOM(
        `<div id="root"><button class="btn">Click</button></div>`,
        { url: "http://localhost" }
      );
      const doc = dom.window.document;
      const root = doc.getElementById("root");
      const btn = doc.querySelector(".btn");
      let called = false;
      let receivedThis = null;
      const handler = function () {
        called = true;
        receivedThis = this;
      };
      addEventListener(root, "click", handler, ".btn");
      btn.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      expect(called).to.equal(true);
      expect(receivedThis).to.equal(btn);
    });

    it("when selector provided and target does not match, does not call handler", () => {
      const dom = new JSDOM(
        `<div id="root"><span class="other">Other</span></div>`,
        { url: "http://localhost" }
      );
      const doc = dom.window.document;
      const root = doc.getElementById("root");
      const span = doc.querySelector(".other");
      let called = false;
      addEventListener(root, "click", () => (called = true), ".btn");
      span.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
      expect(called).to.equal(false);
    });

    it("returns the wrapped handler function", () => {
      const dom = new JSDOM(`<div></div>`, { url: "http://localhost" });
      const el = dom.window.document.querySelector("div");
      const handler = () => {};
      const wrapped = addEventListener(el, "click", handler);
      expect(wrapped).to.be.a("function");
      expect(wrapped).to.not.equal(handler);
    });
  });
});
