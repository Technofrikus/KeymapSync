# KeymapSync

KeymapSync keeps compatible keyboards aligned through shared character mappings and Vial configuration files.

## Language

**Alpha Mapping**:
A mapping from a base key to its corresponding symbol and number values for a keyboard target.
_Avoid_: character table, key translation

**Keymap State**:
The complete keyboard configuration represented in a Vial `.vil` document, including its layout and advanced key settings. A Keymap State retains its original UID when persisted.
_Avoid_: keyboard JSON, layout file
