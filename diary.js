import { allowedPhoto, calendarDate, dateFormat, readDiary } from './diary-data.js';

const get = (id) => document.getElementById(id);
const dialog = get('entry-dialog');
const form = get('entry-form');
const save = get('save');
const status = get('diary-status');
const key = get('publisher-key');
let publishingKey = '';
let pendingPublication;
let editing;
let displayedEntries = [];
let entrySources;
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

function githubHeaders(token) {
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function publishEntries(entries, token, update) {
  const json = JSON.stringify(entries, null, 2) + '\n';
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > 24 * 1024 * 1024) throw new Error('The entry is too large. Use smaller photographs.');
  if (!update && pendingPublication?.json !== json) {
    pendingPublication = { json, id: crypto.randomUUID() };
  }
  const file = update ? update.file : 'event-' + entries[0].date + '-' + pendingPublication.id + '.json';
  const headers = githubHeaders(token);
  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes]));
  });
  const response = await fetch(diaryDirectory + file, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: update ? 'Update Diary entry' : 'Publish Diary entry',
      branch: 'main',
      content,
      ...(update && { sha: update.sha }),
    }),
  });
  // A previous attempt may have committed successfully before the connection dropped.
  if (update && response.status === 409) {
    throw new Error('This entry changed while you were editing. Reload the Diary and try again.');
  }
  if (!update && (response.status === 409 || response.status === 422)) {
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

async function updateEntry(entry, replacement, token) {
  const source = entrySources.get(entry);
  const url = new URL(source.url, location.href);
  const match = url.pathname.match(/\/diary-entries\/([^/]+\.json)$/);
  if (url.origin !== location.origin || !match) throw new Error('The entry file could not be identified.');
  const file = match[1];
  const headers = githubHeaders(token);
  const metadata = await fetch(diaryDirectory + file + '?ref=main', { headers });
  if (!metadata.ok) throw new Error('Could not read the current entry. Check your publishing key and try again.');
  const { sha } = await metadata.json();
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Could not identify the current entry version.');
  const blob = await fetch(new URL('../../git/blobs/' + sha, diaryDirectory), {
    headers: { ...headers, Accept: 'application/vnd.github.raw+json' },
  });
  if (!blob.ok) throw new Error('Could not read the current entry file.');
  const records = await blob.json();
  if (!Array.isArray(records) || JSON.stringify(records[source.index]) !== JSON.stringify(entry)) {
    throw new Error('This entry has changed. Reload the Diary before editing.');
  }
  const revised = { ...entry, ...replacement };
  records[source.index] = revised;
  await publishEntries(records, token, { file, sha });
  Object.assign(entry, revised);
  renderEntries();
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
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'edit-entry';
  edit.textContent = 'Edit';
  edit.setAttribute('aria-label', 'Edit ' + entry.chamber + ' on ' + time.textContent);
  edit.addEventListener('click', () => {
    if (!enterDiaryCode()) return;
    editing = entry;
    legacyEntries = [];
    openEntryDialog();
  });
  details.append(heading, location, calendarLink(entry), edit);
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
  const { entries, sources, incomplete } = await readDiary();
  displayedEntries = entries;
  entrySources = sources;
  if (incomplete) {
    status.textContent = 'Some diary entries could not be loaded.';
  }
  renderEntries();
}

function renderEntries() {
  const today = calendarDate();
  const byDate = (a, b) => a.date.localeCompare(b.date);
  const upcoming = displayedEntries.filter((entry) => entry.date >= today).sort(byDate);
  const past = displayedEntries.filter((entry) => entry.date < today).sort((a, b) => byDate(b, a));
  for (const [id, records] of [['upcoming', upcoming], ['past', past]]) {
    get(id).replaceChildren(...records.map(makeEntry));
    get(id + '-empty').hidden = records.length > 0;
  }
}

let legacyEntries = [];

function enterDiaryCode() {
  const code = window.prompt('Enter the Diary access code.');
  if (code === '1966') return true;
  if (code !== null) window.alert('Incorrect access code.');
  return false;
}

function openEntryDialog() {
  form.reset();
  form.elements.date.value = editing?.date || calendarDate();
  const lodge = form.elements.chamber;
  lodge.querySelector('[data-existing-lodge]')?.remove();
  if (editing) {
    form.elements.location.value = editing.location;
    if (!Array.from(lodge.options).some((option) => option.value === editing.chamber)) {
      const option = new Option(editing.chamber, editing.chamber);
      option.dataset.existingLodge = '';
      lodge.add(option);
    }
    lodge.value = editing.chamber;
  }
  get('keep-photos').hidden = !editing?.photos.length;
  save.textContent = editing ? 'Save changes' : 'Publish entry';
  for (const name of ['date', 'location', 'chamber', 'photos']) {
    const field = form.elements[name];
    field.disabled = legacyEntries.length > 0;
    field.closest('label').hidden = field.disabled;
  }
  get('entry-title').textContent = editing ? 'Edit diary entry' : legacyEntries.length ? 'Publish previous entries' : 'New diary entry';
  get('form-error').textContent = '';
  get('publisher-key-label').hidden = Boolean(publishingKey);
  key.required = !publishingKey;
  dialog.showModal();
}

get('new-entry').addEventListener('click', () => {
  if (!enterDiaryCode()) return;
  editing = undefined;
  legacyEntries = [];
  openEntryDialog();
});
get('cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => {
  if (save.disabled) event.preventDefault();
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!dialog.open || save.disabled) return;
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
    if (editing) {
      const [replacement] = entries;
      if (!photos.length) replacement.photos = editing.photos;
      await updateEntry(editing, replacement, token);
    } else {
      await publishEntries(entries, token);
    }
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
      if (!enterDiaryCode()) return;
      editing = undefined;
      legacyEntries = entries;
      openEntryDialog();
    });
  }).catch(() => {});
}
