import { RoughEngine } from './rough-engine.js';

class WhiteboardApp {
  constructor() {
    this.staticCanvas = document.getElementById('staticCanvas');
    this.interactiveCanvas = document.getElementById('interactiveCanvas');
    this.staticCtx = this.staticCanvas.getContext('2d');
    this.interactiveCtx = this.interactiveCanvas.getContext('2d');

    this.textOverlay = document.getElementById('textOverlay');
    this.textEditor = document.getElementById('textEditor');

    // Application state
    this.elements = [];
    this.undoStack = [];
    this.redoStack = [];

    this.currentTool = 'rectangle'; // 'select' | 'rectangle' | 'rhombus' | 'circle' | 'bullet' | 'text'
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentElement = null;
    this.selectedElement = null;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // Styling defaults
    this.strokeColor = '#1e1e1e';
    this.fillColor = 'transparent';
    this.fillStyle = 'none'; // 'none' | 'hachure' | 'solid'
    this.strokeWidth = 2;
    this.roughness = 1.4;
    this.fontSize = 20;

    this.initCanvasSize();
    this.bindEvents();
    this.render();
  }

  initCanvasSize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    [this.staticCanvas, this.interactiveCanvas].forEach(canvas => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    });

    this.dpr = dpr;
    this.render();
  }

  saveSnapshot() {
    this.undoStack.push(JSON.parse(JSON.stringify(this.elements)));
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.parse(JSON.stringify(this.elements)));
    this.elements = this.undoStack.pop();
    this.selectedElement = null;
    this.render();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.parse(JSON.stringify(this.elements)));
    this.elements = this.redoStack.pop();
    this.selectedElement = null;
    this.render();
  }

  clearCanvas() {
    if (this.elements.length === 0) return;
    this.saveSnapshot();
    this.elements = [];
    this.selectedElement = null;
    this.render();
  }

  deleteSelected() {
    if (!this.selectedElement) return;
    this.saveSnapshot();
    this.elements = this.elements.filter(el => el.id !== this.selectedElement.id);
    this.selectedElement = null;
    this.render();
  }

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    if (tool !== 'select') {
      this.selectedElement = null;
      this.render();
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // Toolbar buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        if (tool) this.setTool(tool);
      });
    });

    // Action buttons
    document.getElementById('btnUndo')?.addEventListener('click', () => this.undo());
    document.getElementById('btnRedo')?.addEventListener('click', () => this.redo());
    document.getElementById('btnClear')?.addEventListener('click', () => this.clearCanvas());
    document.getElementById('btnExport')?.addEventListener('click', () => this.exportImage());

    // Properties controls
    document.querySelectorAll('.color-option[data-type="stroke"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-option[data-type="stroke"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.strokeColor = btn.dataset.color;
        if (this.selectedElement) {
          this.saveSnapshot();
          this.selectedElement.stroke = this.strokeColor;
          this.render();
        }
      });
    });

    document.querySelectorAll('.color-option[data-type="fill"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-option[data-type="fill"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.fillColor = btn.dataset.color;
        if (this.fillColor === 'transparent') {
          this.fillStyle = 'none';
        } else if (this.fillStyle === 'none') {
          this.fillStyle = 'hachure';
        }
        if (this.selectedElement) {
          this.saveSnapshot();
          this.selectedElement.fill = this.fillColor;
          this.selectedElement.fillStyle = this.fillStyle;
          this.render();
        }
      });
    });

    document.querySelectorAll('.style-btn[data-style]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.style-btn[data-style]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.fillStyle = btn.dataset.style;
        if (this.selectedElement) {
          this.saveSnapshot();
          this.selectedElement.fillStyle = this.fillStyle;
          this.render();
        }
      });
    });

    document.querySelectorAll('.width-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.strokeWidth = parseInt(btn.dataset.width, 10);
        if (this.selectedElement) {
          this.saveSnapshot();
          this.selectedElement.strokeWidth = this.strokeWidth;
          this.render();
        }
      });
    });

    document.querySelectorAll('.rough-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.rough-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.roughness = parseFloat(btn.dataset.roughness);
        if (this.selectedElement) {
          this.saveSnapshot();
          this.selectedElement.roughness = this.roughness;
          this.render();
        }
      });
    });

    // Pointer events on interactive canvas
    this.interactiveCanvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.interactiveCanvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.interactiveCanvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    this.interactiveCanvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.textOverlay.style.display === 'block') return; // typing in text editor

      if (e.key === 'Backspace' || e.key === 'Delete') {
        this.deleteSelected();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.key === 'v' || e.key === '1') {
        this.setTool('select');
      } else if (e.key === 'r' || e.key === '2') {
        this.setTool('rectangle');
      } else if (e.key === 'd' || e.key === '3') {
        this.setTool('rhombus');
      } else if (e.key === 'c' || e.key === '4') {
        this.setTool('circle');
      } else if (e.key === 'b' || e.key === '5') {
        this.setTool('bullet');
      } else if (e.key === 't' || e.key === '6') {
        this.setTool('text');
      }
    });

    // Text editor commit
    this.textEditor.addEventListener('blur', () => this.commitText());
    this.textEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.commitText();
      } else if (e.key === 'Enter' && !e.shiftKey && this.activeTextType === 'bullet') {
        // In bullet mode, pressing Enter adds a new bullet right below
        e.preventDefault();
        const currentVal = this.textEditor.value;
        this.commitText();
        if (currentVal.trim()) {
          const nextY = this.activeTextElement.y + 32;
          this.openTextEditor(this.activeTextElement.x, nextY, '', 'bullet');
        }
      }
    });
  }

  getPointerPos(e) {
    const rect = this.interactiveCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  handlePointerDown(e) {
    const pos = this.getPointerPos(e);
    this.startX = pos.x;
    this.startY = pos.y;

    if (this.currentTool === 'select') {
      const hit = this.hitTest(pos.x, pos.y);
      if (hit) {
        this.selectedElement = hit;
        this.isDragging = true;
        this.dragOffsetX = pos.x - hit.x;
        this.dragOffsetY = pos.y - hit.y;
        this.saveSnapshot();
      } else {
        this.selectedElement = null;
      }
      this.render();
      return;
    }

    if (this.currentTool === 'text') {
      this.openTextEditor(pos.x, pos.y, '', 'text');
      return;
    }

    if (this.currentTool === 'bullet') {
      this.openTextEditor(pos.x, pos.y, '', 'bullet');
      return;
    }

    // Drawing geometric shapes
    this.isDrawing = true;
    this.saveSnapshot();

    const seed = Math.floor(Math.random() * 1000000) + 1;
    this.currentElement = {
      id: 'el_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: this.currentTool,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      stroke: this.strokeColor,
      fill: this.fillColor,
      fillStyle: this.fillStyle,
      strokeWidth: this.strokeWidth,
      roughness: this.roughness,
      seed: seed
    };
  }

  handlePointerMove(e) {
    const pos = this.getPointerPos(e);

    if (this.isDragging && this.selectedElement) {
      this.selectedElement.x = pos.x - this.dragOffsetX;
      this.selectedElement.y = pos.y - this.dragOffsetY;
      this.render();
      return;
    }

    if (this.isDrawing && this.currentElement) {
      this.currentElement.width = pos.x - this.startX;
      this.currentElement.height = pos.y - this.startY;

      // Render static elements to static canvas, and current drawing to interactive canvas
      this.renderInteractive();
    }
  }

  handlePointerUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    if (this.isDrawing && this.currentElement) {
      this.isDrawing = false;
      // Normalize width and height
      if (this.currentElement.width < 0) {
        this.currentElement.x += this.currentElement.width;
        this.currentElement.width = Math.abs(this.currentElement.width);
      }
      if (this.currentElement.height < 0) {
        this.currentElement.y += this.currentElement.height;
        this.currentElement.height = Math.abs(this.currentElement.height);
      }

      // Only add if size is noticeable
      if (this.currentElement.width > 4 || this.currentElement.height > 4) {
        this.elements.push(this.currentElement);
        this.selectedElement = this.currentElement;
      }
      this.currentElement = null;
      this.clearInteractiveCanvas();
      this.render();
    }
  }

  handleDoubleClick(e) {
    const pos = this.getPointerPos(e);
    const hit = this.hitTest(pos.x, pos.y);
    if (hit && (hit.type === 'text' || hit.type === 'bullet')) {
      this.openTextEditor(hit.x, hit.y, hit.text, hit.type, hit);
    }
  }

  hitTest(x, y) {
    // Check backwards (top-most first)
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      const padding = 6;
      let w = el.width || 0;
      let h = el.height || 0;

      if (el.type === 'text' || el.type === 'bullet') {
        const metrics = this.measureText(el.text || '', el.fontSize || 20);
        w = metrics.width + (el.type === 'bullet' ? 30 : 10);
        h = metrics.height + 10;
      }

      if (
        x >= el.x - padding &&
        x <= el.x + w + padding &&
        y >= el.y - padding &&
        y <= el.y + h + padding
      ) {
        return el;
      }
    }
    return null;
  }

  measureText(text, fontSize = 20) {
    this.staticCtx.save();
    this.staticCtx.font = `${fontSize}px "Caveat", "Patrick Hand", "Comic Sans MS", cursive, sans-serif`;
    const lines = (text || '').split('\n');
    let maxWidth = 0;
    lines.forEach(line => {
      const w = this.staticCtx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    });
    this.staticCtx.restore();
    return {
      width: Math.max(maxWidth, 20),
      height: Math.max(lines.length * (fontSize * 1.3), fontSize)
    };
  }

  openTextEditor(x, y, initialText = '', type = 'text', existingElement = null) {
    this.activeTextElement = existingElement;
    this.activeTextType = type;
    this.activeTextCoords = { x, y };

    this.textOverlay.style.display = 'block';
    this.textOverlay.style.left = `${x}px`;
    this.textOverlay.style.top = `${y}px`;

    this.textEditor.value = initialText;
    this.textEditor.style.color = this.strokeColor;
    this.textEditor.style.fontSize = `${this.fontSize}px`;
    this.textEditor.style.fontFamily = '"Caveat", "Patrick Hand", "Comic Sans MS", cursive, sans-serif';

    if (type === 'bullet') {
      this.textOverlay.style.paddingLeft = '24px';
      this.textOverlay.classList.add('bullet-mode');
    } else {
      this.textOverlay.style.paddingLeft = '4px';
      this.textOverlay.classList.remove('bullet-mode');
    }

    setTimeout(() => {
      this.textEditor.focus();
      this.textEditor.select();
    }, 10);
  }

  commitText() {
    if (this.textOverlay.style.display !== 'block') return;
    const text = this.textEditor.value;
    this.textOverlay.style.display = 'none';

    if (!text.trim()) {
      // If editing existing element and emptied text, delete it
      if (this.activeTextElement) {
        this.saveSnapshot();
        this.elements = this.elements.filter(el => el.id !== this.activeTextElement.id);
        this.selectedElement = null;
        this.render();
      }
      return;
    }

    this.saveSnapshot();

    if (this.activeTextElement) {
      this.activeTextElement.text = text;
      const m = this.measureText(text, this.activeTextElement.fontSize);
      this.activeTextElement.width = m.width + (this.activeTextElement.type === 'bullet' ? 30 : 10);
      this.activeTextElement.height = m.height;
      this.selectedElement = this.activeTextElement;
    } else {
      const seed = Math.floor(Math.random() * 1000000) + 1;
      const m = this.measureText(text, this.fontSize);
      const newEl = {
        id: 'el_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        type: this.activeTextType,
        x: this.activeTextCoords.x,
        y: this.activeTextCoords.y,
        width: m.width + (this.activeTextType === 'bullet' ? 30 : 10),
        height: m.height,
        text: text,
        stroke: this.strokeColor,
        fontSize: this.fontSize,
        roughness: this.roughness,
        seed: seed
      };
      this.elements.push(newEl);
      this.selectedElement = newEl;
    }

    this.render();
  }

  renderElement(ctx, el) {
    const opts = {
      stroke: el.stroke,
      fill: el.fill,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      roughness: el.roughness,
      seed: el.seed,
      fontSize: el.fontSize
    };

    switch (el.type) {
      case 'rectangle':
        RoughEngine.drawRoughRectangle(ctx, el.x, el.y, el.width, el.height, opts);
        break;
      case 'rhombus':
        RoughEngine.drawRoughRhombus(ctx, el.x, el.y, el.width, el.height, opts);
        break;
      case 'circle':
        RoughEngine.drawRoughEllipse(ctx, el.x, el.y, el.width, el.height, opts);
        break;
      case 'bullet':
        // x, y is the bullet dot center
        RoughEngine.drawRoughBulletPoint(ctx, el.x + 8, el.y + 12, el.text, opts);
        break;
      case 'text':
        RoughEngine.drawRoughText(ctx, el.x, el.y, el.text, opts);
        break;
    }
  }

  drawSelectionBox(ctx, el) {
    ctx.save();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);

    const padding = 6;
    let w = el.width || 0;
    let h = el.height || 0;

    if (el.type === 'text' || el.type === 'bullet') {
      const m = this.measureText(el.text || '', el.fontSize || 20);
      w = m.width + (el.type === 'bullet' ? 30 : 10);
      h = m.height + 10;
    }

    const x = el.x - padding;
    const y = el.y - padding;
    const width = w + padding * 2;
    const height = h + padding * 2;

    ctx.strokeRect(x, y, width, height);

    // Corner handles
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#6366f1';
    ctx.setLineDash([]);
    const handleSize = 7;

    const corners = [
      { x: x, y: y },
      { x: x + width, y: y },
      { x: x + width, y: y + height },
      { x: x, y: y + height }
    ];

    corners.forEach(c => {
      ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    });

    ctx.restore();
  }

  clearCanvasCtx(ctx) {
    ctx.clearRect(0, 0, this.staticCanvas.width / this.dpr, this.staticCanvas.height / this.dpr);
  }

  clearInteractiveCanvas() {
    this.clearCanvasCtx(this.interactiveCtx);
  }

  render() {
    // 1. Static canvas: committed elements
    this.clearCanvasCtx(this.staticCtx);

    // Draw grid pattern (subtle sketchbook dots)
    this.drawGrid(this.staticCtx);

    this.elements.forEach(el => {
      this.renderElement(this.staticCtx, el);
    });

    // 2. Interactive canvas: selection box & handles
    this.clearInteractiveCanvas();
    if (this.selectedElement) {
      this.drawSelectionBox(this.interactiveCtx, this.selectedElement);
    }
  }

  renderInteractive() {
    this.clearInteractiveCanvas();
    if (this.currentElement) {
      this.renderElement(this.interactiveCtx, this.currentElement);
    }
  }

  drawGrid(ctx) {
    const dotSpacing = 24;
    const w = this.staticCanvas.width / this.dpr;
    const h = this.staticCanvas.height / this.dpr;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let x = dotSpacing; x < w; x += dotSpacing) {
      for (let y = dotSpacing; y < h; y += dotSpacing) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.restore();
  }

  exportImage() {
    // Render everything cleanly to an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = this.staticCanvas.width;
    offscreen.height = this.staticCanvas.height;
    const ctx = offscreen.getContext('2d');

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    ctx.scale(this.dpr, this.dpr);
    this.elements.forEach(el => this.renderElement(ctx, el));

    const link = document.createElement('a');
    link.download = `handmade-drawing-${Date.now()}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new WhiteboardApp();
});
