/**
 * Validation for the user-editable alpha_layers.json format.
 *
 * The JSON schema beside this module is deliberately dependency-free and is
 * useful to editors and documentation tools.  Runtime validation is kept
 * here as a small, dependency-free implementation so neither the web app nor
 * the desktop shells need to ship a JSON-schema engine.
 */

import { MAX_EXTRA_LAYERS, MAX_LAYER_INDEX, getExtraLayers, isLayerId } from "./config-layers.js";
import { charToKeycode, isValidKeycode } from "./keycode-mapping.js";

const LANGUAGES = new Set(["de", "fr", "es", "en"]);
const OPERATING_SYSTEMS = new Set(["mac", "win", "linux"]);
const EXAMPLE_PROPERTIES = new Set([
  "comboOverrideExample",
  "tapDanceOverrideExample",
  "keyOverrideOverrideExample",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, pathName, message, keyword = "validation") {
  issues.push({ path: pathName, message, keyword });
}

function propertyPath(parent, property) {
  return parent ? `${parent}.${property}` : property;
}

function indexPath(parent, index) {
  return `${parent}[${index}]`;
}

function validKeycode(value, { allowLiteral = false } = {}) {
  if (typeof value !== "string" || value.length === 0 || /\s/u.test(value)) return false;
  if (allowLiteral && [...value].length === 1) return true;
  if (value === "NO" || value === "TRNS" || value === "TRANSPARENT") return true;

  // Bare QMK/custom keycodes.  Keep this intentionally broad enough for
  // board-defined USERxx and RGB/QK codes, while rejecting arbitrary prose.
  if (/^(?:KC_[A-Z0-9_]+|USER[0-9]+|RGB_[A-Z0-9_]+|QK_[A-Z0-9_]+|XXXX[A-Z0-9_]*)$/.test(value)) {
    return true;
  }

  // QMK expressions such as LALT(KC_BSPC), MT(MOD_LGUI,KC_H), and TD(Name).
  const open = value.indexOf("(");
  if (open <= 0 || !value.endsWith(")")) return false;
  const name = value.slice(0, open);
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return false;
  let depth = 0;
  for (let i = open + 1; i < value.length - 1; i += 1) {
    const char = value[i];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
    if (/[\s"']/u.test(char)) return false;
  }
  if (depth !== 0) return false;
  // Expression arguments may be comma-separated keycodes, modifiers, or a
  // named tap dance.  Reject punctuation that cannot occur in QMK syntax.
  return /^[A-Za-z0-9_,+*\-()]+$/.test(value.slice(open + 1, -1));
}

function validateString(value, issues, pathName, { keycode = false, literal = false, allowEmpty = false } = {}) {
  if (typeof value !== "string") {
    addIssue(issues, pathName, "must be a string", "type");
    return;
  }
  if (value.length === 0 && !allowEmpty) {
    addIssue(issues, pathName, "must not be empty", "minLength");
    return;
  }
  if (value.length === 0) return;
  if (/\s/u.test(value)) {
    addIssue(issues, pathName, "must not contain whitespace", "pattern");
    return;
  }
  if (keycode && !validKeycode(value, { allowLiteral: literal })) {
    addIssue(issues, pathName, `is not a valid keycode: ${value}`, "keycode");
  }
}

function validateTarget(target, issues) {
  const p = "target";
  if (!isObject(target)) {
    addIssue(issues, p, "must be an object", "type");
    return;
  }
  for (const key of Object.keys(target)) {
    if (key !== "language" && key !== "os") addIssue(issues, propertyPath(p, key), "is not allowed", "additionalProperties");
  }
  if (!LANGUAGES.has(target.language)) addIssue(issues, `${p}.language`, "must be one of de, fr, es, en", "enum");
  if (!OPERATING_SYSTEMS.has(target.os)) addIssue(issues, `${p}.os`, "must be one of mac, win, linux", "enum");
}

function validateExtraLayers(layers, issues) {
  const p = "layers";
  for (const key of Object.keys(layers)) {
    if (key !== "alpha" && key !== "extra") addIssue(issues, propertyPath(p, key), "is not allowed together with layers.extra", "additionalProperties");
  }
  if (!Number.isInteger(layers.alpha) || layers.alpha < 0) addIssue(issues, `${p}.alpha`, "is required and must be a non-negative integer", "required");
  const ep = `${p}.extra`;
  if (layers.extra.length < 1 || layers.extra.length > MAX_EXTRA_LAYERS) {
    addIssue(issues, ep, `must contain between 1 and ${MAX_EXTRA_LAYERS} layers`, "items");
  }
  const ids = new Set();
  const indices = new Set([layers.alpha]);
  layers.extra.forEach((layer, i) => {
    const lp = indexPath(ep, i);
    if (!isObject(layer)) {
      addIssue(issues, lp, "must be an object", "type");
      return;
    }
    for (const field of Object.keys(layer)) {
      if (!["id", "name", "index"].includes(field)) addIssue(issues, propertyPath(lp, field), "is not allowed", "additionalProperties");
    }
    if (!isLayerId(layer.id)) addIssue(issues, `${lp}.id`, "must look like layer1, layer2, ...", "pattern");
    else if (ids.has(layer.id)) addIssue(issues, `${lp}.id`, `duplicates another layer id: ${layer.id}`, "unique");
    else ids.add(layer.id);
    if (typeof layer.name !== "string" || layer.name.trim() === "" || layer.name.length > 40) {
      addIssue(issues, `${lp}.name`, "must be a non-empty string of at most 40 characters", "type");
    }
    if (!Number.isInteger(layer.index) || layer.index < 0 || layer.index > MAX_LAYER_INDEX) {
      addIssue(issues, `${lp}.index`, `must be an integer from 0 to ${MAX_LAYER_INDEX}`, "range");
    } else if (indices.has(layer.index)) {
      addIssue(issues, `${lp}.index`, "must differ from the alpha layer and every other layer", "unique");
    } else indices.add(layer.index);
  });
}

function validateLayers(layers, issues) {
  const p = "layers";
  if (!isObject(layers)) {
    addIssue(issues, p, "must be an object", "type");
    return;
  }
  if (layers.extra !== undefined) {
    if (!Array.isArray(layers.extra)) addIssue(issues, `${p}.extra`, "must be an array", "type");
    else validateExtraLayers(layers, issues);
    return;
  }
  const allowed = new Set(["alpha", "symbol", "symbols", "number", "numbers"]);
  for (const key of Object.keys(layers)) {
    if (!allowed.has(key)) addIssue(issues, propertyPath(p, key), "is not allowed", "additionalProperties");
    else if (!Number.isInteger(layers[key]) || layers[key] < 0) addIssue(issues, propertyPath(p, key), "must be a non-negative integer", "minimum");
  }
  if (!Number.isInteger(layers.alpha) || layers.alpha < 0) addIssue(issues, `${p}.alpha`, "is required and must be a non-negative integer", "required");
  for (const [primary, alias] of [["symbol", "symbols"], ["number", "numbers"]]) {
    if (layers[primary] !== undefined && layers[alias] !== undefined && layers[primary] !== layers[alias]) {
      addIssue(issues, p, `${primary} and ${alias} must have the same value`, "conflict");
    }
    if (layers[primary] === undefined && layers[alias] === undefined) addIssue(issues, p, `requires ${primary} (or ${alias})`, "required");
  }
  const indices = [layers.alpha, layers.symbol ?? layers.symbols, layers.number ?? layers.numbers];
  if (indices.every((index) => Number.isInteger(index) && index >= 0) && new Set(indices).size !== indices.length) {
    addIssue(issues, p, "alpha, symbol, and number layer indices must be distinct", "unique");
  }
}

// Layer values may also use the editor's friendly names, e.g. Left, Alt+Bksp, MO1.
function validLayerValue(value) {
  return validKeycode(value, { allowLiteral: true }) || isValidKeycode(charToKeycode(value));
}

function validateAlphaMappings(mappings, issues, layerIds) {
  const p = "alphaMappings";
  if (!isObject(mappings)) {
    addIssue(issues, p, "must be an object", "type");
    return;
  }
  for (const [key, mapping] of Object.entries(mappings)) {
    const mp = propertyPath(p, key);
    if (!isObject(mapping)) {
      addIssue(issues, mp, "must be an object", "type");
      continue;
    }
    for (const field of Object.keys(mapping)) {
      if (field === "base" || field === "aliases") continue;
      if (!layerIds.has(field)) {
        addIssue(issues, propertyPath(mp, field), isLayerId(field) ? "refers to a layer that is not defined in layers" : "is not allowed", "additionalProperties");
        continue;
      }
      const value = mapping[field];
      if (value === undefined || value === null) continue;
      validateString(value, issues, propertyPath(mp, field), { allowEmpty: true });
      if (typeof value === "string" && value !== "" && !/\s/u.test(value) && !validLayerValue(value)) {
        addIssue(issues, propertyPath(mp, field), `is not a valid keycode: ${value}`, "keycode");
      }
    }
    if (mapping.base !== undefined && mapping.base !== null) validateString(mapping.base, issues, propertyPath(mp, "base"), { keycode: true, literal: true });
    if (mapping.aliases !== undefined) {
      if (!Array.isArray(mapping.aliases)) addIssue(issues, propertyPath(mp, "aliases"), "must be an array", "type");
      else mapping.aliases.forEach((alias, index) => validateString(alias, issues, indexPath(propertyPath(mp, "aliases"), index), { keycode: true, literal: true }));
    }
  }
}

function validateCombos(combos, issues) {
  const p = "comboOverrides";
  if (combos === undefined) return;
  if (!Array.isArray(combos)) {
    addIssue(issues, p, "must be an array", "type");
    return;
  }
  combos.forEach((combo, index) => {
    const cp = indexPath(p, index);
    if (!isObject(combo)) {
      addIssue(issues, cp, "must be an object", "type");
      return;
    }
    for (const field of Object.keys(combo)) if (field !== "keys" && field !== "result") addIssue(issues, propertyPath(cp, field), "is not allowed", "additionalProperties");
    if (!Array.isArray(combo.keys)) addIssue(issues, `${cp}.keys`, "must be an array", "type");
    else {
      if (combo.keys.length < 1 || combo.keys.length > 4) addIssue(issues, `${cp}.keys`, "must contain between 1 and 4 keys", "items");
      const seen = new Set();
      combo.keys.forEach((key, keyIndex) => {
        const kp = indexPath(`${cp}.keys`, keyIndex);
        validateString(key, issues, kp, { keycode: true, literal: true });
        if (seen.has(key)) addIssue(issues, kp, "duplicates another key in this combo", "uniqueItems");
        seen.add(key);
      });
    }
    validateString(combo.result, issues, `${cp}.result`, { keycode: true, literal: true });
  });
}

function validateTapDances(tapDances, issues) {
  const p = "tapDanceOverrides";
  if (tapDances === undefined) return;
  if (!Array.isArray(tapDances)) {
    addIssue(issues, p, "must be an array", "type");
    return;
  }
  const names = new Map();
  tapDances.forEach((tapDance, index) => {
    const tp = indexPath(p, index);
    if (!isObject(tapDance)) {
      addIssue(issues, tp, "must be an object", "type");
      return;
    }
    const allowed = new Set(["name", "trigger", "tap", "hold", "doubleTap", "tapHold", "term"]);
    for (const field of Object.keys(tapDance)) if (!allowed.has(field)) addIssue(issues, propertyPath(tp, field), "is not allowed", "additionalProperties");
    if (typeof tapDance.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tapDance.name)) addIssue(issues, `${tp}.name`, "must be a valid unique tap-dance name", "pattern");
    else if (names.has(tapDance.name)) addIssue(issues, `${tp}.name`, `duplicates ${indexPath(p, names.get(tapDance.name))}.name`, "unique");
    else names.set(tapDance.name, index);
    for (const field of ["trigger", "tap", "hold", "doubleTap", "tapHold"]) {
      if (tapDance[field] !== undefined) {
        validateString(tapDance[field], issues, propertyPath(tp, field), {
          keycode: true,
          literal: true,
          // Empty optional actions represent unused Vial tap-dance slots and
          // are normalized to KC_NO by the transformer.
          allowEmpty: field === "doubleTap" || field === "tapHold",
        });
      }
    }
    for (const field of ["tap", "hold"]) if (tapDance[field] === undefined) addIssue(issues, propertyPath(tp, field), "is required", "required");
    if (tapDance.term !== undefined && (!Number.isInteger(tapDance.term) || tapDance.term < 0 || tapDance.term > 65535)) addIssue(issues, `${tp}.term`, "must be an integer from 0 to 65535", "range");
  });
  return names;
}

function validateKeyOverrides(overrides, issues) {
  const p = "keyOverrideOverrides";
  if (overrides === undefined) return;
  if (!Array.isArray(overrides)) {
    addIssue(issues, p, "must be an array", "type");
    return;
  }
  const integerFields = ["layers", "trigger_mods", "negative_mod_mask", "suppressed_mods", "options"];
  overrides.forEach((override, index) => {
    const op = indexPath(p, index);
    if (!isObject(override)) {
      addIssue(issues, op, "must be an object", "type");
      return;
    }
    const allowed = new Set(["trigger", "replacement", ...integerFields]);
    for (const field of Object.keys(override)) if (!allowed.has(field)) addIssue(issues, propertyPath(op, field), "is not allowed; use the Vial key_override field name", "additionalProperties");
    validateString(override.trigger, issues, `${op}.trigger`, { keycode: true, literal: true });
    validateString(override.replacement, issues, `${op}.replacement`, { keycode: true, literal: true });
    for (const field of integerFields) if (override[field] !== undefined && (!Number.isInteger(override[field]) || override[field] < 0)) addIssue(issues, propertyPath(op, field), "must be a non-negative integer", "minimum");
  });
}

function visitStrings(value, pathName, callback) {
  if (typeof value === "string") callback(value, pathName);
  else if (Array.isArray(value)) value.forEach((item, index) => visitStrings(item, indexPath(pathName, index), callback));
  else if (isObject(value)) Object.entries(value).forEach(([key, item]) => visitStrings(item, propertyPath(pathName, key), callback));
}

function validateTapDanceReferences(config, names, issues) {
  if (!(names instanceof Map)) return;
  visitStrings(config, "", (value, pathName) => {
    const pattern = /TD\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      if (!names.has(match[1])) addIssue(issues, pathName || "config", `references unresolved tap dance: ${match[1]}`, "reference");
    }
  });
}

function configLayerIds(config) {
  if (isObject(config.layers) && Array.isArray(config.layers.extra)) {
    return new Set(config.layers.extra.filter((layer) => isObject(layer) && isLayerId(layer.id)).map((layer) => layer.id));
  }
  return new Set(getExtraLayers(config).map((layer) => layer.id));
}

function validateConfig(value) {
  const issues = [];
  if (!isObject(value)) {
    addIssue(issues, "", "configuration must be an object", "type");
    return { valid: false, issues };
  }
  const allowed = new Set([
    "mappingsVersion", "target", "layers", "alphaMappings", "comboOverrides",
    "tapDanceOverrides", "keyOverrideOverrides", ...EXAMPLE_PROPERTIES,
  ]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) addIssue(issues, key, "is not allowed", "additionalProperties");
  if (value.mappingsVersion !== undefined && (!Number.isInteger(value.mappingsVersion) || value.mappingsVersion < 1)) addIssue(issues, "mappingsVersion", "must be a positive integer", "minimum");
  if (value.target === undefined) addIssue(issues, "target", "is required", "required"); else validateTarget(value.target, issues);
  if (value.layers === undefined) addIssue(issues, "layers", "is required", "required"); else validateLayers(value.layers, issues);
  if (value.alphaMappings === undefined) addIssue(issues, "alphaMappings", "is required", "required"); else validateAlphaMappings(value.alphaMappings, issues, configLayerIds(value));
  validateCombos(value.comboOverrides, issues);
  let names = new Map();
  if (value.tapDanceOverrides !== undefined) names = validateTapDances(value.tapDanceOverrides, issues);
  validateKeyOverrides(value.keyOverrideOverrides, issues);
  validateTapDanceReferences(value, names, issues);
  for (const property of EXAMPLE_PROPERTIES) if (value[property] !== undefined && (!Array.isArray(value[property]) || value[property].some((item) => !isObject(item)))) addIssue(issues, property, "must be an array of example objects", "type");
  return { valid: issues.length === 0, issues };
}

class ConfigValidationError extends Error {
  constructor(source, issues) {
    const label = source ? ` in ${source}` : "";
    const detail = issues.map((issue) => `${issue.path || "config"}: ${issue.message}`).join("; ");
    super(`Invalid configuration${label}: ${detail}`);
    this.name = "ConfigValidationError";
    this.source = source;
    this.issues = issues;
  }
}

function assertValidConfig(value, source = "configuration") {
  const result = validateConfig(value);
  if (!result.valid) throw new ConfigValidationError(source, result.issues);
  return value;
}

function parseConfig(text, source = "configuration") {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ConfigValidationError(source, [{ path: "", message: `invalid JSON: ${error.message}`, keyword: "json" }]);
  }
  return assertValidConfig(value, source);
}

export {
  ConfigValidationError,
  validateConfig,
  parseConfig,
  assertValidConfig,
  validKeycode,
};
