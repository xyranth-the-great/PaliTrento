import { LOOP } from './premium-shader-config.js';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FRAG = `
precision highp float;
uniform vec2 res;
uniform float a;
uniform float zoom;
const mat2 R = mat2(0.8,-0.6,0.6,0.8);

float height(vec2 p){
  vec2 q = p;
  for(int i=0;i<6;i++){
    float fi = float(i);
    float k = 1.0 + mod(fi,2.0);
    q += (0.62/(1.0+fi*0.3)) * vec2(
      sin(q.y*1.7 + fi*1.3 + a*k),
      cos(q.x*1.5 - fi*1.9 - a*(3.0-k)));
    q = R*q*1.13;
  }
  return 0.5*sin(q.x*1.25) + 0.5*sin(q.y*1.25 + q.x*0.35);
}

vec3 env(vec3 r){
  vec3 deep   = vec3(0.10,0.01,0.34);
  vec3 violet = vec3(0.48,0.12,0.98);
  vec3 magen  = vec3(0.90,0.28,0.98);
  vec3 cyan   = vec3(0.22,0.62,1.00);
  float s1 = 0.5+0.5*sin(r.x*3.2 + r.y*2.1 + 1.0);
  float s2 = 0.5+0.5*sin(r.y*4.1 - r.x*1.7 + 2.3);
  vec3 c = mix(deep, violet, smoothstep(0.15,0.85,s1));
  c = mix(c, magen, smoothstep(0.55,1.0,s2)*0.85);
  c = mix(c, cyan,  smoothstep(0.72,1.0,s1*s2*1.6)*0.9);
  return c;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*res) / res.y;
  vec2 p = uv * zoom;
  float e = 0.004;
  float h  = height(p);
  float hx = height(p+vec2(e,0.)) - h;
  float hy = height(p+vec2(0.,e)) - h;
  vec3 n = normalize(vec3(-hx/e*0.55, -hy/e*0.55, 1.0));

  vec3 r = reflect(vec3(0.,0.,-1.), n);
  vec3 col = env(r);

  float crease = smoothstep(0.0, 0.9, n.z);
  col *= 0.35 + 0.85*crease;

  float fres = pow(1.0 - n.z, 2.2);
  col += vec3(0.75,0.45,1.0) * fres * 0.9;
  vec3 L = normalize(vec3(-0.4,0.6,0.7));
  float spec = pow(max(dot(r,L),0.0), 38.0);
  col += vec3(1.0,0.92,1.0) * spec * 1.3;
  float spec2 = pow(max(dot(r,normalize(vec3(0.6,-0.3,0.75))),0.0), 22.0);
  col += vec3(0.45,0.7,1.0) * spec2 * 0.7;

  col *= 1.0 - 0.28*dot(uv,uv);
  col = col/(1.0+col*0.35);
  col = pow(col, vec3(0.92));
  gl_FragColor = vec4(col,1.0);
}`;

const liveRequests = [];
let activeLive = null;
let cachedStillFrame;
const TUBE_LOOP = 55.0;
const CHIP_ANGLE = (0.5 / 30.0) * Math.PI * 2;

