import test from "node:test";
import assert from "node:assert/strict";
import { parseLandingRoute, getPreviousLandingRoute } from "../src/landing/flow.js";

test("landing routes restore the selected concern and method step from the URL", () => {
  const routes = [
    ["#start", { page: "start" }],
    ["#example/resume", { page: "example", situation: "resume" }],
    ["#example/portfolio", { page: "example", situation: "portfolio" }],
    ["#example/interview", { page: "example", situation: "interview" }],
    ["#example/unsure", { page: "example", situation: "unsure" }],
    ["#method/1", { page: "method", step: 1 }],
    ["#method/2", { page: "method", step: 2 }],
    ["#method/3", { page: "method", step: 3 }],
    ["#offer", { page: "offer" }],
    ["#contact", { page: "contact" }],
  ];

  for (const [hash, route] of routes) {
    assert.deepEqual(parseLandingRoute(hash), route, hash);
  }
});

test("unknown or malformed URLs safely return to the first question", () => {
  const invalidHashes = [
    undefined, null, 1, {}, "", "start", "#", "#Start", "#start/",
    "#example", "#example/unknown", "#method/0", "#method/4", "#method/01",
    "#offer?redirect=https://example.com", "#contact/extra", "toString",
    "__proto__", "#example/<img src=x onerror=alert(1)>",
    "#example/%72esume", "#example/resume/extra",
  ];

  for (const hash of invalidHashes) {
    assert.deepEqual(parseLandingRoute(hash), { page: "start" }, String(hash));
  }
});

test("changing a parsed route cannot change a later visitor's navigation", () => {
  const route = parseLandingRoute("#example/resume");
  route.situation = "unknown";
  assert.deepEqual(parseLandingRoute("#example/resume"), {
    page: "example", situation: "resume",
  });
});

test("every screen has a predictable previous step, including direct visits", () => {
  const previousRoutes = [
    ["#start", "#start"],
    ["#example/resume", "#start"],
    ["#example/portfolio", "#start"],
    ["#example/interview", "#start"],
    ["#example/unsure", "#start"],
    ["#method/1", "#start"],
    ["#method/2", "#method/1"],
    ["#method/3", "#method/2"],
    ["#offer", "#method/3"],
    ["#contact", "#offer"],
  ];

  for (const [hash, previousHash] of previousRoutes) {
    assert.equal(getPreviousLandingRoute(parseLandingRoute(hash)), previousHash, hash);
  }
  assert.equal(getPreviousLandingRoute({ page: "unknown" }), "#start");
});
