const get = (id) => document.getElementById(id);
const dialog = get('entry-dialog');
const form = get('entry-form');
const save = get('save');
const status = get('diary-status');
const photoUrls = [];
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });
let database;

function calendarDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
}

function openDiary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('saint-patrick-diary', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('events', {
      keyPath: 'id', autoIncrement: true
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readEntries() {
  return new Promise((resolve, reject) => {
    const request = database.transaction('events').objectStore('events').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeEntry(entry) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('events', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('events').add(entry);
  });
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
  details.append(heading, location);
  if (entry.photos.length) {
    const gallery = document.createElement('div');
    gallery.className = 'photos';
    entry.photos.forEach((photo, i) => {
      const url = URL.createObjectURL(photo);
      photoUrls.push(url);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      const image = document.createElement('img');
      image.src = url;
      image.loading = 'lazy';
      image.alt = 'Open photograph ' + (i + 1) + ' of ' + entry.chamber;
      link.append(image);
      gallery.append(link);
    });
    details.append(gallery);
  }
  item.append(time, details);
  return item;
}

async function refresh() {
  const entries = await readEntries();
  const today = calendarDate();
  const byDate = (a, b) => a.date.localeCompare(b.date) || a.id - b.id;
  photoUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  const upcoming = entries.filter((entry) => entry.date >= today).sort(byDate);
  const past = entries.filter((entry) => entry.date < today).sort((a, b) => byDate(b, a));
  for (const [id, records] of [['upcoming', upcoming], ['past', past]]) {
    get(id).replaceChildren(...records.map(makeEntry));
    get(id + '-empty').hidden = records.length > 0;
  }
}

get('new-entry').addEventListener('click', () => {
  form.reset();
  form.elements.date.value = calendarDate();
  get('form-error').textContent = '';
  dialog.showModal();
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
  if (!location.trim() || !chamber.trim()) {
    error.textContent = 'Enter a location and lodge chamber.';
    return;
  }
  if (photos.length > 3 || photos.some((photo) => !/^image\/(jpeg|png|webp|avif|gif)$/.test(photo.type) || photo.size > 10 * 1024 * 1024)) {
    error.textContent = 'Choose up to three JPG, PNG, WebP, AVIF or GIF photographs of 10 MB each.';
    return;
  }
  save.disabled = get('cancel').disabled = true;
  try {
    await storeEntry({ date, location: location.trim(), chamber: chamber.trim(), photos });
  } catch {
    error.textContent = 'The entry could not be saved. Check your browser storage and try again.';
    return;
  } finally {
    save.disabled = get('cancel').disabled = false;
  }
  dialog.close();
  status.textContent = 'Diary entry saved.';
  try {
    await refresh();
  } catch {
    status.textContent = 'Diary entry saved. Reload the diary to refresh the list.';
  }
});

openDiary().then(async (opened) => {
  database = opened;
  await refresh();
  get('new-entry').disabled = false;
}).catch(() => {
  status.textContent = 'The diary could not open. Check that this browser allows local storage.';
});
