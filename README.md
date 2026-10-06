# Sequence Studio

A TypeScript + React planner for grandMA3 sequences. Vite builds a static app suitable for Vercel. Optional Supabase email/password login and owner-only cloud plans; no user-management UI.

## Run locally

Requires Node 22 or newer.

```sh
npm install
npm run dev
```

Open the address printed by Vite. `npm test` checks numbering, reordering, validation and export generation. `npm run build` checks TypeScript and builds `dist`.

## Planning

- Starts with an empty Christmas show: 11 scenes at 100, 200, … 1100.
- Edit the show title, sequence slot, scene names, scene starts and cue increments inline.
- Add cue numbers, titles and multiline operator notes. Changes save automatically in this browser after 350ms. Export JSON for backups; browser storage is not a cloud backup.
- Right-click a cue or use its three-dot menu to copy, duplicate, paste, move or delete it. Copied cues can be pasted into any scene.
- Drag a cue by its handle onto the boundary above another cue, the end of a scene, or a scene in the sidebar. Accessible move-up/down alternatives are in each cue menu.
- Adding, duplicating, pasting or moving cues renumbers **the whole affected scene**, using its start and increment. Cross-scene moves renumber both scenes. Explicitly edited cue numbers are retained until such an operation; editing a number sorts the cue into numeric order.
- Deleting a cue leaves a numbering gap. Use **Renumber** to close it.
- Scene starts must increase. Cue numbers are unique, with three decimal places at most; a scene cannot overlap the next scene's start. Operations that would overflow a scene are rejected without changing the plan.
- Undo/redo holds 50 draft changes during this browser session. For text fields, a change is committed on blur or Enter. Search matches numbers, titles and notes; clear search to drag reorder.
- Only one draft is stored per browser. New show and JSON/cloud load replace it; download a backup first. Cloud save is explicit, not automatic. Saving a loaded cloud plan updates that plan (last save wins across devices). JSON imports receive a new identity.

## Supabase

1. With automatic RLS enabled in Supabase, execute `supabase/schema.sql` in its SQL editor once. This creates the table, owner-access policies, and authenticated-role grants. The explicit RLS enable statement is compatible with automatic RLS and can safely run when RLS is already enabled.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using your `sb_publishable_...` key. Never put a secret key in a `VITE_` variable.
3. Restart Vite. In Supabase Authentication, create users in the dashboard and disable public signup if you want administrator-created accounts only. Configure passwords in Supabase.
4. Click **Cloud plans** to sign in, **Save current plan** to upload, and **Refresh plans** to load your saved plans.

Automatic RLS enables row-level security; it does not create access policies. The included policies enforce `auth.uid() = user_id` on reads and writes, and explicit grants allow authenticated users to access the table through those policies. Supabase account credentials are handled by the client SDK; plans remain private to their owner. Drafts and persisted auth sessions remain on the browser device; sign out on shared devices and remove local browser data when needed.

## Vercel

Import this repository in Vercel; choose the Vite framework preset. Build: `npm run build`; output: `dist`. `vercel.json` supplies these settings. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel's environment settings, then deploy. Vite embeds these public settings at build time, so redeploy after changing them. Without settings, the app still works as a local planner.

## Export to grandMA3

Click **Export sequence** and download the generated `.lua` file, or copy the importer code. The export contains all cue metadata; no network access or separate JSON parser is required on the console.

### onPC workflow

1. Save your show and programmer work. Use a test show for the first import.
2. Add a Plugins pool window; edit an unused plugin.
3. Add a Lua component (**New Component Lua**), select it, click **Edit**.
4. Open the downloaded `.lua` as text and paste its entire contents into the Lua editor; save and close it.
5. Run the plugin. It asks for a new sequence slot in the **current data pool** and refuses an occupied slot. Confirm that it can clear the programmer.
6. It runs `ClearAll`, stores empty cues, and assigns each cue's `Name` and `Note` through the object API. These strings are data, not interpolated commands, so quotes and multiline notes are preserved.
7. Inspect the result in the Sequence Sheet. Enable **Show Notes** and/or the Note column. Check numbers, cue names, and notes before programming fixture values.

The importer does not create fixture values, timings, executor assignments or lighting looks. It only creates the sequence skeleton. It stops on command errors or a failed metadata readback and reports that a partial sequence may remain; use Oops or remove the partial sequence before retrying. This is a new-sequence import, not a synchroniser for an existing programmed sequence.

The manual documents native sequence import/export, but does not specify a complete sequence XML schema. This first implementation uses documented Lua commands and object APIs rather than invented XML. The downloaded `.lua` is **not** a complete plugin XML package and cannot be selected directly in the plugin Import dialog. After creating the plugin on onPC, you can use MA3's native plugin Export to produce an XML package for USB transfer to hardware.

### Validation status

Automated tests verify the planner and generated code. **The importer must still be run on grandMA3 2.5 to validate console behaviour**, including empty cue creation and the `Note` property. No MA3 runtime is bundled with this project. Keep the first import in a test show.

Manual references (local PDF, version 2.5.0.3, 2026-08-27): Notes in Cues pp.1366–1367; Cues and Sequences pp.1497–1595; cue number range/precision p.1557; Plugins and Lua component setup pp.1856–1863; Cmd p.1884; Show Creator import/export pp.2288–2292. See `docs/MA3-acceptance.md` for console checks.

Primary setup references: [Vite deployment](https://vite.dev/guide/static-deploy.html), [Supabase password login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