function createRenderer(canvas, { zoom = 3.4, preserveDrawingBuffer = false } = {}) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer
  });
  if (!gl) {
    console.warn('WebGL is unavailable; using the Premium liquid-chrome fallback.');
    return null;
  }

  const releaseContext = () => {
    if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) {
      console.error('Unable to create the Premium liquid-chrome shader.');
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Premium liquid-chrome shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, VERT);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAG);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    releaseContext();
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    console.error('Unable to create the Premium liquid-chrome shader program.');
    releaseContext();
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Premium liquid-chrome shader linking failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    releaseContext();
    return null;
  }

  const position = gl.getAttribLocation(program, 'p');
  const resolution = gl.getUniformLocation(program, 'res');
  const uA = gl.getUniformLocation(program, 'a');
  const uZoom = gl.getUniformLocation(program, 'zoom');
  const buffer = gl.createBuffer();
  if (position < 0 || !resolution || !uA || !uZoom || !buffer) {
    console.error('Premium liquid-chrome shader could not initialize its drawing buffers.');
    if (buffer) gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    releaseContext();
    return null;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return {
    draw(t, duration = LOOP) {
      if (gl.isContextLost()) return;
      gl.useProgram(program);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(uA, (t / duration) * Math.PI * 2);
      gl.uniform1f(uZoom, zoom);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    drawAngle(angle) {
      if (gl.isContextLost()) return;
      gl.useProgram(program);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(uA, angle);
      gl.uniform1f(uZoom, zoom);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    resize(width, height) {
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    destroy() {
      if (!gl.isContextLost()) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      }
      releaseContext();
    }
  };
}

function drawGoldChrome(source, target) {
  const context = target.getContext('2d');
  if (!context) throw new Error('Unable to create the Premium gold chrome canvas.');
  if (!('filter' in context)) throw new Error('Canvas color grading is unavailable.');
  context.filter = getComputedStyle(document.documentElement)
    .getPropertyValue('--chrome-gold-filter').trim() || 'none';
  try {
    context.drawImage(source, 0, 0, target.width, target.height);
  } finally {
    context.filter = 'none';
  }
}

function getCachedStillFrame() {
  if (cachedStillFrame !== undefined) return cachedStillFrame;

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 432;
  const renderer = createRenderer(canvas);
  if (!renderer) {
    cachedStillFrame = '';
  } else {
    try {
      renderer.draw(1.5);
      const goldCanvas = document.createElement('canvas');
      goldCanvas.width = canvas.width;
      goldCanvas.height = canvas.height;
      drawGoldChrome(canvas, goldCanvas);
      cachedStillFrame = goldCanvas.toDataURL('image/png');
    } catch (error) {
      console.error('Unable to cache the Premium liquid-chrome still frame:', error);
      cachedStillFrame = '';
    } finally {
      renderer.destroy();
    }
  }

  const image = cachedStillFrame ? `url("${cachedStillFrame}")` : 'var(--chrome-fallback)';
  document.documentElement.style.setProperty('--chrome-still-image', image);
  return cachedStillFrame;
}

export function ensureLiquidChromeStill() {
  return getCachedStillFrame();
}

function refreshActiveLive() {
  const next = [...liveRequests].reverse().find(instance =>
    !instance.destroyed && !instance.reduceMotion.matches
  ) || null;

  if (next && oneShotRendererActive) {
    stopTubeRenderer();
    activeLive?.deactivate();
    activeLive = null;
    return;
  }

  if (activeLive === next) {
    activeLive?.refreshActive();
    if (!activeLive) updateTubeEngine();
    return;
  }

  if (next) stopTubeRenderer();
  activeLive?.deactivate();
  activeLive = next;
  activeLive?.activate();
  if (!activeLive) {
    releaseRendererWaiters();
    updateTubeEngine();
  }
}

export class LiquidChrome {
  constructor(surface, { radius = 'inherit', zoom = 3.4, live = false } = {}) {
    if (!(surface instanceof HTMLElement)) {
      throw new TypeError('LiquidChrome requires an HTML element surface.');
    }

    this.surface = surface;
    this.radius = typeof radius === 'number' ? `${radius}px` : radius;
    this.zoom = zoom;
    this.liveRequested = false;
    this.isActive = false;
    this.isVisible = true;
    this.destroyed = false;
    this.canvas = null;
    this.renderer = null;
    this.frameRequest = 0;
    this.t = 0;
    this.lastTimestamp = null;
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.originalBackgroundImage = surface.style.backgroundImage;
    this.originalBackgroundSize = surface.style.backgroundSize;
    this.originalBackgroundPosition = surface.style.backgroundPosition;
    this.originalRadius = surface.style.getPropertyValue('--liquid-chrome-radius');
    this.originalRadiusPriority = surface.style.getPropertyPriority('--liquid-chrome-radius');
    this.onVisibilityChange = () => this.updatePlayback();
    this.onMotionPreferenceChange = () => refreshActiveLive();

    surface.classList.add('liquid-chrome-surface');
    surface.style.setProperty('--liquid-chrome-radius', this.radius);
    getCachedStillFrame();
    this.showStill();
    if (live) this.setLive(true);
  }

  setLive(live) {
    if (this.destroyed) return;
    const shouldBeLive = Boolean(live);
    if (this.liveRequested === shouldBeLive) return;
    this.liveRequested = shouldBeLive;

    const existingIndex = liveRequests.indexOf(this);
    if (existingIndex >= 0) liveRequests.splice(existingIndex, 1);
    if (shouldBeLive) {
      liveRequests.push(this);
      if (typeof this.reduceMotion.addEventListener === 'function') {
        this.reduceMotion.addEventListener('change', this.onMotionPreferenceChange);
      } else {
        this.reduceMotion.addListener(this.onMotionPreferenceChange);
      }
    } else if (typeof this.reduceMotion.removeEventListener === 'function') {
      this.reduceMotion.removeEventListener('change', this.onMotionPreferenceChange);
    } else {
      this.reduceMotion.removeListener(this.onMotionPreferenceChange);
    }
    refreshActiveLive();
  }

  activate() {
    if (this.destroyed) return;
    this.isActive = true;
    this.surface.classList.add('liquid-chrome-live');
    this.surface.classList.remove('liquid-chrome-static', 'liquid-chrome-fallback');
    this.surface.style.backgroundImage = 'none';
    if (this.reduceMotion.matches) {
      this.showStill();
      return;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'liquid-chrome-canvas premium-shader-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.surface.prepend(this.canvas);
    this.renderer = createRenderer(this.canvas, { zoom: this.zoom });
    if (!this.renderer) {
      this.canvas.remove();
      this.canvas = null;
      this.showStill(true);
      return;
    }

    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.surface);
    } else {
      window.addEventListener('resize', this.onResize);
    }
    if (typeof IntersectionObserver === 'function') {
      this.isVisible = false;
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.isVisible = entries.some(entry => entry.isIntersecting);
        this.updatePlayback();
      });
      this.intersectionObserver.observe(this.surface);
    }
    this.resize();
  }

  onResize = () => this.resize();

  onContextLost = event => {
    event.preventDefault();
    this.stopPlayback();
    this.disposeRenderer();
    this.showStill(true);
    console.warn('Premium liquid-chrome WebGL context was lost; using the cached still frame.');
  };

  refreshActive() {
    if (this.reduceMotion.matches) {
      this.stopPlayback();
      this.showStill();
      return;
    }
    if (!this.renderer && this.isActive) {
      this.activate();
      return;
    }
    this.updatePlayback();
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(this.surface.clientWidth * scale);
    const height = Math.round(this.surface.clientHeight * scale);
    if (width <= 0 || height <= 0) return;
    this.renderer.resize(width, height);
    this.renderer.draw(this.reduceMotion.matches ? 1.5 : this.t);
    this.updatePlayback();
  }

  updatePlayback() {
    if (!this.renderer || !this.canvas) return;
    const shouldRun = this.isActive && this.isVisible && !document.hidden && !this.reduceMotion.matches;
    if (shouldRun && !this.frameRequest) {
      this.lastTimestamp = null;
      this.frameRequest = requestAnimationFrame(this.renderFrame);
    } else if (!shouldRun) {
      this.stopPlayback();
    }
  }

  renderFrame = timestamp => {
    this.frameRequest = 0;
    if (!this.renderer || !this.isActive || !this.isVisible || document.hidden || this.reduceMotion.matches) return;
    const dt = this.lastTimestamp === null ? 0 : (timestamp - this.lastTimestamp) / 1000;
    this.t = (this.t + dt) % LOOP;
    this.lastTimestamp = timestamp;
    this.renderer.draw(this.t);
    this.frameRequest = requestAnimationFrame(this.renderFrame);
  };

  stopPlayback() {
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
    this.lastTimestamp = null;
  }

  disposeRenderer() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('resize', this.onResize);
    if (this.canvas) this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer?.destroy();
    this.renderer = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  showStill(fallback = false) {
    this.stopPlayback();
    this.disposeRenderer();
    this.surface.classList.remove('liquid-chrome-live');
    this.surface.classList.add('liquid-chrome-static');
    const stillFrame = getCachedStillFrame();
    this.surface.style.backgroundImage = stillFrame
      ? `url("${stillFrame}")`
      : 'var(--chrome-fallback)';
    this.surface.style.backgroundSize = 'cover';
    this.surface.style.backgroundPosition = 'center';
    this.surface.classList.toggle('liquid-chrome-fallback', fallback || !stillFrame);
  }

  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    this.disposeRenderer();
    this.showStill();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const index = liveRequests.indexOf(this);
    if (index >= 0) liveRequests.splice(index, 1);
    if (typeof this.reduceMotion.removeEventListener === 'function') {
      this.reduceMotion.removeEventListener('change', this.onMotionPreferenceChange);
    } else {
      this.reduceMotion.removeListener(this.onMotionPreferenceChange);
    }
    refreshActiveLive();
    this.deactivate();
    this.surface.classList.remove(
      'liquid-chrome-surface',
      'liquid-chrome-live',
      'liquid-chrome-static',
      'liquid-chrome-fallback'
    );
    this.surface.style.backgroundImage = this.originalBackgroundImage;
    this.surface.style.backgroundSize = this.originalBackgroundSize;
    this.surface.style.backgroundPosition = this.originalBackgroundPosition;
    if (this.originalRadius) {
      this.surface.style.setProperty('--liquid-chrome-radius', this.originalRadius, this.originalRadiusPriority);
    } else {
      this.surface.style.removeProperty('--liquid-chrome-radius');
    }
  }
}

