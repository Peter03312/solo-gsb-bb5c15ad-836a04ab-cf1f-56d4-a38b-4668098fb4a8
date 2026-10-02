'use strict';

// 彩色玻璃原片排样核心。
// 输入全部为整数毫米：原片宽高（1–2000）、片间最小间距（0–50）、件数（正整数）。
// 每片只允许平移与 90° 整数倍旋转（不得镜像）；所有放置坐标仍为整数。
//
// 排样用 skyline bottom-left：以片的轴对齐包围盒向右/上外扩 gap 后占位，
// 占位框互不重叠即保证两片包围盒在 x 或 y 方向相距 ≥ gap，而多边形恒在其包围盒内，
// 故两多边形轮廓处处相距 ≥ gap（贴原片边沿不要求留缝）——无需逐对多边形求距。
// 另导出基于精确整数运算（叉积 / 段距平方比较）的轮廓间距判定，供校验与测试复核。
// 纯计算、不访问数据库、不产生任何副作用。

const geo = require('./geometry');

const MAX_SHEET_SIDE = 2000;
const MAX_GAP = 50;
const MAX_TOTAL_SHEETS = 60;
const COPIES_MAX = 10000;
const ROTATIONS = [0, 90, 180, 270];

// ---------- 参数解析 ----------

function parseIntMm(value, { name, min, max, unit = '' }) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: `${name}必须是整数${unit}` };
  }
  if (value < min || value > max) {
    return { ok: false, error: `${name}必须是 ${min}–${max} 之间的整数${unit}` };
  }
  return { ok: true, n: value };
}

const parseSheetSide = (v, name) => parseIntMm(v, { name, min: 1, max: MAX_SHEET_SIDE, unit: '毫米' });
const parseGap = (v) => parseIntMm(v, { name: '片间最小间距', min: 0, max: MAX_GAP, unit: '毫米' });
const parseCopies = (v) => parseIntMm(v, { name: '制作件数', min: 1, max: COPIES_MAX });

// ---------- 多边形变换（整数） ----------

function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
}

// 绕原点顺时针旋转 90° 的整数倍；再平移使包围盒最小角落到 (0,0)。
// 0°/90°/180°/270° 均无镜像（行列式恒为 +1）。
function rotatedVariant(poly, deg) {
  let rot;
  switch (deg) {
    case 0: rot = poly.map(([x, y]) => [x, y]); break;
    case 90: rot = poly.map(([x, y]) => [y, -x]); break;
    case 180: rot = poly.map(([x, y]) => [-x, -y]); break;
    case 270: rot = poly.map(([x, y]) => [-y, x]); break;
    default: throw new Error(`非法旋转角 ${deg}`);
  }
  const b = bbox(rot);
  const norm = rot.map(([x, y]) => [x - b.x0, y - b.y0]);
  return { deg, poly: norm, bw: b.width, bh: b.height };
}

const translate = (poly, tx, ty) => poly.map(([x, y]) => [x + tx, y + ty]);

// ---------- 轮廓间距（精确整数） ----------

// 点 P 到线段 AB 的距离平方是否 ≥ g2（g 为整数间距，g2=g²）。
// |P-A|²·|B-A|² − ((P-A)·(B-A))² ≥ g²·|B-A|²，全程整数。
function pointSegDist2AtLeast(px, py, ax, ay, bx, by, g2) {
  const dx = bx - ax, dy = by - ay;
  const wx = px - ax, wy = py - ay;
  const c1 = wx * dx + wy * dy;
  const c2 = dx * dx + dy * dy;
  let dx2, dy2;
  if (c1 <= 0) {
    dx2 = wx; dy2 = wy;             // 最近点 A
  } else if (c2 <= c1) {
    dx2 = px - bx; dy2 = py - by;   // 最近点 B
  } else {
    // 最近点为线段内投影；距离平方 = |w|² − c1²/c2，乘 c2 比较
    const w2 = wx * wx + wy * wy;
    return w2 * c2 - c1 * c1 >= g2 * c2;
  }
  return dx2 * dx2 + dy2 * dy2 >= g2;
}

// 两条互不相交（不含共线重叠/接触）的线段之间最小距离平方是否 ≥ g²。
// 相离线段的最短距离必在某个端点到另一线段的垂足处取得。
function segSegDist2AtLeast(a, b, c, d, g2) {
  return pointSegDist2AtLeast(a[0], a[1], c[0], c[1], d[0], d[1], g2) &&
    pointSegDist2AtLeast(b[0], b[1], c[0], c[1], d[0], d[1], g2) &&
    pointSegDist2AtLeast(c[0], c[1], a[0], a[1], b[0], b[1], g2) &&
    pointSegDist2AtLeast(d[0], d[1], a[0], a[1], b[0], b[1], g2);
}

