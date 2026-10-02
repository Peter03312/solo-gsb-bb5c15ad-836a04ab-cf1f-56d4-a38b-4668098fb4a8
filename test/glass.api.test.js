'use strict';

// 端到端：真实 HTTP 服务（临时 SQLite），验证
// 原片登记/改库存、排样预览不占库存、整单缺色/单片放不下/超 60 报错、
// 确认原子预留所有颜色、并发不超卖、取消只释放一次、快照绑定。

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.TEST_PORT || '39126';
process.env.DB_PATH = require('path').join(__dirname, '..', 'data', `glass-test-${process.pid}.db`);

const { test, before, after } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const db = require('../src/db');
const app = require('../src/server');

const BASE = `http://localhost:${process.env.PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
let designId, pubId;

async function api(method, url, body) {
  const resp = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

before(async () => {
  server = app.listen(Number(process.env.PORT));
  for (let i = 0; i < 40; i++) {
    try { await api('GET', '/api/glass-materials'); break; } catch { await sleep(50); }
  }
  const d = await api('POST', '/api/designs', { name: '玻璃测试窗', width: 100, height: 100 });
  designId = d.data.design.id;
  await api('POST', `/api/designs/${designId}/pieces`, {
    color: '#ff0000', polygon: [[0, 0], [50, 0], [50, 100], [0, 100]],
  });
  await api('POST', `/api/designs/${designId}/pieces`, {
    color: '#00ff00', polygon: [[50, 0], [100, 0], [100, 100], [50, 100]],
  });
  const p = await api('POST', `/api/designs/${designId}/publish`);
  pubId = p.data.publication.id;
});

after(async () => {
  await new Promise((r) => server.close(r));
  try { db.getDb().close(); } catch { /* ignore */ }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(process.env.DB_PATH + suffix, { force: true }); } catch { /* ignore */ }
  }
});

test('原片登记：非法宽高/库存拒绝；同色重复登记 409', async () => {
  assert.strictEqual((await api('POST', '/api/glass-materials', { color: '#ff0000', width: 0, height: 100, stock: 1 })).status, 400);
  assert.strictEqual((await api('POST', '/api/glass-materials', { color: '#ff0000', width: 2001, height: 100, stock: 1 })).status, 400);
  assert.strictEqual((await api('POST', '/api/glass-materials', { color: '#ff0000', width: 100, height: 100, stock: -1 })).status, 400);
  const ok = await api('POST', '/api/glass-materials', { color: '#FF0000', name: '红玻', width: 300, height: 200, stock: 5 });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.data.material.color, '#ff0000', '颜色归一为小写');
  assert.strictEqual(ok.data.material.available, 5);
  const dup = await api('POST', '/api/glass-materials', { color: '#ff0000', width: 1, height: 1, stock: 1 });
  assert.strictEqual(dup.status, 409);
});

test('缺色整单 422；参数非法 400；单片放不下 422', async () => {
  // 只登记了红色，缺绿色
  const miss = await api('POST', '/api/glass-plans/preview', { publicationId: pubId, copies: 1, gap: 0 });
  assert.strictEqual(miss.status, 422);
  assert.strictEqual(miss.data.code, 'color_material_missing');
  assert.deepStrictEqual(miss.data.missingColors, ['#00ff00']);

  assert.strictEqual((await api('POST', '/api/glass-plans/preview', { publicationId: pubId, copies: 1, gap: 51 })).status, 400);
  assert.strictEqual((await api('POST', '/api/glass-plans/preview', { publicationId: pubId, copies: 0, gap: 0 })).status, 400);
  assert.strictEqual((await api('POST', '/api/glass-plans/preview', { publicationId: pubId, copies: 1, gap: 1.5 })).status, 400);
  assert.strictEqual((await api('POST', '/api/glass-plans/preview', { publicationId: 9999, copies: 1, gap: 0 })).status, 404);

  // 绿色登记为 40×40：单片 50×100 任何朝向都放不下
  await api('POST', '/api/glass-materials', { color: '#00ff00', width: 40, height: 40, stock: 9 });
  const big = await api('POST', '/api/glass-plans/preview', { publicationId: pubId, copies: 1, gap: 0 });
  assert.strictEqual(big.status, 422);
  assert.strictEqual(big.data.code, 'piece_too_large');
  assert.strictEqual(big.data.pieceWidth, 50);
  assert.strictEqual(big.data.sheetWidth, 40);
});

test('预览给出逐板片号/件次/角度/坐标/轮廓与各色用板、缺口；预览不占库存', async () => {
  const mats = (await api('GET', '/api/glass-materials')).data.materials;
  const green = mats.find((m) => m.color === '#00ff00');
  // 宽高属于规格身份，PATCH 拒绝修改（只能改备注名/库存）
  const forbidden = await api('PATCH', `/api/glass-materials/${green.id}`, { width: 150, height: 150 });
  assert.strictEqual(forbidden.status, 400);

  // 用只含红色片的发布版验证逐板内容与缺口
  const d2 = await api('POST', '/api/designs', { name: '单色窗', width: 60, height: 60 });
  const did = d2.data.design.id;
  await api('POST', `/api/designs/${did}/pieces`, {
    color: '#ff0000', polygon: [[0, 0], [30, 0], [30, 60], [0, 60]],
  });
  await api('POST', `/api/designs/${did}/pieces`, {
    color: '#ff0000', polygon: [[30, 0], [60, 0], [60, 60], [30, 60]],
  });
  const pub2 = (await api('POST', `/api/designs/${did}/publish`)).data.publication;

  const before = (await api('GET', '/api/glass-materials')).data.materials.find((m) => m.color === '#ff0000').available;
  const pv = await api('POST', '/api/glass-plans/preview', { publicationId: pub2.id, copies: 4, gap: 5 });
  assert.ok(pv.data.ok);
  const after = (await api('GET', '/api/glass-materials')).data.materials.find((m) => m.color === '#ff0000').available;
  assert.strictEqual(before, after, '预览不改库存');

  const L = pv.data.preview.layout;
  assert.strictEqual(L.totalPieces, 8);
  assert.strictEqual(L.colors.length, 1);
  const c = L.colors[0];
  // 30×60 片、间距 5：一行可放 floor((300-30)/(30+5))+1 = 9 片 → 4 件 8 片只需 1 张
  assert.strictEqual(c.usedSheets, 1);
  assert.strictEqual(c.shortage, 0);
  assert.strictEqual(c.stock, 5);
  const placements = c.boards[0].placements;
  for (const p of placements) {
    assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y));
    assert.ok([0, 90, 180, 270].includes(p.rotation));
    assert.ok(Array.isArray(p.polygon) && p.polygon.length === 4);
    assert.ok(Number.isInteger(p.copy) && p.copy >= 1 && p.copy <= 4);
  }
  // 相同参数再次预览 → 布局一致
  const pv2 = await api('POST', '/api/glass-plans/preview', { publicationId: pub2.id, copies: 4, gap: 5 });
  assert.deepStrictEqual(pv2.data.preview.layout.colors[0].boards, c.boards);

  // 缺口：库存 5、copies=100 会超 60 张上限（整单 422），改用更大 gap 或小件验证 shortage
  // 两件、原片只能放 1 片/张 → 需 2 张；库存 5 足够。构造缺口：把库存降到 0 再预览
  await api('PATCH', `/api/glass-materials/${c.materialId}`, { stock: 0 });
  const short = await api('POST', '/api/glass-plans/preview', { publicationId: pub2.id, copies: 2, gap: 0 });
  assert.strictEqual(short.data.preview.layout.colors[0].shortage, 1);
  assert.strictEqual(short.data.preview.layout.feasible, false);
  // 恢复
  await api('PATCH', `/api/glass-materials/${c.materialId}`, { stock: 5 });
});

test('草稿不预留；确认原子预留全部颜色；重复确认不重复；取消只释放一次', async () => {
  const designs = (await api('GET', '/api/designs')).data.designs;
  const single = designs.find((x) => x.name === '单色窗');
  const pub2 = (await api('GET', `/api/designs/${single.id}/publications`)).data.publications[0];

  const redMat = (await api('GET', '/api/glass-materials')).data.materials.find((m) => m.color === '#ff0000');
  await api('PATCH', `/api/glass-materials/${redMat.id}`, { stock: 3 });

  const plan = await api('POST', '/api/glass-plans', { publicationId: pub2.id, copies: 2, gap: 0 });
  const pid = plan.data.plan.id;
  assert.strictEqual(plan.data.plan.status, 'draft');
  assert.strictEqual(plan.data.plan.totalSheets, 1);
  let mat = (await api('GET', `/api/glass-materials/${redMat.id}`)).data.material;
  assert.strictEqual(mat.reserved, 0);

  await api('POST', `/api/glass-plans/${pid}/confirm`);
  mat = (await api('GET', `/api/glass-materials/${redMat.id}`)).data.material;
  assert.strictEqual(mat.reserved, 1);
  assert.strictEqual(mat.available, 2);

  // 重复确认 409 且不重复预留
  assert.strictEqual((await api('POST', `/api/glass-plans/${pid}/confirm`)).status, 409);
  mat = (await api('GET', `/api/glass-materials/${redMat.id}`)).data.material;
  assert.strictEqual(mat.reserved, 1);

  // 已确认不可改不可删
  assert.strictEqual((await api('PUT', `/api/glass-plans/${pid}`, { copies: 3 })).status, 409);
  assert.strictEqual((await api('DELETE', `/api/glass-plans/${pid}`)).status, 409);

  // 取消释放一次
  assert.ok((await api('POST', `/api/glass-plans/${pid}/cancel`)).data.ok);
  mat = (await api('GET', `/api/glass-materials/${redMat.id}`)).data.material;
  assert.strictEqual(mat.reserved, 0);
  assert.strictEqual((await api('POST', `/api/glass-plans/${pid}/cancel`)).status, 409);
  mat = (await api('GET', `/api/glass-materials/${redMat.id}`)).data.material;
  assert.strictEqual(mat.reserved, 0, '重复取消不重复释放');
});

test('并发确认不超卖；多颜色库存不足整单失败（无部分预留）', async () => {
  // 主图纸红绿两色；绿色 40×40 放不下 50×100。新建一张红绿双色小窗（片 ≤40）。
  const d3 = await api('POST', '/api/designs', { name: '并发双色窗', width: 20, height: 20 });
  const did = d3.data.design.id;
  await api('POST', `/api/designs/${did}/pieces`, {
    color: '#ff0000', polygon: [[0, 0], [10, 0], [10, 20], [0, 20]],
  });
  await api('POST', `/api/designs/${did}/pieces`, {
    color: '#00ff00', polygon: [[10, 0], [20, 0], [20, 20], [10, 20]],
  });
  const pub3 = (await api('POST', `/api/designs/${did}/publish`)).data.publication;

  const mats = (await api('GET', '/api/glass-materials')).data.materials;
  const red = mats.find((m) => m.color === '#ff0000');
  const green = mats.find((m) => m.color === '#00ff00');
  await api('PATCH', `/api/glass-materials/${red.id}`, { stock: 2 });
  await api('PATCH', `/api/glass-materials/${green.id}`, { stock: 2 });

  // 每个单 1 件：红绿各需 1 张；建 3 个草稿并发确认，只有 2 个成功
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const r = await api('POST', '/api/glass-plans', { name: `并发${i}`, publicationId: pub3.id, copies: 1, gap: 0 });
    ids.push(r.data.plan.id);
  }
  const results = await Promise.all(ids.map((id) => api('POST', `/api/glass-plans/${id}/confirm`)));
  const okN = results.filter((r) => r.data.ok).length;
  assert.strictEqual(okN, 2, '恰好 2 单抢到库存');
  assert.ok(results.every((r) => r.data.ok || r.data.code === 'shortage'));
  const rm = (await api('GET', `/api/glass-materials/${red.id}`)).data.material;
  const gm = (await api('GET', `/api/glass-materials/${green.id}`)).data.material;
  assert.strictEqual(rm.reserved, 2);
  assert.strictEqual(gm.reserved, 2);

  // 整单原子性：绿色有货但红色为 0 → 确认失败，绿色不被预留
  await api('PATCH', `/api/glass-materials/${red.id}`, { stock: 2 });   // 维持 0 可用
  await api('PATCH', `/api/glass-materials/${green.id}`, { stock: 5 }); // 绿色有富余
  const atomic = await api('POST', '/api/glass-plans', { publicationId: pub3.id, copies: 1, gap: 0 });
  const fail = await api('POST', `/api/glass-plans/${atomic.data.plan.id}/confirm`);
  assert.strictEqual(fail.status, 409);
  assert.strictEqual(fail.data.code, 'shortage');
  const gmAfter = (await api('GET', `/api/glass-materials/${green.id}`)).data.material;
  assert.strictEqual(gmAfter.reserved, 2, '失败单未预留任何颜色');
});

test('库存调整不得低于已预留数', async () => {
  const green = (await api('GET', '/api/glass-materials')).data.materials.find((m) => m.color === '#00ff00');
  const r = await api('PATCH', `/api/glass-materials/${green.id}`, { stock: 1 });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.data.code, 'stock_below_reserved');
});

test('超 60 张整单 422（不产生部分方案）', async () => {
  // 专用颜色：原片恰好 10×10，每片一张
  const reg = await api('POST', '/api/glass-materials', { color: '#777777', width: 10, height: 10, stock: 100 });
  assert.strictEqual(reg.status, 201);
  const d = await api('POST', '/api/designs', { name: '超板窗', width: 10, height: 10 });
  const did = d.data.design.id;
  await api('POST', `/api/designs/${did}/pieces`, {
    color: '#777777', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]],
  });
  const pub = (await api('POST', `/api/designs/${did}/publish`)).data.publication;
  const r = await api('POST', '/api/glass-plans/preview', { publicationId: pub.id, copies: 61, gap: 0 });
  assert.strictEqual(r.status, 422);
  assert.strictEqual(r.data.code, 'too_many_sheets');
  assert.strictEqual(r.data.totalSheets, 61);
  // 恰好 60 张可以排
  const edge = await api('POST', '/api/glass-plans/preview', { publicationId: pub.id, copies: 60, gap: 0 });
  assert.strictEqual(edge.status, 200);
  assert.strictEqual(edge.data.preview.layout.totalSheets, 60);
  // 未落库
  const plans = (await api('GET', '/api/glass-plans')).data.plans;
  assert.ok(!plans.some((p) => p.publicationId === pub.id && p.totalSheets === 61));
});

test('快照绑定：确认后再发布不改变方案；草稿改动不影响已确认单', async () => {
  const d4 = await api('POST', '/api/designs', { name: '快照绑定窗', width: 40, height: 40 });
  const did = d4.data.design.id;
  await api('POST', `/api/designs/${did}/pieces`, {
    color: '#ff0000', polygon: [[0, 0], [40, 0], [40, 40], [0, 40]],
  });
  const v1 = (await api('POST', `/api/designs/${did}/publish`)).data.publication;
  const red = (await api('GET', '/api/glass-materials')).data.materials.find((m) => m.color === '#ff0000');
  await api('PATCH', `/api/glass-materials/${red.id}`, { stock: 20 });
  const created = await api('POST', '/api/glass-plans', { publicationId: v1.id, copies: 1, gap: 0 });
  const pid = created.data.plan.id;
  await api('POST', `/api/glass-plans/${pid}/confirm`);
  const before = (await api('GET', `/api/glass-plans/${pid}`)).data.plan;
  assert.strictEqual(before.totalPieces, 1);

  // 草稿改为 4 片并发布 v2
  await api('DELETE', `/api/designs/${did}/pieces/1`);
  for (const [c, poly] of [
    ['#ff0000', [[0, 0], [20, 0], [20, 40], [0, 40]]],
    ['#00ff00', [[20, 0], [40, 0], [40, 20], [20, 20]]],
    ['#0000ff', [[20, 20], [40, 20], [40, 40], [20, 40]]],
  ]) {
    await api('POST', `/api/designs/${did}/pieces`, { color: c, polygon: poly });
  }
  await api('POST', `/api/designs/${did}/publish`);

  const after = (await api('GET', `/api/glass-plans/${pid}`)).data.plan;
  assert.strictEqual(after.version, 1);
  assert.strictEqual(after.publicationId, v1.id);
  assert.strictEqual(after.totalPieces, 1);
  assert.strictEqual(after.status, 'confirmed');
  assert.deepStrictEqual(after.layout, before.layout);
});

test('网页与裁片单可查询', async () => {
  const root = await fetch(BASE + '/');
  assert.strictEqual(root.status, 200);
  const plans = await api('GET', '/api/glass-plans');
  assert.ok(Array.isArray(plans.data.plans) && plans.data.plans.length > 0);
  const mats = await api('GET', '/api/glass-materials');
  for (const m of mats.data.materials) {
    assert.strictEqual(m.stock - m.reserved, m.available);
  }
});