const chromePillImages = new Map();
const pendingChromePillImages = new Map();
const observedChromePills = new Set();
const chromePillRequestKeys = new WeakMap();
let chromePillRenderQueue = Promise.resolve();

async function renderChromePillImage(width, height) {
  stopTubeRenderer();
  await acquireRendererSlot();
  let renderer = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    renderer = createRenderer(canvas, { zoom: 0.7, preserveDrawingBuffer: true });
    if (!renderer) return '';
    renderer.drawAngle(CHIP_ANGLE);
    const goldCanvas = document.createElement('canvas');
    goldCanvas.width = width;
    goldCanvas.height = height;
    drawGoldChrome(canvas, goldCanvas);
    const blob = await new Promise((resolve, reject) => {
      try {
        goldCanvas.toBlob(result => result
          ? resolve(result)
          : reject(new Error('The Premium label still frame could not be encoded.')), 'image/png');
      } catch (error) {
        reject(error);
      }
    });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Unable to render a sharp Premium label still frame:', error);
    return '';
  } finally {
    renderer?.destroy();
    releaseRendererSlot();
  }
}

function getChromePillImage(key, width, height) {
  if (chromePillImages.has(key)) return Promise.resolve(chromePillImages.get(key));
  if (pendingChromePillImages.has(key)) return pendingChromePillImages.get(key);

  const request = chromePillRenderQueue.then(() => renderChromePillImage(width, height));
  chromePillRenderQueue = request.then(() => undefined, () => undefined);
  pendingChromePillImages.set(key, request);
  request.then(image => {
    if (image) chromePillImages.set(key, image);
    pendingChromePillImages.delete(key);
    updateTubeEngine();
  }, () => {
    pendingChromePillImages.delete(key);
    updateTubeEngine();
  });
  return request;
}

