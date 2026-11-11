// A simplified 2.5D model of the campus, built from the colour-coded campus map (campus.json holds the outlines traced from it, see tools/extract.py):
// teaching buildings and dorms are extruded, sports grounds / green / water are flat, trees are scattered over the green. The faculty housing is left out on purpose.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';


const S = 0.012; // world units per map pixel
const { TREASURES, FINALE, INTRO } = await import('./hunt.js?v=' + Date.now()); // (the texts are edited often: never a stale copy)
const data = await (await fetch('./campus.json', { cache: 'no-cache' })).json();
const cx = data.w / 2, cy = data.h / 2;
{ const list = data.classes.dorm, i = list.findIndex((p) => inRing(p.outer, 711 - data.x0, 753 - data.y0)), cut = 725 - data.x0;
  const lift = ([x, y]) => [x, y - 8 - (y >= 757 - data.y0 ? 2 : 0)]; // 26号楼 and 27号楼 move 8 map px north and lose 2 px on their south side: the gap to the buildings south of them (27号楼's door) gets wider
  if (i >= 0) { const p = list[i]; list[i] = { ...p, outer: clipX(p.outer, cut, true).map(lift) }; list.push({ ...p, outer: clipX(p.outer, cut, false).map(lift), his: true }); } } // 27号楼 is his: blue
const wx = (x) => (x - cx) * S, wz = (y) => (y - cy) * S;
const pt = (mx, my) => [wx(mx - data.x0), wz(my - data.y0)]; // from picture pixels

const host = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const BG = new THREE.Color('#e9e5da'); scene.background = BG; scene.fog = new THREE.Fog(BG, 34, 80);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const HOME = { pos: new THREE.Vector3(5.5, 12.5, 12.5), target: new THREE.Vector3(0, 0, 0.8) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 4, maxDistance: 34, maxPolarAngle: 1.22, minPolarAngle: 0.35, screenSpacePanning: false });
controls.update();

scene.add(new THREE.HemisphereLight('#fff6e4', '#a9b6a0', 1.35));
const sun = new THREE.DirectionalLight('#fff0d6', 2.2);
sun.position.set(-7, 12, 6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
scene.add(sun);

// ---- shapes from the traced outlines
const toShape = (poly) => {
  const sh = new THREE.Shape(poly.outer.map(([x, y]) => new THREE.Vector2(wx(x), -wz(y))));
  for (const h of poly.holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(wx(x), -wz(y)))));
  return sh;
};
const solids = []; // the buildings, for the camera's line-of-sight check
function slab(poly, depth, mats, y = 0) {
  const shown = depth; if (y === 0.05) { depth += 0.05; y = 0; } // a building stands on the ground (y = 0), not on the 0.05 plinth of the greens: it used to float
  const g = new THREE.ExtrudeGeometry(toShape(poly), { depth, bevelEnabled: shown > 0.3, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); // shape y -> world -z, extrusion up
  const m = new THREE.Mesh(g, mats); m.position.y = y; m.castShadow = shown > 0.2; m.receiveShadow = true; scene.add(m); if (shown > 0.2) solids.push(m); return m;
}
const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const hash = (poly) => { const [x, y] = poly.outer[0]; return ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1; };

// ---- ground and roads
// 建华楼 (the purple 经管新楼 on the map) has an open sunken court between its main wing and its east wing; map picture pixels
const COURT = { x0: 852, x1: 873, y0: 1375, y1: 1394, top: -0.07 };
const ground = data.classes.ground[0];
ground.holes.push([[COURT.x0, COURT.y0], [COURT.x1, COURT.y0], [COURT.x1, COURT.y1], [COURT.x0, COURT.y1]].map(([x, y]) => [x - data.x0, y - data.y0]));
slab(ground, 0.12, [mat('#dcd8cd', 1), mat('#cfcabb', 1)], -0.12);
// a soft base under it, so the campus looks like a model on a table
const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.14, 1), mat('#cdc8b9', 1));
base.visible = false; scene.add(base);

// ---- water, green, sports (flat)
for (const p of data.classes.water) slab(p, 0.02, [mat('#a9c5dc', .35), mat('#8fb0cb', .5)], 0.005);
const greens = data.classes.green;
for (const p of greens) slab(p, 0.05, [mat('#bad39f', 1), mat('#9fbd85', 1)], 0);
for (const p of data.classes.sport) { /* drawn after the places are known, see below */ }

// ---- the places that matter: names, kinds and heights (map pixel positions read off the picture)
// kind: canteen (食堂) | gate | sport (a big hall or ground) | major | minor ; h: a fixed height instead of the guessed one
const PLACES = [
  // canteens
  ['紫荆园', 862, 543, 'canteen'], ['玉树园', 1044, 585, 'canteen'], ['芝兰园', 1130, 683, 'canteen'], ['闻馨园', 522, 894, 'canteen'], ['荷园', 488, 1150, 'canteen'], ['近春园餐厅', 497, 1213, 'canteen'], ['桃李园', 731, 612, 'canteen'], ['听涛园', 774, 916, 'canteen'],
  ['丁香园', 770, 812, 'canteen'], ['清芬园', 821, 951, 'canteen'], ['观畴园', 548, 882, 'canteen'],
  // halls and big sports buildings
  ['综合体育馆', 1018, 1098, 'sport', 0.38], ['游泳馆', 971, 870, 'sport', 0.34], ['北体育馆', 1037, 878, 'sport', 0.34], ['气膜体育馆', 1012, 514, 'sport', 0.3], ['西体育馆', 336, 0, 'skip'],
  // fields
  ['西大操场', 554, 995, 'field'],  ['东大操场', 1013, 990, 'field'], ['紫荆操场', 897, 690, 'field'],
  // landmarks
  ['图书馆', 607, 1007, 'major', 0.62], ['大礼堂', 650, 1128, 'major', 0.55], ['清华学堂', 699, 1202, 'major', 0.42], ['工字厅', 574, 1159, 'major', 0.36], ['中央主楼', 1014, 1258, 'major', 0.95],
  ['西主楼', 972, 1250, 'minor', 0.7], ['东主楼', 1056, 1250, 'minor', 0.7], ['新清华学堂', 869, 1261, 'major', 0.5], ['艺术博物馆', 1165, 1252, 'major', 0.5], ['经管学院', 947, 1424, 'major', 0.55],
  ['美术学院', 1183, 1414, 'major', 0.5], ['苏世民书院', 894, 861, 'minor', 0.5], ['清华科技园', 912, 1736, 'major', 0.8], ['李兆基科技大楼', 860, 1597, 'minor', 0.7],
  ['新水利馆', 697, 1118, 'minor'], ['旧水利馆', 713, 1226, 'minor'], ['机械工程馆', 690, 1282, 'minor'], ['科学馆', 619, 1161, 'minor'], ['理科楼', 427, 981, 'minor'], ['生命科学馆', 446, 1047, 'minor'],
  ['人文社科图书馆', 834, 1078, 'minor'], ['新土木馆', 883, 1104, 'minor'], ['第六教学楼', 895, 1189, 'minor'], ['第三教学楼', 837, 1174, 'minor'], ['校史馆', 867, 1230, 'minor'],
  ['建筑馆', 1042, 1403, 'minor'], ['明法楼', 832, 1403, 'minor'], ['建华楼', 842, 1357, 'minor'], ['自强科技楼', 1142, 1098, 'minor'], ['工物馆', 1068, 1196, 'minor'], ['纳米科技楼', 836, 1470, 'minor'], ['集成电路学院', 896, 1470, 'minor'],
  // gates
  ['北门', 551, 627, 'gate'], ['西北门', 366, 884, 'gate'], ['东北门', 1237, 775, 'gate'], ['东三门', 1241, 1139, 'gate'], ['西门', 213, 1344, 'gate'], ['南门', 800, 1745, 'gate'], ['东南门', 1013, 1660, 'gate'],
].filter((p) => p[3] !== 'skip');
const local = (gx, gy) => [gx - data.x0, gy - data.y0];
const centroid = (p) => { let x = 0, y = 0; for (const q of p.outer) { x += q[0]; y += q[1]; } return [x / p.outer.length, y / p.outer.length]; };
function inRing(ring, x, y) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) c = !c; } return c; }
function findPoly(lists, gx, gy, reach = 46) {
  const [x, y] = local(gx, gy); let best = null, bd = reach;
  for (const list of lists) for (const p of list) {
    if (inRing(p.outer, x, y) && !p.holes.some((h) => inRing(h, x, y))) return p;
    const [cx0, cy0] = centroid(p), d = Math.hypot(cx0 - x, cy0 - y); if (d < bd) { bd = d; best = p; }
  }
  return best;
}
const special = new Map(); // polygon -> { kind, h }
for (const [name, gx, gy, kind, h] of PLACES) {
  if (kind === 'canteen') { const p = findPoly([data.classes.dorm, data.classes.teach], gx, gy, 38); if (p) special.set(p, { kind, h: 0.5 }); }
  else if (kind === 'sport') { const p = findPoly([data.classes.sport], gx, gy, 60); if (p) special.set(p, { kind, h }); }
  else if (kind === 'major' || kind === 'minor') { const p = findPoly([data.classes.teach, data.classes.dorm], gx, gy, 40); if (p && !special.has(p)) special.set(p, { kind, h }); }
}

// ---- sports: fields are flat, the halls are raised (the old 北足球场 next to 34号楼 is being renovated: bare ground)
const workPoly = findPoly([data.classes.sport], 956, 805, 24);
for (const p of data.classes.sport) {
  const sp = special.get(p);
  if (p === workPoly) { slab(p, 0.02, [mat('#e2d4ae', 1), mat('#cbbb92', 1)], 0.01); continue; }
  slab(p, sp ? sp.h : 0.04, sp ? [mat('#f3e79a', .8), mat('#d9ca66', .9)] : [mat('#f1e48a', .9), mat('#d8c95f', 1)], 0.01);
}

