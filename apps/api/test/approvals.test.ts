/**
 * 2.5 双签 ApprovalsStore 单测（audit-restore · node:test 零依赖）。
 * 覆盖：登记去重（同管理员不重复计数）· 去重人数 ≥ 配额判定 ·
 * operationSha 确定性（同输入同指纹）· approvals.json 持久化重载。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { ApprovalsStore, operationSha } from "@agentssignal/audit";

let dir = "";
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "as-approvals-"));
});
after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const FILE = () => path.join(dir, "approvals.json");
const OP = "op-sha-固定指纹";

describe("ApprovalsStore（2.5 双签）", () => {
  test("登记去重：同管理员不重复计数，异管理员累加", () => {
    const store = new ApprovalsStore(FILE());
    assert.equal(store.register(OP, "admin:a", "t1").distinct, 1);
    assert.equal(store.register(OP, "admin:a", "t2").distinct, 1, "同管理员去重");
    assert.equal(store.register(OP, "admin:b", "t3").distinct, 2);
  });

  test("operationSha 确定性：同输入同指纹，异输入异指纹", () => {
    assert.equal(operationSha("signal", "sig_1", 3), operationSha("signal", "sig_1", 3));
    assert.notEqual(operationSha("signal", "sig_1", 3), operationSha("signal", "sig_2", 3));
    assert.notEqual(operationSha("signal", "sig_1", 3), operationSha("signal", "sig_1", 4));
  });

  test("持久化重载：登记数跨实例一致", async () => {
    const myFile = path.join(dir, "approvals-persist.json"); // 独立文件防同文件跨用例累积
    const store = new ApprovalsStore(myFile);
    store.register(OP, "admin:a", "t1");
    const reopened = new ApprovalsStore(myFile);
    assert.equal(reopened.distinctAdmins(OP), 1);
    assert.equal(reopened.isSatisfied(OP, 1), true);
    assert.equal(reopened.isSatisfied(OP, 2), false);
  });
});
