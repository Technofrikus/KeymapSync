/**
 * Layout options decode + KLE visibility — ported from pipette-desktop
 * @license GPL-2.0-or-later
 */
(function (global) {
  function decodeLayoutOptions(options, labels) {
    const result = new Map();
    if (options < 0 || !labels || !labels.length) return result;
    let bitPos = 0;
    for (let idx = labels.length - 1; idx >= 0; idx--) {
      const label = labels[idx];
      const numChoices = typeof label === 'string' ? 2 : label.length - 1;
      const numBits = numChoices <= 1 ? 0 : 32 - Math.clz32(numChoices - 1);
      const mask = (1 << numBits) - 1;
      result.set(idx, (options >>> bitPos) & mask);
      bitPos += numBits;
    }
    return result;
  }

  function hasSecondaryRect(key) {
    return (
      key.width2 !== key.width ||
      key.height2 !== key.height ||
      key.x2 !== 0 ||
      key.y2 !== 0
    );
  }

  function visualMinPos(key) {
    const corners = [
      [key.x, key.y],
      [key.x + key.width, key.y],
      [key.x + key.width, key.y + key.height],
      [key.x, key.y + key.height],
    ];
    if (hasSecondaryRect(key)) {
      corners.push(
        [key.x + key.x2, key.y + key.y2],
        [key.x + key.x2 + key.width2, key.y + key.y2],
        [key.x + key.x2 + key.width2, key.y + key.y2 + key.height2],
        [key.x + key.x2, key.y + key.y2 + key.height2],
      );
    }
    const rad = (key.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = key.rotationX;
    const cy = key.rotationY;
    let minX = Infinity;
    let minY = Infinity;
    for (const [px, py] of corners) {
      const dx = px - cx;
      const dy = py - cy;
      const rx = cx + dx * cos - dy * sin;
      const ry = cy + dx * sin + dy * cos;
      if (rx < minX) minX = rx;
      if (ry < minY) minY = ry;
    }
    return { x: minX, y: minY };
  }

  function repositionLayoutKeys(keys, layoutOptions) {
    if (!layoutOptions || layoutOptions.size === 0) return keys;

    const minPos = new Map();
    for (const key of keys) {
      if (key.layoutIndex < 0) continue;
      const id = `${key.layoutIndex},${key.layoutOption}`;
      const vMin = visualMinPos(key);
      const cur = minPos.get(id);
      if (!cur) {
        minPos.set(id, { x: vMin.x, y: vMin.y });
      } else {
        if (vMin.x < cur.x) cur.x = vMin.x;
        if (vMin.y < cur.y) cur.y = vMin.y;
      }
    }

    let needsShift = false;
    for (const [, opt] of layoutOptions) {
      if (opt !== 0) {
        needsShift = true;
        break;
      }
    }
    if (!needsShift) return keys;

    let changed = false;
    const result = keys.map((key) => {
      if (key.layoutIndex < 0) return key;
      const selectedOpt = layoutOptions.get(key.layoutIndex) ?? 0;
      if (selectedOpt === 0) return key;
      if (key.layoutOption !== selectedOpt) return key;

      const opt0Min = minPos.get(`${key.layoutIndex},0`);
      const optMin = minPos.get(`${key.layoutIndex},${selectedOpt}`);
      if (!opt0Min || !optMin) return key;

      const dx = opt0Min.x - optMin.x;
      const dy = opt0Min.y - optMin.y;
      if (dx === 0 && dy === 0) return key;

      changed = true;
      return {
        ...key,
        x: key.x + dx,
        y: key.y + dy,
        rotationX: key.rotationX + dx,
        rotationY: key.rotationY + dy,
      };
    });

    return changed ? result : keys;
  }

  /**
   * Drop pure decorative decals; keep decals that carry a matrix position (row,col) — some
   * firmware exports use "d" for thumb keys. If a layout option decodes wrong and hides all
   * keys for an index, fall back to layoutOption 0 for that index.
   */
  function filterVisibleKeys(keys, layoutOptions) {
    const hasMatrixPos = (key) => {
      const l0 = key.labels && key.labels[0];
      return l0 != null && String(l0).includes(',');
    };

    const baseKeys = keys.filter((key) => {
      if (!key.decal) return true;
      return hasMatrixPos(key);
    });

    const filtered = baseKeys.filter((key) => {
      if (key.layoutIndex < 0) return true;
      if (!layoutOptions || layoutOptions.size === 0) return true;
      const selectedOption = layoutOptions.get(key.layoutIndex);
      if (selectedOption === undefined) return key.layoutOption === 0;
      return key.layoutOption === selectedOption;
    });

    const countByIdx = new Map();
    for (const k of filtered) {
      if (k.layoutIndex >= 0) {
        countByIdx.set(k.layoutIndex, (countByIdx.get(k.layoutIndex) || 0) + 1);
      }
    }

    const merged = [...filtered];
    for (const k of baseKeys) {
      if (k.layoutIndex < 0 || k.layoutOption !== 0) continue;
      const cnt = countByIdx.get(k.layoutIndex) || 0;
      if (cnt > 0) continue;
      const anyForIdx = baseKeys.some((x) => x.layoutIndex === k.layoutIndex);
      if (anyForIdx && !merged.includes(k)) merged.push(k);
    }
    return merged;
  }

  /**
   * When layout option bitmasks cannot be decoded, pick exactly one variant per layout group:
   * option 0 for every layoutIndex present in the KLE. Matches pipette/Vial behavior when a
   * layout index is missing from the options map (undefined → treat as 0).
   * NEVER pass an empty Map into filterVisibleKeys — size===0 skips filtering and shows every
   * layoutOption variant at once (duplicated/exploded layout).
   */
  function buildLayoutOptionsDefaultMap(keys) {
    const m = new Map();
    if (!keys || !keys.length) return m;
    for (const key of keys) {
      if (key.layoutIndex >= 0) {
        m.set(key.layoutIndex, 0);
      }
    }
    return m;
  }

  function formatLayoutOptionsSummary(labels, map) {
    if (!labels || !labels.length || !map || map.size === 0) return '';
    const parts = [];
    for (let i = 0; i < labels.length; i++) {
      const sel = map.get(i);
      if (sel === undefined) continue;
      const label = labels[i];
      if (typeof label === 'string') {
        parts.push(`${label}: ${sel ? 'On' : 'Off'}`);
      } else if (Array.isArray(label) && label.length > 1) {
        const title = label[0];
        const optName = label[sel + 1] != null ? label[sel + 1] : String(sel);
        parts.push(`${title}: ${optName}`);
      }
    }
    return parts.join(' · ');
  }

  global.decodeLayoutOptions = decodeLayoutOptions;
  global.repositionLayoutKeys = repositionLayoutKeys;
  global.filterVisibleKeys = filterVisibleKeys;
  global.buildLayoutOptionsDefaultMap = buildLayoutOptionsDefaultMap;
  global.formatLayoutOptionsSummary = formatLayoutOptionsSummary;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      decodeLayoutOptions,
      repositionLayoutKeys,
      filterVisibleKeys,
      buildLayoutOptionsDefaultMap,
      formatLayoutOptionsSummary,
    };
  }
})(typeof window !== 'undefined' ? window : global);