// ---- buildings
const wallT = mat('#e8e3d6', .95), roofT = mat('#d0d8dc', .75), wallD = mat('#e6eee4', .95), roofD = mat('#d6e8e1', .8);
const wallC = mat('#f7ead6', .95), roofC = mat('#f0c394', .7), roofM = mat('#c6d1db', .7), wallM = mat('#eeeade', .95);
const shoelace = (r) => Math.abs(r.reduce((a, [x, y], i) => a + (x * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y), 0)) / 2;
const perimeter = (r) => r.reduce((a, [x, y], i) => a + Math.hypot(r[(i + 1) % r.length][0] - x, r[(i + 1) % r.length][1] - y), 0);
// how thick the shape is (area / half the outline): a thin strip is a low wing, a fat block is the tall part
const thickness = (p) => { const a = shoelace(p.outer) - p.holes.reduce((s, h) => s + shoelace(h), 0); return (2 * a) / (perimeter(p.outer) + p.holes.reduce((s, h) => s + perimeter(h), 0) + 1); };
const jhPoly = findPoly([data.classes.teach], 860, 1360, 6);
const jhEast = [[893, 1388], [946, 1388], [946, 1394], [948, 1394], [951, 1398], [951, 1404], [946, 1409], [941, 1409], [936, 1405], [936, 1403], [932, 1403], [931, 1409], [929, 1410], [929, 1412], [924, 1414], [924, 1418], [967, 1418], [967, 1403], [956, 1403], [956, 1388], [987, 1388], [987, 1420], [989, 1420], [992, 1423], [992, 1433], [907, 1433], [907, 1395], [893, 1395]];
for (const p of data.classes.teach) {
  const k = hash(p), t = Math.min(1, thickness(p) / 40), sp = special.get(p);
  if (p === jhPoly) { slab({ outer: jhEast.map(([x, y]) => [x - data.x0, y - data.y0]), holes: [], cells: p.cells }, sp?.h ?? 0.55, [roofM, wallM], 0.05); continue; }
  const h = sp?.h ?? Math.min(0.7, 0.14 + t * 0.42 * (0.65 + k * 0.7));
  slab(p, h, sp?.kind === 'canteen' ? [roofC, wallC] : sp ? [roofM, wallM] : [roofT, wallT], 0.05);
}
// ---- my dorm: 34号楼, the east half of the pair 33/34 south of Zijing field (the two are one shape on the map: cut it in the middle)
const MINE = { gx: 908, gy: 793, splitGx: 896 };
const pairPoly = findPoly([data.classes.dorm], MINE.gx, MINE.gy, 12);
function clipX(ring, xs, keepEast) { // Sutherland-Hodgman against the line x = xs
  const out = [], inx = (p) => (keepEast ? p[0] >= xs : p[0] <= xs);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ia = inx(a), ib = inx(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (xs - a[0]) / (b[0] - a[0]); out.push([xs, a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
const roofHim = mat('#4a86d6', .55), wallHim = mat('#d6e6fb', .85); roofHim.emissive = new THREE.Color('#2f6fcc'); roofHim.emissiveIntensity = 0.22;
const roofMine = mat('#ff5c93', .55), wallMine = mat('#ffd3e2', .85);
roofMine.emissive = new THREE.Color('#ff2f78'); roofMine.emissiveIntensity = 0.28;
let mineMesh = null, mineBox = null, mineH = 0.4, mineRing = null;
for (const p of data.classes.dorm) {
  const k = hash(p), t = Math.min(1, thickness(p) / 30), sp = special.get(p);
  const h = sp?.h ?? Math.min(0.8, 0.3 + t * 0.35 * (0.7 + k * 0.6));
  if (p.his) { slab(p, h, [roofHim, wallHim], 0.05); continue; }
  if (p === pairPoly) {
    const split = MINE.splitGx - data.x0;
    slab({ outer: clipX(p.outer, split, false), holes: [], cells: p.cells }, h, [roofD, wallD], 0.05);
    const east = clipX(p.outer, split, true); mineRing = east;
    mineH = h; // the same height as before: only the colour is different
    mineMesh = slab({ outer: east, holes: [], cells: p.cells }, h, [roofMine, wallMine], 0.05);
    const xs = east.map((q) => q[0]), ys = east.map((q) => q[1]);
    mineBox = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    continue;
  }
  slab(p, h, sp?.kind === 'canteen' ? [roofC, wallC] : [roofD, wallD], 0.05);
}
// ---- the faculty housing (家属区, orange on the map): low blocks in a warm, light peach
const wallH = mat('#f1e4da', .95), roofH = mat('#e3c4b4', .75);
for (const p of data.classes.orange ?? []) { const k = hash(p), t = Math.min(1, thickness(p) / 22); slab(p, Math.min(0.2, 0.08 + t * 0.1 * (0.7 + k * 0.6)), [roofH, wallH], 0.05); }
for (const [p, sp] of special) if (sp.kind === 'sport' && data.classes.sport.includes(p)) { /* halls are raised in the sports loop below */ }


// ---- the scene at the foot of 34号楼, on the side next to the football pitches (北足球场)
const fieldPoly = findPoly([data.classes.sport], 956, 805, 24);
const L = (gx, gy) => [wx(gx - data.x0), wz(gy - data.y0)]; // map picture pixel -> world x, z
const props = new THREE.Group(); scene.add(props);
const add = (geo, m, x, y, z, ry = 0, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = shadow; o.receiveShadow = true; props.add(o); return o; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const PW = mat('#ffffff', .9), PG = mat('#c9dfae', 1), PM = mat('#9a9a92', .6);

// ---- 建华楼: main wing (west) + east wing, six floors on a basement; the sunken court between them (stairs down on the west and south sides, glass basement walls, planters, benches, trees)
const FH = 0.078, JH_WING = 6 * FH, JH_STRIP = 5 * FH, DEPTH = 0.05 - COURT.top; // DEPTH: from the 0.05 plinth level to the court floor
const jh = { wing: [[810, 1343], [858, 1343], [859, 1350], [873, 1350], [873, 1374], [810, 1374]], strip: [[873, 1349], [893, 1349], [893, 1433], [873, 1433], [873, 1394], [878, 1394], [878, 1388], [873, 1388]] };
const jhLocal = (r) => r.map(([x, y]) => [x - data.x0, y - data.y0]);
const roofJ = mat('#e4e8e8', .65), wallJ = mat('#ece6d8', .95), ledgeJ = mat('#cfc7b4', .9), glassJ = mat('#587a90', .3), stoneJ = mat('#ddd6c6', .9), floorJ = mat('#d9d1bf', 1);
glassJ.emissive = new THREE.Color('#2d4a5e'); glassJ.emissiveIntensity = 0.18;
slab({ outer: jhLocal(jh.wing), holes: [], cells: 1 }, JH_WING, [roofJ, wallJ], 0.05);
slab({ outer: jhLocal(jh.strip), holes: [], cells: 1 }, JH_STRIP, [roofJ, wallJ], 0.05);
{
  const win = [], ledges = [], dm = new THREE.Object3D();
  const shared = (a, b) => a[0] === 873 && b[0] === 873 && Math.min(a[1], b[1]) >= 1349 && Math.max(a[1], b[1]) <= 1374; // the wall the two wings share
  const facade = (ring, floors) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 5 || shared(a, b)) continue;
      const dx = (b[0] - a[0]) / len, dy = (b[1] - a[1]) / len, sgn = inRing(ring, (a[0] + b[0]) / 2 + dy * 1.5, (a[1] + b[1]) / 2 - dx * 1.5) ? -1 : 1, nx = dy * sgn, ny = -dx * sgn, ang = Math.atan2(dy, dx); // outward = the side that is not inside the ring (the extrusion's bevel puts the wall about 1 map px outside the outline, so everything sits a little further out)
      for (let f = 0; f < floors; f++) {
        for (let d = 2.5; d < len - 1.5; d += 3.4) win.push([a[0] + dx * d + nx * 1.3, a[1] + dy * d + ny * 1.3, ang, 0.05 + FH * (f + 0.5), 0.034, 0.043]);
        ledges.push([a[0] + dx * len / 2 + nx * 1.1, a[1] + dy * len / 2 + ny * 1.1, ang, 0.05 + FH * (f + 1) - 0.002, len, 0.006]); // floor ledge: a thin strip running along the wall
      }
      ledges.push([a[0] + dx * len / 2 + nx * 0.9, a[1] + dy * len / 2 + ny * 0.9, ang, 0.05 + FH * floors + 0.008, len, 0.016]); // roof parapet
    }
  };
  facade(jh.wing, 6); facade(jh.strip, 5);
  // the glass basement: the wall of the court under the main wing (north side) and under the east wing (east side)
  const ng = [[(COURT.x0 + COURT.x1) / 2, COURT.y0 - 0.2, 0], [COURT.x1 - 0.2, (COURT.y0 + COURT.y1) / 2, Math.PI / 2]];
  for (let d = COURT.x0 + 2; d < COURT.x1 - 1; d += 3.4) win.push([d, COURT.y0 + 0.3, Math.PI, -0.03, 0.034, 0.04]);
  for (let d = COURT.y0 + 2; d < COURT.y1 - 6; d += 3.4) win.push([COURT.x1 - 0.3, d, -Math.PI / 2, -0.03, 0.034, 0.04]);
  void ng;
  const wm = new THREE.InstancedMesh(box(1, 1, 0.004), glassJ, win.length);
  win.forEach(([gx, gy, ang, y, w, h], i) => { dm.position.set(wx(gx - data.x0), y, wz(gy - data.y0)); dm.rotation.set(0, -ang, 0); dm.scale.set(w, h, 1); dm.updateMatrix(); wm.setMatrixAt(i, dm.matrix); });
  props.add(wm);
  const lm = new THREE.InstancedMesh(box(1, 1, 0.012), ledgeJ, ledges.length);
  ledges.forEach(([gx, gy, ang, y, lenPx, h], i) => { dm.position.set(wx(gx - data.x0), y, wz(gy - data.y0)); dm.rotation.set(0, -ang, 0); dm.scale.set(lenPx * S, h, 1); dm.updateMatrix(); lm.setMatrixAt(i, dm.matrix); });
  lm.castShadow = true; props.add(lm);
  // roof: a glazed lantern over the main wing, plant boxes
  const [rx, rz] = L(834, 1358); add(box(0.2, 0.03, 0.12), mat('#9fc3d6', .3), rx, 0.05 + JH_WING + 0.015, rz, 0, true); add(box(0.08, 0.05, 0.07), stoneJ, rx + 0.28, 0.05 + JH_WING + 0.025, rz + 0.04, 0, true);
  const [sx, sz] = L(883, 1410); add(box(0.1, 0.04, 0.12), stoneJ, sx, 0.05 + JH_STRIP + 0.02, sz, 0, true);
}
{ // the sunken court itself
  const c = COURT, W = 7, [x0w, z0w] = L(c.x0, c.y0), [x1w, z1w] = L(c.x1, c.y1), w = x1w - x0w, d = z1w - z0w, top = c.top;
  add(box(w, 0.05, d), floorJ, (x0w + x1w) / 2, top - 0.025, (z0w + z1w) / 2, 0, false);                                    // the court floor
  const wall = (cx0, cz0, ww, dd, yb, yt) => add(box(ww, yt - yb, dd), stoneJ, cx0, (yb + yt) / 2, cz0, 0, true);
  wall((x0w + x1w) / 2, z0w - 0.005, w + 0.02, 0.01, top, 0.05);                                                              // north wall (under the main wing)
  wall(x1w + 0.005, (z0w + z1w) / 2, 0.01, d + 0.02, top, 0.05);                                                              // east wall (under the east wing)
  // stairs down: five steps along the west side and along the south side
  for (let k = 0; k < 5; k++) {
    const sw = (W / 5) * 0.012 * (k + 1), yTop = -(0.07 / 5) * (k + 1) + 0.0, h = yTop - top;
    add(box((W / 5) * 0.012, h + 0.04, d - 0.0), stoneJ, x0w + (W / 5) * 0.012 * (k + 0.5), top + (h + 0.04) / 2 - 0.0, (z0w + z1w) / 2, 0, true); void sw; // west steps
  }
  for (let k = 0; k < 5; k++) { const yTop = -(0.07 / 5) * (k + 1), h = yTop - top; add(box(w - (W) * 0.012, h + 0.04, (W / 5) * 0.012), stoneJ, (x0w + x1w) / 2 + (W * 0.012) / 2, top + (h + 0.04) / 2, z1w - (W / 5) * 0.012 * (k + 0.5), 0, true); } // south steps
  // pavers: a light grid on the floor
  for (let i = 1; i < 5; i++) add(box(0.002, 0.002, d - 0.02), mat('#c9c1ad', 1), x0w + (w / 5) * i + 0.03, top + 0.001, (z0w + z1w) / 2, 0, false);
  // planters, benches, trees
  for (const [gx, gy] of [[864, 1382], [868, 1389]]) { const [px, pz] = L(gx, gy); add(box(0.075, 0.018, 0.04), stoneJ, px, top + 0.009, pz, 0, true); add(box(0.065, 0.01, 0.03), mat('#8fb27a', 1), px, top + 0.02, pz, 0, false); }
  for (const [gx, gy] of [[860, 1380], [870, 1380]]) { const [px, pz] = L(gx, gy); add(box(0.05, 0.012, 0.016), mat('#a9835b', .8), px, top + 0.016, pz, 0, true); }
  for (const [gx, gy, sz] of [[866, 1386, 0.045], [858, 1380, 0.038]]) { const [px, pz] = L(gx, gy); add(new THREE.CylinderGeometry(0.008, 0.01, 0.05, 6), mat('#8a6d4f', 1), px, top + 0.025, pz, 0, true); add(new THREE.IcosahedronGeometry(sz, 1), mat('#a7b04e', 1), px, top + 0.06 + sz * 0.5, pz, 0, true); }
}
// walking: the court floor is lower; the steps on the west and south sides lead down (heights for the cat and the ride)
const floorY = (x, z) => { const gx = x / S + cx + data.x0, gy = z / S + cy + data.y0; if (gx <= COURT.x0 || gx >= COURT.x1 - 0.5 || gy <= COURT.y0 + 0.5 || gy >= COURT.y1) return 0.05; const Wd = 7, k = Math.min(Math.ceil((gx - COURT.x0) / (Wd / 5)), Math.ceil((COURT.y1 - gy) / (Wd / 5)), 5); return 0.05 - (0.07 / 5) * k; };

const cranes = [], diggers = [];
if (fieldPoly) {
  // the old pitches are being renovated: blue hoarding round the site, dirt heaps, cones, an excavator
  const xs = fieldPoly.outer.map((q) => q[0]), ys = fieldPoly.outer.map((q) => q[1]);
  const fx0 = Math.min(...xs) + 2, fx1 = Math.max(...xs) - 2, fy0 = Math.min(...ys) + 2, fy1 = Math.max(...ys) - 2;
  const wx0 = wx(fx0), wx1 = wx(fx1), wz0 = wz(fy0), wz1 = wz(fy1), top = 0.032;
  const hoard = mat('#6fa8dc', .8), rail = mat('#ffffff', .7), dirt = mat('#b99a6b', 1), steel = mat('#4a4f58', .6), yellow = mat('#f2b843', .6);
  const fence = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), ang = -Math.atan2(bz - az, bx - ax); add(box(len, 0.034, 0.003), hoard, (ax + bx) / 2, top + 0.017, (az + bz) / 2, ang, false); add(box(len, 0.004, 0.005), rail, (ax + bx) / 2, top + 0.036, (az + bz) / 2, ang, false); const n = Math.max(2, Math.round(len / 0.07)); for (let i = 0; i <= n; i++) add(box(0.004, 0.04, 0.004), rail, ax + (bx - ax) * i / n, top + 0.02, az + (bz - az) * i / n, 0, false); };
  fence(wx0, wz0, wx1, wz0); fence(wx1, wz0, wx1, wz1); fence(wx1, wz1, wx0, wz1); fence(wx0, wz1, wx0, wz0);
  for (const [dxr, dzr, r] of [[0.25, 0.3, 0.07], [0.62, 0.7, 0.055], [0.78, 0.25, 0.045]]) add(new THREE.ConeGeometry(r, r * 0.7, 10), dirt, wx0 + (wx1 - wx0) * dxr, top + r * 0.35, wz0 + (wz1 - wz0) * dzr);
  for (let i = 0; i < 8; i++) { const cx0 = wx0 + (wx1 - wx0) * (0.1 + 0.12 * i), cz0 = wz1 + 0.02; add(new THREE.ConeGeometry(0.009, 0.026, 8), mat('#ff7a2f', .7), cx0, 0.045, cz0, 0, true); add(new THREE.CylinderGeometry(0.0075, 0.0085, 0.004, 8), rail, cx0, 0.04, cz0, 0, false); }
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 8), mat('#9aa3ad', .5), wx0 + (wx1 - wx0) * 0.4 + i * 0.019, top + 0.012, wz0 + (wz1 - wz0) * 0.15).rotation.z = Math.PI / 2;
  // the excavator
  const ex = new THREE.Group(); ex.position.set(wx0 + (wx1 - wx0) * 0.45, top, wz0 + (wz1 - wz0) * 0.55); props.add(ex);
  const part = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
  ex.add(part(box(0.1, 0.018, 0.05), steel, 0, 0.009, 0));
  const upper = new THREE.Group(); upper.position.y = 0.018; ex.add(upper);
  upper.add(part(box(0.07, 0.03, 0.05), yellow, 0, 0.015, 0), part(box(0.03, 0.03, 0.04), mat('#b8d8f0', .3), 0.02, 0.045, 0), part(box(0.02, 0.02, 0.05), steel, -0.04, 0.012, 0));
  const arm = new THREE.Group(); arm.position.set(0.035, 0.03, 0); upper.add(arm);
  const boom = part(box(0.09, 0.012, 0.014), yellow, 0.04, 0.02, 0); boom.rotation.z = 0.5; arm.add(boom);
  const stick = part(box(0.06, 0.01, 0.012), yellow, 0.1, 0.05, 0); stick.rotation.z = -0.9; arm.add(stick); arm.add(part(box(0.022, 0.016, 0.026), steel, 0.13, 0.026, 0));
  diggers.push({ upper, arm });
}