function updateChromePill(element) {
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(dpr * 2, 3);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const key = `${bounds.width.toFixed(3)}x${bounds.height.toFixed(3)}@${dpr}`;
  if (chromePillRequestKeys.get(element) === key) return;
  chromePillRequestKeys.set(element, key);
  element.style.setProperty('--chrome-pill-image', 'var(--chrome-fallback)');

  getChromePillImage(key, width, height).then(image => {
    if (image && element.isConnected && chromePillRequestKeys.get(element) === key) {
      element.style.setProperty('--chrome-pill-image', `url("${image}")`);
    }
  }, error => {
    console.error('Unable to apply the Premium label still frame:', error);
  });
}

function observeChromePill(element) {
  if (observedChromePills.has(element)) {
    updateChromePill(element);
    return;
  }
  observedChromePills.add(element);
  chromePillResizeObserver?.observe(element);
  updateChromePill(element);
}

function unobserveChromePill(element) {
  chromePillResizeObserver?.unobserve(element);
  observedChromePills.delete(element);
  chromePillRequestKeys.delete(element);
  element.style.removeProperty('--chrome-pill-image');
}

function scanChromePills(node, observe) {
  if (!(node instanceof Element)) return;
  const pills = [];
  if (node.matches('.chrome-pill')) pills.push(node);
  pills.push(...node.querySelectorAll('.chrome-pill'));
  pills.forEach(element => {
    if (observe) observeChromePill(element);
    else unobserveChromePill(element);
  });
}

let chromePillResizeObserver = null;
if (typeof ResizeObserver === 'function') {
  chromePillResizeObserver = new ResizeObserver(entries => {
    entries.forEach(entry => updateChromePill(entry.target));
  });
}

