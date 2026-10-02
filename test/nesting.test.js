'use strict';

// 原片排样核心测试：参数校验、90° 旋转、间距精确整数判定、越板/超上限整单拒绝、确定性。

const test = require('node:test');
const assert = require('assert');
const n = require('../src/nesting');

const matsOf = (...entries) => new Map(entries.map(([color, w, h]) =>
  [color, { id: 0, color, width: w, height: h }]));

test('参数解析：宽高 1–2000、间距 0–50、件数正整数', () => {
  assert.ok(n.parseSheetSide(1, 'x').ok);
  assert.ok(n.parseSheetSide(2000, 'x').ok);
  assert.ok(!n.parseSheetSide(0, 'x').ok);
  assert.ok(!n.parseSheetSide(2001, 'x').ok);
  assert.ok(!n.parseSheetSide(1.5, 'x').ok);
  assert.ok(n.parseGap(0).ok && n.parseGap(50).ok);
  assert.ok(!n.parseGap(-1).ok && !n.parseGap(51).ok);
  assert.ok(n.parseCopies(1).ok && !n.parseCopies(0).ok && !n.parseCopies(1.2).ok);
});

test('旋转：90° 的整数倍且归一到 (0,0)；0/90/180/270 宽高互换但不镜像', () => {
  const rect = [[0, 0], [80, 0], [80, 30], [0, 30]];
  const v0 = n.rotatedVariant(rect, 0);
  const v90 = n.rotatedVariant(rect, 90);
  const v180 = n.rotatedVariant(rect, 180);
  const v270 = n.rotatedVariant(rect, 270);
  assert.deepStrictEqual([v0.bw, v0.bh], [80, 30]);
  assert.deepStrictEqual([v90.bw, v90.bh], [30, 80]);
  assert.deepStrictEqual([v180.bw, v180.bh], [80, 30]);
  assert.deepStrictEqual([v270.bw, v270.bh], [30, 80]);
  // 归一后最小角恒在原点
  for (const v of [v0, v90, v180, v270]) {
    const b = n.bbox(v.poly);
    assert.strictEqual(b.x0, 0); assert.strictEqual(b.y0, 0);
    assert.ok(v.poly.every(([x, y]) => x >= 0 && y >= 0));
  }
  // 90° 不镜像：面积（2 倍）保持不变
  const area = (p) => {
    let s = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1];
    return Math.abs(s);
  };
  assert.strictEqual(area(v90.poly), area(rect));
  // 90°（顺时针，y 向上）：(x,y)→(y,-x)，顶点顺序保持
  assert.deepStrictEqual(v90.poly, [[0, 80], [0, 0], [30, 0], [30, 80]]);
  assert.deepStrictEqual(v180.poly, [[80, 30], [0, 30], [0, 0], [80, 0]]);
  assert.deepStrictEqual(v270.poly, [[30, 0], [30, 80], [0, 80], [0, 0]]);
});

test('排样：放得下的片自动旋转 90°；任何朝向放不下整单拒绝', () => {
  const snap = { pieces: [{ pieceNo: 1, color: '#000001', polygon: [[0, 0], [80, 0], [80, 30], [0, 30]] }] };
  const r = n.planNesting({ snapshot: snap, copies: 1, gap: 0,
    materials: matsOf(['#000001', 50, 200]) });
  assert.ok(r.ok);
  assert.strictEqual(r.layout.colors[0].boards[0].placements[0].rotation, 90);

  const bad = n.planNesting({ snapshot: snap, copies: 1, gap: 0,
    materials: matsOf(['#000001', 70, 70]) });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.code, 'piece_too_large');
  assert.strictEqual(bad.pieceWidth, 80);
  assert.strictEqual(bad.pieceHeight, 30);
});

test('缺颜色整单拒绝且带 missingColors', () => {
  const snap = { pieces: [
    { pieceNo: 1, color: '#aa0000', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    { pieceNo: 2, color: '#bb0000', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] },
  ] };
  const r = n.planNesting({ snapshot: snap, copies: 1, gap: 0, materials: matsOf(['#aa0000', 100, 100]) });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'color_material_missing');
  assert.deepStrictEqual(r.missingColors, ['#bb0000']);
});

test('片间间距：间隙正好 gap 可放，少 1mm 即换板', () => {
  const snap = { pieces: [{ pieceNo: 1, color: '#010101', polygon: [[0, 0], [100, 0], [100, 100], [0, 100]] }] };
  const m = matsOf(['#010101', 205, 200]);
  const fit = n.planNesting({ snapshot: snap, copies: 2, gap: 5, materials: m });
  assert.ok(fit.ok);
  assert.strictEqual(fit.layout.colors[0].sheets, 1);
  const tight = n.planNesting({ snapshot: snap, copies: 2, gap: 5, materials: matsOf(['#010101', 204, 200]) });
  assert.strictEqual(tight.layout.colors[0].sheets, 2);
  // gap=0 时两片可共边贴合（x=0 与 x=100）
  const touch = n.planNesting({ snapshot: snap, copies: 2, gap: 0, materials: matsOf(['#010101', 200, 200]) });
  assert.strictEqual(touch.layout.colors[0].sheets, 1);
  assert.deepStrictEqual(touch.layout.colors[0].boards[0].placements.map((p) => [p.x, p.y]),
    [[0, 0], [100, 0]]);
});

