export interface Cue { id: string; number: string; title: string; notes: string }
export interface Scene { id: string; title: string; start: string; step: string; cues: Cue[] }
export interface Plan { version: 1; id: string; title: string; sequence: number; scenes: Scene[] }
export const id = () => crypto.randomUUID();
export function ticks(value: string): number {
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(value)) throw new Error('Use a cue number with up to three decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const n = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (n < 1 || n > 999999999) throw new Error('Cue numbers must be between 0.001 and 999999.999.');
  return n;
}
export const format = (n: number) => (n / 1000).toFixed(3).replace(/\.?0+$/, '');
export function createPlan(): Plan {
  return { version: 1, id: id(), title: 'Christmas show', sequence: 1,
    scenes: Array.from({ length: 11 }, (_, i) => ({ id: id(), title: `Scene ${i + 1}`, start: String((i + 1) * 100), step: '1', cues: [] })) };
}
export function validate(p: Plan) {
  if (p.version !== 1 || typeof p.id !== 'string' || !p.id || typeof p.title !== 'string' || !Number.isInteger(p.sequence) || p.sequence < 1 || p.sequence > 9999 || !Array.isArray(p.scenes)) throw new Error('Invalid planner document or sequence slot (1–9999).');
  const ids = new Set<string>([p.id]); const numbers = new Set<number>();
  let previousStart = 0;
  p.scenes.forEach((s, index) => {
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.title !== 'string' || typeof s.start !== 'string' || typeof s.step !== 'string' || !Array.isArray(s.cues)) throw new Error('Invalid scene data.');
    ids.add(s.id);
    const start = ticks(s.start); ticks(s.step);
    if (start <= previousStart) throw new Error('Scene starts must increase through the show.');
    previousStart = start;
    const end = index + 1 < p.scenes.length ? ticks(p.scenes[index + 1].start) : 1000000000;
    let prev = start - 1;
    for (const c of s.cues) {
      if (typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.number !== 'string' || typeof c.title !== 'string' || typeof c.notes !== 'string') throw new Error('Invalid cue data.');
      ids.add(c.id);
      const n = ticks(c.number);
      if (numbers.has(n) || n <= prev || n < start || n >= end) throw new Error(`Cue ${c.number} must be unique, in order, and inside ${s.title}'s number range.`);
      numbers.add(n); prev = n;
    }
  });
  return p;
}
export function parsePlan(text: string): Plan { return validate(JSON.parse(text) as Plan); }
export function renumber(p: Plan, sceneIds: string[]) {
  const next = structuredClone(p);
  for (const s of next.scenes) if (sceneIds.includes(s.id)) {
    const start = ticks(s.start), step = ticks(s.step);
    s.cues.forEach((c, i) => { c.number = format(start + i * step); });
  }
  return validate(next);
}
export function insertCue(p: Plan, sceneId: string, index: number, source?: Cue): Plan {
  const next = structuredClone(p); const s = next.scenes.find(s => s.id === sceneId);
  if (!s) throw new Error('Scene not found.');
  s.cues.splice(index, 0, { id: id(), number: s.start, title: source?.title ?? '', notes: source?.notes ?? '' });
  return renumber(next, [sceneId]);
}
export function moveCue(p: Plan, cueId: string, targetId: string, index: number) {
  const next = structuredClone(p);
  const source = next.scenes.find(s => s.cues.some(c => c.id === cueId));
  const target = next.scenes.find(s => s.id === targetId);
  if (!source || !target) throw new Error('Cue or scene not found.');
  const oldIndex = source.cues.findIndex(c => c.id === cueId);
  const [cue] = source.cues.splice(oldIndex, 1);
  const adjusted = source.id === targetId && oldIndex < index ? index - 1 : index;
  target.cues.splice(adjusted, 0, cue);
  return renumber(next, [source.id, target.id]);
}
export function updateNumber(p: Plan, cueId: string, number: string) {
  ticks(number); const next = structuredClone(p);
  for (const s of next.scenes) {
    const c = s.cues.find(c => c.id === cueId);
    if (c) { c.number = format(ticks(number)); s.cues.sort((a, b) => ticks(a.number) - ticks(b.number)); }
  }
  return validate(next);
}
