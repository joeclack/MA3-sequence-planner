# MA3 2.5 acceptance checks

Use a disposable show file and the current data pool. These checks are pending a real MA3 runtime; do not mark them passed based on app tests.

1. Build a plan with cue 100, 100.1, 101, 200, and 1100, names containing quotes/Unicode, and multiline notes including a leading newline.
2. Put fixture values in the programmer; cancel the importer confirmation. Confirm no sequence is created and programmer content stays intact.
3. Choose an occupied sequence slot. Confirm the plugin refuses it without changing the existing sequence.
4. Choose an empty slot and confirm. Verify programmer is cleared; the new sequence has exactly the planned cues (plus MA3's automatic Zero/Off cues).
5. Verify all names and notes, including line breaks and Unicode. The plugin checks metadata through Get after setting it; any failure must be reported rather than silently skipped.
6. Verify no fixture values were captured into the planned cues.
7. Verify cues are sorted by their actual decimal value (100.11 before 100.2).
8. Verify sequence name, selected data pool, and no unintended executor assignments.
9. Run the plugin again in the same slot; confirm refusal.
10. Test Oops after import and verify what MA3 restores. Do not rely on restoration of programmer contents until verified.
11. Export the created plugin from MA3 for hardware transfer; import the resulting native XML + component files on a console and repeat the checks.

Supabase integration checks after configuration: sign in with two administrator-created users; ensure each sees only their own plans, can save/load multiline content, and cannot access another user's row via the Supabase API. Verify sign out and reload preserve only the intended local draft.
