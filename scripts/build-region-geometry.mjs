import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = new URL('../data/region-geometry.json', import.meta.url);
const data = JSON.parse(readFileSync(source, 'utf8'));
const image = readFileSync(new URL('../dist/' + data.source, import.meta.url));
if (createHash('sha256').update(image).digest('hex') !== data.sourceSha256) {
  throw new Error('The base photograph changed. Re-register the region contours before building.');
}
if (Object.keys(data.regions).length !== 18) throw new Error('Expected 18 region geometries.');
const expected = JSON.parse(readFileSync(new URL('../data/expanded-content.json', import.meta.url), 'utf8')).countries.map(c => c.id);
if (expected.some(id => !data.regions[id])) throw new Error('A country is missing from the geometry review.');
if (data.sourceSize.join(',') !== '1280,822') throw new Error('Geometry coordinates must use the full native photograph.');
const requiredChecks = ['outer_perimeter', 'detached_parts', 'open_notches', 'interior_holes', 'lettering_overlap'];
let totalParts = 0, totalHoles = 0;
const contoursById = new Map();
for (const [id, region] of Object.entries(data.regions)) {
  if (!region.path || region.bounds.width <= 0 || region.bounds.height <= 0) throw new Error('Invalid region: ' + id);
  if (!region.review?.reviewed || requiredChecks.some(check => !region.review.checks.includes(check))) throw new Error('Incomplete perimeter review: ' + id);
  let outer = 0, holes = 0;
  const points = [];
  const contours = region.path.match(/M[^Z]+Z/g) || [];
  contoursById.set(id, []);
  if (contours.join(' ').replaceAll(/\s/g, '') !== region.path.replaceAll(/\s/g, '')) throw new Error('Unclosed or invalid contour: ' + id);
  for (const contour of contours) {
    const vertices = [...contour.matchAll(/(-?\d+),(-?\d+)/g)].map(p => [+p[1], +p[2]]);
    contoursById.get(id).push(vertices);
    if (vertices.length < 3) throw new Error('Empty contour: ' + id);
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      if (a[0] < 0 || a[1] < 0 || a[0] > data.sourceSize[0] || a[1] > data.sourceSize[1]) throw new Error('Contour outside the photograph: ' + id);
      area += a[0] * b[1] - a[1] * b[0];
    }
    if (!area) throw new Error('Zero-area contour: ' + id);
    if (area < 0) outer++; else holes++;
    points.push(...vertices);
  }
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  if (Object.keys(bounds).some(k => bounds[k] !== region.bounds[k])) throw new Error('Stale contour bounds: ' + id);
  if (outer !== region.parts || holes !== region.holes) throw new Error('Unaccounted detached parts or holes: ' + id);
  totalParts += outer; totalHoles += holes;
}
function contains(vertices, [x, y]) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const probes = JSON.parse(readFileSync(new URL('../data/region-review-probes.json', import.meta.url), 'utf8'));
for (const probe of probes) {
  const inside = contoursById.get(probe.region).reduce((value, contour) => value !== contains(contour, probe.point), false);
  if (inside !== probe.inside) throw new Error(`Photograph review regression (${probe.region}): ${probe.reason}`);
}
writeFileSync(new URL('../dist/region-geometry.js', import.meta.url),
  '// Generated from data/region-geometry.json; coordinates match the retained photograph.\nwindow.TERRA_GEOMETRY = ' + JSON.stringify(data) + ';\n');
console.log(`Validated all 18 region reviews: ${totalParts} parts, ${totalHoles} holes and ${probes.length} photographic regression probes.`);
