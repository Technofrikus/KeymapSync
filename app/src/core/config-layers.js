/**
 * Extra layers of an Alpha Mapping config.
 *
 * Current format: `layers.extra` lists the layers filled from the alpha keys,
 * each with a stable `id` (the field name used in every alpha mapping), a
 * display `name`, and the keyboard layer `index` it writes to:
 *
 *   "layers": { "alpha": 0, "extra": [{ "id": "layer1", "name": "Symbols", "index": 1 }, ...] }
 *   "alphaMappings": { "Q": { "layer1": "°", "layer2": "NO", "layer3": "Left" } }
 *
 * Legacy format (still accepted): `layers.symbol` / `layers.number` with the
 * fixed mapping fields `layer1` / `layer2`.
 */

const LAYER_ID_PATTERN = /^layer[1-9][0-9]*$/;
const MAX_LAYER_INDEX = 31;
const MAX_EXTRA_LAYERS = 16;

function isLayerId(value) {
  return typeof value === "string" && LAYER_ID_PATTERN.test(value);
}

/** Extra layers in display order, for either config format. */
function getExtraLayers(config) {
  const layers = config?.layers || {};
  if (Array.isArray(layers.extra)) {
    return layers.extra.map((layer) => ({ id: layer.id, name: layer.name, index: layer.index }));
  }
  return [
    { id: "layer1", name: "Symbols", index: layers.symbol ?? layers.symbols ?? 1 },
    { id: "layer2", name: "Numbers", index: layers.number ?? layers.numbers ?? 2 },
  ];
}

/** First `layerN` id not used by any of the given layers. */
function nextLayerId(extraLayers) {
  const used = new Set(extraLayers.map((layer) => layer.id));
  let n = 1;
  while (used.has(`layer${n}`)) n += 1;
  return `layer${n}`;
}

/** Lowest keyboard layer index not used by the alpha layer or another extra layer. */
function nextLayerIndex(alphaIndex, extraLayers) {
  const used = new Set([alphaIndex, ...extraLayers.map((layer) => layer.index)]);
  let index = 0;
  while (used.has(index)) index += 1;
  return index;
}

/**
 * Returns a copy of `config` in the current format, or `config` itself when
 * nothing changes.  Empty layer values ("") are written as "NO": both clear
 * the key, and the editor uses an empty field for "leave the key unchanged".
 */
function upgradeConfig(config) {
  if (!config || typeof config !== "object" || !config.layers || typeof config.layers !== "object") return config;
  const legacy = !Array.isArray(config.layers.extra);
  const extra = getExtraLayers(config);
  const ids = extra.map((layer) => layer.id);
  const mappings = config.alphaMappings && typeof config.alphaMappings === "object" ? config.alphaMappings : null;
  const hasEmpty = mappings && Object.values(mappings).some((mapping) => (
    mapping && typeof mapping === "object" && ids.some((id) => mapping[id] === "")
  ));
  if (!legacy && !hasEmpty) return config;

  const next = { ...config };
  if (legacy) next.layers = { alpha: config.layers.alpha ?? 0, extra };
  if (hasEmpty) {
    next.alphaMappings = Object.fromEntries(Object.entries(mappings).map(([key, mapping]) => {
      if (!mapping || typeof mapping !== "object") return [key, mapping];
      const copy = { ...mapping };
      for (const id of ids) if (copy[id] === "") copy[id] = "NO";
      return [key, copy];
    }));
  }
  return next;
}

export {
  LAYER_ID_PATTERN,
  MAX_LAYER_INDEX,
  MAX_EXTRA_LAYERS,
  isLayerId,
  getExtraLayers,
  nextLayerId,
  nextLayerIndex,
  upgradeConfig,
};
