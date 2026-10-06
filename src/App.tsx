import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowDown, ArrowUp, Check, ChevronDown, Clipboard, Cloud, Copy, Download, GripVertical, Layers3, MoreHorizontal, Plus, Redo2, Search, Trash2, Undo2, Upload, X } from 'lucide-react';
import { createPlan, format, id, insertCue, moveCue, parsePlan, renumber, ticks, updateNumber, validate, type Cue, type Plan } from './model';
import { download, exportLua } from './export';
import { supabase } from './supabase';

const STORAGE = 'sequence-studio-draft-v1';
function initial(): Plan {
  try {
    const stored = localStorage.getItem(STORAGE);
    if (stored) {
      try { return parsePlan(stored); }
      catch { localStorage.setItem(`${STORAGE}-recovery`, stored); }
    }
  } catch { /* Storage may be unavailable; save errors are surfaced by the app. */ }
  return createPlan();
}
function Field({ value, label, onCommit, multiline = false, className = '' }: { value: string; label: string; onCommit: (value: string) => void; multiline?: boolean; className?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const props = { value: draft, 'aria-label': label, placeholder: label, className, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value), onBlur: () => { if (draft !== value) onCommit(draft); setDraft(value); }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') { setDraft(value); (e.target as HTMLElement).blur(); } if (!multiline && e.key === 'Enter') (e.target as HTMLElement).blur(); } };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}
export default function App() {
  const [plan, setPlan] = useState(initial);
  const [past, setPast] = useState<Plan[]>([]), [future, setFuture] = useState<Plan[]>([]);
  const [active, setActive] = useState('all'), [search, setSearch] = useState('');
  const [menu, setMenu] = useState<{ cue: string; x: number; y: number } | null>(null);
  const [clipboard, setClipboard] = useState<Cue | null>(null);
  const [drag, setDrag] = useState<string | null>(null), [drop, setDrop] = useState('');
  const [confirmation, setConfirmation] = useState<{ text: string; resolve: (answer: boolean) => void } | null>(null);
  function ask(text: string): Promise<boolean> { return new Promise(resolve => setConfirmation({ text, resolve })); }
  const [modal, setModal] = useState<'export' | 'cloud' | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [cloudPlans, setCloudPlans] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const total = plan.scenes.reduce((n, s) => n + s.cues.length, 0);
  function commit(next: Plan) { validate(next); setPast(p => [...p.slice(-49), plan]); setFuture([]); setPlan(next); }
  function attempt(fn: () => void) { try { setError(''); fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }
  function change(fn: (p: Plan) => Plan) { attempt(() => commit(fn(plan))); }
  function updateCue(cueId: string, key: 'title' | 'notes', value: string) { change(p => ({ ...p, scenes: p.scenes.map(s => ({ ...s, cues: s.cues.map(c => c.id === cueId ? { ...c, [key]: value } : c) })) })); }
  function undo() { if (!past.length) return; setFuture(f => [plan, ...f]); setPlan(past[past.length - 1]); setPast(p => p.slice(0, -1)); }
  function redo() { if (!future.length) return; setPast(p => [...p, plan]); setPlan(future[0]); setFuture(f => f.slice(1)); }
  useEffect(() => {
    setSaved(false);
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE, JSON.stringify(plan)); setSaved(true); } catch { setError('Browser storage is full or unavailable. Download a JSON backup to keep your plan.'); } }, 350);
    return () => clearTimeout(timer);
  }, [plan]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => { if (error) setError(error.message); setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setAuthReady(true); setCloudPlans([]); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); setModal(null); } };
    const click = () => setMenu(null);
    document.addEventListener('keydown', close); window.addEventListener('click', click); window.addEventListener('scroll', click, true);
    return () => { document.removeEventListener('keydown', close); window.removeEventListener('click', click); window.removeEventListener('scroll', click, true); };
  }, []);
  async function cloudTask(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  async function listCloud() {
    if (!supabase || !session) return;
    const { data, error } = await supabase.from('sequence_plans').select('id,title,updated_at').order('updated_at', { ascending: false });
    if (error) throw error; setCloudPlans(data ?? []);
  }
  const slug = plan.title.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'sequence';
  const selected = menu && plan.scenes.flatMap(s => s.cues).find(c => c.id === menu.cue);
  const selectedScene = menu && plan.scenes.find(s => s.cues.some(c => c.id === menu.cue));
  function add(sceneId: string, at: number, source?: Cue) { change(p => insertCue(p, sceneId, at, source)); }
  function move(cueId: string, sceneId: string, at: number) { change(p => moveCue(p, cueId, sceneId, at)); setDrag(null); setDrop(''); }
  function dropProps(sceneId: string, index: number) {
    const key = `${sceneId}:${index}`;
    return { onDragOver: (e: React.DragEvent) => { if (drag && !search) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDrop(key); } }, onDrop: (e: React.DragEvent) => { e.preventDefault(); if (drag && !search) move(drag, sceneId, index); }, className: `drop-target ${drop === key ? 'over' : ''}` };
  }
  return <div className="app">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => e.preventDefault()}><span className="brand-icon"><Layers3 size={23}/></span><span>Sequence<span className="brand-light"> Studio</span><small>GRANDMA3 SEQUENCE PLANNER</small></span></a>
      <div className="show-card"><span className="eyebrow">CURRENT SHOW</span><strong>{plan.title || 'Untitled show'}</strong><span>{plan.scenes.length} scenes · {total} cues</span></div>
      <div className="nav-caption">YOUR SEQUENCE <button title="Add scene" aria-label="Add scene" onClick={() => change(p => ({ ...p, scenes: [...p.scenes, { id: id(), title: `Scene ${p.scenes.length + 1}`, start: format((p.scenes.length ? ticks(p.scenes.at(-1)!.start) : 0) + 100000), step: '1', cues: [] }] }))}><Plus size={16}/></button></div>
      <button className={`nav-item all ${active === 'all' ? 'active' : ''}`} onClick={() => setActive('all')}><Layers3 size={17}/> Entire sequence <span>{total}</span></button>
      <nav aria-label="Scenes">{plan.scenes.map((s, i) => <button key={s.id} className={`nav-item ${active === s.id ? 'active' : ''}`} onClick={() => setActive(s.id)} onDragOver={e => { if (drag) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (drag) move(drag, s.id, s.cues.length); }}><span className="scene-index">{String(i + 1).padStart(2, '0')}</span><span className="scene-nav-name">{s.title}</span><span className="start-label">{s.start}</span></button>)}</nav>
      <div className="sidebar-bottom"><p><span className="green-dot"/> {saved ? 'Draft saved on this device' : 'Saving draft…'}</p><button className="account" onClick={() => setModal('cloud')}><span className="avatar">{session ? session.user.email?.slice(0, 1).toUpperCase() : 'L'}</span><span>{session ? session.user.email : 'Local workspace'}<small>{session ? 'Open cloud plans' : 'Connect Supabase to sync'}</small></span><ChevronDown size={14}/></button></div>
    </aside>
    <div className="workspace">
      <header><span className="breadcrumb">Workspace <span>/</span> {plan.title || 'Untitled show'}</span><div className="header-actions"><button className="quiet" onClick={() => file.current?.click()}><Upload size={15}/> Open JSON</button><button className="quiet" onClick={() => setModal('cloud')}><Cloud size={16}/> Cloud plans</button><button className="primary" onClick={() => setModal('export')}><Download size={16}/> Export sequence</button></div></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow">PLAN THE SHOW. PROGRAM WITH CONFIDENCE.</div><Field value={plan.title} label="Show title" className="show-title" onCommit={title => change(p => ({ ...p, title }))}/><p>Your show, one cue at a time. Build the running order before you reach the console.</p></div><span className="tag">MA3 <span>READY TO PLAN</span></span></div>
        {error && <div className="message error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
        {notice && <div className="message" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
        <div className="stats"><div><span>SCENES</span><strong>{String(plan.scenes.length).padStart(2, '0')}</strong></div><div><span>PLANNED CUES</span><strong>{String(total).padStart(2, '0')}</strong></div><div><span>SEQUENCE SLOT</span><Field value={String(plan.sequence)} label="Sequence slot" onCommit={v => change(p => ({ ...p, sequence: Number(v) }))}/></div><div className="stats-note"><span className="green-dot"/><span>Room for every moment.<small>Scene blocks keep your show organised.</small></span></div></div>
        <div className="toolbar"><div className="view-label"><Layers3 size={18}/><strong>{active === 'all' ? 'Entire sequence' : plan.scenes.find(s => s.id === active)?.title ?? 'Scene'}</strong><span className="count">{total} cues</span></div><div className="tools"><label className="search"><Search size={15}/><input aria-label="Search cues" placeholder="Find a cue or note…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14}/></button>}</label><button title="Undo" aria-label="Undo" disabled={!past.length} onClick={undo}><Undo2 size={17}/></button><button title="Redo" aria-label="Redo" disabled={!future.length} onClick={redo}><Redo2 size={17}/></button><button className="secondary" onClick={() => { const s = plan.scenes.find(s => s.id === active) ?? plan.scenes[0]; if (s) add(s.id, s.cues.length); }} disabled={!plan.scenes.length}><Plus size={16}/> Add cue</button></div></div>
        <p className="hint">{search ? 'Clear search to reorder cues.' : 'Drag cues to change their order. Adding, pasting or moving cues renumbers the affected scene from its start and increment.'}</p>
        <div className="scenes">{plan.scenes.filter(s => active === 'all' || active === s.id).map(s => {
          const sceneIndex = plan.scenes.findIndex(x => x.id === s.id);
          const matches = (c: Cue) => `${c.number} ${c.title} ${c.notes}`.toLowerCase().includes(search.toLowerCase());
          const visible = s.cues.filter(matches);
          return <section key={s.id} className="scene-panel"><div className="scene-heading"><span className="scene-badge">{String(sceneIndex + 1).padStart(2, '0')}</span><Field value={s.title} label="Scene title" className="scene-title" onCommit={title => change(p => ({ ...p, scenes: p.scenes.map(x => x.id === s.id ? { ...x, title } : x) }))}/><span className="scene-cue-count">{s.cues.length} cues</span><div className="scene-settings"><label>Starts at <Field value={s.start} label="Scene start" onCommit={start => change(p => renumber({ ...p, scenes: p.scenes.map(x => x.id === s.id ? { ...x, start } : x) }, [s.id]))}/></label><label>Step <Field value={s.step} label="Cue increment" onCommit={step => change(p => renumber({ ...p, scenes: p.scenes.map(x => x.id === s.id ? { ...x, step } : x) }, [s.id]))}/></label><button title="Renumber scene" onClick={() => change(p => renumber(p, [s.id]))}>Renumber</button><button title="Delete scene" aria-label={`Delete ${s.title}`} onClick={async () => { if (await ask(`Delete ${s.title} and its ${s.cues.length} cues? You can undo this.`)) { change(p => ({ ...p, scenes: p.scenes.filter(x => x.id !== s.id) })); if (active === s.id) setActive('all'); } }}><Trash2 size={14}/></button></div></div>
            <div className="table-heading"><span/><span>CUE</span><span>TITLE</span><span>OPERATOR NOTES</span><span/></div>
            {visible.map(c => { const index = s.cues.findIndex(x => x.id === c.id); return <div key={c.id}>
              {!search && <div {...dropProps(s.id, index)}/>}
              <div className={`cue-row ${drag === c.id ? 'dragging' : ''}`} onDragOver={e => { if (drag && !search) { e.preventDefault(); const box = e.currentTarget.getBoundingClientRect(); setDrop(`${s.id}:${index + (e.clientY > box.top + box.height / 2 ? 1 : 0)}`); } }} onDrop={e => { if (drag && !search) { e.preventDefault(); const box = e.currentTarget.getBoundingClientRect(); move(drag, s.id, index + (e.clientY > box.top + box.height / 2 ? 1 : 0)); } }} onContextMenu={e => { e.preventDefault(); setMenu({ cue: c.id, x: Math.max(8, Math.min(e.clientX, window.innerWidth - 230)), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 285)) }); }}>
                <button className="drag-handle" draggable={!search} title="Drag to reorder; use the cue menu for keyboard movement" aria-label={`Drag cue ${c.number}`} onDragStart={e => { setDrag(c.id); e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setDrop(''); }}><GripVertical size={17}/></button>
                <Field value={c.number} label="Cue number" className="cue-number" onCommit={n => change(p => updateNumber(p, c.id, n))}/>
                <Field value={c.title} label="Untitled cue" className="cue-title" onCommit={v => updateCue(c.id, 'title', v)}/>
                <Field value={c.notes} label="Add an operator note…" multiline onCommit={v => updateCue(c.id, 'notes', v)}/>
                <button className="row-menu" aria-label={`Menu for cue ${c.number}`} onClick={e => { e.stopPropagation(); const box = e.currentTarget.getBoundingClientRect(); setMenu({ cue: c.id, x: Math.max(8, box.right - 220), y: Math.min(box.bottom, window.innerHeight - 285) }); }}><MoreHorizontal size={18}/></button>
              </div>
            </div>; })}
            {!visible.length && <div className="empty-scene">{search ? 'No matching cues in this scene.' : <><span className="empty-icon"><Plus size={20}/></span><span>This scene is a blank canvas.<small>Add your first cue and start planning the moment.</small></span><button onClick={() => add(s.id, 0)}>Add first cue <Plus size={14}/></button></>}</div>}
            {!search && <div {...dropProps(s.id, s.cues.length)}/>}
            <div className="scene-footer"><button onClick={() => add(s.id, s.cues.length)}><Plus size={14}/> Add cue</button>{clipboard && <button onClick={() => add(s.id, s.cues.length, clipboard)}><Clipboard size={14}/> Paste cue</button>}<span>{s.start} – {plan.scenes[sceneIndex + 1] ? format(ticks(plan.scenes[sceneIndex + 1].start) - 1) : '999999.999'}</span></div>
          </section>;
        })}</div>
        {!plan.scenes.length && <div className="empty-scene">Add a scene using the + in the sidebar.</div>}
        <footer><span>Made for the moments that matter.</span><span>Sequence Studio / grandMA3 planner</span><button className="quiet" onClick={async () => { if (await ask('Start a new show? Download a JSON backup first if you want to keep this draft.')) { commit(createPlan()); setActive('all'); } }}>New show</button></footer>
      </main>
    </div>
    <input hidden type="file" accept="application/json,.json" ref={file} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const next = parsePlan(await f.text()); if (await ask('Replace the current draft with this JSON plan? You can undo this.')) { commit({ ...next, id: id() }); setActive('all'); setNotice('Plan opened as a new local draft.'); } } catch (e) { setError(e instanceof Error ? e.message : 'Could not open plan.'); } }}/>
    {menu && selected && selectedScene && <div className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
      <span className="menu-caption">CUE {selected.number}</span>
      <button role="menuitem" onClick={() => { setClipboard(structuredClone(selected)); setMenu(null); setNotice(`Cue ${selected.number} copied. Paste it into any scene.`); }}><Copy size={15}/> Copy cue</button>
      <button role="menuitem" onClick={() => { add(selectedScene.id, selectedScene.cues.findIndex(c => c.id === selected.id) + 1, selected); setMenu(null); }}><Layers3 size={15}/> Duplicate below</button>
      <button role="menuitem" disabled={!clipboard} onClick={() => { if (clipboard) add(selectedScene.id, selectedScene.cues.findIndex(c => c.id === selected.id) + 1, clipboard); setMenu(null); }}><Clipboard size={15}/> Paste below</button>
      <button role="menuitem" disabled={selectedScene.cues[0].id === selected.id} onClick={() => { move(selected.id, selectedScene.id, selectedScene.cues.findIndex(c => c.id === selected.id) - 1); setMenu(null); }}><ArrowUp size={15}/> Move up</button>
      <button role="menuitem" disabled={selectedScene.cues.at(-1)!.id === selected.id} onClick={() => { move(selected.id, selectedScene.id, selectedScene.cues.findIndex(c => c.id === selected.id) + 2); setMenu(null); }}><ArrowDown size={15}/> Move down</button>
      <button className="danger" role="menuitem" onClick={() => { change(p => ({ ...p, scenes: p.scenes.map(s => ({ ...s, cues: s.cues.filter(c => c.id !== selected.id) })) })); setMenu(null); }}><Trash2 size={15}/> Delete cue</button>
    </div>}
    {confirmation && <div className="overlay" style={{ zIndex: 60 }}><div className="modal" role="alertdialog" aria-modal="true" aria-label="Confirm change"><h2>Confirm change</h2><p>{confirmation.text}</p><div className="cloud-actions"><button className="secondary" autoFocus onClick={() => { confirmation.resolve(false); setConfirmation(null); }}>Cancel</button><button className="primary" onClick={() => { confirmation.resolve(true); setConfirmation(null); }}>Continue</button></div></div></div>}
    {modal && <div className="overlay" onClick={() => setModal(null)}><div className="modal" role="dialog" aria-modal="true" aria-label={modal === 'export' ? 'Export sequence' : 'Cloud plans'} onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button>
      {modal === 'export' ? <><span className="eyebrow">FROM PLAN TO CONSOLE</span><h2>Take your sequence with you.</h2><p>{total} cues · {plan.scenes.length} scenes · {plan.title}</p><div className="export-option"><span className="export-icon"><Download/></span><div><strong>grandMA3 Lua importer</strong><p>Creates an empty sequence with cue numbers, names and multiline notes.</p></div><button className="primary" disabled={!total} onClick={() => attempt(() => { download(`${slug}-ma3.lua`, exportLua(plan)); setNotice('Lua importer downloaded. Follow the onPC instructions below.'); })}>Download</button></div><button className="secondary" disabled={!total} onClick={() => attempt(() => { const code = exportLua(plan); navigator.clipboard.writeText(code).then(() => setNotice('Lua importer copied. Paste it into a plugin component in onPC.'), () => setError('Clipboard unavailable. Download the Lua file instead.')); })}><Copy size={15}/> Copy importer code</button><ol className="instructions"><li>In MA3 onPC, edit an empty object in the Plugins pool.</li><li>Add a Lua component, open its editor, and paste the downloaded file’s contents. Save.</li><li>Run the plugin. Choose an unused sequence slot in the current data pool and confirm.</li></ol><div className="import-note">Save your programmer work first: the importer clears it to create empty cues. Existing sequence slots are refused. Console validation is still required on MA3 2.5; use a test show first.</div><div className="backup"><div><strong>Planner backup</strong><p>Keep scenes and settings, or open this plan on another device.</p></div><button className="secondary" onClick={() => download(`${slug}.json`, JSON.stringify(plan, null, 2), 'application/json')}>Download JSON</button></div></> : <><span className="eyebrow">YOUR WORKSPACE, ANYWHERE</span><h2>Cloud plans</h2>{!supabase ? <><p>This workspace currently saves to your browser. To enable login and cloud plans, set the Supabase environment variables and run the included database schema.</p><div className="import-note">See README.md for Vercel and Supabase setup. Users are managed directly in the Supabase dashboard.</div></> : !authReady ? <p>Loading account…</p> : !session ? <form onSubmit={e => { e.preventDefault(); void cloudTask(async () => { const { error } = await supabase!.auth.signInWithPassword({ email, password }); if (error) throw error; setPassword(''); }); }}><p>Sign in with the account created by your administrator.</p><label>Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label><button disabled={busy} className="primary" type="submit">{busy ? 'Signing in…' : 'Sign in'}</button></form> : <><p>Signed in as {session.user.email}. Your draft saves locally; save to the cloud when you’re ready.</p><div className="cloud-actions"><button className="primary" disabled={busy} onClick={() => void cloudTask(async () => { validate(plan); const { error } = await supabase!.from('sequence_plans').upsert({ id: plan.id, user_id: session.user.id, title: plan.title, document: plan, updated_at: new Date().toISOString() }); if (error) throw error; setNotice('Saved to your Supabase account.'); await listCloud(); })}><Cloud size={15}/> {busy ? 'Working…' : 'Save current plan'}</button><button className="secondary" disabled={busy} onClick={() => void cloudTask(listCloud)}>Refresh plans</button></div><div className="cloud-list">{cloudPlans.map(p => <button key={p.id} disabled={busy} onClick={async () => { if (await ask('Load this cloud plan and replace your current draft? You can undo this.')) void cloudTask(async () => { const { data, error } = await supabase!.from('sequence_plans').select('document').eq('id', p.id).single(); if (error) throw error; commit(parsePlan(JSON.stringify(data.document))); setActive('all'); setModal(null); setNotice('Cloud plan loaded.'); }); }}><span>{p.title}<small>{new Date(p.updated_at).toLocaleString()}</small></span><Download size={15}/></button>)}</div><button className="quiet" disabled={busy} onClick={() => void cloudTask(async () => { const { error } = await supabase!.auth.signOut(); if (error) throw error; })}>Sign out</button></> }</>}
      {error && <div className="message error" role="alert">{error}</div>}{notice && <p className="modal-status"><Check size={14}/>{notice}</p>}
    </div></div>}
  </div>;
}
