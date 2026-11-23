import { allowedPhoto, calendarDate, dateFormat, readDiary } from './diary-data.js';

const get = (id) => document.getElementById(id);
const dialog = get('entry-dialog');
const form = get('entry-form');
const save = get('save');
const status = get('diary-status');
const key = get('publisher-key');
let publishingKey = '';
let pendingPublication;
const diaryDirectory = 'https://api.github.com/repos/webappngdsib/Saint-Patrick-RITUAL-/contents/diary-entries/';
function readBrowserEntries() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('saint-patrick-diary', 1);
    request.onupgradeneeded = () => {
      request.transaction.abort();
      resolve([]);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('events');
      const entries = transaction.objectStore('events').getAll();
      entries.onsuccess = () => resolve(entries.result);
      entries.onerror = () => reject(entries.error);
      transaction.oncomplete = transaction.onabort = () => database.close();
    };
  });
}

function encodePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const ratio = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', .82));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('A photograph could not be opened.'));
    };
    image.src = url;
  });
}

async function prepareEntry({ date, location, chamber, photos }) {
  return { date, location, chamber, photos: await Promise.all(photos.map(encodePhoto)) };
}

async function publishEntries(entries, token) {
  const json = JSON.stringify(entries, null, 2) + '\n';
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > 24 * 1024 * 1024) throw new Error('The entry is too large. Use smaller photographs.');
  if (pendingPublication?.json !== json) {
    pendingPublication = { json, id: crypto.randomUUID() };
  }
  const file = 'event-' + entries[0].date + '-' + pendingPublication.id + '.json';
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes]));
  });
  const response = await fetch(diaryDirectory + file, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message: 'Publish Diary entry', branch: 'main', content }),
  });
  // A previous attempt may have committed successfully before the connection dropped.
  if (response.status === 409 || response.status === 422) {
    const existing = await fetch(diaryDirectory + file + '?ref=main', { headers });
    if (existing.ok) return;
  }
  if (!response.ok) {
    const message = [401, 403, 404].includes(response.status)
      ? 'Check that your publishing key has write access to this repository.'
      : 'The entry could not be published. Please try again.';
    throw new Error(message);
  }
}

function calendarLink(entry) {
  const tomorrow = new Date(entry.date + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const start = entry.date.replaceAll('-', '');
  const end = tomorrow.toISOString().slice(0, 10).replaceAll('-', '');
  const url = new URL('https://calendar.google.com/calendar/render');
  url.search = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'ST PATRICK LODGE',
    dates: start + '/' + end,
    location: entry.location,
    details: 'Lodge chamber: ' + entry.chamber,
  });
  const link = document.createElement('a');
  link.className = 'calendar-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Add to Google Calendar';
  return link;
}

function makeEntry(entry) {
  const item = document.createElement('li');
  item.className = 'entry';
  const time = document.createElement('time');
  time.dateTime = entry.date;
  time.textContent = dateFormat.format(new Date(entry.date + 'T12:00:00'));
  const details = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = entry.chamber;
  const location = document.createElement('p');
  location.className = 'location';
  location.textContent = entry.location;
  details.append(heading, location, calendarLink(entry));
  if (entry.photos.length) {
    const gallery = document.createElement('div');
    gallery.className = 'photos';
    entry.photos.forEach((photo, i) => {
      const link = document.createElement('a');
      link.href = photo;
      link.download = 'lodge-photograph-' + (i + 1) + '.' + photo.match(allowedPhoto)[1].replace('jpeg', 'jpg');
      const image = document.createElement('img');
      image.src = photo;
      image.loading = 'lazy';
      image.alt = 'Download photograph ' + (i + 1) + ' of ' + entry.chamber;
      link.append(image);
      gallery.append(link);
    });
    details.append(gallery);
  }
  item.append(time, details);
  return item;
}

async function refresh() {
  const { entries, incomplete } = await readDiary();
  if (incomplete) {
    status.textContent = 'Some diary entries could not be loaded.';
  }
  const today = calendarDate();
  const byDate = (a, b) => a.date.localeCompare(b.date);
  const upcoming = entries.filter((entry) => entry.date >= today).sort(byDate);
  const past = entries.filter((entry) => entry.date < today).sort((a, b) => byDate(b, a));
  for (const [id, records] of [['upcoming', upcoming], ['past', past]]) {
    get(id).replaceChildren(...records.map(makeEntry));
    get(id + '-empty').hidden = records.length > 0;
  }
}

let legacyEntries = [];

function openEntryDialog() {
  form.reset();
  form.elements.date.value = calendarDate();
  for (const name of ['date', 'location', 'chamber', 'photos']) {
    const field = form.elements[name];
    field.disabled = legacyEntries.length > 0;
    field.closest('label').hidden = field.disabled;
  }
  get('entry-title').textContent = legacyEntries.length ? 'Publish previous entries' : 'New diary entry';
  get('form-error').textContent = '';
  get('publisher-key-label').hidden = Boolean(publishingKey);
  key.required = !publishingKey;
  dialog.showModal();
}

get('new-entry').addEventListener('click', () => {
  legacyEntries = [];
  openEntryDialog();
});
get('cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => {
  if (save.disabled) event.preventDefault();
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = get('form-error');
  error.textContent = '';
  const { date, location, chamber } = Object.fromEntries(new FormData(form));
  const photos = Array.from(form.elements.photos.files);
  if (!legacyEntries.length && (!location.trim() || !chamber.trim())) {
    error.textContent = 'Enter a location and lodge chamber.';
    return;
  }
  if (photos.length > 3 || photos.some((photo) => !/^image\/(jpeg|png|webp|avif|gif)$/.test(photo.type) || photo.size > 10 * 1024 * 1024)) {
    error.textContent = 'Choose up to three JPG, PNG, WebP, AVIF or GIF photographs of 10 MB each.';
    return;
  }
  save.disabled = get('cancel').disabled = true;
  try {
    const entries = await Promise.all((legacyEntries.length ? legacyEntries : [
      { date, location: location.trim(), chamber: chamber.trim(), photos },
    ]).map(prepareEntry));
    const token = publishingKey || key.value.trim();
    await publishEntries(entries, token);
    publishingKey = token;
    key.value = '';
    pendingPublication = undefined;
    if (legacyEntries.length) get('legacy-tools').hidden = true;
    dialog.close();
    status.textContent = 'Published. The public Diary and Lodge wall will update after GitHub Pages deploys.';
  } catch (problem) {
    publishingKey = '';
    get('publisher-key-label').hidden = false;
    key.required = true;
    error.textContent = problem.message || 'The entry could not be published. Please try again.';
  } finally {
    save.disabled = get('cancel').disabled = false;
  }
});

get('new-entry').disabled = false;
refresh().catch(() => {
  status.textContent = 'The public diary could not be loaded. Reload to try again.';
});

if (window.indexedDB) {
  readBrowserEntries().then((entries) => {
    if (!entries.length) return;
    get('legacy-tools').hidden = false;
    get('publish-legacy').addEventListener('click', () => {
      legacyEntries = entries;
      openEntryDialog();
    });
  }).catch(() => {});
}