if (typeof MutationObserver === 'function' && document.documentElement) {
  const chromePillMutationObserver = new MutationObserver(records => {
    records.forEach(record => {
      if (record.target instanceof Element) {
        if (record.target.matches('.chrome-pill')) observeChromePill(record.target);
        else if (observedChromePills.has(record.target)) unobserveChromePill(record.target);
      }
      record.removedNodes.forEach(node => scanChromePills(node, false));
      record.addedNodes.forEach(node => scanChromePills(node, true));
    });
  });
  chromePillMutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  document.querySelectorAll('.chrome-pill').forEach(observeChromePill);
}

window.addEventListener('resize', () => observedChromePills.forEach(updateChromePill));
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  chromePillImages.forEach(image => URL.revokeObjectURL(image));
  chromePillImages.clear();
});

const tubeFrames = new Map();
const rendererWaiters = [];
const tubeMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let tubeRenderer = null;
let tubeWebGLCanvas = null;
let tubeGoldCanvas = null;
let tubeStillCanvas = null;
let tubeFrameRequest = 0;
let tubeLastTimestamp = null;
let tubeLastFrameTimestamp = 0;
let tubeTime = 0;
let tubeFrameIndex = 0;
let tubeStartPending = false;
let tubeStillAttempted = false;
let tubeWebGLFailed = false;
let oneShotRendererActive = false;
let tubeIntersectionObserver = null;
let tubeResizeObserver = null;
let tubeMotionListenerAttached = false;

function isTubeStaticMode() {
  const connection = navigator.connection;
  return tubeMotionPreference.matches
    || Boolean(connection && connection.saveData)
    || (Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4);
}

function acquireRendererSlot() {
  return new Promise(resolve => {
    const acquire = () => {
      if (activeLive || oneShotRendererActive) {
        rendererWaiters.push(acquire);
        return;
      }
      stopTubeRenderer();
      oneShotRendererActive = true;
      resolve();
    };
    acquire();
  });
}

function releaseRendererWaiters() {
  if (activeLive || oneShotRendererActive) return;
  rendererWaiters.splice(0).forEach(waiter => waiter());
}

function releaseRendererSlot() {
  oneShotRendererActive = false;
  refreshActiveLive();
  releaseRendererWaiters();
}

function visibleTubeFrames() {
  return [...tubeFrames.values()].filter(record => record.visible && record.frame.isConnected);
}

function resizeTubeFrame(record) {
  const bounds = record.frame.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  if (record.canvas.width === width && record.canvas.height === height) return;

  record.canvas.width = width;
  record.canvas.height = height;
  record.hasFrame = false;
  if (tubeStillCanvas) drawTubeCrop(record, tubeStillCanvas);
}

function drawTubeCrop(record, source) {
  const width = record.canvas.width;
  const height = record.canvas.height;
  if (!width || !height || !source.width || !source.height) return;

  const targetRatio = width / height;
  const sourceRatio = source.width / source.height;
  let sx = 0;
  let sy = 0;
  let sw = source.width;
  let sh = source.height;
  if (sourceRatio > targetRatio) {
    sw = source.height * targetRatio;
    sx = ((record.index * 0.17) % 1) * (source.width - sw);
  } else {
    sh = source.width / targetRatio;
    sy = ((record.index * 0.17) % 1) * (source.height - sh);
  }
  record.context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  record.hasFrame = true;
}

function setTubeFallback(record) {
  record.frame.classList.add('premium-frame-fallback');
}

function markTubeWebGLFailure() {
  tubeWebGLFailed = true;
  tubeFrames.forEach(setTubeFallback);
}

function pauseTubeLoop() {
  if (tubeFrameRequest) cancelAnimationFrame(tubeFrameRequest);
  tubeFrameRequest = 0;
  tubeLastTimestamp = null;
}

function stopTubeRenderer() {
  pauseTubeLoop();
  tubeRenderer?.destroy();
  tubeRenderer = null;
  tubeWebGLCanvas = null;
  tubeGoldCanvas = null;
}

