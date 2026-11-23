const get = (id) => document.getElementById(id);
const stage = get('stage');
const status = get('load-status');

const stations = [
  ['Knight Commander', 'Paul Johnston', 0, -6.7, 0],
  ['Priest', 'Paul Hollebone', 2.5, -6.7, 0],
  ['Senior Warden', 'Ioannis Benetatos', -2.8, -3.7, 0],
  ['Junior Warden', 'Tony Lewis', 2.8, -3.7, 0],
  ['Registrar', 'Lodge Warrant Station', -5.1, 0, 90],
  ['Master of Ceremonies', 'Simon Polkinghorne', 2.8, 4.8, 180],
  ['Deacon', 'Dimitrios Skiadopoulos', -2.8, 4.8, 180],
  ['Sentinel', 'Dimitrios Skiadopoulos', -2.8, 7.5, 180],
];

async function buildChamber() {
  const T = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
  const scene = new T.Scene();
  scene.background = new T.Color('#211a13');
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  stage.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Lodge chamber with eight draggable officer chairs');
  const camera = new T.PerspectiveCamera(43, 1, .1, 100);
  const plan = new T.OrthographicCamera(-10, 10, 10, -10, .1, 100);
  plan.position.set(0, 24, 0);
  plan.up.set(0, 0, -1);
  plan.lookAt(0, 0, 0);
  let activeCamera = camera;
  const ambient = new T.HemisphereLight(0xffedd3, 0x503521, 1.9);
  scene.add(ambient);
  const light = new T.DirectionalLight(0xffdfaa, 3.1);
  light.position.set(-3, 13, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -10, right: 10, top: 12, bottom: -12 });
  light.shadow.normalBias = .04;
  scene.add(light);

  const material = (color, roughness = .72, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const wood = material('#512c18');
  const trim = material('#986039');
  const panel = material('#71472b');
  const green = material('#145339');
  const velvet = material('#143e2e');
  const gold = material('#cba055', .36, .5);
  const ivory = material('#eee7d5');
  const dark = material('#28251f');
  const linen = material('#161b18');

  function box(parent, mat, size, position) {
    const mesh = new T.Mesh(new T.BoxGeometry(...size), mat);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function label(text, background = '#142a21', foreground = '#f5db9c', height = .36) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(3, 3, 506, 90, 15);
    ctx.fill();
    ctx.font = 'bold 32px Georgia';
    ctx.fillStyle = foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48, 480);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map, depthTest: false }));
    sprite.scale.set(height * 5.33, height, 1);
    return sprite;
  }

  box(scene, wood, [14, .16, 18], [0, -.12, 0]);
  for (let row = 0; row < 20; row++) {
    for (let column = 0; column < 14; column++) {
      box(scene, (row + column) % 2 ? ivory : dark,
        [.66, .025, .72], [(column - 6.5) * .66, -.015, (row - 9.5) * .72]);
    }
  }
  for (const x of [-4.85, 4.85]) {
    box(scene, green, [.45, .035, 14.85], [x, 0, 0]);
    box(scene, gold, [.035, .042, 14.85], [x, .01, 0]);
  }
  for (const z of [-7.4, 7.4]) {
    box(scene, green, [10.15, .036, .45], [0, 0, z]);
    box(scene, gold, [10.15, .042, .035], [0, .01, z]);
    const direction = label(z < 0 ? 'EAST' : 'WEST', '#192f24', '#f5db9c', .28);
    direction.position.set(0, .08, z < 0 ? -8.15 : 8.15);
    scene.add(direction);
  }

  const walls = new T.Group();
  scene.add(walls);
  box(walls, wood, [14, 4.7, .18], [0, 2.35, -8.95]);
  for (const x of [-6.95, 6.95]) {
    box(walls, wood, [.16, 4.7, 18], [x, 2.35, 0]);
    for (let z = -8; z <= 8; z += 2) {
      box(walls, panel, [.20, 3.9, 1.76], [x, 2.3, z]);
    }
  }
  for (let x = -6; x <= 6; x += 2) {
    box(walls, panel, [1.76, 3.9, .20], [x, 2.3, -8.85]);
  }
  const tapestry = document.createElement('canvas');
  tapestry.width = 384;
  tapestry.height = 528;
  const paint = tapestry.getContext('2d');
  paint.fillStyle = '#075235';
  paint.fillRect(0, 0, 384, 528);
  paint.strokeStyle = '#e3b954';
  for (const inset of [12, 22, 32]) paint.strokeRect(inset, inset, 384 - 2 * inset, 528 - 2 * inset);
  paint.fillStyle = '#f1cf72';
  paint.textAlign = 'center';
  paint.font = 'bold 38px Georgia';
  paint.fillText('ATHENIAN', 192, 99);
  paint.fillText('SHAMROCK', 192, 149);
  paint.font = 'bold 34px Georgia';
  paint.fillText('LODGE', 192, 193);
  paint.font = 'bold 177px Georgia';
  paint.fillText('♣', 192, 369);
  paint.font = 'bold 21px Georgia';
  paint.fillText('ORDER OF SAINT PATRICK', 192, 424);
  paint.fillText('GREECE', 192, 474);
  const bannerMap = new T.CanvasTexture(tapestry);
  bannerMap.colorSpace = T.SRGBColorSpace;
  const banner = new T.Mesh(new T.PlaneGeometry(1.75, 2.4), new T.MeshStandardMaterial({ map: bannerMap }));
  banner.position.set(-4.2, 2.7, -8.71);
  walls.add(banner);
  const secondBanner = banner.clone();
  secondBanner.position.x = 4.2;
  walls.add(secondBanner);
  for (const z of [-6, -1, 4]) {
    const ring = new T.Mesh(new T.TorusGeometry(.62, .035, 8, 28), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 4.1, z);
    walls.add(ring);
    for (let arm = 0; arm < 6; arm++) {
      const theta = arm * Math.PI / 3;
      box(walls, ivory, [.08, .22, .08], [.62 * Math.cos(theta), 4.22, z + .62 * Math.sin(theta)]);
    }
  }

  box(scene, linen, [1.98, 1.08, 1.5], [0, .54, 0]);
  box(scene, green, [1.92, .04, 1.44], [0, 1.1, 0]);
  box(scene, gold, [1.99, .055, 1.51], [0, .13, 0]);
  box(scene, green, [.065, .55, .018], [0, .57, .76]);
  [ .39, .48, .57, .66, .75 ].forEach((y, i) =>
    box(scene, green, [.56 - Math.abs(i - 2) * .13, .045, .018], [0, y, .76]));
  for (const x of [-.24, .24]) {
    box(scene, wood, [.49, .048, .59], [x, 1.13, 0]);
    box(scene, ivory, [.45, .068, .55], [x, 1.16, 0]);
    for (let line = 0; line < 7; line++) {
      box(scene, dark, [.32, .003, .009], [x, 1.196, line * .055 - .16]);
    }
  }
  function candle(x, y, z) {
    box(scene, gold, [.23, .06, .23], [x, y + .03, z]);
    box(scene, ivory, [.083, .31, .083], [x, y + .2, z]);
    const flame = new T.Mesh(new T.SphereGeometry(.057, 10, 8),
      new T.MeshBasicMaterial({color: 0xffcb62}));
    flame.scale.y = 1.55;
    flame.position.set(x, y + .4, z);
    scene.add(flame);
  }
  function desk(x, z) {
    box(scene, trim, [1.3, .12, .72], [x, .77, z]);
    for (const dx of [-.52, .52]) for (const dz of [-.26, .26])
      box(scene, wood, [.1, .72, .1], [x + dx, .36, z + dz]);
    box(scene, wood, [.38, .05, .065], [x + .25, .86, z + .11]);
    box(scene, trim, [.12, .11, .21], [x + .08, .88, z + .11]);
  }
  desk(0, -5.5);
  candle(-.43, .83, -5.59);
  const salt = new T.Mesh(new T.CylinderGeometry(.13, .09, .06, 24), ivory);
  salt.position.set(.4, .86, -5.65);
  scene.add(salt);
  desk(-4.15, 0);
  box(scene, ivory, [.38, .018, .44], [-4.35, .842, -.09]);
  desk(-2.8, -2.7);
  desk(2.8, -2.7);

  const chairs = [];
  stations.forEach(([office, , x, z, angle], i) => {
    const chair = new T.Group();
    chair.userData.station = i;
    const high = i === 0 ? 1.72 : 1.45;
    box(chair, wood, [.85, .17, .82], [0, .53, 0]);
    box(chair, velvet, [.71, .12, .68], [0, .66, .025]);
    box(chair, trim, [.82, high - .55, .14], [0, (.55 + high) / 2, -.37]);
    box(chair, velvet, [.65, high - .72, .05], [0, (.65 + high) / 2, -.284]);
    box(chair, gold, [.83, .035, .15], [0, high - .12, -.37]);
    for (const dx of [-.33, .33]) {
      for (const dz of [-.31, .31]) box(chair, wood, [.11, .55, .11], [dx, .275, dz]);
      box(chair, trim, [.1, .1, .7], [dx, .87, .015]);
      box(chair, wood, [.085, .27, .085], [dx, .73, .26]);
    }
    chair.position.set(x, 0, z);
    chair.rotation.y = T.MathUtils.degToRad(angle);
    scene.add(chair);
    const badge = label(`${i + 1} · ${office}`, '#173428');
    badge.position.set(x, high + .28, z);
    scene.add(badge);
    chairs.push({ chair, badge });
    get('chair').add(new Option(`${i + 1} · ${office}`, String(i)));
  });

  const selection = new T.Mesh(new T.RingGeometry(.64, .72, 48),
    new T.MeshBasicMaterial({ color: '#f6cc6a', side: T.DoubleSide }));
  selection.rotation.x = -Math.PI / 2;
  scene.add(selection);
  let selected = 0;
  function draw() { renderer.render(scene, activeCamera); }
  function update() {
    const { chair } = chairs[selected];
    const angle = (Math.round(T.MathUtils.radToDeg(chair.rotation.y)) + 360) % 360;
    get('chair').value = String(selected);
    get('officer').textContent = stations[selected][1];
    get('x').value = chair.position.x;
    get('z').value = chair.position.z;
    get('angle').value = angle;
    get('angle-value').value = `${angle}°`;
    selection.position.set(chair.position.x, .05, chair.position.z);
    draw();
  }
  function place(x, z) {
    const { chair, badge } = chairs[selected];
    chair.position.x = T.MathUtils.clamp(x, -6, 6);
    chair.position.z = T.MathUtils.clamp(z, -8, 8);
    badge.position.x = chair.position.x;
    badge.position.z = chair.position.z;
    update();
  }
  function rotate(angle) {
    chairs[selected].chair.rotation.y = T.MathUtils.degToRad((angle + 360) % 360);
    update();
  }
  get('chair').addEventListener('change', (event) => { selected = Number(event.target.value); update(); });
  get('x').addEventListener('input', (event) => place(Number(event.target.value), chairs[selected].chair.position.z));
  get('z').addEventListener('input', (event) => place(chairs[selected].chair.position.x, Number(event.target.value)));
  get('angle').addEventListener('input', (event) => rotate(Number(event.target.value)));
  get('turn-left').addEventListener('click', () => rotate(Number(get('angle').value) - 15));
  get('turn-right').addEventListener('click', () => rotate(Number(get('angle').value) + 15));
  get('reset').addEventListener('click', () => {
    chairs.forEach(({ chair, badge }, i) => {
      const [, , x, z, angle] = stations[i];
      chair.position.set(x, 0, z);
      chair.rotation.y = T.MathUtils.degToRad(angle);
      badge.position.x = x;
      badge.position.z = z;
    });
    update();
  });

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    const aspect = width / height;
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    camera.position.set(0, 11, aspect < 1 ? 22 : 17);
    camera.lookAt(0, .1, -.7);
    camera.updateProjectionMatrix();
    const halfHeight = Math.max(10, 7.6 / aspect);
    Object.assign(plan, { left: -halfHeight * aspect, right: halfHeight * aspect,
      top: halfHeight, bottom: -halfHeight });
    plan.updateProjectionMatrix();
    draw();
  }

  for (const [id, view] of [['perspective', camera], ['plan', plan]]) {
    get(id).addEventListener('click', () => {
      activeCamera = view;
      walls.visible = view === camera;
      get('perspective').setAttribute('aria-pressed', String(view === camera));
      get('plan').setAttribute('aria-pressed', String(view === plan));
      draw();
    });
  }
  const raycaster = new T.Raycaster();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const point = new T.Vector3();
  const pointer = new T.Vector2();
  const canvas = renderer.domElement;
  let drag;
  function pointRay(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, activeCamera);
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) return;
    pointRay(event);
    const [hit] = raycaster.intersectObjects(chairs.map(({ chair }) => chair), true);
    if (!hit || !raycaster.ray.intersectPlane(plane, point)) return;
    selected = hit.object.parent.userData.station;
    const { position } = chairs[selected].chair;
    drag = { id: event.pointerId, x: position.x - point.x, z: position.z - point.z };
    canvas.setPointerCapture(event.pointerId);
    update();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    pointRay(event);
    if (raycaster.ray.intersectPlane(plane, point)) place(point.x + drag.x, point.z + drag.z);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(eventName, (event) => {
      if (drag?.id === event.pointerId) drag = undefined;
    });
  }
  new ResizeObserver(resize).observe(stage);
  get('position').disabled = false;
  status.hidden = true;
  resize();
  update();
}

buildChamber().catch(() => {
  status.textContent = 'The 3D chamber could not load. Check that WebGL is enabled and reload the page.';
});
