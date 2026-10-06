import { describe, expect, it } from 'vitest';
import { createPlan, format, insertCue, moveCue, parsePlan, renumber, ticks, updateNumber, validate } from '../src/model';
import { exportLua, luaString } from '../src/export';
function populated() {
  let p = createPlan();
  for (let i = 0; i < 3; i++) p = insertCue(p, p.scenes[0].id, i);
  p.scenes[0].cues.forEach((c, i) => { c.title = `Cue ${i}`; });
  return p;
}
describe('MA3 cue numbering', () => {
  it('treats cue numbers as decimals rather than strings', () => {
    expect(ticks('5.2')).toBeGreaterThan(ticks('5.11'));
    expect(format(ticks('100.000'))).toBe('100');
    expect(format(ticks('0.001'))).toBe('0.001');
    expect(() => ticks('1.0001')).toThrow();
    expect(() => ticks('0')).toThrow();
    expect(ticks('999999.999')).toBe(999999999);
  });
  it('starts eleven scenes at hundred intervals', () => expect(createPlan().scenes.map(s => s.start)).toEqual(['100','200','300','400','500','600','700','800','900','1000','1100']));
  it('duplicates content with a fresh identity and renumbers', () => {
    const p = populated(); p.scenes[0].cues[0].notes = 'Stand by\nGO';
    const next = insertCue(p, p.scenes[0].id, 1, p.scenes[0].cues[0]);
    expect(next.scenes[0].cues.map(c => c.number)).toEqual(['100','101','102','103']);
    expect(next.scenes[0].cues[1].notes).toBe('Stand by\nGO');
    expect(next.scenes[0].cues[1].id).not.toBe(p.scenes[0].cues[0].id);
    expect(p.scenes[0].cues.length).toBe(3);
  });
  it('moves cues both directions in a scene', () => {
    const p = populated(), s = p.scenes[0];
    const down = moveCue(p, s.cues[0].id, s.id, 3);
    expect(down.scenes[0].cues.map(c => c.title)).toEqual(['Cue 1','Cue 2','Cue 0']);
    const up = moveCue(down, s.cues[0].id, s.id, 0);
    expect(up.scenes[0].cues.map(c => c.title)).toEqual(['Cue 0','Cue 1','Cue 2']);
  });
  it('moves between scenes and renumbers both', () => {
    const p = populated(); const next = moveCue(p, p.scenes[0].cues[0].id, p.scenes[1].id, 0);
    expect(next.scenes[0].cues.map(c => c.number)).toEqual(['100','101']);
    expect(next.scenes[1].cues[0].number).toBe('200');
    expect(next.scenes[1].cues[0].title).toBe('Cue 0');
  });
  it('supports decimal increments and rejects overflowing a scene', () => {
    const p = populated(); p.scenes[0].step = '0.1';
    expect(renumber(p, [p.scenes[0].id]).scenes[0].cues.map(c => c.number)).toEqual(['100','100.1','100.2']);
    p.scenes[0].step = '50';
    expect(() => renumber(p, [p.scenes[0].id])).toThrow();
  });
  it('sorts manually changed numbers and rejects collisions', () => {
    const p = populated();
    expect(updateNumber(p, p.scenes[0].cues[0].id, '110').scenes[0].cues.map(c => c.number)).toEqual(['101','102','110']);
    expect(() => updateNumber(p, p.scenes[0].cues[0].id, '101')).toThrow();
    expect(() => updateNumber(p, p.scenes[0].cues[0].id, '200')).toThrow();
  });
  it('round trips JSON and rejects malformed input', () => {
    const p = populated(); expect(parsePlan(JSON.stringify(p))).toEqual(p);
    expect(() => parsePlan('{"version":1}')).toThrow();
    p.scenes[0].cues[1].id = p.scenes[0].cues[0].id;
    expect(() => validate(p)).toThrow();
  });
});
describe('Lua export', () => {
  it('preserves multiline, Unicode and potentially hostile command text as data', () => {
    const p = populated(); p.scenes[0].cues[0].title = 'Snow "fall"; Delete Sequence Thru';
    p.scenes[0].cues[0].notes = '\nGO 🎄\nC:\\show ]=]';
    const code = exportLua(p);
    expect(code).toContain(p.scenes[0].cues[0].title);
    expect(code).toContain('object:Set("Note", cue.note)');
    expect(luaString(p.scenes[0].cues[0].notes)).toContain('[==[');
    expect(code).toContain('already exists');
    expect(code).toContain('command("ClearAll")');
    expect(code).toContain('/Programmer /Active /NoConfirmation');
  });
  it('refuses export of empty plans', () => expect(() => exportLua(createPlan())).toThrow('Add at least one cue'));
});
