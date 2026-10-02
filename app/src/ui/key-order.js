/* Display order of the alpha keys. Purely cosmetic: rules stay keyed by letter.
 * Each layout lists its rows; keys missing from every row go to "Other keys". */

const KEY_ORDERS = {
  qwerty: {
    label: 'QWERTY',
    rows: [['Top row', 'QWERTYUIOP'], ['Home row', "ASDFGHJKL;'"], ['Bottom row', 'ZXCVBNM,./-']],
  },
  dvorak: {
    label: 'Dvorak',
    rows: [['Top row', "',.PYFGCRL"], ['Home row', 'AOEUIDHTNS-'], ['Bottom row', ';QJKXBMWVZ/']],
  },
  colemak: {
    label: 'Colemak',
    rows: [['Top row', 'QWFPGJLUY;'], ['Home row', "ARSTDHNEIO'"], ['Bottom row', 'ZXCVBKM,./-']],
  },
  alphabetical: {
    label: 'Alphabetical',
    rows: [['A – I', 'ABCDEFGHI'], ['J – R', 'JKLMNOPQR'], ['S – Z', 'STUVWXYZ']],
  },
};

/** Keys of an alphaMappings object that represent real keys (no row spacers). */
function mappingKeys(alphaMappings) {
  return Object.keys(alphaMappings || {}).filter((key) => !key.startsWith('_row'));
}

/**
 * Splits keys into display groups for the chosen order.
 * @returns {{ name: string, keys: string[] }[]}
 */
function groupKeys(keys, order) {
  const layout = KEY_ORDERS[order] || KEY_ORDERS.qwerty;
  const remaining = new Set(keys);
  const groups = layout.rows.map(([name, row]) => {
    const rowKeys = [...row].filter((key) => remaining.has(key));
    rowKeys.forEach((key) => remaining.delete(key));
    return { name, keys: rowKeys };
  });
  const other = [...remaining].sort((a, b) => a.localeCompare(b));
  if (other.length) groups.push({ name: 'Other keys', keys: other });
  return groups.filter((group) => group.keys.length);
}

export { KEY_ORDERS, mappingKeys, groupKeys };
