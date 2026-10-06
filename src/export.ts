import { type Plan, validate } from './model';
// Lua long strings preserve Unicode, quotes, backslashes and multiline notes.
export function luaString(value: string) {
  let eq = '=';
  while (value.includes(`]${eq}]`)) eq += '=';
  // Leading newline prevents Lua from discarding a user's leading newline.
  return `[${eq}[\n${value}]${eq}]`;
}
export function exportLua(plan: Plan) {
  validate(plan);
  const cues = plan.scenes.flatMap(s => s.cues);
  if (!cues.length) throw new Error('Add at least one cue before exporting to MA3.');
  return `-- Sequence Studio | grandMA3 2.5 | generated planner import
-- Creates a NEW sequence in the current data pool. Never merges into an existing slot.
local sequenceName = ${luaString(plan.title)}
local cues = {
${cues.map(c => `  { number = ${luaString(c.number)}, name = ${luaString(c.title || `Cue ${c.number}`)}, note = ${luaString(c.notes)} },`).join('\n')}
}
return function()
  local slot = TextInput("New sequence slot (current data pool)", "${plan.sequence}")
  if slot == nil then return end
  if not slot:match("^%d+$") or tonumber(slot) < 1 or tonumber(slot) > 9999 then
    ErrPrintf("Enter a whole sequence slot from 1 to 9999.")
    return
  end
  slot = tostring(tonumber(slot))
  local address = "Sequence " .. slot
  if #ObjectList(address) > 0 then
    ErrPrintf("Sequence " .. slot .. " already exists. Choose an empty slot.")
    return
  end
  if not Confirm("Import planned sequence", "Create " .. #cues .. " empty cues in " .. address .. "? This clears the programmer first. Save any programmer work before continuing.") then return end
  local undo = CreateUndo("Import planned sequence")
  local function command(text)
    local result = Cmd(text, undo)
    if result ~= "OK" then error(text .. ": " .. tostring(result)) end
  end
  local ok, err = pcall(function()
    command("ClearAll")
    for _, cue in ipairs(cues) do
      -- ClearAll succeeded above: restrict storage to the now-empty programmer,
      -- ignoring Output/DMX store preferences that could capture playback values.
      command("Store " .. address .. " Cue " .. cue.number .. " /Programmer /Active /NoConfirmation")
      local object = ObjectList(address .. " Cue " .. cue.number)[1]
      if not object then error("Cue " .. cue.number .. " was not created") end
      object:Set("Name", cue.name)
      object:Set("Note", cue.note)
      if object:Get("Name") ~= cue.name or (cue.note ~= "" and object:Get("Note") ~= cue.note) then
        error("Cue name or note did not save for " .. cue.number)
      end
    end
    local sequence = ObjectList(address)[1]
    sequence:Set("Name", sequenceName)
  end)
  CloseUndo(undo)
  if not ok then
    ErrPrintf("Import stopped: " .. tostring(err) .. ". A partial sequence may exist; use Oops or remove it before retrying.")
    return
  end
  Printf("Imported " .. #cues .. " cues into " .. address)
end
`;
}
export function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
