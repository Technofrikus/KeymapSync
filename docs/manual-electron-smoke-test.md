# KeymapSync Electron and physical-keyboard smoke test

Run this checklist against a development build and one supported Vial keyboard before a release. Record the OS, Electron build, keyboard model/firmware, and result for each section. Use a disposable copy of the configuration and keep the initial backup until the final restore step.

## Preconditions

- Start the packaged Electron app with the keyboard connected and unlocked.
- Keep a plain-text editor available for physical key checks.
- Make a copy of the source configuration and note its UID, layer count, combos, tap dances, key overrides, and Vial settings.

## Backup and restore

1. Select the keyboard and load its current snapshot.
2. Choose **Download Current Config (.vil)** and save a backup with a unique name.
3. Verify the file is valid JSON/Vial data, contains the exact keyboard UID literal, and opens in Vial/Vitaly.
4. Leave the backup untouched until the end. Restore it through Vial/Vitaly and verify the keyboard returns to its starting state.

## Key override and selective apply

1. Add or edit one visible key override in the configuration (for example, a modifier replacement), then save.
2. Preview online sync and confirm the diff explicitly lists **Key Overrides** with the expected before/after values.
3. Uncheck Base & Layer Keys, Combos, and TapDance; leave only **Apply Key Overrides** selected.
4. Apply and take a fresh snapshot. Confirm layout, combos, tap dances, macros, layers, and unrelated settings are byte-for-byte unchanged while the selected override changed.
5. Test the overridden key physically in a plain-text editor, including the modifier behavior and the unmodified neighboring keys.

## Stale preview protection

1. Create a preview.
2. Change the keyboard out-of-band (for example, edit one key in Vial) and save it.
3. Press **Apply** in KeymapSync. It must refuse the write and request a new preview.
4. Preview again, then apply only the intended sections.

## Save, close, and failure flows

- Edit the configuration, close the window, choose **Save**, and confirm the file contains the edit and the app closes.
- Repeat and choose **Don't Save**. Confirm the edit is absent after reopening.
- Repeat and choose **Cancel**. Confirm the window remains open and the dirty edit remains visible.
- Make the target configuration read-only or otherwise force a write failure. Choose **Save** during close; confirm an error is shown, the window stays open, and dirty state is retained for another attempt.

## Dirty configuration switching

1. Edit configuration A without saving.
2. Pick configuration B. Confirm the app warns before discarding the edit (or allows saving it) and never writes A's in-memory content into B.
3. Reopen both files and verify A and B contain their original independent contents.

## Offline generation

1. Choose an input directory and a separate output directory.
2. Run **Offline Sync** after an edit; generation must save the active config first.
3. Confirm the generator completes, originals are unchanged, generated files contain the expected UID, and logs include the exit code.
4. Restore the initial keyboard backup and repeat the physical smoke check if the keyboard was modified.

## Release evidence

Attach the backup filename, keyboard/firmware details, screenshots or logs for any failure, and a completed checklist to the release record. A physical-keyboard test is not replaced by unit tests; rerun it after changes to IPC, transformation, online preview/apply, backup, or close/save behavior.