function renderTubeFrame(timestamp) {
  tubeFrameRequest = 0;
  if (!tubeRenderer || activeLive || document.hidden || !visibleTubeFrames().length) return;

  if (timestamp - tubeLastFrameTimestamp < 1000 / 30) {
    tubeFrameRequest = requestAnimationFrame(renderTubeFrame);
    return;
  }
  const dt = tubeLastTimestamp === null ? 0 : (timestamp - tubeLastTimestamp) / 1000;
  tubeTime = (tubeTime + dt) % TUBE_LOOP;
  tubeLastTimestamp = timestamp;
  tubeLastFrameTimestamp = timestamp;
  tubeRenderer.draw(tubeTime, TUBE_LOOP);
  try {
    drawGoldChrome(tubeWebGLCanvas, tubeGoldCanvas);
  } catch (error) {
    console.error('Unable to color-grade the Premium tube frame:', error);
    markTubeWebGLFailure();
    stopTubeRenderer();
    return;
  }
  const visible = visibleTubeFrames();
  const selected = visible
    .map(record => {
      const bounds = record.frame.getBoundingClientRect();
      return {
        record,
        distance: Math.hypot(
          bounds.left + bounds.width / 2 - window.innerWidth / 2,
          bounds.top + bounds.height / 2 - window.innerHeight / 2
        )
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12)
    .map(({ record }) => record);
  const selectedFrames = new Set(selected);
  selected.forEach(record => drawTubeCrop(record, tubeGoldCanvas));
  visible.forEach(record => {
    if (!selectedFrames.has(record) && !record.hasFrame) drawTubeCrop(record, tubeGoldCanvas);
  });
  tubeFrameRequest = requestAnimationFrame(renderTubeFrame);
}

function startTubeRenderer() {
  if (tubeRenderer || tubeStartPending || tubeWebGLFailed || activeLive || oneShotRendererActive) return;
  if (pendingChromePillImages.size || rendererWaiters.length) return;
  if (document.hidden || !visibleTubeFrames().length || isTubeStaticMode()) return;

  tubeWebGLCanvas = document.createElement('canvas');
  tubeWebGLCanvas.width = 1024;
  tubeWebGLCanvas.height = 1024;
  tubeRenderer = createRenderer(tubeWebGLCanvas, { zoom: 1.0, preserveDrawingBuffer: true });
  if (!tubeRenderer) {
    tubeWebGLCanvas = null;
    markTubeWebGLFailure();
    return;
  }
  tubeGoldCanvas = document.createElement('canvas');
  tubeGoldCanvas.width = 1024;
  tubeGoldCanvas.height = 1024;
  tubeFrames.forEach(record => record.frame.classList.remove('premium-frame-fallback'));
  tubeLastTimestamp = null;
  tubeLastFrameTimestamp = 0;
  tubeFrameRequest = requestAnimationFrame(renderTubeFrame);
}

async function renderTubeStillFrames() {
  if (tubeStillAttempted || tubeStillCanvas || tubeStartPending || tubeWebGLFailed
      || !tubeFrames.size || activeLive || oneShotRendererActive) return;
  if (pendingChromePillImages.size) {
    chromePillRenderQueue.then(updateTubeEngine, updateTubeEngine);
    return;
  }

  tubeStartPending = true;
  let renderer = null;
  try {
    await acquireRendererSlot();
    if (!tubeFrames.size || activeLive || !isTubeStaticMode()) return;

    const webglCanvas = document.createElement('canvas');
    webglCanvas.width = 1024;
    webglCanvas.height = 1024;
    renderer = createRenderer(webglCanvas, { zoom: 1.0, preserveDrawingBuffer: true });
    if (!renderer) {
      tubeStillAttempted = true;
      markTubeWebGLFailure();
      return;
    }

    renderer.draw(1.5, TUBE_LOOP);
    tubeStillCanvas = document.createElement('canvas');
    tubeStillCanvas.width = 1024;
    tubeStillCanvas.height = 1024;
    drawGoldChrome(webglCanvas, tubeStillCanvas);
    tubeStillAttempted = true;
  } catch (error) {
    tubeStillAttempted = true;
    markTubeWebGLFailure();
    console.error('Unable to render a Premium tube still frame:', error);
  } finally {
    renderer?.destroy();
    if (oneShotRendererActive) releaseRendererSlot();
    tubeStartPending = false;
    updateTubeEngine();
  }

  if (tubeStillCanvas) tubeFrames.forEach(record => drawTubeCrop(record, tubeStillCanvas));
}

function updateTubeVisibility() {
  if (!tubeIntersectionObserver) {
    tubeFrames.forEach(record => {
      const bounds = record.frame.getBoundingClientRect();
      record.visible = bounds.bottom > 0 && bounds.top < window.innerHeight
        && bounds.right > 0 && bounds.left < window.innerWidth;
    });
  }
  updateTubeEngine();
}

function updateTubeEngine() {
  if (!tubeFrames.size) {
    stopTubeRenderer();
    tubeStillCanvas = null;
    return;
  }

  if (isTubeStaticMode()) {
    stopTubeRenderer();
    renderTubeStillFrames();
    return;
  }

  if (activeLive || oneShotRendererActive || document.hidden || !visibleTubeFrames().length) {
    if (activeLive || oneShotRendererActive) stopTubeRenderer();
    pauseTubeLoop();
    return;
  }
  startTubeRenderer();
}

function onTubeMotionPreferenceChange() {
  updateTubeEngine();
}

function onTubeVisibilityChange() {
  updateTubeEngine();
}

function onTubeWindowChange() {
  tubeFrames.forEach(resizeTubeFrame);
  updateTubeVisibility();
}

function attachTubeObservers() {
  if (typeof IntersectionObserver === 'function') {
    tubeIntersectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const record = tubeFrames.get(entry.target);
        if (record) record.visible = entry.isIntersecting;
      });
      updateTubeEngine();
    });
    tubeFrames.forEach(record => tubeIntersectionObserver.observe(record.frame));
  }
  if (typeof ResizeObserver === 'function') {
    tubeResizeObserver = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const record = tubeFrames.get(entry.target);
        if (record) resizeTubeFrame(record);
      });
    });
    tubeFrames.forEach(record => tubeResizeObserver.observe(record.frame));
  }
  if (typeof tubeMotionPreference.addEventListener === 'function') {
    tubeMotionPreference.addEventListener('change', onTubeMotionPreferenceChange);
  } else {
    tubeMotionPreference.addListener(onTubeMotionPreferenceChange);
  }
  document.addEventListener('visibilitychange', onTubeVisibilityChange);
  window.addEventListener('resize', onTubeWindowChange);
  if (!tubeIntersectionObserver) window.addEventListener('scroll', updateTubeVisibility, { passive: true });
  tubeMotionListenerAttached = true;
}

