// 무료 Upstash DB 보관 처리 방지용 예약 작업(api/keepalive.js) 검사.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createKeepAliveHandler, isCronCaller } from "../api/keepalive.js";

function fakeRes() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

test("keepalive writes one expiring key", async () => {
  const calls = [];
  const store = { async set(...args) { calls.push(args); } };
  const res = fakeRes();
  await createKeepAliveHandler({ store, secret: "" })({ headers: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "aro:keepalive");
  assert.deepEqual(calls[0][2], { ex: 3 * 86400 });
});

test("keepalive requires the cron secret when one is set", async () => {
  assert.equal(isCronCaller({ headers: {} }, "s3"), false);
  assert.equal(isCronCaller({ headers: { authorization: "Bearer s3" } }, "s3"), true);
  const store = { async set() { throw new Error("must not run"); } };
  const res = fakeRes();
  await createKeepAliveHandler({ store, secret: "s3" })({ headers: {} }, res);
  assert.equal(res.code, 401);
});

test("keepalive reports an unreachable store instead of crashing", async () => {
  const store = { async set() { throw new Error("fetch failed"); } };
  const res = fakeRes();
  await createKeepAliveHandler({ store, secret: "" })({ headers: {} }, res);
  assert.equal(res.code, 502);
  const none = fakeRes();
  await createKeepAliveHandler({ store: null, secret: "" })({ headers: {} }, none);
  assert.equal(none.code, 503);
});
