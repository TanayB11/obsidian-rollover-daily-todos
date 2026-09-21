import { expect, test, vi } from 'vitest';
import moment from 'moment';
vi.mock('obsidian', () => ({ Plugin:class {}, Notice:class {}, PluginSettingTab:class {}, Setting:class {}, Modal:class {} }));
vi.mock('obsidian-daily-notes-interface', () => ({getDailyNoteSettings: () => ({folder:'weekly', format:'GGGG-[W]WW'})}));
import RolloverTodosPlugin from './index';

function setup() {
  const dates = ['2026-W37', '2026-W38', '2026-W39', '2026-W40'];
  const files = dates.map(basename => ({path:`weekly/${basename}.md`,basename,extension:'md',stat:{ctime:Date.now()}}));
  const content = new Map(files.map(file=>[file.path, '### Inbox\n']));
  content.set(files[1].path, '- [ ] Parent\n  - [x] Done\n  - [ ] Next\n- [x] Closed\n  - [ ] Blocked\n');
  const plugin = new RolloverTodosPlugin();
  plugin.settings = {templateHeading:'### Inbox',deleteOnComplete:true,rolloverChildren:true,removeEmptyTodos:true,doneStatusMarkers:'xX-',leadingNewLine:true};
  plugin.app = {internalPlugins:{plugins:{'daily-notes':{enabled:true}}},plugins:{getPlugin:()=>null},vault:{
    getMarkdownFiles:()=>files,
    getAbstractFileByPath:path=>files.find(file=>file.path===path),
    read:async file=>content.get(file.path),
    modify:vi.fn(async(file,text)=>content.set(file.path,text))
  }};
  global.window = {moment};
  return {plugin,files,content};
}

test('manual rollover on Wednesday resolves ISO weekly note, excludes future note, preserves completed subtrees, supports undo snapshots', async()=> {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
  try {
    const {plugin,files,content}=setup();
    const sourceBefore=content.get(files[1].path);
    await plugin.rollover();
    expect(content.get(files[2].path)).toContain('- [ ] Parent\n  - [ ] Next');
    expect(content.get(files[1].path)).toBe('- Parent\n  - [x] Done\n- [x] Closed\n  - [ ] Blocked\n');
    expect(content.get(files[3].path)).toBe('### Inbox\n');
    expect(plugin.undoHistory[0].previousDay.oldContent).toBe(sourceBefore);
    expect(plugin.undoHistory[0].today.oldContent).toBe('### Inbox\n');
    await plugin.rollover();
    expect((content.get(files[2].path).match(/Parent/g)||[]).length).toBe(1);
  } finally {vi.useRealTimers();}
});

test('destination failure does not remove source tasks', async()=> {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
  try {
    const {plugin,files,content}=setup();
    const before=content.get(files[1].path);
    plugin.app.vault.modify.mockRejectedValue(new Error('write failed'));
    await expect(plugin.rollover()).rejects.toThrow('write failed');
    expect(content.get(files[1].path)).toBe(before);
  } finally {vi.useRealTimers();}
});

test('concurrent create event and manual command do not duplicate tasks', async()=> {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
  try {
    const {plugin,files,content}=setup();
    await Promise.all([plugin.rollover(files[2]), plugin.rollover()]);
    expect((content.get(files[2].path).match(/Parent/g)||[]).length).toBe(1);
    expect(plugin.app.vault.modify).toHaveBeenCalledTimes(2);
  } finally {vi.useRealTimers();}
});

test('custom range creation applies template, rolls tasks, opens one file, and supports manual lookup without core', async()=> {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
  try {
    const {plugin,files,content}=setup();
    plugin.settings = {...plugin.settings,weeklyNotesEnabled:true,weeklyFolder:'weekly',weeklyTemplate:'templates/Weekly Note.md',rolloverOnFileCreate:true};
    plugin.app.internalPlugins.plugins['daily-notes'].enabled=false;
    files.forEach(file=>content.delete(file.path));
    files.splice(0,files.length,...['2026-0914-0920','2026-0928-1004','2026-0915-0921'].map(basename=>({path:`weekly/${basename}.md`,basename,extension:'md',stat:{ctime:Date.now()}})));
    content.set(files[0].path,'- [ ] Parent\n  - [x] Done\n  - [ ] Next');
    content.set(files[1].path,'- [ ] Future');
    content.set(files[2].path,'- [ ] Invalid date');
    const template={path:'templates/Weekly Note.md'};
    files.push(template);
    content.set(template.path,'### Weekly Goals\n\n### Inbox\n{{title}}');
    const originalLookup=plugin.app.vault.getAbstractFileByPath;
    plugin.app.vault.getAbstractFileByPath=path=>path==='weekly'?{path}:originalLookup(path);
    plugin.app.vault.create=vi.fn(async(path,text)=>{
      const file={path,basename:path.split('/').pop().slice(0,-3),extension:'md',stat:{ctime:Date.now()}};
      files.push(file);content.set(path,text);return file;
    });
    const openFile=vi.fn();plugin.app.workspace={getLeaf:()=>({openFile})};
    await Promise.all([plugin.openCurrentWeeklyNote(),plugin.openCurrentWeeklyNote()]);
    const path='weekly/2026-0921-0927.md';
    expect(plugin.app.vault.create).toHaveBeenCalledTimes(1);
    expect(content.get(path)).toContain('### Weekly Goals');
    expect(content.get(path)).toContain('- [ ] Parent\n  - [ ] Next');
    expect(content.get(path)).toContain('2026-0921-0927');
    expect(content.get(files[0].path)).toBe('- Parent\n  - [x] Done');
    expect(content.get(files[1].path)).toBe('- [ ] Future');
    expect(content.get(files[2].path)).toBe('- [ ] Invalid date');
    await plugin.rollover();
    expect((content.get(path).match(/Parent/g)||[]).length).toBe(1);
    await plugin.openCurrentWeeklyNote();
    expect(plugin.app.vault.create).toHaveBeenCalledTimes(1);
    expect(openFile).toHaveBeenCalledTimes(2);
  } finally {vi.useRealTimers();}
});
