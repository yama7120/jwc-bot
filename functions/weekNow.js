export const WEEK_NOW_LEAGUES = ['j1', 'j2', 'swiss', 'mix', 'five'];

const cache = Object.create(null);

export function getWeekNow(league) {
  return Number(cache[league] ?? 0);
}

export function setWeekNowLeague(league, week) {
  cache[league] = Number(week);
}

export async function loadWeekNowFromDb(clientMongo) {
  const doc = await clientMongo
    .db('jwc')
    .collection('config')
    .findOne({ name: 'weekNow' });
  if (doc) {
    for (const league of WEEK_NOW_LEAGUES) {
      if (doc[league] != null) {
        setWeekNowLeague(league, doc[league]);
      }
    }
  }
  return getWeekNowSnapshot();
}

export function getWeekNowSnapshot() {
  return { ...cache };
}
