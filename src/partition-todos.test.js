import { expect, test } from 'vitest';
import { partitionTodos } from './partition-todos';

test('splits nested branches, retaining completed descendants with non-task parent context', () => {
  const lines = ['- [ ] Project', '  - [x] Finished', '  - [ ] Open', '    - [x] Done detail', '    - [ ] Next detail'];
  expect(partitionTodos({lines})).toEqual({
    todos: ['- [ ] Project', '  - [ ] Open', '    - [ ] Next detail'],
    remaining: ['- Project', '  - [x] Finished', '  - Open', '    - [x] Done detail']
  });
});

test.each([true, false])('completed ancestors block every descendant with children=%s', withChildren => {
  const lines = ['- [x] Closed', '  - Context', '    - [ ] Must stay', '- [ ] Move'];
  expect(partitionTodos({lines, withChildren})).toEqual({todos: ['- [ ] Move'], remaining: lines.slice(0,3)});
});

test('duplicate text in a protected branch is never deleted', () => {
  const lines = ['- [x] Done', '  - [ ] Same', '- [ ] Open', '  - [ ] Same'];
  expect(partitionTodos({lines})).toEqual({remaining: lines.slice(0,2), todos: lines.slice(2)});
});

test('plain weekday and numbered context remain attached; tabs work', () => {
  const lines = ['### Daily Plan', '- Monday', '\t1. [ ] Project', '\t\t- [x] Done', '\t\t- [ ] Next'];
  expect(partitionTodos({lines})).toEqual({remaining: ['### Daily Plan', '- Monday', '\t1. Project', '\t\t- [x] Done'], todos: ['- Monday', '\t1. [ ] Project', '\t\t- [ ] Next']});
});

test('completed custom unicode status protects descendants', () => {
  const lines = ['- [✅] Done', '  - [ ] Stays', '- [🟣] Open'];
  expect(partitionTodos({lines, doneStatusMarkers:'✅'})).toEqual({remaining:lines.slice(0,2), todos:lines.slice(2)});
});

test('ignore empty placeholders without orphaning children', () => {
  const lines = ['- [ ]', '- [ ] ', '  - [ ] Child'];
  expect(partitionTodos({lines, removeEmptyTodos:true})).toEqual({remaining:['- [ ]', '- [ ] '], todos:['- ', '  - [ ] Child']});
});

test('ignore fenced examples and inline checkbox text', () => {
  const lines = ['```md', '- [ ] Example', '```', 'Text - [ ] example', '- [ ] Real'];
  expect(partitionTodos({lines})).toEqual({remaining: lines.slice(0,4), todos:lines.slice(4)});
});

test('rerunning cleaned source cannot move protected descendants', () => {
  const lines = ['- [ ] Parent', '  - [x] Done', '    - [ ] Blocked', '  - [ ] Open'];
  const first = partitionTodos({lines});
  expect(partitionTodos({lines:first.remaining}).todos).toEqual([]);
});

test('plain child notes follow moving task while completed child notes stay', () => {
  const lines = ['- [ ] Task', '  - supporting note', '  - [x] Done', '    explanation'];
  expect(partitionTodos({lines})).toEqual({todos:lines.slice(0,2), remaining:['- Task', ...lines.slice(2)]});
});