function detachTubeObservers() {
  tubeIntersectionObserver?.disconnect();
  tubeIntersectionObserver = null;
  tubeResizeObserver?.disconnect();
  tubeResizeObserver = null;
  if (!tubeMotionListenerAttached) return;
  if (typeof tubeMotionPreference.removeEventListener === 'function') {
    tubeMotionPreference.removeEventListener('change', onTubeMotionPreferenceChange);
  } else {
    tubeMotionPreference.removeListener(onTubeMotionPreferenceChange);
  }
  document.removeEventListener('visibilitychange', onTubeVisibilityChange);
  window.removeEventListener('resize', onTubeWindowChange);
  window.removeEventListener('scroll', updateTubeVisibility);
  tubeMotionListenerAttached = false;
}

export function registerPremiumTubeFrame(frame) {
  if (!(frame instanceof HTMLElement) || tubeFrames.has(frame)) return;
  const canvas = frame.querySelector('.tube-bg');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    frame.classList.add('premium-frame-fallback');
    console.error('Unable to create the Premium tube canvas context.');
    return;
  }

  const record = { frame, canvas, context, index: tubeFrameIndex++, visible: false };
  tubeFrames.set(frame, record);
  if (tubeWebGLFailed) setTubeFallback(record);
  if (tubeFrames.size === 1) attachTubeObservers();
  tubeIntersectionObserver?.observe(frame);
  tubeResizeObserver?.observe(frame);
  resizeTubeFrame(record);
  if (!tubeIntersectionObserver) updateTubeVisibility();
  updateTubeEngine();
}

export function unregisterPremiumTubeFrame(frame) {
  const record = tubeFrames.get(frame);
  if (!record) return;
  tubeIntersectionObserver?.unobserve(frame);
  tubeResizeObserver?.unobserve(frame);
  tubeFrames.delete(frame);
  record.canvas.width = 1;
  record.canvas.height = 1;
  if (!tubeFrames.size) {
    detachTubeObservers();
    stopTubeRenderer();
    tubeStillCanvas = null;
    tubeStillAttempted = false;
    tubeWebGLFailed = false;
    tubeFrameIndex = 0;
    return;
  }
  updateTubeEngine();
}
