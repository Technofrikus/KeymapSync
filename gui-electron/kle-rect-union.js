/**
 * Boolean union of two axis-aligned rounded rectangles → SVG path (pipette rect-union.ts).
 * Used for ISO / stepped Enter — not the DisplayKeyboard L-polygon shortcut.
 * @license GPL-2.0-or-later
 */
(function (global) {
  const GRID_SNAP_EPSILON = 1e-6;

  const STEP_COL = [1, 0, -1, 0];
  const STEP_ROW = [0, 1, 0, -1];

  const INTERIOR_OFFSET = [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, -1],
  ];
  const EXTERIOR_OFFSET = [
    [0, -1],
    [0, 0],
    [-1, 0],
    [-1, -1],
  ];

  const TURN_ORDER = [1, 0, 3, 2];

  function snapClose(arr) {
    if (arr.length < 2) return arr;
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] - result[result.length - 1] >= GRID_SNAP_EPSILON) {
        result.push(arr[i]);
      }
    }
    return result;
  }

  function computeUnionPolygon(ax, ay, aw, ah, bx, by, bw, bh) {
    const r1l = ax;
    const r1t = ay;
    const r1r = ax + aw;
    const r1b = ay + ah;
    const r2l = bx;
    const r2t = by;
    const r2r = bx + bw;
    const r2b = by + bh;

    if (r1r <= r2l || r2r <= r1l || r1b <= r2t || r2b <= r1t) return [];

    const xs = snapClose([...new Set([r1l, r1r, r2l, r2r])].sort((a, b) => a - b));
    const ys = snapClose([...new Set([r1t, r1b, r2t, r2b])].sort((a, b) => a - b));
    const cols = xs.length - 1;
    const rows = ys.length - 1;

    function filled(c, r) {
      if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
      const mx = (xs[c] + xs[c + 1]) / 2;
      const my = (ys[r] + ys[r + 1]) / 2;
      return (
        (mx > r1l && mx < r1r && my > r1t && my < r1b) ||
        (mx > r2l && mx < r2r && my > r2t && my < r2b)
      );
    }

    let startCol = -1;
    let startRow = -1;
    for (let r = 0; r < rows && startCol === -1; r++) {
      for (let c = 0; c < cols; c++) {
        if (filled(c, r) && !filled(c, r - 1)) {
          startCol = c;
          startRow = r;
          break;
        }
      }
    }
    if (startCol === -1) return [];

    const raw = [];
    let col = startCol;
    let row = startRow;
    let dir = 0;

    do {
      raw.push([xs[col], ys[row]]);

      let moved = false;
      for (const turn of TURN_ORDER) {
        const nd = (dir + turn) % 4;
        const [ic, ir] = INTERIOR_OFFSET[nd];
        const [ec, er] = EXTERIOR_OFFSET[nd];
        if (filled(col + ic, row + ir) && !filled(col + ec, row + er)) {
          dir = nd;
          col += STEP_COL[nd];
          row += STEP_ROW[nd];
          moved = true;
          break;
        }
      }
      if (!moved) break;
    } while (!(col === startCol && row === startRow) && raw.length < (cols + rows) * 4);

    return removeCollinear(raw);
  }

  function removeCollinear(verts) {
    const n = verts.length;
    if (n <= 3) return verts;
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n];
      const curr = verts[i];
      const next = verts[(i + 1) % n];
      const cross =
        (curr[0] - prev[0]) * (next[1] - curr[1]) - (curr[1] - prev[1]) * (next[0] - curr[0]);
      if (Math.abs(cross) > 1e-10) out.push(curr);
    }
    return out;
  }

  function polygonToSvgPath(vertices, r) {
    const n = vertices.length;
    if (n < 3) return '';

    const arcs = vertices.map((curr, i) => {
      const prev = vertices[(i - 1 + n) % n];
      const next = vertices[(i + 1) % n];

      const dx1 = curr[0] - prev[0];
      const dy1 = curr[1] - prev[1];
      const len1 = Math.hypot(dx1, dy1);

      const dx2 = next[0] - curr[0];
      const dy2 = next[1] - curr[1];
      const len2 = Math.hypot(dx2, dy2);

      const isConvex = dx1 * dy2 - dy1 * dx2 > 0;
      const maxR = Math.min(len1, len2) / 2;
      const actualR = isConvex ? Math.min(r, maxR) : 0;

      if (actualR <= 0) {
        return { sx: curr[0], sy: curr[1], ex: curr[0], ey: curr[1], r: 0 };
      }
      return {
        sx: curr[0] - (dx1 / len1) * actualR,
        sy: curr[1] - (dy1 / len1) * actualR,
        ex: curr[0] + (dx2 / len2) * actualR,
        ey: curr[1] + (dy2 / len2) * actualR,
        r: actualR,
      };
    });

    const parts = [`M ${arcs[0].ex} ${arcs[0].ey}`];
    for (let i = 1; i <= n; i++) {
      const a = arcs[i % n];
      parts.push(`L ${a.sx} ${a.sy}`);
      if (a.r > 0) {
        parts.push(`A ${a.r} ${a.r} 0 0 1 ${a.ex} ${a.ey}`);
      }
    }
    parts.push('Z');

    return parts.join(' ');
  }

  function insetAxisAlignedPolygon(verts, inset) {
    if (inset === 0) return verts;
    const n = verts.length;
    return verts.map((v, i) => {
      const prev = verts[(i - 1 + n) % n];
      const next = verts[(i + 1) % n];
      const dxIn = Math.sign(v[0] - prev[0]);
      const dyIn = Math.sign(v[1] - prev[1]);
      const dxOut = Math.sign(next[0] - v[0]);
      const dyOut = Math.sign(next[1] - v[1]);
      let ox = 0;
      let oy = 0;
      if (dxIn !== 0) oy = dxIn * inset;
      else ox = -dyIn * inset;
      if (dxOut !== 0) oy = dxOut * inset;
      else ox = -dyOut * inset;
      return [v[0] + ox, v[1] + oy];
    });
  }

  function computeUnionPath(ax, ay, aw, ah, bx, by, bw, bh, cornerRadius, inset) {
    const ins = inset || 0;
    const verts = computeUnionPolygon(ax, ay, aw, ah, bx, by, bw, bh);
    if (verts.length === 0) return '';
    return polygonToSvgPath(insetAxisAlignedPolygon(verts, ins), cornerRadius);
  }

  global.kleRectUnion = {
    computeUnionPolygon,
    computeUnionPath,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.kleRectUnion;
  }
})(typeof window !== 'undefined' ? window : global);