// ---- the street between Zijing field (紫荆操场, to the north) and 34号楼: road, pavements, crossing, lamps, benches, bikes, small trees, people; the dorm gets windows and a door
const lampM = mat('#6b7078', .5), glow = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
const ROAD = { x0: 858, x1: 934, y0: 767, y1: 775 };
const flat = (gx0, gy0, gx1, gy1, m, y, h = 0.006) => { const [xa, za] = L(gx0, gy0), [xb, zb] = L(gx1, gy1); return add(box(Math.abs(xb - xa), h, Math.abs(zb - za)), m, (xa + xb) / 2, y, (za + zb) / 2, 0, false); };
flat(ROAD.x0, ROAD.y0, ROAD.x1, ROAD.y1, mat('#c4c1b8', 1), 0.03);                      // the road
flat(ROAD.x0, ROAD.y1, ROAD.x1, 783, mat('#ece8dc', 1), 0.034, 0.008);                    // the pavement in front of the dorms
flat(ROAD.x0, 763, ROAD.x1, ROAD.y0, mat('#ece8dc', 1), 0.034, 0.008);                    // the pavement along the field
for (let gx = ROAD.x0 + 3; gx < ROAD.x1 - 4; gx += 7) flat(gx, 770.6, gx + 3.6, 771.4, PW, 0.037, 0.002); // dashed middle line
for (let k = 0; k < 6; k++) flat(891 + k * 1.2, 767.3, 891.7 + k * 1.2, 774.7, PW, 0.037, 0.002);          // zebra crossing towards the field gate
const benchWood = mat('#b98b5d', .8);
const leaf = [mat('#d9b64e', 1), mat('#a9b04e', 1), mat('#c98f3c', 1), mat('#8fa65c', 1)];
[[864, 779], [873, 779], [884, 779], [862, 765], [880, 764], [933, 764]].forEach(([gx, gy], i) => { const [x, z] = L(gx, gy); add(new THREE.CylinderGeometry(0.007, 0.01, 0.09, 6), mat('#8a6d4f', 1), x, 0.1, z); add(new THREE.IcosahedronGeometry(0.04 + (i % 3) * 0.005, 1), leaf[i % 4], x, 0.17, z); });
// flower beds and bins
const flowerM = ['#ff8fb3', '#ffd166', '#c792ea'].map((c) => mat(c, .8));
[[870, 781.5], [888, 781.8], [919, 781.6]].forEach(([gx, gy], i) => { const [x, z] = L(gx, gy); add(box(0.07, 0.012, 0.016), mat('#9fbd85', 1), x, 0.06, z); for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(0.007, 6, 5), flowerM[(i + k) % 3], x - 0.028 + k * 0.014, 0.075, z, 0, false); });
[[892, 777.6], [909, 777.6]].forEach(([gx, gy]) => { const [x, z] = L(gx, gy); add(new THREE.CylinderGeometry(0.01, 0.009, 0.034, 8), mat('#5f8f7a', .7), x, 0.065, z); });
const walkers = [];
const person = (gx, gy, color, dirx = 1) => { const [x, z] = L(gx, gy); const g = new THREE.Group(); g.position.set(x, 0.06, z);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.034, 4, 8), mat(color, .8)); body.position.y = 0.035; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), mat('#f3cfae', .9)); head.position.y = 0.074; head.castShadow = true; g.add(head);
  props.add(g); walkers.push({ g, x0: x, z0: z, dir: dirx, phase: rnd() * 6 }); return g; };
