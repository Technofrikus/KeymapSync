/* Vial definition (vial.json) of the simulated test keyboard, xz-compressed
 * the way Vial firmware stores it. Generated with Python's lzma.compress(). */
const DEFINITION = {
  "name": "Simulated Keyboard",
  "vendorId": "0xFEED",
  "productId": "0x0001",
  "matrix": {
    "rows": 2,
    "cols": 3
  },
  "layouts": {
    "labels": [
      "Split Backspace"
    ],
    "keymap": [
      [
        "0,0",
        "0,1",
        "0,2",
        "0,0\n\n\n\n\n\n\n\n\ne",
        "0,1\n\n\n\n\n\n\n\n\ne"
      ],
      [
        "1,0",
        "1,1",
        "1,2"
      ]
    ]
  }
};

const DEFINITION_XZ_BASE64 = [
  '/Td6WFoAAATm1rRGAgAhARYAAAB0L+Wj4ADwAKddAD2IicZUNsMXT+TmKauZYOUZvugtjhlwuvXM',
  'nSyxYAXKaNMM/u0gjEtjB382Iia16NfTqqMoG++5vbDcruvwsrtoHbGN7gslFoQtMQdWaPV+yNhI',
  'KWF9+qGWvnIOweXjLPkFauobhEJkNs2/Utw+8Bu66TMdqV7kwOB9p8qPn5CkWU1yfhft59RloUQn',
  'BGTDlW0+OJCGXJT+5cTjk1iHlzxrM8bUW1sAAACSOseBnCCQkwABwwHxAQAAgopRVrHEZ/sCAAAA',
  'AARZWg==',
].join('');

export { DEFINITION, DEFINITION_XZ_BASE64 };
