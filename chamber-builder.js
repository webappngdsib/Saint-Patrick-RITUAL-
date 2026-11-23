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
  renderer.toneMappingExposure = 1.12;
  stage.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Lodge chamber with eight draggable officer chairs');
  const camera = new T.PerspectiveCamera(43, 1, .1, 100);
  const plan = new T.OrthographicCamera(-10, 10, 10, -10, .1, 100);
  plan.position.set(0, 24, 0);
  plan.up.set(0, 0, -1);
  plan.lookAt(0, 0, 0);
  let activeCamera = camera;
  const ambient = new T.HemisphereLight(0xffe8cb, 0x534332, 1.45);
  scene.add(ambient);
  const light = new T.DirectionalLight(0xffe0b4, 2.2);
  light.position.set(-3, 13, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -10, right: 10, top: 12, bottom: -12 });
  light.shadow.normalBias = .04;
  scene.add(light);

  const material = (color, roughness = .72, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  function texture(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }

  const walnut = texture(256, 512, (ctx) => {
    ctx.fillStyle = '#aa7751';
    ctx.fillRect(0, 0, 256, 512);
    for (let line = 0; line < 430; line++) {
      const x = (line * 73.21) % 256;
      ctx.strokeStyle = line % 3 ? 'rgba(67,34,18,.12)' : 'rgba(251,202,144,.18)';
      ctx.lineWidth = .25 + (line % 6) / 7;
      ctx.beginPath();
      for (let y = 0; y <= 512; y += 8) {
        const drift = Math.sin(y / 89 + x / 24) * 3.7 + Math.sin(y / 31 + x / 12) * .8;
        if (y === 0) ctx.moveTo(x + drift, y);
        else ctx.lineTo(x + drift, y);
      }
      ctx.stroke();
    }
  });
  function walnutFinish(color, roughness) {
    return new T.MeshStandardMaterial({ color, map: walnut, bumpMap: walnut, bumpScale: .027, roughness });
  }
  const wood = walnutFinish('#856042', .47);
  const trim = walnutFinish('#bf9674', .37);
  const panel = walnutFinish('#b78a66', .62);
  const leather = material('#37251d', .42);
  const leatherEdge = material('#513629', .43);
  const green = material('#145339');
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

  function spindle(parent, mat, x, y, z, height, radius) {
    const profile = [
      [0, 0], [.55, 0], [.65, .08], [.43, .18], [.49, .35],
      [.78, .65], [1, .78], [.64, .89], [.72, 1], [0, 1],
    ].map(([r, h]) => new T.Vector2(r * radius, h * height));
    const mesh = new T.Mesh(new T.LatheGeometry(profile, 12), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function curvedTrim(parent, mat, points, radius = .026) {
    const curve = new T.CatmullRomCurve3(points.map((point) => new T.Vector3(...point)));
    const mesh = new T.Mesh(new T.TubeGeometry(curve, 14, radius, 6, false), mat);
    mesh.castShadow = true;
    parent.add(mesh);
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
  for (let i = 0; i < 31; i++) {
    const x = (i - 15) * .45;
    for (const z of [-8.26, 8.26]) {
      box(scene, i % 3 ? panel : trim, [.442, .025, 1.62], [x, -.03, z]);
    }
  }
  for (let i = 0; i < 31; i++) {
    for (const x of [-6.14, 6.14]) {
      box(scene, i % 3 ? panel : wood, [1.71, .025, .572], [x, -.03, (i - 15) * .57]);
    }
  }
  const woven = texture(1024, 64, (ctx) => {
    ctx.fillStyle = '#143b2a';
    ctx.fillRect(0, 0, 1024, 64);
    ctx.strokeStyle = '#9c9a56';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 4, 1024, 56);
    for (const phase of [0, Math.PI]) {
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 2) {
        const y = 32 + 14 * Math.sin(x * Math.PI / 32 + phase);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  const carpet = new T.MeshStandardMaterial({ map: woven, roughness: .95 });
  function carpetEdge(length, x, z, angle) {
    const edge = new T.Mesh(new T.PlaneGeometry(length, .43), carpet);
    edge.rotation.set(-Math.PI / 2, 0, angle);
    edge.position.set(x, .031, z);
    edge.receiveShadow = true;
    scene.add(edge);
  }
  for (let row = 0; row < 20; row++) {
    for (let column = 0; column < 14; column++) {
      box(scene, (row + column) % 2 ? ivory : dark,
        [.66, .025, .72], [(column - 6.5) * .66, -.015, (row - 9.5) * .72]);
    }
  }
  for (const x of [-4.85, 4.85]) {
    box(scene, green, [.45, .035, 14.85], [x, 0, 0]);
    carpetEdge(14.85, x, 0, Math.PI / 2);
  }
  for (const z of [-7.4, 7.4]) {
    box(scene, green, [10.15, .036, .45], [0, 0, z]);
    carpetEdge(10.15, 0, z, 0);
    const direction = label(z < 0 ? 'EAST' : 'WEST', '#192f24', '#f5db9c', .28);
    direction.position.set(0, .08, z < 0 ? -8.15 : 8.15);
    scene.add(direction);
  }

  const walls = new T.Group();
  scene.add(walls);
  box(walls, wood, [14, 4.7, .18], [0, 2.35, -8.95]);
  function wallPanel(x, z, angle) {
    const frame = new T.Group();
    frame.position.set(x, 0, z);
    frame.rotation.y = angle;
    walls.add(frame);
    for (const [y, height] of [[2.89, 2.17], [.85, 1.11]]) {
      box(frame, panel, [1.62, height, .09], [0, y, 0]);
      for (const edge of [-1, 1]) {
        box(frame, trim, [.064, height, .095], [edge * .84, y, .045]);
        box(frame, trim, [1.75, .075, .095], [0, y + edge * height / 2, .045]);
      }
    }
    box(frame, wood, [2, .24, .16], [0, .16, .05]);
    box(frame, trim, [2, .12, .14], [0, 1.53, .05]);
    box(frame, trim, [2, .15, .14], [0, 4.15, .05]);
  }
  for (const x of [-6.95, 6.95]) {
    box(walls, wood, [.16, 4.7, 18], [x, 2.35, 0]);
    for (let z = -8; z <= 8; z += 2) wallPanel(x - Math.sign(x) * .105, z, -Math.sign(x) * Math.PI / 2);
  }
  for (let x = -6; x <= 6; x += 2) wallPanel(x, -8.83, 0);
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
  for (const [center, z] of [[-2.5, -5.6], [2.5, -5.6], [-2.7, 2.4], [2.7, 2.4]]) {
    spindle(walls, gold, center, 3.81, z, .9, .12);
    for (let arm = 0; arm < 6; arm++) {
      const theta = arm * Math.PI / 3;
      const offsetX = .62 * Math.cos(theta);
      const offsetZ = .62 * Math.sin(theta);
      const x = center + offsetX;
      curvedTrim(walls, gold, [
        [center, 3.95, z], [center + offsetX * .62, 3.69, z + offsetZ * .62],
        [x, 4.05, z + offsetZ]
      ], .029);
      spindle(walls, gold, x, 4.02, z + offsetZ, .1, .095);
      candle(x, 4.1, z + offsetZ, walls, false);
    }
    const glow = new T.PointLight(0xffba7d, 11, 7);
    glow.position.set(center, 4.15, z);
    walls.add(glow);
  }
  for (const x of [-6, -2, 2, 6]) {
    box(walls, gold, [.16, .36, .08], [x, 2.71, -8.66]);
    curvedTrim(walls, gold, [[x, 2.62, -8.64], [x, 2.55, -8.45], [x, 2.79, -8.37]]);
    candle(x, 2.78, -8.37, walls);
  }

  const drape = new T.PlaneGeometry(2.08, 1.09, 48, 12);
  const folds = drape.attributes.position;
  for (let i = 0; i < folds.count; i++) {
    const x = folds.getX(i);
    const y = folds.getY(i);
    const weight = (.545 - y) / 1.09;
    folds.setZ(i, Math.sin(x * 34 + weight * 1.3) * .042 * weight);
  }
  drape.computeVertexNormals();
  box(scene, linen, [1.98, 1.08, 1.5], [0, .54, 0]);
  for (const [x, z, angle, sx] of [[0, .77, 0, 1], [0, -.77, Math.PI, 1], [-1.01, 0, -Math.PI / 2, .74], [1.01, 0, Math.PI / 2, .74]]) {
    const cloth = new T.Mesh(drape, linen);
    cloth.position.set(x, .56, z);
    cloth.rotation.y = angle;
    cloth.scale.x = sx;
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    scene.add(cloth);
  }
  box(scene, green, [1.92, .04, 1.44], [0, 1.1, 0]);
  box(scene, gold, [1.99, .055, 1.51], [0, .13, 0]);
  box(scene, green, [.065, .55, .018], [0, .57, .82]);
  [ .39, .48, .57, .66, .75 ].forEach((y, i) =>
    box(scene, green, [.56 - Math.abs(i - 2) * .13, .045, .018], [0, y, .82]));
  for (const x of [-.24, .24]) {
    box(scene, wood, [.49, .048, .59], [x, 1.13, 0]);
    box(scene, ivory, [.45, .068, .55], [x, 1.16, 0]);
    for (let line = 0; line < 7; line++) {
      box(scene, dark, [.32, .003, .009], [x, 1.196, line * .055 - .16]);
    }
  }
  function candle(x, y, z, parent = scene, warmLight = true) {
    spindle(parent, gold, x, y, z, .12, .11);
    spindle(parent, ivory, x, y + .08, z, .28, .047);
    const flame = new T.Mesh(new T.SphereGeometry(.057, 10, 8),
      new T.MeshBasicMaterial({color: 0xffcb62}));
    flame.scale.y = 1.55;
    flame.position.set(x, y + .4, z);
    parent.add(flame);
    if (warmLight) {
      const glow = new T.PointLight(0xffa655, 2.6, 2.6);
      glow.position.set(x, y + .44, z);
      parent.add(glow);
    }
  }
  function desk(x, z) {
    box(scene, trim, [1.3, .12, .72], [x, .77, z]);
    box(scene, wood, [1.22, .16, .64], [x, .66, z]);
    for (const dx of [-.52, .52]) for (const dz of [-.26, .26])
      spindle(scene, trim, x + dx, 0, z + dz, .66, .077);
    const handle = new T.Mesh(new T.CylinderGeometry(.022, .032, .38, 12), wood);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(x + .25, .865, z + .11);
    scene.add(handle);
    const head = new T.Mesh(new T.CylinderGeometry(.059, .063, .18, 18), trim);
    head.rotation.x = Math.PI / 2;
    head.position.set(x + .08, .89, z + .11);
    scene.add(head);
  }
  candle(.77, 1.12, .38);
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
    const high = i === 0 ? 1.99 : 1.64;
    box(chair, trim, [.91, .16, .84], [0, .53, 0]);
    box(chair, leatherEdge, [.78, .095, .72], [0, .64, .025]);
    box(chair, leather, [.72, .075, .67], [0, .69, .025]);
    box(chair, leather, [.69, high - .9, .13], [0, (high + .56) / 2, -.37]);
    for (const dx of [-.39, .39]) {
      for (const dz of [-.31, .31]) spindle(chair, trim, dx * .9, 0, dz, .52, .078);
      spindle(chair, trim, dx, .55, -.37, high - .56, .067);
      spindle(chair, trim, dx, .56, .26, .37, .056);
      curvedTrim(chair, trim, [[dx, .99, -.36], [dx, .94, -.03], [dx, .94, .23], [dx, .89, .33]], .055);
      const finial = new T.Mesh(new T.SphereGeometry(.061, 12, 10), trim);
      finial.position.set(dx, high - .015, -.37);
      chair.add(finial);
      for (let stud = 0; stud < 11; stud++) {
        box(chair, gold, [.024, .024, .024], [dx * .79, .7 + (high - .98) * stud / 10, -.291]);
      }
    }
    curvedTrim(chair, trim, [[-.4, high - .11, -.37], [-.24, high - .075, -.38],
      [0, high + .035, -.38], [.24, high - .075, -.38], [.4, high - .11, -.37]], .066);
    curvedTrim(chair, gold, [[-.33, high - .14, -.285], [0, high - .055, -.285],
      [.33, high - .14, -.285]], .017);
    if (i === 0) {
      for (const side of [-1, 1]) {
        curvedTrim(chair, trim, [[0, high + .08, -.37], [side * .1, high + .14, -.37],
          [side * .19, high + .041, -.37], [side * .21, high - .03, -.37]], .036);
      }
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
    camera.position.set(aspect < 1 ? .5 : 1.65, 8.4, aspect < 1 ? 23 : 17.6);
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
