/**
 * KLE (Keyboard Layout Editor) parser — ported from pipette-desktop kle-parser.ts
 * @license GPL-2.0-or-later
 */
(function (global) {
  const labelMap = [
    [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
    [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
    [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
    [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
    [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
    [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
    [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
    [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
  ];

  function reorderLabels(labels, align) {
    const ret = new Array(12).fill(null);
    const mapping = labelMap[align];
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== undefined && labels[i] !== null && labels[i] !== '') {
        const pos = mapping[i];
        if (pos >= 0) ret[pos] = labels[i];
      }
    }
    return ret;
  }

  function parsePairLabel(value) {
    if (!value || !String(value).includes(',')) return null;
    const parts = String(value).split(',');
    if (parts.length < 2) return null;
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { a, b };
  }

  function parseKeyLabels(key, rawLabels) {
    const isEncoder = rawLabels[4] === 'e' || key.labels[4] === 'e';
    const matrixPair = parsePairLabel(rawLabels[0]) || parsePairLabel(key.labels[0]);
    if (isEncoder) {
      if (matrixPair) {
        key.encoderIdx = matrixPair.a;
        key.encoderDir = matrixPair.b;
      }
    } else if (key.decal || matrixPair) {
      if (matrixPair) {
        key.row = matrixPair.a;
        key.col = matrixPair.b;
      }
    }

    // Prefer raw slot 8 (Vial convention), but accept reordered slot 8 if needed.
    const layoutPair = parsePairLabel(rawLabels[8]) || parsePairLabel(key.labels[8]);
    if (layoutPair) {
      key.layoutIndex = layoutPair.a;
      key.layoutOption = layoutPair.b;
    }
  }

  function parseKle(rows) {
    const keys = [];
    let currentX = 0;
    let currentY = 0;
    let currentWidth = 1;
    let currentHeight = 1;
    let currentX2 = 0;
    let currentY2 = 0;
    let currentWidth2 = 0;
    let currentHeight2 = 0;
    let currentRotation = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;
    let currentColor = '#cccccc';
    let currentNub = false;
    let currentStepped = false;
    let currentDecal = false;
    let currentGhost = false;
    let currentTextColor = new Array(12).fill(null);
    let currentTextSize = [];
    let clusterX = 0;
    let clusterY = 0;
    let align = 4;
    let defaultTextColor = '#000000';
    let defaultTextSize = 3;

    for (const row of rows) {
      if (!Array.isArray(row)) continue;

      for (let k = 0; k < row.length; k++) {
        const item = row[k];

        if (typeof item === 'string') {
          const width2 = currentWidth2 === 0 ? currentWidth : currentWidth2;
          const height2 = currentHeight2 === 0 ? currentHeight : currentHeight2;

          const rawLabels = item.split('\n');
          const labels = reorderLabels(rawLabels, align);
          const textSize = reorderLabels(currentTextSize, align);

          const cleanTextColor = [...currentTextColor];
          const cleanTextSize = [...textSize];
          for (let i = 0; i < 12; i++) {
            if (labels[i] === null || labels[i] === undefined) {
              cleanTextSize[i] = null;
              cleanTextColor[i] = null;
            }
            if (cleanTextSize[i] === defaultTextSize) cleanTextSize[i] = null;
            if (cleanTextColor[i] === defaultTextColor) cleanTextColor[i] = null;
          }

          const newKey = {
            x: currentX,
            y: currentY,
            width: currentWidth,
            height: currentHeight,
            x2: currentX2,
            y2: currentY2,
            width2,
            height2,
            rotation: currentRotation,
            rotationX: currentRotationX,
            rotationY: currentRotationY,
            color: currentColor,
            labels,
            textColor: cleanTextColor,
            textSize: cleanTextSize,
            row: 0,
            col: 0,
            encoderIdx: -1,
            encoderDir: -1,
            layoutIndex: -1,
            layoutOption: -1,
            decal: currentDecal,
            nub: currentNub,
            stepped: currentStepped,
            ghost: currentGhost,
          };

          parseKeyLabels(newKey, rawLabels);
          keys.push(newKey);

          currentX += currentWidth;
          currentWidth = 1;
          currentHeight = 1;
          currentX2 = 0;
          currentY2 = 0;
          currentWidth2 = 0;
          currentHeight2 = 0;
          currentNub = false;
          currentStepped = false;
          currentDecal = false;
        } else if (typeof item === 'object' && item !== null) {
          const props = item;
          if (k !== 0 && ('r' in props || 'rx' in props || 'ry' in props)) {
            throw new Error('Rotation can only be specified on the first key in a row');
          }
          if (props.r !== undefined) currentRotation = props.r;
          if (props.rx !== undefined) {
            currentRotationX = props.rx;
            clusterX = props.rx;
            currentX = clusterX;
            currentY = clusterY;
          }
          if (props.ry !== undefined) {
            currentRotationY = props.ry;
            clusterY = props.ry;
            currentX = clusterX;
            currentY = clusterY;
          }
          if (props.a !== undefined) align = props.a;
          if (props.f !== undefined) {
            defaultTextSize = props.f;
            currentTextSize = [];
          }
          if (props.f2 !== undefined) {
            for (let i = 1; i < 12; i++) currentTextSize[i] = props.f2;
          }
          if (props.fa !== undefined) currentTextSize = props.fa;
          if (props.c !== undefined) currentColor = props.c;
          if (props.t !== undefined) {
            const split = props.t.split('\n');
            if (split[0] !== '') defaultTextColor = split[0];
            currentTextColor = reorderLabels(split, align);
          }
          if (props.x !== undefined) currentX += props.x;
          if (props.y !== undefined) currentY += props.y;
          if (props.w !== undefined) {
            currentWidth = props.w;
            currentWidth2 = props.w;
          }
          if (props.h !== undefined) {
            currentHeight = props.h;
            currentHeight2 = props.h;
          }
          if (props.x2 !== undefined) currentX2 = props.x2;
          if (props.y2 !== undefined) currentY2 = props.y2;
          if (props.w2 !== undefined) currentWidth2 = props.w2;
          if (props.h2 !== undefined) currentHeight2 = props.h2;
          if (props.n !== undefined) currentNub = props.n;
          if (props.l !== undefined) currentStepped = props.l;
          if (props.d !== undefined) currentDecal = props.d;
          if (props.g !== undefined && props.g) currentGhost = true;
        }
      }
      currentY += 1;
      currentX = currentRotationX;
    }

    return { keys };
  }

  global.parseKle = parseKle;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseKle };
  }
})(typeof window !== 'undefined' ? window : global);
