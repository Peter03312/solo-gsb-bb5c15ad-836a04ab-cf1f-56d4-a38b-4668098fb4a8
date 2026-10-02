'use strict';

// Skyline 排样不变量：对多种随机简单拼片/原片/间距，逐放置验证
// 不越板、同板片间轮廓距离 ≥ gap、旋转仅限 0/90/180/270（无镜像）、布局确定性。

const test = require('node:test');
const assert = require('assert');
const n = require('../src/nesting');
const geo = require('../src/geometry');

// 生成轴对齐矩形拼片（简单多边形）；颜色两种
function rectPieces(seed) {
  const pieces = [];
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  let no = 1;
  for (let i = 0; i < 8; i++) {
    const w = 10 + Math.floor(rnd() * 70);
    const h = 10 + Math.floor(rnd() * 70);
    pieces.push({ pieceNo: no++, color: i % 2 ? '#aabb00' : '#00bbaa', polygon: [[0, 0], [w, 0], [w, h], [0, h]] });
  }
  return pieces;
}

// 有向面积符号：旋转不应翻转（镜像会翻转符号）
function signed(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return a;
}

test('不变量：多种规模下所有放置越板/间距/朝向均合法', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const pieces = rectPieces(seed);
    const snap = { width: 500, height: 500, pieces };
    const sheetW = 200 + (seed % 5) * 60;
    const sheetH = 180 + (seed % 7) * 50;
    const gap = seed % 6;
    const copies = 1 + (seed % 4);
    const materials = new Map([
      ['#00bbaa', { id: 1, color: '#00bbaa', width: sheetW, height: sheetH }],
      ['#aabb00', { id: 2, color: '#aabb00', width: sheetH, height: sheetW }], // 另一朝向的板
    ]);
    const r = n.planNesting({ snapshot: snap, copies, gap, materials });
    assert.ok(r.ok, `seed ${seed} 应能排样：${r.error || ''}`);

    for (const c of r.layout.colors) {
      for (const board of c.boards) {
        assert.ok(board.placements.length > 0);
        for (let i = 0; i < board.placements.length; i++) {
          const p = board.placements[i];
          // 朝向合法
          assert.ok([0, 90, 180, 270].includes(p.rotation));
          // 不越板
          assert.strictEqual(n.placementOK(p.polygon,
            { width: c.sheetWidth, height: c.sheetHeight }, [], gap), true);
          // 与同板其他片轮廓距离
          const others = board.placements.filter((_, k) => k !== i)
            .map((q) => ({ polygon: q.polygon, bbox: n.bbox(q.polygon) }));
          const ok = n.placementOK(p.polygon,
            { width: c.sheetWidth, height: c.sheetHeight }, others, gap);
          assert.ok(ok, `seed ${seed} 颜色 ${c.color} 板 ${board.index} 片 #${p.pieceNo} 间距/重叠不合法`);
        }
      }
    }

    // 确定性
    const r2 = n.planNesting({ snapshot: snap, copies, gap, materials });
    assert.strictEqual(JSON.stringify(r2.layout), JSON.stringify(r.layout), `seed ${seed} 布局不确定`);

    // 无镜像：放置后多边形有向面积符号与原片一致（矩形 CCW 为正）
    const origSign = new Map(pieces.map((p) => [p.pieceNo, Math.sign(signed(p.polygon))]));
    for (const c of r.layout.colors) {
      for (const board of c.boards) {
        for (const p of board.placements) {
          assert.strictEqual(Math.sign(signed(p.polygon)), origSign.get(p.pieceNo),
            `seed ${seed} 片 #${p.pieceNo} 被镜像（有向面积符号翻转）`);
        }
      }
    }
  }
});

test('不变量：非矩形简单多边形（L 形）密排仍满足间距', () => {
  // 4 个全等 L 形，板 200×200，gap 4
  const lShape = (ox, oy) => [
    [ox, oy], [ox + 40, oy], [ox + 40, oy + 16], [ox + 16, oy + 16],
    [ox + 16, oy + 40], [ox, oy + 40],
  ];
  const pieces = [1, 2, 3, 4].map((i) => ({
    pieceNo: i,
    color: '#123456',
    polygon: lShape(0, 0),
  }));
  const r = n.planNesting({
    snapshot: { pieces },
    copies: 3,
    gap: 4,
    materials: new Map([['#123456', { id: 1, color: '#123456', width: 200, height: 200 }]]),
  });
  assert.ok(r.ok, r.error);
  for (const c of r.layout.colors) {
    for (const board of c.boards) {
      for (let i = 0; i < board.placements.length; i++) {
        const p = board.placements[i];
        const others = board.placements.filter((_, k) => k !== i)
          .map((q) => ({ polygon: q.polygon, bbox: n.bbox(q.polygon) }));
        assert.ok(n.placementOK(p.polygon, { width: 200, height: 200 }, others, 4));
      }
    }
  }
  // 编辑器几何健全性：L 形本身是合法简单多边形
  assert.strictEqual(geo.validatePolygon(lShape(0, 0)).ok, true);
});
