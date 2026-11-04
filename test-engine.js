import { RoughEngine } from './rough-engine.js';

class MockCanvasContext {
  constructor() {
    this.calls = [];
    this.operations = [];
    this.strokeStyle = '';
    this.fillStyle = '';
    this.lineWidth = 1;
    this.lineCap = '';
    this.lineJoin = '';
    this.font = '';
    this.textBaseline = '';
  }

  save() { this.operations.push('save'); }
  restore() { this.operations.push('restore'); }
  beginPath() { this.operations.push('beginPath'); }
  closePath() { this.operations.push('closePath'); }
  moveTo(x, y) {
    if (isNaN(x) || isNaN(y)) throw new Error(`NaN in moveTo: ${x}, ${y}`);
    this.operations.push(`moveTo(${x.toFixed(1)}, ${y.toFixed(1)})`);
  }
  lineTo(x, y) {
    if (isNaN(x) || isNaN(y)) throw new Error(`NaN in lineTo: ${x}, ${y}`);
    this.operations.push(`lineTo(${x.toFixed(1)}, ${y.toFixed(1)})`);
  }
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    if ([cp1x, cp1y, cp2x, cp2y, x, y].some(isNaN)) {
      throw new Error(`NaN in bezierCurveTo`);
    }
    this.operations.push('bezierCurveTo');
  }
  stroke() { this.operations.push('stroke'); }
  fill() { this.operations.push('fill'); }
  fillRect(x, y, w, h) {
    if ([x, y, w, h].some(isNaN)) throw new Error(`NaN in fillRect`);
    this.operations.push(`fillRect(${x},${y},${w},${h})`);
  }
  strokeRect(x, y, w, h) {
    if ([x, y, w, h].some(isNaN)) throw new Error(`NaN in strokeRect`);
    this.operations.push(`strokeRect(${x},${y},${w},${h})`);
  }
  fillText(text, x, y) {
    if (isNaN(x) || isNaN(y)) throw new Error(`NaN in fillText`);
    this.operations.push(`fillText("${text}", ${x}, ${y})`);
  }
  ellipse(x, y, rx, ry, rot, s, e) {
    if ([x, y, rx, ry, rot, s, e].some(isNaN)) throw new Error(`NaN in ellipse`);
    this.operations.push('ellipse');
  }
}

function runTests() {
  console.log('--- Testing Rough Drawing Engine ---');
  const ctx = new MockCanvasContext();

  // Test 1: PRNG consistency
  const rand1 = RoughEngine.createPRNG(42);
  const rand2 = RoughEngine.createPRNG(42);
  const r1 = [rand1(), rand1(), rand1()];
  const r2 = [rand2(), rand2(), rand2()];
  if (JSON.stringify(r1) !== JSON.stringify(r2)) {
    throw new Error('PRNG failed: outputs are not deterministic');
  }
  console.log('✔ PRNG deterministic check passed');

  // Test 2: Rectangle
  ctx.operations = [];
  RoughEngine.drawRoughRectangle(ctx, 10, 20, 100, 80, { roughness: 1.5, stroke: '#000', seed: 101 });
  console.log(`✔ Rectangle drew ${ctx.operations.filter(o => o === 'stroke').length} strokes without NaN`);

  // Test 3: Rhombus (Diamond)
  ctx.operations = [];
  RoughEngine.drawRoughRhombus(ctx, 50, 50, 120, 100, { roughness: 1.5, stroke: '#2563eb', seed: 202 });
  console.log(`✔ Rhombus drew ${ctx.operations.filter(o => o === 'stroke').length} strokes without NaN`);

  // Test 4: Circle / Ellipse
  ctx.operations = [];
  RoughEngine.drawRoughEllipse(ctx, 100, 100, 80, 80, { roughness: 1.5, stroke: '#e11d48', seed: 303 });
  console.log(`✔ Circle drew ${ctx.operations.filter(o => o === 'stroke').length} strokes without NaN`);

  // Test 5: Bullet Point
  ctx.operations = [];
  RoughEngine.drawRoughBulletPoint(ctx, 40, 40, 'First Key Finding', { stroke: '#000', seed: 404 });
  const hasFillText = ctx.operations.some(o => o.includes('fillText("First Key Finding"'));
  if (!hasFillText) throw new Error('Bullet point missing text rendering');
  console.log('✔ Bullet point drew dot and text label');

  // Test 6: Text
  ctx.operations = [];
  RoughEngine.drawRoughText(ctx, 10, 10, 'Hello\nWorld', { stroke: '#1e1e1e' });
  const textOps = ctx.operations.filter(o => o.startsWith('fillText'));
  if (textOps.length !== 2) throw new Error(`Expected 2 lines rendered, got ${textOps.length}`);
  console.log('✔ Text multi-line rendered 2 lines correctly');

  // Test 7: Hachure Fill on Rectangle
  ctx.operations = [];
  RoughEngine.drawRoughRectangle(ctx, 0, 0, 100, 100, { fill: '#ff0000', fillStyle: 'hachure', roughness: 1.0 });
  const strokeOps = ctx.operations.filter(o => o === 'stroke').length;
  console.log(`✔ Hachure fill generated ${strokeOps} sketched strokes`);

  console.log('--- ALL ROUGH ENGINE TESTS PASSED ---');
}

runTests();
