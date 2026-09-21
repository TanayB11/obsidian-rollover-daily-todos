export function weeklyBasename(date) {
  const monday = date.clone().startOf('isoWeek');
  return `${monday.format('YYYY-MMDD')}-${monday.clone().add(6, 'days').format('MMDD')}`;
}

export function parseWeeklyBasename(name, moment) {
  if (!/^\d{4}-\d{4}-\d{4}$/.test(name)) return moment.invalid();
  const monday = moment(name.slice(0, 9), 'YYYY-MMDD', true);
  return monday.isValid() && monday.isoWeekday() === 1 && weeklyBasename(monday) === name
    ? monday : moment.invalid();
}