// the track and pitch of Zijing field: lane lines, white markings, goals, and a few runners
const track = findPoly([data.classes.sport], 897, 690, 30);
let stadiumAt = null;
if (track) {
  const xs = track.outer.map((q) => q[0]), ys = track.outer.map((q) => q[1]);
  const tx0 = Math.min(...xs), tx1 = Math.max(...xs), ty0 = Math.min(...ys), ty1 = Math.max(...ys);
  const cxw = wx((tx0 + tx1) / 2), czw = wz((ty0 + ty1) / 2), A = ((tx1 - tx0) / 2) * S, B = ((ty1 - ty0) / 2) * S, top = 0.052;
  const stadium = (a, b) => { const sh = new THREE.Shape(), st = b - a; sh.moveTo(cxw + a, -(czw - st)); sh.lineTo(cxw + a, -(czw + st)); sh.absarc(cxw, -(czw + st), a, 0, Math.PI, true); sh.lineTo(cxw - a, -(czw - st)); sh.absarc(cxw, -(czw - st), a, Math.PI, Math.PI * 2, true); return sh; };
  const ringMesh = (a, b, w) => { const sh = stadium(a, b); sh.holes.push(new THREE.Path(stadium(a - w, b - w).getPoints(48))); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.002, bevelEnabled: false, curveSegments: 16 }); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, PW); m.position.y = top; m.receiveShadow = true; props.add(m); };
  for (const f of [0.97, 0.88, 0.8, 0.72, 0.65]) ringMesh(A * f, B - A * (1 - f), 0.004);
  // pitch markings in the green infield
  const iw = A * 0.55, ih = B - A * 0.62, line = (lw, ld, x, z) => add(box(lw, 0.002, ld), PW, x, top + 0.003, z, 0, false);
  line(iw * 2, 0.004, cxw, czw - ih); line(iw * 2, 0.004, cxw, czw + ih); line(0.004, ih * 2, cxw - iw, czw); line(0.004, ih * 2, cxw + iw, czw); line(iw * 2, 0.004, cxw, czw);
  const cc = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.054, 28), PW); cc.rotation.x = -Math.PI / 2; cc.position.set(cxw, top + 0.004, czw); props.add(cc);
  for (const sz of [-1, 1]) { line(iw * 1.1, 0.004, cxw, czw + sz * (ih - 0.07)); line(0.004, 0.07, cxw - iw * 0.55, czw + sz * (ih - 0.035)); line(0.004, 0.07, cxw + iw * 0.55, czw + sz * (ih - 0.035)); add(box(0.09, 0.03, 0.004), PW, cxw, top + 0.017, czw + sz * ih, 0, false); }
  // where a point at distance u (0..1 round the lap) of lane radius f lies
  stadiumAt = (u, f) => { const a = A * f, st = B - A * (1 - f) - a, len = 4 * st / 2 + 2 * Math.PI * a; let d = (u % 1) * (2 * st + 2 * Math.PI * a); if (d < 2 * st) return [cxw + a, czw - st + d, Math.PI]; d -= 2 * st; if (d < Math.PI * a) { const th = d / a; return [cxw + a * Math.cos(th), czw + st + a * Math.sin(th), Math.PI + th]; } d -= Math.PI * a; if (d < 2 * st) return [cxw - a, czw + st - d, 0]; d -= 2 * st; const th = Math.PI + d / a; return [cxw + a * Math.cos(th), czw - st + a * Math.sin(th), th + Math.PI]; };
}
// windows, a door and an awning on 34号楼, and a little stair house on its roof
if (mineMesh && mineBox) {
  const ring = mineRing, signed = ring.reduce((a, [x, y], i) => a + (x * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y), 0) / 2, sgn = signed > 0 ? -1 : 1;
  const winM = mat('#6f8aa6', .35), frameM = mat('#fff6f9', .8), spots = [];
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length], len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 6) continue;
    const dx = (x2 - x1) / len, dy = (y2 - y1) / len, nx = dy * sgn, ny = -dx * sgn; // outward normal (in map pixels)
    for (let d = 3; d < len - 2; d += 4.5) for (let r = 0; r * 0.085 + 0.1 < mineH - 0.02; r++) spots.push([x1 + dx * d + nx * 0.25, y1 + dy * d + ny * 0.25, Math.atan2(dy, dx), 0.05 + 0.1 + r * 0.085]);
  }
  const win = new THREE.InstancedMesh(box(0.028, 0.034, 0.005), winM, spots.length), dm = new THREE.Object3D();
  spots.forEach(([gx, gy, ang, y], i) => { dm.position.set(wx(gx), y, wz(gy)); dm.rotation.set(0, -ang, 0); dm.updateMatrix(); win.setMatrixAt(i, dm.matrix); });
  win.castShadow = false; props.add(win);
  const [ex, ez] = L(data.x0 + (mineBox.x0 + mineBox.x1) / 2 + 0, data.y0 + mineBox.y0 + 1);
  add(box(0.05, 0.05, 0.006), mat('#ffffff', .6), ex, 0.085, ez - 0.003, 0, false);   // door
  add(box(0.085, 0.008, 0.04), mat('#ff3f86', .5), ex, 0.125, ez - 0.02, 0, true);     // awning
  add(box(0.05, 0.1, 0.05), mat('#ffe6ef', .8), ex + 0.08, 0.05 + mineH + 0.05, ez + 0.1, 0, true); // stair house on the roof
}
// ---- idle life for the flat pictures: ears twitch, the tail sways, the cat blinks. Done in the sprite shader like in the puppy-training game (its src/train-warp.js): a mask picture says
// which pixels are the left ear (red), the right ear (green) and the tail (blue); each part turns a little about its root, more the further from the root, so one part never drags another.
// (the cat has no closed-eye picture: its lids are painted over the eyes). Parts are in picture units, origin top-left, x scaled by the picture's aspect; roots are x, y, length.
const loadMask = (url) => { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.NoColorSpace; return t; };
const IDLE = {
  dog: { mask: loadMask('./assets/dog-masks.png'), asp: 1, parts: [[0.256, 0.256, 0.462], [0.752, 0.244, 0.439], [0.725, 0.818, 0.186]], earAmp: 0.16, tailAmp: 0.3, eyes: null },
  catFront: { mask: loadMask('./assets/cat-masks-front.png'), asp: 1, parts: [[0.27, 0.28, 0.2], [0.72, 0.28, 0.2], [0.725, 0.84, 0.25]], earAmp: 0.3, tailAmp: 0.3, eyes: { L: [0.40, 0.415], R: [0.61, 0.40], r: [0.062, 0.05] } },
  catBack: { mask: loadMask('./assets/cat-masks-back.png'), asp: 0.749, parts: [[0.2, 0.22, 0.2], [0.82, 0.22, 0.2], [0.28, 0.86, 0.3]], earAmp: 0.3, tailAmp: 0.3, eyes: null },
};
function makeIdle(material, first) {
  const u = { uMask: { value: first.mask }, uAsp: { value: first.asp }, uR0: { value: new THREE.Vector3() }, uR1: { value: new THREE.Vector3() }, uR2: { value: new THREE.Vector3() }, uAng: { value: new THREE.Vector3() }, uEye: { value: new THREE.Vector4() }, uEyeRad: { value: new THREE.Vector2() }, uBlink: { value: 0 } };
  material.userData.idle = u;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform sampler2D uMask; uniform float uAsp, uBlink; uniform vec3 uR0, uR1, uR2, uAng; uniform vec4 uEye; uniform vec2 uEyeRad;
      vec2 turnBack(vec2 P, vec2 pivot, float a) { float c = cos(a), s = sin(a); vec2 v = P - pivot; return pivot + vec2(c * v.x + s * v.y, -s * v.x + c * v.y); }
      void main() {`).replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 p = vec2(vMapUv.x, 1.0 - vMapUv.y), P = vec2(p.x * uAsp, p.y), q = P, asp2 = vec2(uAsp, 1.0);
        vec3 m = texture2D(uMask, vMapUv).rgb;
        if (m.r > 0.003) { vec2 pv = uR0.xy * asp2; q += turnBack(P, pv, uAng.x * pow(clamp(distance(P, pv) / uR0.z, 0.0, 1.0), 1.25) * m.r) - P; }
        if (m.g > 0.003) { vec2 pv = uR1.xy * asp2; q += turnBack(P, pv, uAng.y * pow(clamp(distance(P, pv) / uR1.z, 0.0, 1.0), 1.25) * m.g) - P; }
        if (m.b > 0.003) { vec2 pv = uR2.xy * asp2; q += turnBack(P, pv, uAng.z * clamp(distance(P, pv) / uR2.z, 0.0, 1.0) * m.b) - P; }
        vec4 sampledDiffuseColor = texture2D(map, clamp(vec2(q.x / uAsp, 1.0 - q.y), 0.0, 1.0));
        if (uEyeRad.x > 0.0 && uBlink > 0.0) {
          vec3 lid = pow(vec3(0.97, 0.79, 0.62), vec3(2.2));
          for (int k = 0; k < 2; k++) {
            vec2 e = k == 0 ? uEye.xy : uEye.zw, d = (p - e) / uEyeRad; float inside = step(dot(d, d), 1.0), cut = e.y - uEyeRad.y + 2.0 * uEyeRad.y * uBlink;
            if (inside > 0.5 && p.y < cut) sampledDiffuseColor.rgb = lid;
            if (inside > 0.5 && uBlink > 0.85 && abs(p.y - (e.y + uEyeRad.y * 0.3 - abs(p.x - e.x) * 0.25)) < 0.0035) sampledDiffuseColor.rgb = pow(vec3(0.28, 0.14, 0.10), vec3(2.2));
          }
        }
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
}
// the puppy moves her ears and tail like in the puppy-training game (src/train-rig.js): three springs follow where her expression wants them (a little late, a little overshooting), with a gentle sway of their own;
// MOOD: ears = how far the ears swing out (degrees, negative = they hang in), wag = [how far the tail swings each way (degrees), times a second], tail = where it rests (degrees, positive = droops)
const MOOD = {
  sly: { ears: 0.5, wag: [5, 0.7], tail: 0 }, listen: { ears: 2.5, wag: [6, 1.1], tail: -2 }, happy: { ears: 4, wag: [17, 3.2], tail: -2 }, blank: { ears: -1, wag: [1.5, 0.5], tail: 3 }, sorry: { ears: -2.5, wag: [2, 1.6], tail: 9 },
  angry: { ears: -4.5, wag: [3, 2.6], tail: -3 }, shock: { ears: 3.5, wag: [0, 1], tail: -8 }, heart: { ears: 3, wag: [15, 2.8], tail: -2 }, kiss: { ears: 2.5, wag: [12, 2.4], tail: -2 },
};
const dogSpring = { L: { a: 0, v: 0 }, R: { a: 0, v: 0 }, T: { a: 0, v: 0 } };
const dogKick = (l = 0, r = l, t = 0) => { dogSpring.L.v += l; dogSpring.R.v += r; dogSpring.T.v += t; }; // degrees a second: how hard the ears and the tail are flung (positive = ears out, tail down)
const idleState = { dog: { nextEar: 1500, earAt: -9e9, side: 0, nextBlink: 2500, blinkAt: -9e9 }, cat: { nextEar: 3000, earAt: -9e9, side: 1, nextBlink: 1800, blinkAt: -9e9 } };
function idleStep(who, material, cfg, now, dt = 0.016) { // sets the shader's numbers for this moment
  const u = material.userData.idle, st = idleState[who]; if (!u) return;
  u.uMask.value = cfg.mask; u.uAsp.value = cfg.asp; u.uR0.value.set(...cfg.parts[0]); u.uR1.value.set(...cfg.parts[1]); u.uR2.value.set(...cfg.parts[2]);
  if (now > st.nextEar) { st.earAt = now; st.side = Math.random() < 0.5 ? 0 : 1; st.nextEar = now + 2600 + Math.random() * 3200; }
  const k = (now - st.earAt) / 380, a = (k >= 0 && k < 1 ? Math.sin(k * Math.PI * 2) : 0) * cfg.earAmp, tail = (Math.sin(now / 240) * 0.75 + Math.sin(now / 610) * 0.3) * cfg.tailAmp;
  u.uAng.value.set(st.side === 0 ? a : 0, st.side === 1 ? a : 0, tail);
  if (who === 'dog') { // her: the springs of the training game
    const t = now / 1000, m = MOOD[face] ?? MOOD.sly, want = { L: m.ears + 2.2 * Math.sin(t * 1.9) + 0.6 * Math.sin(t * 5.3), R: m.ears + 2.2 * Math.sin(t * 1.7 + 1.3) + 0.6 * Math.sin(t * 4.9), T: m.tail + m.wag[0] * Math.sin(t * 2 * Math.PI * m.wag[1]) };
    for (const key of ['L', 'R', 'T']) { const p = dogSpring[key]; p.v += (-110 * (p.a - want[key]) - 11 * p.v) * Math.min(dt, 0.05); p.a += p.v * Math.min(dt, 0.05); }
    u.uAng.value.set(dogSpring.L.a * Math.PI / 180, -dogSpring.R.a * Math.PI / 180, dogSpring.T.a * Math.PI / 180);
  }
  if (window.__idleForce) u.uAng.value.set(...window.__idleForce); // test hook: [left ear, right ear, tail] in radians
  if (cfg.eyes) { if (now > st.nextBlink) { st.blinkAt = now; st.nextBlink = now + 2200 + Math.random() * 3000; } const bk = (now - st.blinkAt) / 240; u.uBlink.value = bk >= 0 && bk < 1 ? Math.sin(bk * Math.PI) : 0; u.uEye.value.set(...cfg.eyes.L, ...cfg.eyes.R); u.uEyeRad.value.set(...cfg.eyes.r); } else u.uEyeRad.value.set(0, 0);
}
// her puppy and his cat, standing on the pavement in front of the dorm door (flat pictures that always turn to the camera)
const loader = new THREE.TextureLoader();
function standee(url, gx, gy, height, phase) {
  const tex = loader.load(url); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05 }));
  const [x, z] = L(gx, gy); sp.center.set(0.5, 0.04); sp.scale.set(height, height, 1); sp.position.set(x, 0.045, z); props.add(sp);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(height * 0.34, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.24, depthWrite: false })); shadow.scale.set(1, 0.7, 1); shadow.renderOrder = 1;
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(x, 0.043, z); props.add(shadow);
  pets.push({ sp, shadow, y0: 0.045, phase }); return sp;
}
const pets = [];
const doorGx = data.x0 + (mineBox ? (mineBox.x0 + mineBox.x1) / 2 : 12);
const dogSprite = standee('./assets/dog-happy.webp', doorGx + 7, 778.6, 0.075, 0);
makeIdle(dogSprite.material, IDLE.dog);
const FACES = {}; for (const f of ['happy', 'sly', 'blank', 'blink', 'listen', 'angry', 'sorry', 'shock', 'heart', 'kiss']) { FACES[f] = loader.load(`./assets/dog-${f}.webp`); FACES[f].colorSpace = THREE.SRGBColorSpace; }
let face = 'happy', faceUntil = 0, blinkAt = 0;
function setFace(name, holdMs = 0) { face = name; faceUntil = holdMs ? performance.now() + holdMs : 0; dogSprite.material.map = FACES[name]; dogSprite.material.needsUpdate = true; }
props.visible = true;

// ---- the pink marker over 34号楼 and a pulse on the ground, so it is easy to find
const mineWorld = mineBox ? { x: wx((mineBox.x0 + mineBox.x1) / 2), z: wz((mineBox.y0 + mineBox.y1) / 2), top: 0.05 + mineH } : null;
const pin = new THREE.Group();
if (mineWorld) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 14), new THREE.MeshBasicMaterial({ color: '#ff3f86' })); cone.rotation.x = Math.PI; cone.position.y = 0.06;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff3f86' })); ball.position.y = 0.16;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); dot.position.y = 0.16;
  pin.add(cone, ball, dot); pin.position.set(mineWorld.x, mineWorld.top + 0.12, mineWorld.z); scene.add(pin);
}
const pulse = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 40), new THREE.MeshBasicMaterial({ color: '#ff3f86', transparent: true, opacity: 0.7, depthWrite: false }));
pulse.rotation.x = -Math.PI / 2; if (mineWorld) { pulse.position.set(mineWorld.x, 0.07, mineWorld.z); scene.add(pulse); }

// ---- trees on the green
function inside(poly, x, y) {
  const ring = poly.outer; let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) c = !c;
  }
  if (!c) return false;
  for (const h of poly.holes) { let d = false; for (let i = 0, j = h.length - 1; i < h.length; j = i++) { const [xi, yi] = h[i], [xj, yj] = h[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) d = !d; } if (d) return false; }
  return true;
}
const treeSpots = [];
const taken = new Map(); const CELL = 26; // trees keep at least ~22 map pixels apart
const free = (x, y) => { const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [a, b] of taken.get(`${cx0 + i},${cy0 + j}`) ?? []) if (Math.hypot(a - x, b - y) < 22) return false; return true; };
for (const p of greens) {
  const xs = p.outer.map((q) => q[0]), ys = p.outer.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const want = Math.min(70, Math.round(p.cells / 1100));
  for (let n = 0, tries = 0; n < want && tries < want * 25; tries++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (inside(p, x, y) && free(x, y) && !data.classes.sport.some((q) => inRing(q.outer, x, y))) { const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`; (taken.get(key) ?? taken.set(key, []).get(key)).push([x, y]); treeSpots.push([wx(x), wz(y)]); n++; }
  }
}
const palette = ['#d9b64e', '#c98f3c', '#a9b04e', '#8fa65c', '#d4a246', '#b9b85a', '#7f9a57'].map((c) => new THREE.Color(c));
const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#ffffff', 1), treeSpots.length);
const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.026, 1, 6), mat('#8a6d4f', 1), treeSpots.length);
const dummy = new THREE.Object3D();
treeSpots.forEach(([x, z], i) => {
  const s = 0.045 + rnd() * 0.04, th = 0.07 + rnd() * 0.06;
  dummy.position.set(x, 0.05 + th / 2, z); dummy.scale.set(1, th, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
  dummy.position.set(x, 0.05 + th + s * 0.7, z); dummy.scale.set(s, s * 0.95, s); dummy.rotation.y = rnd() * 6; dummy.updateMatrix(); crown.setMatrixAt(i, dummy.matrix);
  crown.setColorAt(i, palette[Math.floor(rnd() * palette.length)]);
});
crown.castShadow = trunk.castShadow = true; scene.add(trunk, crown);

// ---- name tags
const labelHost = document.getElementById('labels');
const ALWAYS = new Set(['图书馆']);
const NO_TAG = new Set(['大礼堂', '清华学堂', '中央主楼']); // these buildings stay (and keep their height) but have no name tag; the canteens are orange but have no tag either
const labels = PLACES.filter(([text, , , kind]) => !NO_TAG.has(text) && kind !== 'canteen').map(([text, mx, my, kind]) => {
  const el = document.createElement('div'); el.className = 'tag' + (kind === 'canteen' ? ' canteen' : kind === 'gate' ? ' gate' : kind === 'his' ? ' him' : kind === 'field' || kind === 'sport' ? ' sport' : kind === 'work' ? ' work' : '');
  el.textContent = (kind === 'canteen' ? '🍴 ' : kind === 'work' ? '🚧 ' : kind === 'his' ? '🐱 ' : '') + (kind === 'his' ? '他的宿舍' : text); labelHost.appendChild(el);
  const [x, z] = pt(mx, my); const sp = [...special.entries()].find(([, v]) => false);
  return { el, name: text, far: kind === 'canteen' || kind === 'his' || kind === 'gate' || kind === 'field' || kind === 'work' || ALWAYS.has(text), v: new THREE.Vector3(x, kind === 'gate' ? 0.2 : kind === 'his' ? 0.5 : kind === 'field' ? 0.3 : kind === 'work' ? 0.65 : kind === 'canteen' ? 0.85 : 1.15, z) };
});
let showLabels = true;
document.getElementById('btn-labels').addEventListener('click', (e) => { showLabels = !showLabels; e.currentTarget.setAttribute('aria-pressed', String(showLabels)); });
let spin = false;
document.getElementById('btn-spin').addEventListener('click', (e) => { spin = !spin; controls.autoRotate = spin; controls.autoRotateSpeed = 0.9; e.currentTarget.setAttribute('aria-pressed', String(spin)); });
document.getElementById('btn-spin').setAttribute('aria-pressed', 'false');
document.getElementById('btn-reset').addEventListener('click', () => { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update(); });

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h;
  camera.fov = w < h ? 44 : 32; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();


// ---- zoom to the scene at the foot of 34号楼 (click the pink dorm or its tag), and back
const card = document.getElementById('focus-card');
let tween = null, focusOn = false, saved = null;
const FOOT = (() => { const [x, z] = L(906, 781); return { target: new THREE.Vector3(x, 0.1, z), pos: new THREE.Vector3(x + 0.15, 0.75, z - 1.3) }; })(); // from Zijing field (north) looking south at the foot of the dorm
function flyTo(pos, target, ms = 1100, done) { tween = { t0: performance.now(), ms, p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos.clone(), t1: target.clone(), done }; }
function enterFoot() {
  if (focusOn || !mineWorld) return; focusOn = true;
  saved = { pos: camera.position.clone(), target: controls.target.clone(), min: controls.minDistance, polar: controls.maxPolarAngle, rot: controls.autoRotate };
  controls.autoRotate = false; controls.minDistance = 0.5; controls.maxPolarAngle = 1.5; saved.minPolar = controls.minPolarAngle; controls.minPolarAngle = 0.08; // the ride's camera may look almost straight down
  flyTo(FOOT.pos, FOOT.target, 1100, startPlay); card.hidden = false; document.body.classList.add('in-foot');
}
function leaveFoot() {
  if (!focusOn) return; stopPlay(); chat.hidden = true; setFace('happy'); focusOn = false; card.hidden = true; document.body.classList.remove('in-foot');
  flyTo(saved.pos, saved.target, 1000, () => { controls.minDistance = saved.min; controls.maxPolarAngle = saved.polar; controls.minPolarAngle = saved.minPolar; controls.autoRotate = spin; });
}
document.getElementById('foot-back').addEventListener('click', leaveFoot);
document.getElementById('btn-reset').addEventListener('click', () => { if (focusOn) { stopPlay(); chat.hidden = true; focusOn = false; card.hidden = true; document.body.classList.remove('in-foot'); controls.minDistance = 4; controls.maxPolarAngle = 1.22; controls.minPolarAngle = 0.35; } });
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), focus: focusOn }; });
// ---- talk to the puppy: click her (while zoomed in at the dorm door) for a little chat
const chat = document.getElementById('chat'), chatOpts = document.getElementById('chat-opts');
// every reply carries its own face, and she keeps it until she says something else
const TALK = {
  start: [['汪?你来啦。', 'listen'], ['(耳朵动了一下)是你呀。', 'happy'], ['嗯?有事找我?', 'sly']],
  options: [
    ['摸摸头', [['(尾巴摇了摇)别摸了……再摸一下。', 'heart'], ['呜,头发都乱了。继续。', 'sorry'], ['(眯眼)这个可以有。', 'happy'], ['……别摸了!(脸红)', 'shock']]],
    ['去操场玩吗', [['飞盘带了吗?Ultimate。', 'listen'], ['先说好,我跑得比你快。', 'sly'], ['走!跑完你请我喝水。', 'happy']]],
    ['你是谁的小狗', [['……你猜。', 'sly'], ['是我自己的。偶尔借给你。', 'angry'], ['你说呢。(尾巴出卖了我)', 'heart']]],
    ['想你了', [['……我也。', 'heart'], ['(假装没听见)', 'blank'], ['(扑过来)', 'kiss']]],
    ['你生气了吗', [['没有!(很大声)', 'angry'], ['……有一点。哄我。', 'sorry']]],
    ['吓你一跳', [['!!', 'shock'], ['(炸毛)你完了。', 'angry']]],
    ['汪', [['汪!(其实想说:想你了)', 'kiss'], ['汪汪。翻译:我在呢。', 'happy'], ['汪?(挑眉)', 'sly']]],
  ],
  bye: [['再见。路上小心。', 'sorry'], ['好,我在这儿等你。', 'happy'], ['(挥爪)明天见。', 'kiss']],
};
const CANTEENS = PLACES.filter((p) => p[3] === 'canteen'); // [name, gx, gy, 'canteen']
const NOT_EAT = new Set(['闻馨园']); // not offered as a place to eat (still an orange canteen on the map)
const EAT = CANTEENS.filter((c) => !NOT_EAT.has(c[0]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let hop = 0;
const mkBubble = (cls) => { const el = document.createElement('div'); el.className = 'bubble ' + cls; el.style.display = 'none'; labelHost.appendChild(el); return el; };
const dogBubble = mkBubble('dog'), catBubble = mkBubble('cat'); let catBubbleUntil = 0;
function say([text, f]) { dogBubble.textContent = text; dogBubble.style.display = ''; setFace(f); hop = performance.now(); dogKick(-90, -90, 80); }
function catSay(text, ms = 4200) { catBubble.textContent = text; catBubble.style.display = ''; catBubbleUntil = performance.now() + ms; }
function hideBubbles() { dogBubble.style.display = catBubble.style.display = 'none'; }
function options(list) { chatOpts.innerHTML = ''; for (const [label, fn, ghost] of list) { const b = document.createElement('button'); if (ghost) b.className = 'ghost'; b.textContent = label; b.addEventListener('click', () => { catSay(label); fn(); }); chatOpts.appendChild(b); } }
function mainOptions() {
  options([
    ['去吃饭', askFood],
    ['寻宝', huntTalk],
    ...TALK.options.map(([label, lines]) => [label, () => say(pick(lines))]),
    ['再见', () => { say(pick(TALK.bye)); setTimeout(() => { chat.hidden = true; setFace('happy'); chatCool = performance.now() + 4000; }, 1600); }, true],
  ]);
}
function askFood() {
  say(['好呀!去哪吃?', 'happy']);
  options([...EAT.map(([name]) => [name, () => goEat(name)]), ['随便', () => goEat(pick(EAT)[0])], ['算了,不吃了', () => { say(['……哦。(肚子叫了)', 'sorry']); mainOptions(); }, true]]);
}
let chatCool = 0;
function openChat() { chat.hidden = false; say(pick(TALK.start)); mainOptions(); }
const dogOnScreen = (cx, cy) => { const p = new THREE.Vector3(); dogSprite.getWorldPosition(p); p.y += 0.04; p.project(camera); const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight; return Math.hypot(cx - sx, cy - sy) < 46; };
const goPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), goPoint = new THREE.Vector3();
const goMarker = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.07, 28), new THREE.MeshBasicMaterial({ color: '#ff3f86', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); goMarker.rotation.x = -Math.PI / 2; goMarker.visible = false; scene.add(goMarker);
let pendingGo = null;
function goTo(x, z, label = '那里') { // both of them ride to a spot (the nearest free place to it); from the campus view the foot scene opens first
  if (!playOn) { pendingGo = [x, z, label]; enterFoot(); return; }
  if (mode !== 'walk') return;
  const from = [catSprite.position.x, catSprite.position.z]; if (Math.hypot(x - from[0], z - from[1]) < 0.12) return;
  const path = findPath(from, [x, z], true); if (!path) { playHint.textContent = '这里去不了,点别的地方吧'; return; }
  const [ex, ez] = path[path.length - 1]; goMarker.position.set(ex, floorY(ex, ez) - 0.04, ez); goMarker.visible = true; chat.hidden = true;
  mount(path, label, () => { goMarker.visible = false; dismount(ex, ez); chatCool = performance.now() + 2000; });
}
function goClick(e) { // click a place: he rides there
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(solids, false)[0]; let x, z;
  if (hit) { x = hit.point.x; z = hit.point.z; } else if (ray.ray.intersectPlane(goPlane, goPoint)) { x = goPoint.x; z = goPoint.z; } else return;
  goTo(x, z);
}
renderer.domElement.addEventListener('pointerup', (e) => {
  if (down && down.focus && focusOn && dogOnScreen(e.clientX, e.clientY) && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6) { openChat(); down = null; return; }
  if (down && down.focus && focusOn && playOn && mode === 'walk' && !modalOpen && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6 && performance.now() - down.t < 450) { goClick(e); down = null; return; }
  if (!down || !mineMesh || focusOn) return;
  down = down.focus ? null : down;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 450) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  if (ray.intersectObject(mineMesh, false).length || ray.intersectObject(pin, true).length) enterFoot();
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (focusOn) { renderer.domElement.style.cursor = dogOnScreen(e.clientX, e.clientY) ? 'pointer' : ''; return; }
  if (!mineMesh) { renderer.domElement.style.cursor = ''; return; }
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  renderer.domElement.style.cursor = ray.intersectObject(mineMesh, false).length || ray.intersectObject(pin, true).length ? 'pointer' : '';
});
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const tmp = new THREE.Vector3();
// ---- play mode: you are the cat (third-person: the camera follows you), walk to the puppy, choose where to eat, and ride the e-bike there with her
const catTex = loader.load('./assets/his-cat.webp'); catTex.colorSpace = THREE.SRGBColorSpace;
// which of the eight pictures (index 0 = facing away from us, clockwise) shows something that looks along world direction (dx, dz)? it stays on the current one until the direction is >30 degrees past its centre
function pickView(views, cur, dx, dz) {
  const fx = controls.target.x - camera.position.x, fz = controls.target.z - camera.position.z, th = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz), cc = views.indexOf(cur) * Math.PI / 4;
  return Math.abs(Math.atan2(Math.sin(th - cc), Math.cos(th - cc))) > 0.52 ? views[((Math.round(th / (Math.PI / 4)) % 8) + 8) % 8] : cur;
}
const catSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: catTex, transparent: true, alphaTest: 0.05 })); catSprite.center.set(0.5, 0.04); catSprite.scale.set(0.085, 0.085, 1); catSprite.visible = false; makeIdle(catSprite.material, IDLE.catFront);
scene.add(catSprite);
// his eight views (the right-hand ones are the left-hand ones mirrored); the front picture is square with padding, the others are cropped tight and their figure is as tall as the front's
const CAT_VIEWS = ['back', 'br', 'right', 'fr', 'front', 'fl', 'left', 'bl'], CAT_FILE = { back: 'cat-back', front: 'his-cat', left: 'cat-left', fl: 'cat-fl', bl: 'cat-bl' }, CAT_MIRROR = { br: 'bl', right: 'left', fr: 'fl' };
const catTexs = { front: catTex }; for (const k of ['back', 'left', 'fl', 'bl']) { catTexs[k] = loader.load(`./assets/${CAT_FILE[k]}.webp`, () => setCatView(catView)); catTexs[k].colorSpace = THREE.SRGBColorSpace; }
let catView = 'front'; const catFace = { x: 0, z: 1 }; // the direction he looks
function setCatView(v) {
  catView = v; const key = CAT_MIRROR[v] ?? v, t = catTexs[key], front = key === 'front', h = front ? 0.085 : 0.0742, im = t.image, asp = im ? im.width / im.height : 1;
  catSprite.material.map = t; catSprite.material.needsUpdate = true; catSprite.center.set(0.5, front ? 0.04 : 0); catSprite.scale.set((CAT_MIRROR[v] ? -1 : 1) * h * asp, h, 1);
}
function faceDog() { catFace.x = dogSprite.position.x - catSprite.position.x; catFace.z = dogSprite.position.z - catSprite.position.z; }
const catShadow = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.24, depthWrite: false })); catShadow.scale.set(1, 0.7, 1); catShadow.renderOrder = 1; catShadow.rotation.x = -Math.PI / 2; catShadow.visible = false; scene.add(catShadow);
const meTag = document.createElement('div'); meTag.className = 'tag me'; meTag.textContent = '🐱 我'; meTag.style.display = 'none'; labelHost.appendChild(meTag);
// the vehicle: a flat picture of the two of them riding, one set per scooter (九号 / 雅迪), four views picked by where it heads on the screen
const bike = new THREE.Group(); bike.visible = false; scene.add(bike);
// eight views, by the angle of its heading on the screen (0 = away from us, clockwise): back, back-right, right, front-right, front, front-left, left, back-left
const VIEWS = ['back', 'br', 'right', 'fr', 'front', 'fl', 'left', 'bl'], VIEW_H = { left: 0.13, right: 0.13, fl: 0.14, fr: 0.14, bl: 0.14, br: 0.14, front: 0.135, back: 0.15 }; // sized so that the cat on the bike is as big as the cat standing
const VEHICLES = { nine: '九号', yadea: '雅迪' }; let vehicle = 'nine';
const RIDE = {}; for (const v of Object.keys(VEHICLES)) { RIDE[v] = {}; for (const d of VIEWS) { const t = loader.load(`./assets/ride-${v}-${d}.webp`); t.colorSpace = THREE.SRGBColorSpace; RIDE[v][d] = t; } }
const rideSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: RIDE.nine.right, transparent: true, alphaTest: 0.05 })); rideSprite.center.set(0.5, 0.03); bike.add(rideSprite);
const rideShadow = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false })); rideShadow.rotation.x = -Math.PI / 2; rideShadow.scale.set(1, 1.7, 1); rideShadow.position.y = 0.002; bike.add(rideShadow);
let rideView = 'right';
function setRideView(d) { rideView = d; const t = RIDE[vehicle][d], im = t.image; rideSprite.material.map = t; rideSprite.material.needsUpdate = true; const h = VIEW_H[d]; rideSprite.scale.set(h * (im ? im.width / im.height : 1), h, 1); }
function setVehicle(v) { vehicle = v; for (const b of document.querySelectorAll('#vehicle button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); setRideView(rideView); }
for (const b of document.querySelectorAll('#vehicle button')) b.addEventListener('click', () => setVehicle(b.dataset.v));
const doorLocal = () => [MINE.gx - data.x0 + 7, 778.6 - data.y0];
// the walking map: rasterised outlines (half resolution). blocked = buildings, water and the building site; soft = grass and sports grounds (slower)
const MW = Math.ceil(data.w / 2), MH = Math.ceil(data.h / 2);
const mask = (() => {
  const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH; const g = cv.getContext('2d', { willReadFrequently: true });
  const fill = (poly, color) => { g.fillStyle = color; g.beginPath(); for (const ring of [poly.outer, ...poly.holes]) { ring.forEach(([x, y], i) => (i ? g.lineTo(x / 2, y / 2) : g.moveTo(x / 2, y / 2))); g.closePath(); } g.fill('evenodd'); };
  for (const p of [...data.classes.green, ...data.classes.sport]) fill(p, 'rgb(0,0,255)');
  for (const p of [...data.classes.teach, ...data.classes.dorm, ...data.classes.water, ...(data.classes.orange ?? [])]) fill(p, 'rgb(255,0,0)');
  for (const p of data.classes.sport) if (special.get(p)?.kind === 'sport' || p === workPoly) fill(p, 'rgb(255,0,0)');
  const px = g.getImageData(0, 0, MW, MH).data, grid = new Uint8Array(MW * MH);
  for (let i = 0; i < grid.length; i++) { const a = px[i * 4 + 3]; grid[i] = a > 100 && px[i * 4] > 128 ? 2 : a > 100 && px[i * 4 + 2] > 128 ? 1 : 0; }
  return grid;
})();
// the empty margins of the map picture (and the strip outside the campus) are far from every coloured area: nobody rides there, so those cells are blocked
{ const d = new Uint8Array(MW * MH).fill(255), q = []; for (let i = 0; i < mask.length; i++) if (mask[i] !== 0) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const n = q[h], i = n % MW, j = (n / MW) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= MW || b >= MH) continue; const m = b * MW + a; if (d[m] > d[n] + 1) { d[m] = d[n] + 1; q.push(m); } } }
  for (let i = 0; i < mask.length; i++) if (d[i] > 7) mask[i] = 2; }