// 放置片 cand（整数简单多边形）与已放置片 other 的轮廓距离是否满足 gap。
// gap>0：不得有任何面积重叠，且两轮廓处处距离 ≥ gap。
function pairClearanceStrict(cand, other, gap) {
  const g2 = gap * gap;
  // 顶点在对方内部（含洞概念不涉及：拼片均为简单多边形）
  for (const p of cand) {
    if (geo.pointInPolygon(p[0], p[1], other) === 1) return false;
  }
  for (const p of other) {
    if (geo.pointInPolygon(p[0], p[1], cand) === 1) return false;
  }
  for (let i = 0; i < cand.length; i++) {
    const a = cand[i], b = cand[(i + 1) % cand.length];
    for (let j = 0; j < other.length; j++) {
      const c = other[j], d = other[(j + 1) % other.length];
      const rel = geo.segmentRelation(a, b, c, d);
      if (rel.kind === 'proper') return false;          // 边交叉 → 重叠
      if (rel.kind === 'collinear') return false;      // 共线重叠段 → 距离 0 < gap
      if (rel.kind === 'touch') return false;          // 轮廓相触 → 距离 0 < gap
      if (!segSegDist2AtLeast(a, b, c, d, g2)) return false;
    }
  }
  return true;
}

// 包围盒层面的快速相容：两片包围盒在某一轴向上已相距 ≥ gap，
// 则轮廓必然满足间距（供测试/外部复用）。
function aabbsSeparated(ba, bb, gap) {
  return bb.x0 - ba.x1 >= gap || ba.x0 - bb.x1 >= gap ||
    bb.y0 - ba.y1 >= gap || ba.y0 - bb.y1 >= gap;
}

// 精确判定：候选多边形不越板、与给定已放置片轮廓距离达标（测试用；排样本身用
// 包围盒 skyline 直接保证间距，无需逐对调用）。
function placementOK(poly, board, placed, gap) {
  const W = board.width, H = board.height;
  for (const [x, y] of poly) {
    if (x < 0 || y < 0 || x > W || y > H) return false;
  }
  if (gap === 0) {
    const rel = geo.checkAgainstPieces(poly, placed, { width: W, height: H });
    return !!rel.ok;
  }
  const cb = bbox(poly);
  for (const p of placed) {
    if (aabbsSeparated(cb, p.bbox, gap)) continue;
    if (!pairClearanceStrict(poly, p.polygon, gap)) return false;
  }
  return true;
}