test('间距精确判定（点到线段距离平方的整数比较）', () => {
  // (0,3) 到竖段 x=4, y∈[0,3] 距离恰为 4
  assert.strictEqual(n.pointSegDist2AtLeast(0, 3, 4, 0, 4, 3, 16), true);
  assert.strictEqual(n.pointSegDist2AtLeast(0, 3, 4, 0, 4, 3, 25), false);
  // 原点到 3-4-5 三角形斜边的距离 = 12/5 = 2.4
  assert.strictEqual(n.pointSegDist2AtLeast(0, 0, 3, 0, 0, 4, 4), true);
  assert.strictEqual(n.pointSegDist2AtLeast(0, 0, 3, 0, 0, 4, 9), false);
});

test('复杂多边形 gap=0 允许共边/T 接；gap>0 共边拒绝', () => {
  const L1 = [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]];
  const L2 = [[40, 0], [80, 0], [80, 40], [60, 40], [60, 20], [40, 20]];
  const placed = [{ polygon: L1, bbox: n.bbox(L1) }];
  assert.strictEqual(n.placementOK(L2, { width: 300, height: 300 }, placed, 0), true);
  assert.strictEqual(n.placementOK(L2, { width: 300, height: 300 }, placed, 1), false);
  // 平移到相距 5mm 且不重叠：L2 整体 x+45 后，其最左竖边 x=85，L1 最右 x=40，距离 45
  const far = L2.map(([x, y]) => [x + 45, y]);
  assert.strictEqual(n.placementOK(far, { width: 300, height: 300 }, placed, 5), true);
  // 越板拒绝
  const out = [[250, 0], [320, 0], [320, 40], [250, 40]];
  assert.strictEqual(n.placementOK(out, { width: 300, height: 300 }, [], 0), false);
});

test('总裁片数上限 60：恰好 60 通过，61 整单拒绝', () => {
  const snap = { pieces: [{ pieceNo: 1, color: '#020202', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] }] };
  const m = matsOf(['#020202', 10, 10]);
  assert.strictEqual(n.planNesting({ snapshot: snap, copies: 60, gap: 0, materials: m }).ok, true);
  const over = n.planNesting({ snapshot: snap, copies: 61, gap: 0, materials: m });
  assert.strictEqual(over.ok, false);
  assert.strictEqual(over.code, 'too_many_sheets');
  assert.strictEqual(over.totalSheets, 61);
});

test('确定性：相同快照与参数两次排样布局逐字节一致', () => {
  const snap = { pieces: [
    { pieceNo: 1, color: '#030303', polygon: [[0, 0], [30, 0], [30, 40], [0, 40]] },
    { pieceNo: 2, color: '#030303', polygon: [[0, 0], [25, 0], [25, 35], [0, 35]] },
    { pieceNo: 3, color: '#040404', polygon: [[0, 0], [20, 0], [20, 60], [0, 60]] },
  ] };
  const m = matsOf(['#030303', 120, 120], ['#040404', 90, 90]);
  const a = JSON.stringify(n.planNesting({ snapshot: snap, copies: 4, gap: 3, materials: m }).layout);
  const b = JSON.stringify(n.planNesting({ snapshot: snap, copies: 4, gap: 3, materials: m }).layout);
  assert.strictEqual(a, b);
});

test('输出：每个放置带片号、件次、角度、坐标、轮廓；逐件展开', () => {
  const snap = { pieces: [
    { pieceNo: 7, color: '#050505', polygon: [[0, 0], [20, 0], [20, 20], [0, 20]] },
  ] };
  const r = n.planNesting({ snapshot: snap, copies: 3, gap: 0,
    materials: matsOf(['#050505', 40, 40]) });
  assert.ok(r.ok);
  const placements = r.layout.colors[0].boards[0].placements;
  assert.strictEqual(r.layout.totalPieces, 3);
  assert.deepStrictEqual(placements.map((p) => p.copy), [1, 2, 3]);
  assert.strictEqual(placements[0].pieceNo, 7);
  for (const p of placements) {
    assert.ok([0, 90, 180, 270].includes(p.rotation));
    assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y));
    assert.strictEqual(p.polygon.length, 4);
    assert.ok(p.polygon.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)));
  }
});
