const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });

const allowedPhoto = /^data:image\/(jpeg|png|webp|avif|gif);base64,[a-z\d+/]+=*$/i;

function calendarDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not read diary data.');
  return response.json();
}

function validEntry(entry) {
  if (!entry || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
  const date = new Date(entry.date + 'T12:00:00');
  return Number.isFinite(date.getTime()) && date.getDate() === Number(entry.date.slice(-2)) &&
    typeof entry.location === 'string' && typeof entry.chamber === 'string' &&
    Array.isArray(entry.photos) && entry.photos.length <= 3 &&
    entry.photos.every((photo) => typeof photo === 'string' && allowedPhoto.test(photo));
}

async function readDiary() {
  const manifest = await readJson('./diary-feed.json');
  const results = await Promise.allSettled(manifest.map(readJson));
  const entries = results.flatMap((result) =>
    result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.filter(validEntry) : []);
  return { entries, incomplete: results.some((result) => result.status === 'rejected') };
}

export { allowedPhoto, calendarDate, dateFormat, readDiary };