// ---------- 单板排样：skyline bottom-left ----------
//
// 每片只用其轴对齐包围盒占位（多边形恒在包围盒内），占位框向“右/上”外扩 gap：
// 任意两已放置片的占位框不重叠 ⇒ 两片包围盒在 x 或 y 方向相距 ≥ gap
// （原片边沿无需留缝）⇒ 两多边形轮廓处处相距 ≥ gap；故无需逐对多边形判定。
// skyline 记录已占位轮廓的分段包络 [{x,y,w}]，每片在每段左沿尝试“向上抬齐”，
// 取 y 最小（y 同则 x 最小）的位置；相同输入结果完全一致且密排近似线性。
function makePacker(board, gap) {
  const W = board.width, H = board.height;
  // levels 始终按 x 有序并恰好分段覆盖 [0,W)
  const levels = [{ x: 0, y: 0, w: W }];
  const placed = [];

  // 将占位带 [x, x+rw) 抬升到高度 y（y ≥ 该范围原包络高度），再合并同高邻段
  function insertRaise(x, rw, y) {
    const ends = [x, x + rw];
    for (const bx of ends) {
      for (let i = 0; i < levels.length; i++) {
        const L = levels[i];
        if (bx > L.x && bx < L.x + L.w) {
          const rightW = L.x + L.w - bx;
          L.w = bx - L.x;
          levels.splice(i + 1, 0, { x: bx, y: L.y, w: rightW });
          break;
        }
      }
    }
    const xEnd = x + rw;
    for (const L of levels) {
      if (L.x >= x && L.x < xEnd) L.y = y;
    }
    for (let i = 0; i + 1 < levels.length;) {
      if (levels[i].y === levels[i + 1].y) {
        levels[i].w += levels[i + 1].w;
        levels.splice(i + 1, 1);
      } else i++;
    }
  }

  // 查询占位框（fw=实际宽+右间隙, fh=实际高+上间隙）在 skyline 上的最低可行位置；
  // 越界用“实际包围盒”bw/bh 判定（贴板边时外扩部分可超出板沿，不要求留缝）。
  function fit(fw, fh, bw, bh) {
    let best = null;
    for (let i = 0; i < levels.length; i++) {
      const startX = levels[i].x;
      if (startX + bw > W) continue;
      const cover = Math.min(fw, W - startX); // 抬升只在板内范围取包络
      let y = 0, acc = 0, j = i, ok = true;
      while (acc < cover) {
        if (j >= levels.length) { ok = false; break; }
        if (levels[j].y > y) y = levels[j].y;
        acc += levels[j].w;
        j++;
      }
      if (!ok || y + bh > H) continue;
      if (!best || y < best.y || (y === best.y && startX < best.x)) {
        best = { x: startX, y };
      }
    }
    return best;
  }

  // 在 0°/90°（180/270 包围盒等价）朝向中选最低、再最左、再优先小角度的位置；放不下返回 null
  function findSpot(variants) {
    let choice = null;
    variants.forEach((v, order) => {
      if (v.bw > W || v.bh > H) return;
      const spot = fit(v.bw + gap, v.bh + gap, v.bw, v.bh);
      if (!spot) return;
      if (!choice || spot.y < choice.spot.y ||
        (spot.y === choice.spot.y && (spot.x < choice.spot.x ||
          (spot.x === choice.spot.x && order < choice.order)))) {
        choice = { variant: v, spot, order };
      }
    });
    return choice;
  }

  return {
    placed,
    findSpot,
    add(variant, spot) {
      const entry = {
        rotation: variant.deg,
        x: spot.x,
        y: spot.y,
        polygon: translate(variant.poly, spot.x, spot.y),
        bbox: { x0: spot.x, y0: spot.y, x1: spot.x + variant.bw, y1: spot.y + variant.bh,
          width: variant.bw, height: variant.bh },
      };
      placed.push(entry);
      // 抬升占位段（右/上各外扩 gap；插入宽夹到板沿，贴边时不要求留缝）
      const raiseW = Math.min(variant.bw + gap, W - spot.x);
      insertRaise(spot.x, raiseW, spot.y + variant.bh + gap);
      return entry;
    },
  };
}

// ---------- 整单排样 ----------

