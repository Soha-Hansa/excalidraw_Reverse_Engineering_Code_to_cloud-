/**
 * Handmade Rough Drawing Engine
 * Reverse-engineered from Excalidraw's Rough.js rendering pipeline.
 * 
 * Features:
 * 1. Seeded Pseudo-Random Number Generator (PRNG) for deterministic wobbliness without jitter on re-render.
 * 2. Multi-stroke line sketching with perpendicular bowing and random endpoint displacement.
 * 3. Rough rectangles with corner overshoots.
 * 4. Rough circles/ellipses with overlapping Bézier arcs and varying radii.
 * 5. Rough rhombus (diamond) polygons.
 * 6. Rough bullet points (hand-drawn bullet dots with attached text).
 * 7. Sketchy hachure / cross-hatch fill patterns.
 */

export class RoughEngine {
  /**
   * Linear Congruential Generator for reproducible randomness
   */
  static createPRNG(seed = 123456789) {
    let s = (Math.abs(seed) % 2147483647) || 1;
    return function nextRandom() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646; // returns in [0, 1)
    };
  }

  static getJitter(rand, roughness, magnitude = 1) {
    return (rand() - 0.5) * 2 * roughness * magnitude;
  }

  /**
   * Draw a hand-drawn sketchy line between (x1, y1) and (x2, y2).
   * Excalidraw / Rough.js draws each line twice with slight variations (double stroke)
   * and a gentle curve (bowing) to simulate human hand movement.
   */
  static drawRoughLine(ctx, x1, y1, x2, y2, options = {}) {
    const roughness = options.roughness ?? 1.5;
    const bowing = options.bowing ?? 1.0;
    const stroke = options.stroke || '#000000';
    const strokeWidth = options.strokeWidth || 2;
    const seed = options.seed || 42;

    const rand = this.createPRNG(seed);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);

    if (len === 0) return;

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Unit normal vector perpendicular to the line
    const nx = -dy / len;
    const ny = dx / len;

    // Draw 2 strokes (or 1 stroke if roughness is 0)
    const strokeCount = roughness > 0 ? 2 : 1;

    for (let pass = 0; pass < strokeCount; pass++) {
      ctx.beginPath();

      // Endpoint offsets (overshoot / undershoot)
      const startOvershoot = this.getJitter(rand, roughness, 1.8);
      const endOvershoot = this.getJitter(rand, roughness, 1.8);

      const sx = x1 + startOvershoot * (dx / len) + this.getJitter(rand, roughness, 0.8) * nx;
      const sy = y1 + startOvershoot * (dy / len) + this.getJitter(rand, roughness, 0.8) * ny;

      const ex = x2 + endOvershoot * (dx / len) + this.getJitter(rand, roughness, 0.8) * nx;
      const ey = y2 + endOvershoot * (dy / len) + this.getJitter(rand, roughness, 0.8) * ny;

      // Middle control points for bowing
      const bowOffset = (rand() - 0.5) * bowing * roughness * Math.min(len * 0.05, 5);
      const mid1X = x1 + dx * 0.35 + nx * bowOffset + this.getJitter(rand, roughness, 1.2);
      const mid1Y = y1 + dy * 0.35 + ny * bowOffset + this.getJitter(rand, roughness, 1.2);

      const mid2X = x1 + dx * 0.65 + nx * (bowOffset * 0.8) + this.getJitter(rand, roughness, 1.2);
      const mid2Y = y1 + dy * 0.65 + ny * (bowOffset * 0.8) + this.getJitter(rand, roughness, 1.2);

      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(mid1X, mid1Y, mid2X, mid2Y, ex, ey);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw a hand-drawn rectangle with slightly overshooting corners.
   */
  static drawRoughRectangle(ctx, x, y, width, height, options = {}) {
    const roughness = options.roughness ?? 1.5;
    const fill = options.fill;
    const fillStyle = options.fillStyle || 'hachure'; // 'hachure' | 'solid' | 'none'
    const seed = options.seed || 101;

    // Normalize rectangle coordinates
    let rx = width < 0 ? x + width : x;
    let ry = height < 0 ? y + height : y;
    let rw = Math.abs(width);
    let rh = Math.abs(height);

    if (rw < 1 && rh < 1) return;

    // Fill first
    if (fill && fill !== 'transparent' && fill !== 'none') {
      if (fillStyle === 'solid') {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.restore();
      } else if (fillStyle === 'hachure') {
        this.drawHachureFill(ctx, [
          { x: rx, y: ry },
          { x: rx + rw, y: ry },
          { x: rx + rw, y: ry + rh },
          { x: rx, y: ry + rh }
        ], fill, options);
      }
    }

    // 4 edges with unique sub-seeds
    const topSeed = seed + 1;
    const rightSeed = seed + 2;
    const bottomSeed = seed + 3;
    const leftSeed = seed + 4;

    // Top: (rx, ry) -> (rx + rw, ry)
    this.drawRoughLine(ctx, rx, ry, rx + rw, ry, { ...options, seed: topSeed });
    // Right: (rx + rw, ry) -> (rx + rw, ry + rh)
    this.drawRoughLine(ctx, rx + rw, ry, rx + rw, ry + rh, { ...options, seed: rightSeed });
    // Bottom: (rx + rw, ry + rh) -> (rx, ry + rh)
    this.drawRoughLine(ctx, rx + rw, ry + rh, rx, ry + rh, { ...options, seed: bottomSeed });
    // Left: (rx, ry + rh) -> (rx, ry)
    this.drawRoughLine(ctx, rx, ry + rh, rx, ry, { ...options, seed: leftSeed });
  }

  /**
   * Draw a hand-drawn rhombus / diamond.
   * Vertices are top-center, right-center, bottom-center, left-center.
   */
  static drawRoughRhombus(ctx, x, y, width, height, options = {}) {
    let rx = width < 0 ? x + width : x;
    let ry = height < 0 ? y + height : y;
    let rw = Math.abs(width);
    let rh = Math.abs(height);

    if (rw < 1 && rh < 1) return;

    const cx = rx + rw / 2;
    const cy = ry + rh / 2;

    const top = { x: cx, y: ry };
    const right = { x: rx + rw, y: cy };
    const bottom = { x: cx, y: ry + rh };
    const left = { x: rx, y: cy };

    const fill = options.fill;
    const fillStyle = options.fillStyle || 'hachure';

    if (fill && fill !== 'transparent' && fill !== 'none') {
      if (fillStyle === 'solid') {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(left.x, left.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (fillStyle === 'hachure') {
        this.drawHachureFill(ctx, [top, right, bottom, left], fill, options);
      }
    }

    const seed = options.seed || 202;
    this.drawRoughLine(ctx, top.x, top.y, right.x, right.y, { ...options, seed: seed + 1 });
    this.drawRoughLine(ctx, right.x, right.y, bottom.x, bottom.y, { ...options, seed: seed + 2 });
    this.drawRoughLine(ctx, bottom.x, bottom.y, left.x, left.y, { ...options, seed: seed + 3 });
    this.drawRoughLine(ctx, left.x, left.y, top.x, top.y, { ...options, seed: seed + 4 });
  }

  /**
   * Draw a hand-drawn circle or ellipse.
   * Hand-drawn circles overlap around 360-380 degrees and have subtle radius oscillations.
   */
  static drawRoughEllipse(ctx, x, y, width, height, options = {}) {
    const roughness = options.roughness ?? 1.5;
    const stroke = options.stroke || '#000000';
    const strokeWidth = options.strokeWidth || 2;
    const fill = options.fill;
    const fillStyle = options.fillStyle || 'hachure';
    const seed = options.seed || 303;

    let rx = width < 0 ? x + width : x;
    let ry = height < 0 ? y + height : y;
    let rw = Math.abs(width);
    let rh = Math.abs(height);

    if (rw < 1 && rh < 1) return;

    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const a = rw / 2; // semi-major radius
    const b = rh / 2; // semi-minor radius

    const rand = this.createPRNG(seed);

    // Optional fill
    if (fill && fill !== 'transparent' && fill !== 'none') {
      if (fillStyle === 'solid') {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (fillStyle === 'hachure') {
        // Approximate ellipse with polygon for hachure
        const pts = [];
        const steps = 32;
        for (let i = 0; i < steps; i++) {
          const ang = (i / steps) * Math.PI * 2;
          pts.push({ x: cx + a * Math.cos(ang), y: cy + b * Math.sin(ang) });
        }
        this.drawHachureFill(ctx, pts, fill, options);
      }
    }

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const passes = roughness > 0 ? 2 : 1;
    const numPoints = 16;

    for (let pass = 0; pass < passes; pass++) {
      ctx.beginPath();
      // Overlap angle: slightly past 2*PI (e.g. 2*PI + 0.2 to 0.4 rad)
      const overlap = (rand() * 0.35 + 0.15) * roughness;
      const startAngle = (rand() * 0.4 - 0.2);
      const totalAngle = Math.PI * 2 + overlap;
      const angleStep = totalAngle / numPoints;

      let firstX = 0, firstY = 0;

      for (let i = 0; i <= numPoints; i++) {
        const theta = startAngle + i * angleStep;
        // Jitter radius
        const rJitter = 1 + this.getJitter(rand, roughness, 0.05);
        const px = cx + (a * rJitter) * Math.cos(theta) + this.getJitter(rand, roughness, 0.7);
        const py = cy + (b * rJitter) * Math.sin(theta) + this.getJitter(rand, roughness, 0.7);

        if (i === 0) {
          firstX = px;
          firstY = py;
          ctx.moveTo(px, py);
        } else {
          // Smooth curve using bezier / quadratic
          ctx.lineTo(px, py);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw a hand-drawn circle (specialized ellipse with width = height)
   */
  static drawRoughCircle(ctx, cx, cy, radius, options = {}) {
    return this.drawRoughEllipse(ctx, cx - radius, cy - radius, radius * 2, radius * 2, options);
  }

  /**
   * Draw a handmade bullet point (organic sketch dot + text label)
   */
  static drawRoughBulletPoint(ctx, x, y, text = 'Bullet Item', options = {}) {
    const seed = options.seed || 404;
    const bulletRadius = options.bulletRadius || 4.5;
    const color = options.stroke || '#000000';
    const textColor = options.textColor || color;
    const fontSize = options.fontSize || 18;
    const fontFamily = options.fontFamily || '"Caveat", "Patrick Hand", "Comic Sans MS", cursive, sans-serif';

    // 1. Draw rough filled bullet dot
    ctx.save();
    // Fill the bullet dot with sketched solid or dense hachure
    this.drawRoughCircle(ctx, x, y, bulletRadius, {
      ...options,
      fill: color,
      fillStyle: 'solid',
      roughness: (options.roughness ?? 1.5) * 0.8,
      seed: seed
    });
    ctx.restore();

    // 2. Draw text label
    if (text) {
      ctx.save();
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + bulletRadius + 10, y);
      ctx.restore();
    }
  }

  /**
   * Draw rough text on canvas
   */
  static drawRoughText(ctx, x, y, text, options = {}) {
    const fontSize = options.fontSize || 20;
    const fontFamily = options.fontFamily || '"Caveat", "Patrick Hand", "Comic Sans MS", cursive, sans-serif';
    const color = options.stroke || '#000000';
    const lineHeight = fontSize * 1.3;

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';

    const lines = (text || '').split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });

    ctx.restore();
  }

  /**
   * Hachure fill (sketchy diagonal strokes) inside a polygon
   */
  static drawHachureFill(ctx, polygon, color, options = {}) {
    if (!polygon || polygon.length < 3) return;

    const angle = options.hachureAngle || -45;
    const gap = options.hachureGap || 8;
    const strokeWidth = options.hachureStrokeWidth || 1.2;
    const roughness = options.roughness ?? 1.2;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    polygon.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    // Rotate polygon points to align hachure lines horizontally
    const rotated = polygon.map(p => ({
      x: p.x * cos + p.y * sin,
      y: -p.x * sin + p.y * cos
    }));

    let rMinY = Infinity, rMaxY = -Infinity;
    rotated.forEach(p => {
      rMinY = Math.min(rMinY, p.y);
      rMaxY = Math.max(rMaxY, p.y);
    });

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';

    const rand = this.createPRNG((options.seed || 505) + 999);

    for (let y = rMinY + gap; y < rMaxY; y += gap) {
      // Find intersections with rotated polygon edges
      const intersections = [];
      for (let i = 0; i < rotated.length; i++) {
        const p1 = rotated[i];
        const p2 = rotated[(i + 1) % rotated.length];

        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const t = (y - p1.y) / (p2.y - p1.y);
          const x = p1.x + t * (p2.x - p1.x);
          intersections.push(x);
        }
      }

      intersections.sort((a, b) => a - b);

      for (let i = 0; i < intersections.length; i += 2) {
        if (i + 1 < intersections.length) {
          const x1 = intersections[i];
          const x2 = intersections[i + 1];

          // Un-rotate back to original canvas coordinates
          const origX1 = x1 * cos - y * sin;
          const origY1 = x1 * sin + y * cos;
          const origX2 = x2 * cos - y * sin;
          const origY2 = x2 * sin + y * cos;

          this.drawRoughLine(ctx, origX1, origY1, origX2, origY2, {
            stroke: color,
            strokeWidth,
            roughness: roughness * 0.75,
            bowing: 0.5,
            seed: Math.floor(rand() * 100000)
          });
        }
      }
    }

    ctx.restore();
  }
}
