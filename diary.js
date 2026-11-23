const get = (id) => document.getElementById(id);
const dialog = get('entry-dialog');
const form = get('entry-form');
const save = get('save');
const status = get('diary-status');
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });
let downloadUrl;
const allowedPhoto = /^data:image\/(jpeg|png|webp|avif|gif);base64,[a-z\d+/]+=*$/i;

function calendarDate() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
}

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

function offerDownload(entries, title) {
  const blob = new Blob([JSON.stringify(entries, null, 2) + '\n'], { type: 'application/json' });
  if (blob.size > 24 * 1024 * 1024) throw new Error('This export exceeds the GitHub web upload limit.');
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(blob);
  const link = get('download-entry');
  link.href = downloadUrl;
  link.download = title + '-' + crypto.randomUUID().slice(0, 8) + '.json';
  get('publish-entry').hidden = false;
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
  const manifest = await readJson('./diary-feed.json');
  const results = await Promise.allSettled(manifest.map(readJson));
  const entries = results.flatMap((result) =>
    result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.filter(validEntry) : []);
  if (results.some((result) => result.status === 'rejected')) {
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
    const entry = await prepareEntry({ date, location: location.trim(), chamber: chamber.trim(), photos });
    offerDownload([entry], 'event-' + date);
    dialog.close();
    get('download-entry').focus();
    status.textContent = 'Entry ready for GitHub.';
  } catch {
    error.textContent = 'The entry could not be prepared. Check that the photographs open and try again.';
    return;
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
    get('export-legacy').addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      const button = event.currentTarget;
      try {
        const exported = [];
        for (const entry of entries) exported.push(await prepareEntry(entry));
        offerDownload(exported, 'browser-diary-export');
        get('download-entry').focus();
        status.textContent = 'Browser entries ready for GitHub.';
      } catch (error) {
        status.textContent = 'Could not prepare the browser export. ' + error.message;
      } finally {
        button.disabled = false;
      }
    });
  }).catch(() => {});
}