// 入参：
//   snapshot  发布快照（pieces: [{pieceNo,color,polygon}]）
//   copies    制作件数
//   gap       片间最小间距
//   materials 该单涉及颜色的原片规格：Map(lowerColor → {id,color,width,height})
// 返回 { ok:true, layout:{...}, colorStats:Map } 或 { ok:false, code,error,status,... }
function planNesting({ snapshot, copies, gap, materials }) {
  if (!snapshot || !Array.isArray(snapshot.pieces) || snapshot.pieces.length === 0) {
    return { ok: false, code: 'empty_snapshot', status: 422, error: '发布快照中没有拼片，无法排样' };
  }

  // 1) 按颜色归组任务（逐件展开）
  const tasks = [];
  for (let copy = 1; copy <= copies; copy++) {
    for (const pc of snapshot.pieces) {
      tasks.push({
        pieceNo: pc.pieceNo,
        color: String(pc.color).toLowerCase(),
        polygon: pc.polygon,
        copy,
      });
    }
  }

  // 2) 颜色原片齐全性（颜色顺序固定为快照首次出现顺序，输出与展示因此稳定）
  const colors = [];
  for (const t of tasks) if (!colors.includes(t.color)) colors.push(t.color);
  const missingColors = colors.filter((c) => !materials.has(c));
  if (missingColors.length) {
    return {
      ok: false, code: 'color_material_missing', status: 422,
      error: `缺少颜色 ${missingColors.join('、')} 的原片规格登记，整单不能排样`,
      missingColors,
    };
  }

  // 3) 单片可放入性（任一 90° 整数倍朝向能进入原片即可）
  for (const t of tasks) {
    const mat = materials.get(t.color);
    const b = bbox(t.polygon);
    const fit0 = b.width <= mat.width && b.height <= mat.height;
    const fit90 = b.width <= mat.height && b.height <= mat.width;
    if (!fit0 && !fit90) {
      return {
        ok: false, code: 'piece_too_large', status: 422,
        error: `拼片 #${t.pieceNo}（件次 ${t.copy}，${t.color}）轮廓 ${b.width}×${b.height} mm，` +
          `任何 90° 整数倍旋转都无法放入该色原片 ${mat.width}×${mat.height} mm，整单不能排样`,
        pieceNo: t.pieceNo, copy: t.copy, color: t.color,
        pieceWidth: b.width, pieceHeight: b.height,
        sheetWidth: mat.width, sheetHeight: mat.height,
      };
    }
  }

  // 4) 确定性排序：面积（2 倍整数面积）降序，大者优先；再按包围盒长边、片号、件次
  tasks.sort((a, b) => {
    const aa = Math.abs(area2x(a.polygon));
    const bb2 = Math.abs(area2x(b.polygon));
    if (aa !== bb2) return bb2 - aa;
    const ba = bbox(a.polygon), bbb = bbox(b.polygon);
    const ma = Math.max(ba.width, ba.height), mb = Math.max(bbb.width, bbb.height);
    if (ma !== mb) return mb - ma;
    if (a.pieceNo !== b.pieceNo) return a.pieceNo - b.pieceNo;
    return a.copy - b.copy;
  });

  // 5) 逐颜色首次适应（FFD）：依次试已有原片（每片在 0°/90° 两个包围盒等价类中
  //    选最低最左位置），第一张能容纳它的原片；都放不下开新原片
  const layoutColors = [];
  let totalSheets = 0;
  for (const color of colors) {
    const mat = materials.get(color);
    const board = { width: mat.width, height: mat.height };
    const colorTasks = tasks.filter((x) => x.color === color);
    // skyline 只关心轴对齐包围盒：0°/180°、90°/270° 的包围盒分别等价，
    // 各保留最小角度的一个变体（角度信息仍真实为 0° 或 90°）。
    function boxVariants(poly) {
      const out = [];
      const seen = new Set();
      for (const deg of ROTATIONS) {
        const v = rotatedVariant(poly, deg);
        const key = v.bw + 'x' + v.bh;
        if (!seen.has(key)) { seen.add(key); out.push(v); }
      }
      return out;
    }

    const boards = []; // [{ index, packer, placements }]
    let pieceCount = 0;

    for (const t of colorTasks) {
      const variants = boxVariants(t.polygon);
      // 首次适应（FFD）：按顺序放入第一张能容纳它的原片
      let choice = null;
      for (const bd of boards) {
        const found = bd.packer.findSpot(variants);
        if (found) { choice = { bd, found }; break; }
      }
      if (!choice) {
        const projected = totalSheets + boards.length + 1;
        if (projected > MAX_TOTAL_SHEETS) {
          return {
            ok: false, code: 'too_many_sheets', status: 422,
            error: `排样所需原片超过每单上限 ${MAX_TOTAL_SHEETS} 张，整单不能排样`,
            totalSheets: projected, maxSheets: MAX_TOTAL_SHEETS,
          };
        }
        const bd = { index: boards.length + 1, packer: makePacker(board, gap), placements: [] };
        const found = bd.packer.findSpot(variants);
        // 第 3 步已保证单片某朝向可入空板
        if (!found) {
          return { ok: false, code: 'piece_too_large', status: 422, error: '排样内部错误：单片无法入空板' };
        }
        boards.push(bd);
        choice = { bd, found };
      }
      const entry = choice.bd.packer.add(choice.found.variant, choice.found.spot);
      entry.pieceNo = t.pieceNo;
      entry.copy = t.copy;
      entry.color = color;
      choice.bd.placements.push(entry);
      pieceCount++;
    }

    totalSheets += boards.length;
    if (totalSheets > MAX_TOTAL_SHEETS) {
      return {
        ok: false, code: 'too_many_sheets', status: 422,
        error: `排样共需 ${totalSheets} 张原片，超过每单上限 ${MAX_TOTAL_SHEETS} 张，整单不能排样`,
        totalSheets, maxSheets: MAX_TOTAL_SHEETS,
      };
    }

    layoutColors.push({
      color,
      sheetWidth: mat.width,
      sheetHeight: mat.height,
      sheets: boards.length,
      pieceCount,
      boards: boards.map((bd) => ({
        index: bd.index,
        placements: bd.placements.map((p) => ({
          pieceNo: p.pieceNo,
          copy: p.copy,
          rotation: p.rotation,
          x: p.x,
          y: p.y,
          polygon: p.polygon,
          bbox: { x0: p.bbox.x0, y0: p.bbox.y0, x1: p.bbox.x1, y1: p.bbox.y1 },
        })),
      })),
    });
  }

  return {
    ok: true,
    layout: {
      gap,
      copies,
      totalSheets,
      totalPieces: tasks.length,
      colors: layoutColors,
    },
  };
}

function area2x(poly) {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return s;
}

module.exports = {
  MAX_SHEET_SIDE, MAX_GAP, MAX_TOTAL_SHEETS, COPIES_MAX, ROTATIONS,
  parseSheetSide, parseGap, parseCopies,
  rotatedVariant, bbox,
  pointSegDist2AtLeast, segSegDist2AtLeast, pairClearanceStrict, placementOK,
  planNesting,
};
