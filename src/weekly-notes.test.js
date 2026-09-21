import { expect, test } from 'vitest';
import moment from 'moment';
import { weeklyBasename, parseWeeklyBasename } from './weekly-notes';
test.each(['2026-09-21','2026-09-23','2026-09-27'])('Monday–Sunday range for %s', date => {
  expect(weeklyBasename(moment(date))).toBe('2026-0921-0927');
});
test('cross-year uses Monday year and Sunday month/day', () => {
  expect(weeklyBasename(moment('2027-01-01'))).toBe('2026-1228-0103');
  expect(parseWeeklyBasename('2026-1228-0103',moment).format('YYYY-MM-DD')).toBe('2026-12-28');
});
test.each(['2026-0922-0928','2026-0921-0928','2026-0230-0308','2026-W39','2026-09-21','2026-0921-0927-extra'])('reject invalid filename %s', name => {
  expect(parseWeeklyBasename(name,moment).isValid()).toBe(false);
});
