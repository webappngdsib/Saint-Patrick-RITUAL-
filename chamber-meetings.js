import { calendarDate, dateFormat, readDiary } from './diary-data.js';

const inscription = document.getElementById('chamber-meetings');
let entries = [];
let displayedDate;

function renderMeetings() {
  const today = calendarDate();
  if (today === displayedDate) return;
  displayedDate = today;

  const meetings = entries.filter((entry) => entry.date >= today).slice(0, 2);
  const rows = meetings.map((entry) => {
    const row = document.createElement('li');
    const date = document.createElement('time');
    date.dateTime = entry.date;
    date.textContent = dateFormat.format(new Date(entry.date + 'T12:00:00'));
    row.append(entry.chamber + ' · ', date, ' · ' + entry.location);
    return row;
  });
  inscription.replaceChildren(...rows);
  inscription.hidden = rows.length === 0;
}

async function refreshMeetings() {
  try {
    const diary = await readDiary();
    entries = diary.entries.sort((a, b) => a.date.localeCompare(b.date));
    displayedDate = undefined;
  } catch {
    // Keep the last published schedule available during a temporary outage.
  }
  renderMeetings();
}

refreshMeetings();
setInterval(refreshMeetings, 5 * 60 * 1000);
setInterval(renderMeetings, 15 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderMeetings();
});
