import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBoldHtml,
  splitByBold,
  isBoldToken,
  stripBoldDelimiters,
} from "../shared/markdown-bold.js";

test("applyBoldHtml: converts **text** to <strong>text</strong>", () => {
  assert.equal(applyBoldHtml("hello **world**"), "hello <strong>world</strong>");
});

test("applyBoldHtml: leaves plain text untouched", () => {
  assert.equal(applyBoldHtml("no bold here"), "no bold here");
});

test("applyBoldHtml: handles multiple bold spans", () => {
  assert.equal(
    applyBoldHtml("**a** middle **b**"),
    "<strong>a</strong> middle <strong>b</strong>"
  );
});

test("applyBoldHtml: empty string returns empty string", () => {
  assert.equal(applyBoldHtml(""), "");
});

test("splitByBold: returns alternating plain/bold parts", () => {
  assert.deepEqual(
    splitByBold("hello **world** and **friend**"),
    ["hello ", "**world**", " and ", "**friend**", ""]
  );
});

test("splitByBold: returns single plain part when no bold", () => {
  assert.deepEqual(splitByBold("plain"), ["plain"]);
});

test("isBoldToken: true for **wrapped**", () => {
  assert.equal(isBoldToken("**hi**"), true);
});

test("isBoldToken: false for plain text", () => {
  assert.equal(isBoldToken("hi"), false);
});

test("isBoldToken: false for half-wrapped", () => {
  assert.equal(isBoldToken("**hi"), false);
  assert.equal(isBoldToken("hi**"), false);
});

test("stripBoldDelimiters: removes the surrounding **", () => {
  assert.equal(stripBoldDelimiters("**hello**"), "hello");
});