const waterCells = (() => { const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH; const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; for (const p of data.classes.water) { g.beginPath(); for (const ring of [p.outer, ...p.holes]) { ring.forEach(([x, y], i) => (i ? g.lineTo(x / 2, y / 2) : g.moveTo(x / 2, y / 2))); g.closePath(); } g.fill('evenodd'); } const px = g.getImageData(0, 0, MW, MH).data, w = new Uint8Array(MW * MH); for (let i = 0; i < w.length; i++) w[i] = px[i * 4 + 3] > 100 ? 1 : 0; return w; })();
const clearance = (() => { const d = new Uint8Array(MW * MH).fill(255), q = []; for (let i = 0; i < d.length; i++) if (mask[i] === 2) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const n = q[h], i = n % MW, j = (n / MW) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= MW || b >= MH) continue; const m = b * MW + a; if (d[m] > d[n] + 1) { d[m] = d[n] + 1; q.push(m); } } }
  return d; })();
const CLEAR = 7; // cells (2 map px each); the picture of the ride is about six cells wide
{ // river gaps: a free cell with water on both sides (left/right or above/below, within 4 cells) is a bridge or a crossing; the wall margin does not apply to it or to the cells just beside it
  const w = (i, j) => i >= 0 && j >= 0 && i < MW && j < MH && waterCells[j * MW + i] === 1, bridge = new Uint8Array(MW * MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (mask[j * MW + i] === 2) continue;
    let l = false, r = false, u = false, dn = false; for (let k2 = 1; k2 <= 4; k2++) { l = l || w(i - k2, j); r = r || w(i + k2, j); u = u || w(i, j - k2); dn = dn || w(i, j + k2); }
    if ((l && r) || (u && dn)) bridge[j * MW + i] = 1;
  }
  for (let j = 1; j < MH - 1; j++) for (let i = 1; i < MW - 1; i++) if (bridge[j * MW + i]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const m = (j + dj) * MW + i + di; if (mask[m] !== 2 && clearance[m] < 3) clearance[m] = 3; }
}
const cellOf = (x, z) => [Math.floor((x / S + cx) / 2), Math.floor((z / S + cy) / 2)];
const worldOfCell = (i, j) => [((i + 0.5) * 2 - cx) * S, ((j + 0.5) * 2 - cy) * S];
const blockedAt = (x, z) => { const [i, j] = cellOf(x, z); return i < 1 || j < 1 || i >= MW - 1 || j >= MH - 1 || mask[j * MW + i] === 2; };
function nearestFree(i, j, minC = 0) { for (let r = 0; r < 80; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const a = i + di, b = j + dj; if (a > 0 && b > 0 && a < MW - 1 && b < MH - 1 && mask[b * MW + a] !== 2 && clearance[b * MW + a] >= minC) return [a, b]; } return null; }
function findPath(from, to, wide = false) { // wide: the ride, which must stay clear of the buildings: first ask for 3 free cells (about 7 map px) on each side of the path, then fewer where the streets are narrow
  if (!wide) return searchPath(from, to, false, 0);
  for (const thr of [3, 2, 1]) { const p = searchPath(from, to, true, thr); if (p) return p; }
  return null;
}
function searchPath(from, to, wide, thr) { // A* over the walking map; returns world points or null
  const [si, sj] = nearestFree(...cellOf(...from)) ?? [], [ti, tj] = nearestFree(...cellOf(...to), wide ? thr : 0) ?? [];
  if (si == null || ti == null) return null;
  const N = MW * MH, g = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
  const h = (i, j) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  const push = (f, n) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const s0 = sj * MW + si; g[s0] = 0; push(h(si, sj), s0);
  while (heap.length) {
    const [, n] = pop(); if (closed[n]) continue; closed[n] = 1;
    const i = n % MW, j = (n / MW) | 0; if (i === ti && j === tj) break;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 1 || b < 1 || a >= MW - 1 || b >= MH - 1) continue;
      const m = b * MW + a, c = mask[m]; if (c === 2 || closed[m]) continue;
      if (wide && clearance[m] < thr && Math.max(Math.abs(a - si), Math.abs(b - sj)) > 8 && Math.max(Math.abs(a - ti), Math.abs(b - tj)) > 8) continue; // too close to a wall (except right where it starts or stops)
      if (di && dj && (mask[j * MW + a] === 2 || mask[b * MW + i] === 2)) continue; // no squeezing through a corner
      const ng = g[n] + (di && dj ? 1.41 : 1) * (c === 1 ? 5 : 1) + (wide && clearance[m] < CLEAR ? (CLEAR - clearance[m]) * 2.5 : 0); if (ng < g[m]) { g[m] = ng; prev[m] = n; push(ng + h(a, b), m); }
    }
  }
  const t = tj * MW + ti; if (prev[t] < 0 && t !== s0) return null;
  const cells = []; for (let n = t; n >= 0; n = prev[n]) cells.push([n % MW, (n / MW) | 0]); cells.reverse();
  const raw = cells.map(([i, j]) => worldOfCell(i, j));
  // smooth it: (1) pull the string tight (the longest straight pieces that keep their distance from the walls), (2) round the corners; every step is checked, and a step that fails is dropped
  const need = wide ? thr : 0, nearEnd = (ci, cj) => Math.max(Math.abs(ci - si), Math.abs(cj - sj)) <= 8 || Math.max(Math.abs(ci - ti), Math.abs(cj - tj)) <= 8;
  const okAt = (x, z) => { if (blockedAt(x, z)) return false; if (!wide) return true; const [ci, cj] = cellOf(x, z); return clearance[cj * MW + ci] >= need || nearEnd(ci, cj); };
  const clearLine = (a, b) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 0.012)); for (let k = 0; k <= n; k++) if (!okAt(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)) return false; return true; };
  const tight = [raw[0]]; for (let a = 0; a < raw.length - 1;) { let b = raw.length - 1; while (b > a + 1 && !clearLine(raw[a], raw[b])) b--; tight.push(raw[b]); a = b; }
  const okPoly = (poly) => { for (let k = 0; k < poly.length - 1; k++) if (!clearLine(poly[k], poly[k + 1])) return false; return true; };
  let pts = tight;
  for (let it = 0; it < 3 && pts.length > 2; it++) { const out = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) { const [x1, z1] = pts[k], [x2, z2] = pts[k + 1]; out.push([x1 * 0.75 + x2 * 0.25, z1 * 0.75 + z2 * 0.25], [x1 * 0.25 + x2 * 0.75, z1 * 0.25 + z2 * 0.75]); } out.push(pts[pts.length - 1]); if (!okPoly(out)) break; pts = out; }
  return okPoly(pts) ? pts : raw;
}
let playOn = false, mode = 'idle', ride = null, camGoal = null, viewCheck = 0, walkHome = null, home = { r: 1.3, y: 0.65 }, armed = true;
const dogHome = dogSprite.position.clone();
const playHint = document.getElementById('playhint');
function startPlay() {
  if (!focusOn) return; playOn = true; mode = 'walk'; armed = true; { const c = polarOf(); home = { r: c.r, y: c.y }; }
  const [gx, gy] = [doorLocal()[0] - 12, doorLocal()[1] + 0.4]; catSprite.position.set(wx(gx), 0.05, wz(gy)); catSprite.visible = catShadow.visible = true; meTag.style.display = ''; faceDog(); setCatView(pickView(CAT_VIEWS, 'front', catFace.x, catFace.z));
  playHint.hidden = false; document.getElementById('vehicle').hidden = false; controls.maxPolarAngle = 1.35;
  if (pendingGo) { const [x, z, label] = pendingGo; pendingGo = null; setTimeout(() => goTo(x, z, label), 400); }
}
function stopPlay() {
  camGoal = null; playOn = false; mode = 'idle'; ride = null;
  catSprite.visible = catShadow.visible = bike.visible = false; huntHud.hidden = true; for (const c of chests) c.g.visible = false; goMarker.visible = false; dogSprite.visible = true; pets[0].shadow.visible = true; hideBubbles(); catBubbleUntil = 0; meTag.style.display = 'none'; playHint.hidden = true; document.getElementById('vehicle').hidden = true;
  dogSprite.position.copy(dogHome); pets[0].y0 = dogHome.y;
}
function mount(path, label, onArrive) {
  if (mode === 'ride') return; // a second click while riding must not start another ride
  if (zoneOn) { zoneOn = false; home = zoneSaved; }
  chestZoom = 1;
  ride = { path, d: 0, len: path.reduce((a, p, k) => a + (k ? Math.hypot(p[0] - path[k - 1][0], p[1] - path[k - 1][1]) : 0), 0), onArrive, label };
  walkHome = home; home = { r: 2.6, y: 2.2 }; camGoal = { az: null, r: home.r, y: home.y }; mode = 'ride'; chat.hidden = true; bike.visible = true; bike.position.set(path[0][0], 0.05, path[0][1]); bike.rotation.y = Math.atan2(path[Math.min(4, path.length - 1)][0] - path[0][0], path[Math.min(4, path.length - 1)][1] - path[0][1]);
  catSprite.visible = false; catShadow.visible = false; dogSprite.visible = false; pets[0].shadow.visible = false; hideBubbles(); setFace('listen');
  playHint.textContent = '🛵 出发!';
}
function dismount(x, z) {
  bike.visible = false; catSprite.visible = true; catSprite.position.set(x - 0.05, 0.05, z); dogSprite.position.set(x + 0.05, 0.05, z + 0.01); faceDog(); setCatView(pickView(CAT_VIEWS, catView, catFace.x, catFace.z)); catShadow.visible = true;
  dogSprite.visible = true; pets[0].shadow.visible = true; dogSprite.position.set(x + 0.05, 0.05, z + 0.01); pets[0].y0 = 0.05;
  armed = false; mode = 'walk'; ride = null; home = walkHome; camGoal = { az: null, r: home.r, y: home.y }; playHint.textContent = '点地图上的地方,小猫骑车过去 · 点小狗聊天';
}
function goEat(name) {
  const spot = CANTEENS.find((c) => c[0] === name); if (!spot) return;
  const from = [catSprite.position.x, catSprite.position.z], to = L(spot[1], spot[2]);
  const path = findPath(from, to, true);
  if (!path) { say(['这条路好像不通……', 'sorry']); mainOptions(); return; }
  say([`好!去${name}!`, 'happy']);
  setTimeout(() => mount(path, name, () => { const [x, z] = path[path.length - 1]; dismount(x, z); chat.hidden = false; say([pick([`到啦!${name}!`, '到了到了,我要点菜。', '好香……(尾巴摇起来)']), 'happy']); options([['再去一家', askFood], ['骑回楼下', rideHome], ['随便逛逛', () => { chat.hidden = true; chatCool = performance.now() + 5000; }, true]]); }), 700);
}
function rideHome() {
  const from = [catSprite.position.x, catSprite.position.z], path = findPath(from, [dogHome.x - 0.07, dogHome.z + 0.03], true);
  if (!path) { say(['路不通。', 'sorry']); return; } say(['回家!', 'kiss']);
  setTimeout(() => mount(path, '回楼下', () => { const [x, z] = path[path.length - 1]; dismount(x, z); dogSprite.position.copy(dogHome); pets[0].y0 = dogHome.y; pets[0].shadow.position.set(dogHome.x, 0.043, dogHome.z); chat.hidden = false; say(['到家啦。(打了个哈欠)', 'sorry']); mainOptions(); }), 600);
}
const polarOf = (o = camera.position.clone().sub(controls.target)) => ({ az: Math.atan2(o.x, o.z), r: Math.hypot(o.x, o.z), y: o.y });
const sight = new THREE.Raycaster(), sightA = new THREE.Vector3(), sightD = new THREE.Vector3();
function seen(from, az, r, y) { // is the line from the vehicle/cat (from) to a camera at (az, r, y) around it free of buildings?
  sightA.set(from.x, from.y + 0.07, from.z); sightD.set(Math.sin(az) * r, y - 0.07, Math.cos(az) * r); const len = sightD.length(); sightD.divideScalar(len);
  sight.set(sightA, sightD); sight.near = 0.03; sight.far = len; return sight.intersectObjects(solids, false).length === 0;
}
let hiddenFor = 0;
let zoneOn = false, zoneSaved = null, chestZoom = 1, zoomAt = 0;
const courtWorld = L((COURT.x0 + COURT.x1) / 2, (COURT.y0 + COURT.y1) / 2);
function steerCamera(dt, now, follow) {
  // the sunken court of 建华楼 is open on its south side only: near it the camera looks in from the south, from fairly high, so that nothing stands in the way
  if (mode === 'walk') {
    const inZone = Math.hypot(follow.x - courtWorld[0], follow.z - courtWorld[1]) < 0.95;
    if (inZone && !zoneOn) { zoneOn = true; zoneSaved = home; home = { r: 1.5, y: 1.35 }; camGoal = { az: 0, r: 1.5, y: 1.35 }; }
    else if (!inZone && zoneOn) { zoneOn = false; home = zoneSaved; camGoal = { az: null, r: home.r, y: home.y }; }
  } // buildings may hide the ride: turn the view (then lift it) until the vehicle is in sight; the camera can also be moved to a wanted distance
  // on foot (and while hunting) the camera stays where she puts it: one fixed view, no automatic turning or stepping back
  if (mode === 'ride' && now > viewCheck) {
    viewCheck = now + 120; const cur = polarOf(), base = camGoal ? { az: camGoal.az ?? cur.az, r: camGoal.r, y: camGoal.y } : cur;
    const chestNear = huntOn && huntStage < NT && Math.hypot(follow.x - spots[huntStage][0], follow.z - spots[huntStage][1]) < 2.2 ? chests[huntStage].g.position : null;
    const clear = (az, r, y) => seen(follow, az, r, y) && (mode !== 'walk' || chat.hidden || !dogSprite.visible || seen(dogSprite.position, az, r, y)) && (!chestNear || seen(chestNear, az, r, y)); // while chatting, the puppy must be in sight too; near the next chest, the chest
    if (clear(base.az, base.r, base.y)) hiddenFor = 0; else if (++hiddenFor >= 4) { // hidden for about half a second: turn the view, not at once
      hiddenFor = 0;
      let found = null;
      for (const [rk, yk] of [[1, 1], [0.85, 1.35], [0.7, 1.8], [0.55, 2.4], [0.3, 3]]) { // always measured from the normal distance of the mode, so nothing compounds
        for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) { const az = base.az + da, r = home.r * rk, y = Math.min(4, home.y * yk); if (clear(az, r, y)) { found = { az, r, y }; break; } }
        if (found) break;
      }
      if (found) camGoal = found;
    }
  }
  if (camGoal) {
    const cur = polarOf(), k = 1 - Math.exp(-dt * (mode === 'ride' ? 2.2 : 2.6)), az = camGoal.az ?? cur.az, da = Math.atan2(Math.sin(az - cur.az), Math.cos(az - cur.az));
    const naz = cur.az + da * k, nr = cur.r + (camGoal.r - cur.r) * k, ny = cur.y + (camGoal.y - cur.y) * k;
    camera.position.set(controls.target.x + Math.sin(naz) * nr, controls.target.y + ny, controls.target.z + Math.cos(naz) * nr);
    if (Math.abs(da) < 0.03 && Math.abs(nr - camGoal.r) < 0.04 && Math.abs(ny - camGoal.y) < 0.04) camGoal = null;
  }
}
// ---- 寻宝: the puppy gives a clue; a chest sits at each place (the next one only shows up when he is close); an arrow shows the way; opening one gives a card and the next clue (texts: hunt.js)
const NT = TREASURES.length, huntHud = document.getElementById('hunt'), huntArrow = document.getElementById('hunt-arrow'), huntClue = document.getElementById('hunt-clue'), trModal = document.getElementById('treasure');
let huntStage = 0, huntOn = false, modalOpen = false;
try { huntStage = Math.min(NT, +localStorage.getItem('campus-hunt') || 0); huntOn = huntStage > 0; } catch { /* private window: starts from the beginning */ }
let cardOk = -1; // the stop whose printed clue card she has pressed 找到了 for
try { cardOk = +(localStorage.getItem('campus-hunt-card') ?? -1); } catch { /* ignore */ }
const saveHunt = () => { if (!huntStage) cardOk = -1; try { localStorage.setItem('campus-hunt', String(huntStage)); localStorage.setItem('campus-hunt-card', String(cardOk)); } catch { /* ignore */ } };
// a chest stands in the open: the cell near the named place that is the furthest from any wall (a chest right at a wall would half sink into it); `exact` stops (the sunken court) use the place itself
const spots = TREASURES.map((t) => {
  const c = cellOf(...L(...t.place));
  if (t.exact) { const [i, j] = nearestFree(...c) ?? [1, 1]; return worldOfCell(i, j); }
  let best = [1, 1], bs = -1e9;
  for (let dj = -30; dj <= 30; dj++) for (let di = -30; di <= 30; di++) { const a = c[0] + di, b = c[1] + dj; if (a < 2 || b < 2 || a >= MW - 2 || b >= MH - 2 || mask[b * MW + a] === 2) continue; const cl = Math.min(clearance[b * MW + a], 8), sc = cl * 2 - (cl < 6 ? 12 : 0) - Math.hypot(di, dj) * 0.12; if (sc > bs) { bs = sc; best = [a, b]; } }
  return worldOfCell(...best);
});
// no tree stands in front of a chest (the camera is fixed now, so a tree would hide it for good)
{ const m = new THREE.Matrix4().makeScale(0, 0, 0); let cut = 0; treeSpots.forEach(([x, z], i) => { if (spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.3)) { trunk.setMatrixAt(i, m); crown.setMatrixAt(i, m); cut++; } }); trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = true; }
// the surface the chest stands on: the sunken court floor, the 0.05 slabs of grass and pitches, or the plain ground (0)
const chestBase = (x, z) => { const fy = floorY(x, z); if (fy < 0.05) return fy - 0.05; const [i, j] = cellOf(x, z); return mask[j * MW + i] === 1 ? 0.05 : 0; };
const chests = spots.map(([x, z]) => {
  const g = new THREE.Group(), wood = mat('#a8703a', .8), gold = mat('#f2c230', .4), mk = (geo, m, px, py, pz, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = true; parent.add(o); return o; };
  mk(box(0.056, 0.028, 0.038), wood, 0, 0.014, 0); for (const sx of [-0.017, 0.017]) mk(box(0.006, 0.03, 0.04), gold, sx, 0.014, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.028, -0.019); g.add(lid);
  mk(box(0.056, 0.012, 0.038), wood, 0, 0.006, 0.019, lid); mk(box(0.056, 0.006, 0.038), mat('#b9803f', .8), 0, 0.015, 0.019, lid); for (const sx of [-0.017, 0.017]) mk(box(0.006, 0.018, 0.04), gold, sx, 0.009, 0.019, lid);
  mk(box(0.012, 0.014, 0.004), gold, 0, 0.026, 0.021);
  g.scale.setScalar(1.6); // (a little bigger: from the far camera of a ride a normal chest is a speck)
  g.position.set(x, chestBase(x, z) + 0.002, z); g.visible = false; scene.add(g); return { g, lid, open: 0 };
});
const bagBtn = document.getElementById('hunt-bag'), trTitle = document.getElementById('tr-title'), trText = document.getElementById('tr-text'), trItem = document.getElementById('tr-item'), trAsk = document.getElementById('tr-ask'), trReply = document.getElementById('tr-reply'), trNext = document.getElementById('tr-next'), trOk = document.getElementById('tr-ok');
let hintLevel = 0, hintUntil = 0, trAdvance = false;
const clueText = (i) => (TREASURES[i].real ? (cardOk === i ? `线索卡 ${TREASURES[i].cardNo} 拿到啦。照着卡上写的,骑车去找吧。` : `这一条线索不在地图上,在现实里:线索卡 ${TREASURES[i].cardNo}。${TREASURES[i].where}`) : TREASURES[i].clue);
function nextHint() { const t = TREASURES[huntStage], h = hintLevel < t.hints.length ? t.hints[hintLevel] : `答案:${t.name}`; hintLevel = Math.min(hintLevel + 1, t.hints.length + 1); if (hintLevel > t.hints.length + 1) hintLevel = 0; return h; }
function huntRender() {
  huntHud.hidden = !(playOn && huntOn && huntStage < NT);
  bagBtn.hidden = !(playOn && huntOn); bagBtn.textContent = `🎒 ${TREASURES.slice(0, huntStage).map((t) => t.item[0]).join('') || '空'} ${huntStage}/${NT}`;
  if (huntStage < NT && performance.now() > hintUntil) huntClue.textContent = clueText(huntStage);
}
// 抽一个,让小狗跑: the disc flies away from the camera, she runs after it showing her back, leaps, and trots home with it in her mouth
const backTex = loader.load('./assets/dog-back.webp'); backTex.colorSpace = THREE.SRGBColorSpace;
const frisMats = (() => { // a blue flying disc seen from above: a pale ring and a few marks, so that its spin shows
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#2f6fc4'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#cfe3ff'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 44, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#f4f9ff'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(64 + Math.cos(k * Math.PI / 2) * 22, 64 + Math.sin(k * Math.PI / 2) * 22, 6, 0, Math.PI * 2); x.fill(); } x.beginPath(); x.arc(64, 64, 9, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return [new THREE.MeshBasicMaterial({ color: '#1f4f94' }), new THREE.MeshBasicMaterial({ map: t }), new THREE.MeshBasicMaterial({ color: '#1f4f94' })];
})();
let fetchAnim = null;
function playFetch(done) {
  const c0 = catSprite.position.clone(), d0 = dogSprite.position.clone(), f = new THREE.Vector3().subVectors(c0, camera.position);
  const base = Math.atan2(f.x, f.z); let dir = [Math.sin(base), Math.cos(base)], len = 0.2, bestScore = -9;
  for (let n = 0; n < 24; n++) for (const l of [0.7, 0.6, 0.5, 0.4, 0.3]) { // open ground whose landing spot is in the middle of the screen (clear of the clue bar); the longest throw wins
    const turn = (n / 24) * Math.PI * 2 - Math.PI, a = base + turn, v = [Math.sin(a), Math.cos(a)];
    if ([0.25, 0.5, 0.75, 1].some((k) => blockedAt(c0.x + v[0] * l * k, c0.z + v[1] * l * k))) continue;
    const q = new THREE.Vector3(c0.x + v[0] * l, c0.y + 0.1, c0.z + v[1] * l).project(camera);
    if (Math.abs(q.x) > 0.45 || q.y > 0.3 || q.y < -0.4) continue;
    const score = l - Math.hypot(q.x, q.y) * 0.35; if (score > bestScore) { bestScore = score; dir = v; len = l; }
  }
  const toward = dir[0] * f.x + dir[1] * f.z < 0; // running toward the camera: she shows her face out, and her back on the way home
  const P = new THREE.Vector3(c0.x + dir[0] * len, d0.y, c0.z + dir[1] * len);
  const run = new THREE.Sprite(new THREE.SpriteMaterial({ map: FACES.happy, transparent: true, alphaTest: 0.05 })); run.center.copy(dogSprite.center); run.scale.copy(dogSprite.scale); run.position.copy(d0); scene.add(run);
  const shadow = new THREE.Mesh(pets[0].shadow.geometry, pets[0].shadow.material); shadow.scale.copy(pets[0].shadow.scale); shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1; scene.add(shadow);
  const disc = new THREE.Group(), plate = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0155, 0.004, 28), frisMats); disc.add(plate); scene.add(disc); // flies flat, spinning on its upright axis
  const dShadow = new THREE.Mesh(new THREE.CircleGeometry(0.014, 18), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false })); dShadow.rotation.x = -Math.PI / 2; dShadow.renderOrder = 1; scene.add(dShadow);
  dogSprite.visible = false; pets[0].shadow.visible = false; chat.hidden = true; const hid = chests.filter((c) => c.g.visible); for (const c of hid) c.g.visible = false;
  catFace.x = dir[0]; catFace.z = dir[1]; setCatView(pickView(CAT_VIEWS, catView, dir[0], dir[1])); hop = performance.now();
  const sc = dogSprite.scale.x, T = { run0: 0.35, leap: 1.45, land: 1.85, home0: 2.3, end: 3.7 }, ease = (k) => k * k * (3 - 2 * k);
  fetchAnim = { t0: performance.now(), step(now) {
    const t = window.__fetchT ?? (now - this.t0) / 1000, pos = run.position; let y = 0, lean = 0, front = false, held = false, back = false, from = d0, to = d0, k = 0;
    const hops = (k, n, h) => { const w = Math.sin(k * Math.PI * n); return [Math.abs(w) * h, w * 0.1]; };
    if (t < T.run0) { from = to = d0; }
    else if (t < T.leap) { from = d0; to = P; k = (t - T.run0) / (T.leap - T.run0); [y, lean] = hops(k, 5, 0.013); }
    else if (t < T.land) { from = to = P; k = (t - T.leap) / (T.land - T.leap); y = Math.sin(k * Math.PI) * 0.07; front = toward || k > 0.5; held = front; lean = (0.5 - k) * 0.5; }
    else if (t < T.home0) { from = to = P; k = (t - T.land) / (T.home0 - T.land); [y, lean] = hops(k, 2, 0.016); front = held = true; }
    else if (t < T.end) { from = P; to = d0; k = (t - T.home0) / (T.end - T.home0); [y, lean] = hops(k, 5, 0.014); front = held = !toward; back = toward; }
    const e = t < T.leap ? ease(k) : (t >= T.home0 ? ease(k) : 0);
    pos.set(from.x + (to.x - from.x) * (t >= T.home0 || t < T.leap ? e : 0), d0.y + y, from.z + (to.z - from.z) * (t >= T.home0 || t < T.leap ? e : 0));
    if (t >= T.leap && t < T.home0) pos.set(P.x, d0.y + y, P.z);
    const squash = 1 + (y > 0.0 ? Math.min(0.06, y * 1.5) : 0);
    run.material.map = front && !back ? FACES.happy : (back || (t >= 0.15 && !toward) ? backTex : FACES.happy); disc.visible = !back; if (back) dShadow.visible = false; run.material.rotation = lean; run.scale.set(sc * (2 - squash), sc * squash, 1);
    shadow.position.set(pos.x, 0.052, pos.z); shadow.scale.setScalar(Math.max(0.5, 1 - y * 5));
    // the disc: thrown from his hand, caught at the top of her leap, then held in her mouth
    if (held) { // in her mouth: the disc faces the camera, a little askew
      disc.position.set(pos.x, pos.y + 0.017, pos.z).addScaledVector(new THREE.Vector3().subVectors(camera.position, pos).setY(0).normalize(), 0.012);
      disc.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.95, 0, 0.35 + lean * 0.6))); plate.rotation.y = 0; dShadow.visible = false;
    } else {
      const q = Math.min(1, t / (T.leap + 0.05)), a0 = c0.y + 0.045; disc.position.set(c0.x + (P.x - c0.x) * q, a0 + (0.07 - a0) * q + Math.sin(q * Math.PI) * 0.1, c0.z + (P.z - c0.z) * q);
      disc.rotation.set(Math.sin(t * 3) * 0.12, 0, Math.cos(t * 2.3) * 0.12); plate.rotation.y = t * 24; // level in the air, only wobbling a little
      dShadow.visible = !back; dShadow.position.set(disc.position.x, 0.052, disc.position.z); dShadow.scale.setScalar(Math.max(0.5, 1 - (disc.position.y - 0.05) * 3));
    }
    if (t >= T.end) { scene.remove(run, shadow, disc, dShadow); run.material.dispose(); plate.geometry.dispose(); dShadow.geometry.dispose(); dShadow.material.dispose(); dogSprite.visible = true; pets[0].shadow.visible = true; setFace('heart', 1500); faceDog(); setCatView(pickView(CAT_VIEWS, catView, catFace.x, catFace.z)); for (const c of hid) c.g.visible = true; fetchAnim = null; done(); }
  } };
}
let trDone = null;
// the final reward: a short film, full screen, with its sound (the tap on the button lets it play aloud)
function playReward(src) {
  let box = document.getElementById('reward');
  if (!box) { box = document.createElement('div'); box.id = 'reward'; box.innerHTML = '<video playsinline controls></video><button aria-label="关闭">✕</button>'; document.body.append(box); box.querySelector('button').addEventListener('click', () => { const v = box.querySelector('video'); v.pause(); box.hidden = true; }); }
  const v = box.querySelector('video'); if (!v.src.endsWith(src.replace('./', ''))) v.src = src; box.hidden = false; v.currentTime = 0; v.play().catch(() => {});
}
function showCard({ item, title, ask, text, next, advance, okLabel, done, reward }) { // one card for a found chest, the 寻宝册 and the end
  trItem.textContent = item || ''; trTitle.textContent = title; trReply.hidden = true; trNext.hidden = true; trNext.textContent = next || ''; trAdvance = advance; trDone = done || null; trOk.textContent = okLabel || '收下';
  const showText = (reply) => { trReply.hidden = !reply; trReply.textContent = reply || ''; trText.textContent = ''; for (const line of [].concat(text)) { const p = document.createElement('span'); p.className = 'it'; p.textContent = line; trText.append(p); } if (reward) { const b = document.createElement('button'); b.className = 'tr-reward'; b.textContent = '▶ 看奖励'; b.addEventListener('click', () => playReward(reward)); trText.append(b); } trOk.hidden = false; trNext.hidden = !next; };
  trAsk.hidden = !ask;
  if (ask) { trOk.hidden = true; trText.textContent = ''; document.getElementById('tr-q').textContent = ask.q; const box = document.getElementById('tr-opts'); box.innerHTML = ''; ask.options.forEach((o, k) => { const b = document.createElement('button'); b.textContent = o; b.addEventListener('click', () => { trAsk.hidden = true; if (ask.fetch === k) { trModal.hidden = true; playFetch(() => { trModal.hidden = false; showText(ask.replies[k]); }); } else showText(ask.replies[k]); }); box.append(b); }); } else showText('');
  trModal.hidden = false;
}
function huntFoundNow(i) {
  modalOpen = true; const t = TREASURES[i], last = i === NT - 1;
  setTimeout(() => showCard({ item: t.item[0], title: last ? FINALE.title : `${t.title} · ${i + 1}/${NT}`, ask: t.ask, text: last ? [t.text, FINALE.text] : t.text, reward: last ? FINALE.reward : null, next: last ? '' : TREASURES[i + 1].real ? `下一个线索不在地图上,在现实里:线索卡 ${TREASURES[i + 1].cardNo}。${TREASURES[i + 1].where}` : `下一个线索:${TREASURES[i + 1].clue}`, advance: true }), 700);
}
trOk.addEventListener('click', () => { trModal.hidden = true; if (trAdvance) { huntStage = Math.min(NT, huntStage + 1); hintLevel = 0; saveHunt(); } const d = trDone; trDone = null; d?.(); modalOpen = false; huntRender(); if (needReal()) openReal(); }); // the next real-life note replaces the card in the same instant, no gap
// a stop that is found in real life: a floating note with the riddle stays up until she presses 找到了
let realWait = false;
const needReal = () => playOn && huntOn && huntStage < NT && TREASURES[huntStage].real && cardOk !== huntStage && !modalOpen && trModal.hidden;
function openReal() { const t = TREASURES[huntStage]; modalOpen = true; showCard({ item: '💌', title: `去现实里找 · 线索卡 ${t.cardNo}`, text: t.where, okLabel: '找到了', advance: false, done: () => { cardOk = huntStage; saveHunt(); } }); }
function realPrompt() { // when she comes back to the page with a note still unanswered
  if (realWait || !needReal()) return; realWait = true;
  setTimeout(() => { realWait = false; if (needReal()) openReal(); }, 300);
}
setInterval(realPrompt, 1200);
bagBtn.addEventListener('click', () => { if (modalOpen) return; modalOpen = true; showCard({ item: '🎒', title: '寻宝册', text: TREASURES.slice(0, huntStage).map((t) => `${t.item[0]} ${t.item[1]}:${t.text}`).concat(huntStage < NT ? [`还差 ${NT - huntStage} 件。`] : []), advance: false, okLabel: '关上' }); });
document.getElementById('hunt-hint').addEventListener('click', () => { if (huntStage < NT) { huntClue.textContent = nextHint(); hintUntil = performance.now() + 7000; setTimeout(huntRender, 7100); } });
const clueOptions = () => [['再给点提示', () => { say([nextHint(), 'listen']); options(clueOptions()); }], ['我自己找', () => { chat.hidden = true; chatCool = performance.now() + 6000; }], ['返回', mainOptions, true]];
function huntTalk() {
  if (huntStage >= NT) { say([`${NT}件都被你找到啦!(尾巴摇得停不下来)要再藏一遍吗?`, 'heart']); options([['再玩一次', () => { huntStage = 0; hintLevel = 0; huntOn = false; saveHunt(); huntRender(); huntTalk(); }], ['再看一次奖励', () => { chat.hidden = true; playReward(FINALE.reward); }], ['不用啦', mainOptions, true]]); return; }
  if (!huntOn) { say([INTRO, 'happy']); options([['好!给我第一个线索', () => { huntOn = true; huntRender(); say([clueText(huntStage), 'sly']); options(clueOptions()); }], ['等一下', mainOptions, true]]); return; }
  say([clueText(huntStage), 'sly']); options(clueOptions());
}
function huntTick(now) {
  const here = mode === 'ride' ? bike.position : catSprite.position;
  chests.forEach((c, i) => {
    const d = Math.hypot(here.x - spots[i][0], here.z - spots[i][1]), opening = i < huntStage || (i === huntStage && modalOpen);
    c.g.visible = !fetchAnim && huntOn && (opening || (i === huntStage && d < 3));
    c.open += ((opening ? 1 : 0) - c.open) * 0.12; c.lid.rotation.x = -1.15 * c.open;
    c.g.position.y = chestBase(spots[i][0], spots[i][1]) + 0.002 + (i === huntStage ? Math.sin(now / 400) * 0.004 : 0);
  });
  huntRender();
  if (huntOn && huntStage < NT) {
    const dx = spots[huntStage][0] - here.x, dz = spots[huntStage][1] - here.z, fx = controls.target.x - camera.position.x, fz = controls.target.z - camera.position.z, fl = Math.hypot(fx, fz) || 1;
    if (!TREASURES[huntStage].real) { const m = Math.round(Math.hypot(dx, dz) / S * 1.79 / 10) * 10; document.getElementById('hunt-dist').textContent = m < 60 ? '很近了!' : `约${m}米`; huntArrow.textContent = m < 60 ? '★' : '➤'; huntArrow.style.fontSize = m < 60 ? '13px' : ''; }
    if (TREASURES[huntStage].real) { huntArrow.textContent = '💌'; huntArrow.style.transform = ''; huntArrow.style.fontSize = '14px'; document.getElementById('hunt-dist').textContent = ''; } else
    huntArrow.style.transform = `rotate(${Math.atan2((dx * -fz + dz * fx) / fl, (dx * fx + dz * fz) / fl)}rad)`;
    if (mode === 'walk' && chat.hidden && !modalOpen && Math.hypot(dx, dz) < 0.16) huntFoundNow(huntStage);
  }
}
const bpos = new THREE.Vector3();
function placeBubbles(now) { // speech bubbles right above the two heads; the one on the left of the screen opens to the left
  const dogOn = !chat.hidden && mode === 'walk' && dogSprite.visible, catOn = now < catBubbleUntil && catSprite.visible && mode === 'walk';
  const at = (sp, h) => { bpos.copy(sp.position); bpos.y += h; bpos.project(camera); return [(bpos.x * 0.5 + 0.5) * innerWidth, (-bpos.y * 0.5 + 0.5) * innerHeight]; };
  const [dx, dy] = at(dogSprite, 0.082), [cx, cy] = at(catSprite, 0.088), dogLeft = dx < cx;
  for (const [el, on, x, y, left] of [[dogBubble, dogOn, dx, dy, dogLeft], [catBubble, catOn, cx, cy, !dogLeft]]) {
    el.style.display = on ? '' : 'none'; if (!on) continue;
    el.classList.toggle('l', left); el.style.left = `${x}px`; el.style.top = `${y - 6}px`;
  }
}
function updatePlay(dt, now) {
  if (!playOn) return;
  const follow = mode === 'ride' ? bike.position : catSprite.position;
  if (mode === 'walk') {
    catSprite.position.y = floorY(catSprite.position.x, catSprite.position.z) + Math.max(0, Math.sin(now / 520 + pets[0].phase)) * 0.006 + (now - hop < 350 ? Math.sin(((now - hop) / 350) * Math.PI) * 0.02 : 0); // floats like the puppy
    catShadow.position.set(catSprite.position.x, floorY(catSprite.position.x, catSprite.position.z) + 0.002, catSprite.position.z); // just above the 0.05 surfaces (pavement, grass, pitch), otherwise they hide it
    if (!chat.hidden) faceDog(); // talking to her: he turns to face her
    { const v = pickView(CAT_VIEWS, catView, catFace.x, catFace.z); if (v !== catView) setCatView(v); }
    // walking up to the puppy starts the chat
    const dp = new THREE.Vector3(); dogSprite.getWorldPosition(dp);
    const dd = Math.hypot(dp.x - catSprite.position.x, dp.z - catSprite.position.z);
    if (dd > 0.32) armed = true; // when he is far from her and comes back, the chat starts again
    if (armed && chat.hidden && now > chatCool && dd < 0.14) { armed = false; openChat(); }
  } else if (mode === 'ride') {
    ride.d += dt * 0.7; const t = Math.min(1, ride.d / ride.len);
    // locate the point at distance d along the path
    let acc = 0, k = 1; for (; k < ride.path.length; k++) { const seg = Math.hypot(ride.path[k][0] - ride.path[k - 1][0], ride.path[k][1] - ride.path[k - 1][1]); if (acc + seg >= ride.d) break; acc += seg; }
    if (k >= ride.path.length || t >= 1) { const done = ride.onArrive; done(); return; }
    const [x1, z1] = ride.path[k - 1], [x2, z2] = ride.path[k], seg = Math.hypot(x2 - x1, z2 - z1) || 1, u = (ride.d - acc) / seg;
    bike.position.set(x1 + (x2 - x1) * u, floorY(x1 + (x2 - x1) * u, z1 + (z2 - z1) * u), z1 + (z2 - z1) * u);
    const want = Math.atan2(x2 - x1, z2 - z1); let diff = want - bike.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); bike.rotation.y += diff * Math.min(1, dt * 8);
    { const hx = Math.sin(bike.rotation.y), hz = Math.cos(bike.rotation.y), fx = controls.target.x - camera.position.x, fz = controls.target.z - camera.position.z, fl = Math.hypot(fx, fz) || 1;
      void fl; rideView = pickView(VIEWS, rideView, hx, hz); setRideView(rideView); rideSprite.position.y = Math.abs(Math.sin(now / 110)) * 0.004; }
    playHint.textContent = `🛵 去${ride.label}的路上…`;
  }
  steerCamera(dt, now, follow);
  // third person: the camera keeps its angle and distance and follows
  placeBubbles(now); huntTick(now);
  // near the next chest the picture is centred half way between him and the chest, so the chest is always on the screen
  let fx0 = follow.x, fz0 = follow.z;
  if (huntOn && huntStage < NT && mode === 'walk' && !modalOpen) { const ex = spots[huntStage][0] - follow.x, ez = spots[huntStage][1] - follow.z, de = Math.hypot(ex, ez); if (de < 1.8) { const k = Math.min(1, (1.8 - de) / 0.8) * 0.5; fx0 += ex * k; fz0 += ez * k; } }
  const dx = fx0 - controls.target.x, dz = fz0 - controls.target.z, kf = 1 - Math.exp(-dt * 6);
  controls.target.x += dx * kf; controls.target.z += dz * kf; camera.position.x += dx * kf; camera.position.z += dz * kf;
  tmp.set(mode === 'ride' ? bike.position.x : catSprite.position.x, 0.2, mode === 'ride' ? bike.position.z : catSprite.position.z).project(camera);
  meTag.style.display = mode === 'ride' ? 'none' : '';
  meTag.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`; meTag.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
}

let lastT = performance.now();
function frame() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (tween) { const k = Math.min(1, (now - tween.t0) / tween.ms), e = ease(k); camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0v, tween.t1, e); if (k >= 1) { const d = tween.done; tween = null; d?.(); } }
  pin.position.y = (mineWorld ? mineWorld.top + 0.12 : 0) + Math.sin(now / 420) * 0.025; pin.rotation.y = now / 900;
  pulse.visible = !focusOn; const pk = (now % 1800) / 1800; pulse.scale.setScalar(1 + pk * 1.6); pulse.material.opacity = 0.7 * (1 - pk);
  for (const d of diggers) { d.upper.rotation.y = Math.sin(now / 1500) * 0.7; d.arm.rotation.z = Math.sin(now / 900) * 0.12; }
  if (faceUntil && now > faceUntil) setFace('happy');
  if (!faceUntil && face === 'happy' && now > blinkAt) { if (blinkAt && now - blinkAt < 0) {} blinkAt = now + 3500 + Math.random() * 2500; setFace('blink'); setTimeout(() => { if (face === 'blink') setFace('happy'); }, 140); }
  updatePlay(dt, now); fetchAnim?.step(now);
  idleStep('dog', dogSprite.material, IDLE.dog, now, dt); idleStep('cat', catSprite.material, ['back', 'bl', 'br'].includes(catView) ? IDLE.catBack : IDLE.catFront, now);
  for (const p of pets) p.shadow.position.set(p.sp.position.x, 0.052, p.sp.position.z);
  for (const p of pets) p.sp.position.y = p.y0 + Math.max(0, Math.sin(now / 520 + p.phase)) * 0.006 + (now - hop < 350 ? Math.sin(((now - hop) / 350) * Math.PI) * 0.03 : 0);
  for (const w of walkers) { const t = now / 1000 + w.phase; w.g.position.x = w.x0 + Math.sin(t * 0.6) * 0.03 * w.dir; w.g.position.y = 0.06 + Math.abs(Math.sin(t * 5)) * 0.004; w.g.rotation.y = Math.cos(t * 0.6) * w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  controls.update();
  renderer.render(scene, camera);
  const w = innerWidth, h = innerHeight, dist = camera.position.distanceTo(controls.target);
  for (const l of labels) {
    tmp.copy(l.v).project(camera);
    const ok = showLabels && !l.hidden && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 && (l.far || dist < 12);
    l.el.style.display = ok ? '' : 'none';
    if (ok) { l.el.style.left = `${(tmp.x * 0.5 + 0.5) * w}px`; l.el.style.top = `${(-tmp.y * 0.5 + 0.5) * h}px`; }
  }
  requestAnimationFrame(frame);
}
frame();
document.getElementById('loading').style.opacity = 0; setTimeout(() => document.getElementById('loading').remove(), 600);

// ---- bottom-left: the legend is a list of places; click one and the two of them ride there together
{
  const lgBody = document.getElementById('lg-body'), lgToggle = document.getElementById('lg-toggle');
  lgToggle.addEventListener('click', () => { lgBody.hidden = !lgBody.hidden; lgToggle.setAttribute('aria-expanded', String(!lgBody.hidden)); lgToggle.textContent = lgBody.hidden ? '📍 地点 ▸' : '📍 地点 ▾'; });
  const addGroup = (title, color, items) => {
    const d = document.createElement('details'), sm = document.createElement('summary'), box = document.createElement('div'); box.className = 'items';
    sm.innerHTML = `<i style="background:${color}"></i>${title}`; d.append(sm, box);
    for (const [name, cls, target] of items) { const b = document.createElement('button'); b.textContent = name; if (cls) b.className = cls; b.addEventListener('click', () => { const t = target(); goTo(t[0], t[1], name); }); box.append(b); }
    lgBody.append(d);
  };
  // which places can be reached at all (from the dorm door, over free cells)? the others are not offered, and their name tags are hidden
  const reach = new Uint8Array(MW * MH), start = nearestFree(...cellOf(dogHome.x - 0.07, dogHome.z + 0.03), 1);
  if (start) { const q = [start[1] * MW + start[0]]; reach[q[0]] = 1; for (let h = 0; h < q.length; h++) { const n = q[h], i = n % MW, j = (n / MW) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = i + di, b = j + dj; if (a < 1 || b < 1 || a >= MW - 1 || b >= MH - 1) continue; const m = b * MW + a; if (!reach[m] && mask[m] !== 2 && clearance[m] >= 1) { reach[m] = 1; q.push(m); } } } }
  const reachable = (gx, gy) => { const c = nearestFree(...cellOf(...L(gx, gy)), 1); return !!c && reach[c[1] * MW + c[0]] === 1; };
  const gone = PLACES.filter((p) => p[3] !== 'sport' && p[3] !== 'field' && p[3] !== 'work' && !reachable(p[1], p[2])).map((p) => p[0]); // (sports grounds and the building site have no tags worth hiding)
  for (const l of labels) if (gone.includes(l.name)) { l.hidden = true; l.el.style.display = 'none'; }
  if (gone.length) console.info('places nobody can ride to (hidden):', gone.join(', '));
  const at = (gx, gy) => () => L(gx, gy), byKind = (...kinds) => PLACES.filter((p) => kinds.includes(p[3]) && !gone.includes(p[0])).map(([name, gx, gy]) => [name, '', at(gx, gy)]);
  addGroup('学生宿舍', '#d6e8e1', [['34号楼', 'her', () => [dogHome.x - 0.07, dogHome.z + 0.03]], ['27号楼', 'him', at(711, 762)]]);
  addGroup('食堂', '#f0c394', EAT.filter((c) => !gone.includes(c[0])).map(([name, gx, gy]) => [name, '', at(gx, gy)]));
  addGroup('教学科研', '#d0d8dc', byKind('major', 'minor'));
  addGroup('体育场所', '#f1e48a', byKind('sport', 'field'));
  addGroup('校门', '#3a4a42', byKind('gate'));
  for (const [t, c] of [['家属区', '#e3c4b4'], ['绿地 · 水面', '#b7cf9d']]) { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = `<i style="background:${c}"></i>${t}`; lgBody.append(r); }
}
window.__campus = { camera, controls, scene, count: { trees: treeSpots.length }, debug: { state: () => ({ mode, playOn, cat: catSprite.position.toArray().map((v) => +v.toFixed(2)), bike: bike.visible, hunt: [huntStage, huntOn], view: rideView, vehicle, chatHidden: chat.hidden, ride: ride ? +(ride.d / ride.len).toFixed(2) : null }), eat: goEat, chestInfo: (i) => { const c = chests[i], p = c.g.position.clone(); p.y += 0.05; const v = p.clone().project(camera); return { vis: c.g.visible, pos: c.g.position.toArray().map((x) => +x.toFixed(2)), ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] }; }, path: (name) => { const spot = CANTEENS.find((c) => c[0] === name); return findPath([dogHome.x - 0.07, dogHome.z + 0.03], L(spot[1], spot[2]), true).map(([x, z]) => [Math.round(x / S + cx + data.x0), Math.round(z / S + cy + data.y0)]); }, go: (x, z) => goTo(x, z), view: () => ({ home, camGoal, cur: polarOf(), mode, tween: !!tween }), minClear: (name) => { const spot = CANTEENS.find((c) => c[0] === name), path = findPath([dogHome.x - 0.07, dogHome.z + 0.03], L(spot[1], spot[2]), true); if (!path) return null; const cl = path.map(([x, z]) => { const [i, j] = cellOf(x, z); return clearance[j * MW + i]; }); const mid = cl.slice(Math.min(20, cl.length >> 2), cl.length - Math.min(20, cl.length >> 2)); let len = 0; for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]); return { len: +len.toFixed(1), avg: +(cl.reduce((x, y) => x + y, 0) / cl.length).toFixed(1), n: path.length, min: Math.min(...cl), minMid: mid.length ? Math.min(...mid) : null, low: cl.filter((v) => v < 2).length }; }, click: (x, y) => goClick({ clientX: x, clientY: y }), tp: (x, z) => { catSprite.position.x = x; catSprite.position.z = z; }, fetch: () => new Promise((r) => playFetch(r)), hunt: { talk: huntTalk, spots: () => spots.map((s) => s.map((v) => +v.toFixed(2))), set: (n) => { huntStage = n; huntOn = true; saveHunt(); huntRender(); }, reset: () => { huntStage = 0; hintLevel = 0; huntOn = false; saveHunt(); huntRender(); } }, probe: (name) => { const spot = CANTEENS.find((c) => c[0] === name), from = [dogHome.x - 0.07, dogHome.z + 0.03], path = findPath(from, L(spot[1], spot[2]), true), out = []; let prevAz = 3.03;
  for (let k = 0; k < path.length; k += 4) { const p = new THREE.Vector3(path[k][0], 0.05, path[k][1]); let res = '.'; const T = [[1, 1], [0.85, 1.35], [0.7, 1.8], [0.55, 2.4], [0.3, 3]];
    outer: for (let t = 0; t < T.length; t++) for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.25, -1.25, 1.75, -1.75, 2.3, -2.3, Math.PI]) if (seen(p, prevAz + da, 2.6 * T[t][0], Math.min(4, 2.2 * T[t][1]))) { res = String(t); prevAz += da; break outer; } out.push(res); } return { len: path.length, tiers: out.join('') }; }, blockers: () => { const p = catSprite.position, c = polarOf(); sightA.set(p.x, p.y + 0.07, p.z); sightD.set(Math.sin(c.az) * c.r, c.y - 0.07, Math.cos(c.az) * c.r); const len = sightD.length(); sightD.divideScalar(len); sight.set(sightA, sightD); sight.near = 0.03; sight.far = len; return sight.intersectObjects(solids, false).map((h) => [+h.distance.toFixed(2), h.object.position.y, h.object.geometry.boundingBox ? 1 : 0, solids.indexOf(h.object), +h.point.y.toFixed(2)]); }, solidCount: () => solids.length, inSight: () => { const p = mode === 'ride' ? bike.position : catSprite.position, c = polarOf(); return { ok: seen(p, c.az, c.r, c.y), r: +c.r.toFixed(2), y: +c.y.toFixed(2), az: +c.az.toFixed(2) }; }, enter: enterFoot, talk: openChat, pick: (i) => chatOpts.children[i]?.click(), bubbles: () => [dogBubble.textContent, dogBubble.style.display, catBubble.textContent, catBubble.style.display], canteens: CANTEENS.map((c) => c[0]) } };
