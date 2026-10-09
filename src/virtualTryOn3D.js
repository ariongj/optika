import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { frameDimensions } from "./tryOnPose.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const damp = (current, target, speed, delta) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));

const COLOR_MAP = {
  black: "#151515",
  matte: "#20201f",
  graphite: "#363a3b",
  tortoise: "#6b3d24",
  amber: "#a86432",
  caramel: "#b66f3d",
  honey: "#b77a36",
  crystal: "#d9d4ca",
  champagne: "#b89661",
  gold: "#b58a46",
  silver: "#9fa5a7",
  chrome: "#aab0b1",
  gunmetal: "#4a5052",
  rose: "#b87968",
  green: "#344b35",
  brown: "#5a3425",
  smoke: "#303638",
  bronze: "#76502f",
  blue: "#294c67"
};

const photoAnalysisCache = new Map();
const PHOTO_CACHE_LIMIT = 8;

function loadProductImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error("Missing product image"));
      return;
    }
    const image = new Image();
    if (/^https?:/i.test(source)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Product image could not be loaded"));
    image.src = source;
  });
}

function cleanPhotoTexture(imageData, removeBrightFringe) {
  const { data, width, height } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    let alpha = data[index + 3];
    if (alpha < 78) alpha = 0;
    else alpha = Math.min(255, Math.round(((alpha - 78) / 177) * 290));
    if (removeBrightFringe && alpha > 0) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / 3;
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (brightness > 205 && chroma < 42) alpha = 0;
    }
    data[index + 3] = alpha;
  }

  const total = width * height;
  const labels = new Int32Array(total);
  const stack = new Int32Array(total);
  const sizes = [0];
  let opaqueTotal = 0;
  let nextLabel = 1;
  for (let start = 0; start < total; start += 1) {
    if (labels[start] || data[start * 4 + 3] === 0) continue;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    labels[start] = nextLabel;
    while (top > 0) {
      const pixel = stack[--top];
      size += 1;
      const x = pixel % width;
      if (x > 0 && !labels[pixel - 1] && data[(pixel - 1) * 4 + 3] > 0) {
        labels[pixel - 1] = nextLabel;
        stack[top++] = pixel - 1;
      }
      if (x < width - 1 && !labels[pixel + 1] && data[(pixel + 1) * 4 + 3] > 0) {
        labels[pixel + 1] = nextLabel;
        stack[top++] = pixel + 1;
      }
      if (pixel >= width && !labels[pixel - width] && data[(pixel - width) * 4 + 3] > 0) {
        labels[pixel - width] = nextLabel;
        stack[top++] = pixel - width;
      }
      if (pixel < total - width && !labels[pixel + width] && data[(pixel + width) * 4 + 3] > 0) {
        labels[pixel + width] = nextLabel;
        stack[top++] = pixel + width;
      }
    }
    sizes.push(size);
    opaqueTotal += size;
    nextLabel += 1;
  }

  const minSize = Math.max(48, Math.round(opaqueTotal * 0.012));
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (labels[pixel] && sizes[labels[pixel]] < minSize) data[pixel * 4 + 3] = 0;
  }
}

async function analyzeProductPhoto(source) {
  if (photoAnalysisCache.has(source)) return photoAnalysisCache.get(source);
  const pending = loadProductImage(source).then((image) => {
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const imageScale = Math.min(1, 760 / Math.max(1, longestSide));
    const width = Math.max(1, Math.round(image.naturalWidth * imageScale));
    const height = Math.max(1, Math.round(image.naturalHeight * imageScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    const { data } = pixels;

    let transparencySamples = 0;
    const sampleStepX = Math.max(1, Math.round(width / 72));
    const sampleStepY = Math.max(1, Math.round(height / 72));
    for (let y = 0; y < height; y += sampleStepY) {
      for (let x = 0; x < width; x += sampleStepX) {
        if (data[(y * width + x) * 4 + 3] < 235) transparencySamples += 1;
      }
    }

    if (transparencySamples < 10) {
      const border = Math.max(2, Math.round(Math.min(width, height) * 0.025));
      const background = { r: 0, g: 0, b: 0, count: 0 };
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (x >= border && x < width - border && y >= border && y < height - border) continue;
          const index = (y * width + x) * 4;
          background.r += data[index];
          background.g += data[index + 1];
          background.b += data[index + 2];
          background.count += 1;
        }
      }
      background.r /= Math.max(1, background.count);
      background.g /= Math.max(1, background.count);
      background.b /= Math.max(1, background.count);
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const distance = Math.hypot(red - background.r, green - background.g, blue - background.b);
        const brightness = (red + green + blue) / 3;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        let alpha = data[index + 3];
        if (distance <= 16) alpha = 0;
        else if (distance < 64) alpha = Math.round(alpha * ((distance - 16) / 48));
        if (brightness > 232 && chroma < 34) alpha = Math.min(alpha, Math.max(0, Math.round((255 - brightness) * 12)));
        data[index + 3] = alpha;
      }
      context.putImageData(pixels, 0, 0);
    }

    const columnHeight = new Array(width).fill(0);
    const columnTop = new Array(width).fill(height);
    const columnBottom = new Array(width).fill(0);
    let contentLeft = width;
    let contentRight = 0;
    for (let x = 0; x < width; x += 1) {
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < height; y += 1) {
        if (data[(y * width + x) * 4 + 3] > 42) {
          if (top < 0) top = y;
          bottom = y;
        }
      }
      if (top >= 0) {
        columnHeight[x] = bottom - top + 1;
        columnTop[x] = top;
        columnBottom[x] = bottom;
        contentLeft = Math.min(contentLeft, x);
        contentRight = Math.max(contentRight, x);
      }
    }
    if (contentLeft >= contentRight) throw new Error("No frame silhouette found");

    const smoothed = columnHeight.map((_, x) => {
      let total = 0;
      let count = 0;
      for (let offset = -5; offset <= 5; offset += 1) {
        if (x + offset < 0 || x + offset >= width) continue;
        total += columnHeight[x + offset];
        count += 1;
      }
      return total / Math.max(1, count);
    });
    const tallest = Math.max(...smoothed);
    const threshold = tallest * 0.42;
    let bestStart = contentLeft;
    let bestEnd = contentRight;
    let bestSpan = 0;
    let runStart = -1;
    for (let x = contentLeft; x <= contentRight + 1; x += 1) {
      const isTall = x <= contentRight && smoothed[x] >= threshold;
      if (isTall && runStart < 0) runStart = x;
      if (!isTall && runStart >= 0) {
        if (x - runStart > bestSpan) {
          bestSpan = x - runStart;
          bestStart = runStart;
          bestEnd = x - 1;
        }
        runStart = -1;
      }
    }
    if (bestSpan < (contentRight - contentLeft + 1) * 0.52) {
      bestStart = contentLeft;
      bestEnd = contentRight;
    }

    let bandTop = height;
    let bandBottom = 0;
    for (let x = bestStart; x <= bestEnd; x += 1) {
      if (!columnHeight[x]) continue;
      bandTop = Math.min(bandTop, columnTop[x]);
      bandBottom = Math.max(bandBottom, columnBottom[x]);
    }
    if (bandTop >= bandBottom) throw new Error("Frame front could not be isolated");

    const sampleColor = (fromX, toX) => {
      const samples = [];
      const step = Math.max(1, Math.round((toX - fromX) / 120));
      for (let x = fromX; x <= toX; x += step) {
        for (let y = bandTop; y <= bandBottom; y += 2) {
          const index = (y * width + x) * 4;
          if (data[index + 3] > 210) samples.push([data[index], data[index + 1], data[index + 2]]);
        }
      }
      if (!samples.length) return { r: 38, g: 34, b: 31 };
      samples.sort((left, right) => (left[0] + left[1] + left[2]) - (right[0] + right[1] + right[2]));
      const kept = samples.slice(0, Math.max(1, Math.round(samples.length * 0.24)));
      const total = kept.reduce((sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]], [0, 0, 0]);
      return { r: total[0] / kept.length, g: total[1] / kept.length, b: total[2] / kept.length };
    };

    const bandWidth = bestEnd - bestStart + 1;
    const bandHeight = bandBottom - bandTop + 1;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = bandWidth;
    textureCanvas.height = bandHeight;
    const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
    textureContext.drawImage(canvas, bestStart, bandTop, bandWidth, bandHeight, 0, 0, bandWidth, bandHeight);
    const texturePixels = textureContext.getImageData(0, 0, bandWidth, bandHeight);
    const center = Math.round((bestStart + bestEnd) / 2);
    const leftColor = sampleColor(bestStart, center);
    const rightColor = sampleColor(center, bestEnd);
    const frameLuminance = (leftColor.r + leftColor.g + leftColor.b + rightColor.r + rightColor.g + rightColor.b) / 6;
    cleanPhotoTexture(texturePixels, frameLuminance < 96);
    textureContext.putImageData(texturePixels, 0, 0);
    return {
      textureCanvas,
      aspect: clamp(bandHeight / Math.max(1, bandWidth), 0.24, 0.68),
      leftColor,
      rightColor
    };
  }).catch((error) => {
    photoAnalysisCache.delete(source);
    throw error;
  });

  if (photoAnalysisCache.size >= PHOTO_CACHE_LIMIT) {
    const oldestKey = photoAnalysisCache.keys().next().value;
    photoAnalysisCache.delete(oldestKey);
  }
  photoAnalysisCache.set(source, pending);
  return pending;
}

export function colorFromName(value, fallback = "#282421") {
  const normalized = String(value || "").toLowerCase();
  const match = Object.entries(COLOR_MAP).find(([name]) => normalized.includes(name));
  return match?.[1] || fallback;
}

function outlineForShape(shapeName = "Square", side = 1) {
  const shape = String(shapeName).toLowerCase();
  const points = [];
  const count = 72;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI / 2 + (index / count) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    let exponent = 3.6;
    let radiusX = 0.48;
    let radiusY = 0.34;
    if (shape.includes("round") || shape.includes("panto")) exponent = 2.15;
    if (shape.includes("aviator")) {
      exponent = 2.15;
      radiusX = 0.5;
      radiusY = 0.38;
    }
    if (shape.includes("cat")) {
      exponent = 2.8;
      radiusX = 0.5;
      radiusY = 0.34;
    }
    if (shape.includes("wrap")) {
      exponent = 4.2;
      radiusX = 0.53;
      radiusY = 0.29;
    }
    const power = 2 / exponent;
    let x = radiusX * Math.sign(cosine) * Math.pow(Math.abs(cosine), power);
    let y = radiusY * Math.sign(sine) * Math.pow(Math.abs(sine), power);
    if (shape.includes("aviator")) y -= 0.06 * Math.max(0, -sine) + 0.025 * Math.abs(cosine);
    if (shape.includes("cat")) y += 0.09 * Math.max(0, side * x / radiusX) * Math.max(0, sine + 0.15);
    if (shape.includes("geometric")) {
      x *= 1 + 0.035 * Math.cos(angle * 6);
      y *= 1 + 0.035 * Math.cos(angle * 6);
    }
    points.push(new THREE.Vector2(x, y));
  }
  return points;
}

function createRingGeometry(points, thickness = 0.072, depth = 0.09) {
  const frameShape = new THREE.Shape();
  frameShape.setFromPoints(points);
  const inner = points.map((point) => new THREE.Vector2(point.x * (1 - thickness / 0.48), point.y * (1 - thickness / 0.34)));
  const hole = new THREE.Path();
  hole.setFromPoints([...inner].reverse());
  frameShape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(frameShape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSize: 0.015,
    bevelThickness: 0.012,
    bevelSegments: 2
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function createLensGeometry(points) {
  const lensShape = new THREE.Shape();
  lensShape.setFromPoints(points.map((point) => new THREE.Vector2(point.x * 0.96, point.y * 0.96)));
  const geometry = new THREE.ShapeGeometry(lensShape, 48);
  geometry.translate(0, 0, 0.065);
  return geometry;
}

function tube(points, radius, material, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 9, false), material);
  mesh.castShadow = true;
  return mesh;
}

export function createGlassesModel(product, options = {}) {
  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  const frameColor = colorFromName(options.frameColor || product?.color, "#292421");
  const lensColor = colorFromName(options.lensColor || product?.lensColor, "#35423b");
  const isMetal = /metal|titan|steel|çelik|alumin/i.test(product?.material || "");
  const dimensions = frameDimensions(product);
  const unit = 2.12 / dimensions.frameWidth;
  const lensHalfWidth = dimensions.lensWidth * unit / 2;
  const lensHalfHeight = dimensions.lensHeight * unit / 2;
  const lensCenter = (dimensions.lensWidth + dimensions.bridgeWidth) * unit / 2;
  const outerEdge = lensCenter + lensHalfWidth;
  const armLength = dimensions.templeLength * unit;
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: frameColor,
    metalness: isMetal ? 0.78 : 0.12,
    roughness: isMetal ? 0.2 : 0.26,
    clearcoat: 0.8,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.8
  });
  const hardwareMaterial = new THREE.MeshStandardMaterial({ color: isMetal ? frameColor : "#a9854e", metalness: 0.92, roughness: 0.2 });
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: lensColor,
    transparent: true,
    opacity: clamp(Number(options.lensOpacity ?? 64) / 100, 0.16, 0.9),
    roughness: 0.13,
    metalness: String(options.lensColor || product?.lensColor || "").toLowerCase().includes("mirror") ? 0.62 : 0,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const padMaterial = new THREE.MeshPhysicalMaterial({ color: "#eee6da", transparent: true, opacity: 0.65, roughness: 0.28 });
  const materials = { frameMaterial, hardwareMaterial, lensMaterial, padMaterial };

  [-1, 1].forEach((side) => {
    const originalPoints = outlineForShape(product?.frameShape, side);
    const maxX = Math.max(...originalPoints.map((point) => Math.abs(point.x)));
    const maxY = Math.max(...originalPoints.map((point) => Math.abs(point.y)));
    const points = originalPoints.map((point) => new THREE.Vector2(point.x * lensHalfWidth / maxX, point.y * lensHalfHeight / maxY));
    const lensRoot = new THREE.Group();
    lensRoot.name = side < 0 ? "left-front" : "right-front";
    lensRoot.position.x = side * lensCenter;
    lensRoot.rotation.y = side * -0.035;
    const ring = new THREE.Mesh(createRingGeometry(points, isMetal ? 0.019 : 0.046, isMetal ? 0.042 : 0.09), frameMaterial);
    const lens = new THREE.Mesh(createLensGeometry(points), lensMaterial);
    ring.castShadow = true;
    lensRoot.add(ring, lens);
    root.add(lensRoot);

    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.072, isMetal ? 0.04 : 0.062, 0.09), hardwareMaterial);
    hinge.position.set(side * outerEdge, 0.045, -0.02);
    hinge.castShadow = true;
    root.add(hinge);

    const temple = tube([
      new THREE.Vector3(side * outerEdge, 0.045, -0.02),
      new THREE.Vector3(side * (outerEdge + 0.025), 0.045, -armLength * 0.2),
      new THREE.Vector3(side * (outerEdge + 0.035), 0.02, -armLength * 0.74),
      new THREE.Vector3(side * (outerEdge - 0.075), -0.17, -armLength * 0.95)
    ], isMetal ? 0.017 : 0.03, frameMaterial, 30);
    temple.name = side < 0 ? "left-temple" : "right-temple";
    root.add(temple);

    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), padMaterial);
    pad.scale.set(0.55, 1, 0.42);
    pad.position.set(side * 0.14, -0.09, 0.11);
    root.add(pad);
  });

  root.add(tube([
    new THREE.Vector3(-dimensions.bridgeWidth * unit / 2, 0.035, 0.02),
    new THREE.Vector3(0, 0.13, 0.065),
    new THREE.Vector3(dimensions.bridgeWidth * unit / 2, 0.035, 0.02)
  ], isMetal ? 0.019 : 0.038, frameMaterial, 22));

  if (String(product?.frameShape || "").toLowerCase().includes("aviator")) {
    root.add(tube([
      new THREE.Vector3(-0.5, 0.31, 0),
      new THREE.Vector3(0, 0.38, 0.015),
      new THREE.Vector3(0.5, 0.31, 0)
    ], 0.018, hardwareMaterial, 28));
  }

  const faceOccluder = createFaceOccluder();
  root.add(faceOccluder);

  root.userData.materials = materials;
  root.userData.faceOccluder = faceOccluder;
  root.userData.nominalWidth = 2.12;
  root.userData.source = "approximation";
  root.userData.productId = product?.id;
  return root;
}

function createFaceOccluder() {
  // A depth-only ellipsoid hides far-side temples behind the head, unlike a
  // rotating flat circle which exposed arms through the face at oblique angles.
  const mask = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true }));
  mask.name = "face-depth-mask";
  mask.scale.set(0.93, 1.3, 0.8);
  mask.position.set(0, -0.24, -0.92);
  mask.renderOrder = -1;
  return mask;
}

export function modelVisualBounds(model) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  model.traverse((child) => {
    if (!child.isMesh || child === model.userData.faceOccluder) return;
    child.geometry.computeBoundingBox();
    bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
  });
  return bounds;
}

export function fitViewerBounds(bounds, yaw, pitch, aspect, zoom = 1) {
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  const rotated = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) rotated.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(rotation));
  const size = rotated.getSize(new THREE.Vector3());
  const center = rotated.getCenter(new THREE.Vector3());
  const scale = Math.min((2 * aspect * 0.68) / Math.max(size.x, 0.001), 1.1 / Math.max(size.y, 0.001)) * clamp(zoom, 0.8, 1.25);
  return { scale, center };
}

async function createPhotoReconstructedModel(product, options = {}) {
  if (!product?.image) return null;
  const analysis = await analyzeProductPhoto(product.image);
  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  const texture = new THREE.CanvasTexture(analysis.textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const frontWidth = 2.12;
  const frontHeight = frontWidth * analysis.aspect;
  const frontGeometry = new THREE.PlaneGeometry(frontWidth, frontHeight, 72, 1);
  const positions = frontGeometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedX = positions.getX(index) / (frontWidth / 2);
    positions.setZ(index, -0.1 * normalizedX * normalizedX);
  }
  frontGeometry.computeVertexNormals();
  const frontMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.035,
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const front = new THREE.Mesh(frontGeometry, frontMaterial);
  front.position.z = 0.065;
  front.renderOrder = 2;
  root.add(front);

  const shellMaterial = frontMaterial.clone();
  shellMaterial.map = texture;
  shellMaterial.color = new THREE.Color("#69635e");
  shellMaterial.opacity = 0.88;
  const shell = new THREE.Mesh(frontGeometry.clone(), shellMaterial);
  shell.position.z = 0.035;
  shell.renderOrder = 1;
  root.add(shell);

  const chosenFrameColor = options.frameColor && options.frameColor !== product.color
    ? new THREE.Color(colorFromName(options.frameColor, "#302b28"))
    : null;
  const sampledMaterial = (sample) => new THREE.MeshPhysicalMaterial({
    color: chosenFrameColor || new THREE.Color(
      clamp((sample.r / 255) * 0.92, 0, 1),
      clamp((sample.g / 255) * 0.92, 0, 1),
      clamp((sample.b / 255) * 0.92, 0, 1)
    ),
    metalness: 0.18,
    roughness: 0.25,
    clearcoat: 0.82,
    clearcoatRoughness: 0.1
  });
  const hingeY = frontHeight * 0.13;
  [-1, 1].forEach((side) => {
    const material = sampledMaterial(side < 0 ? analysis.leftColor : analysis.rightColor);
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.09, Math.max(0.055, frontHeight * 0.09), 0.11), material);
    hinge.position.set(side * 1.01, hingeY, -0.025);
    hinge.castShadow = true;
    root.add(hinge);
    root.add(tube([
      new THREE.Vector3(side * 1.015, hingeY, -0.04),
      new THREE.Vector3(side * 1.12, hingeY, -0.3),
      new THREE.Vector3(side * 1.16, hingeY - 0.02, -1.18),
      new THREE.Vector3(side * 1.08, hingeY - 0.18, -1.68)
    ], 0.035, material, 30));
  });

  const faceOccluder = new THREE.Mesh(
    new THREE.CircleGeometry(1, 80),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true, side: THREE.DoubleSide })
  );
  faceOccluder.scale.set(1.03, 1.36, 1);
  faceOccluder.position.set(0, -0.17, -0.02);
  faceOccluder.renderOrder = -1;
  root.add(faceOccluder);
  root.userData.photoReconstructed = true;
  root.userData.nominalWidth = frontWidth;
  root.userData.viewerCenterZ = -0.72;
  root.userData.productId = product?.id;
  return root;
}

export function normalizeCatalogGeometry(imported, product = {}) {
  const normalized = new THREE.Group();
  imported.rotation.set(
    THREE.MathUtils.degToRad(Number(product.tryOnRotationX || 0)),
    THREE.MathUtils.degToRad(Number(product.tryOnRotationY || 0)),
    THREE.MathUtils.degToRad(Number(product.tryOnRotationZ || 0))
  );
  imported.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(imported);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x) || size.x < 0.00001) throw new Error("Invalid model bounds");
  const center = bounds.getCenter(new THREE.Vector3());
  // Centre AFTER authoring rotation, scale both the translation and geometry,
  // and anchor the front at z=0. Unscaled centring displaced large-unit GLBs.
  imported.position.sub(new THREE.Vector3(center.x, center.y, bounds.max.z));
  normalized.add(imported);
  normalized.scale.setScalar((2.12 / size.x) * clamp(Number(product.tryOnScale || 1), 0.5, 2));
  normalized.position.y = Number(product.tryOnOffsetY || 0);
  return normalized;
}

async function loadCatalogModel(product, options = {}) {
  if (!product?.model3d) return null;
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(product.model3d);
  const imported = gltf.scene;
  const root = new THREE.Group();
  const normalized = normalizeCatalogGeometry(imported, product);
  const frameColor = new THREE.Color(colorFromName(options.frameColor || product.color, "#282421"));
  const lensColor = new THREE.Color(colorFromName(options.lensColor || product.lensColor, "#35423b"));
  imported.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.castShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      const name = `${child.name} ${material.name}`.toLowerCase();
      if (/lens|glass|lente|left_lens|right_lens/.test(name)) {
        material.color?.copy(lensColor);
        material.transparent = true;
        material.opacity = clamp(Number(options.lensOpacity ?? 64) / 100, 0.16, 0.9);
        material.depthWrite = false;
      } else if (/frame|front|temple|arm|hinge|rim|bridge/.test(name)) {
        material.color?.copy(frameColor);
      }
      material.needsUpdate = true;
    });
  });
  root.add(normalized);
  const faceOccluder = createFaceOccluder();
  root.add(faceOccluder);
  root.userData.imported = true;
  root.userData.source = "catalogue";
  root.userData.nominalWidth = 2.12;
  root.userData.viewerCenterZ = 0;
  root.userData.productId = product?.id;
  return root;
}

export function createVirtualTryOnRenderer(host, initialProduct, initialOptions = {}) {
  if (!host) throw new Error("A render host is required");
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.35 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "vto-three-canvas";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight("#fff7ea", "#625e56", 1.1));
  const key = new THREE.DirectionalLight("#fff2dc", 2.2);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#e3e9ed", 1.25);
  rim.position.set(4, 1, 3);
  scene.add(rim);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(room, 0.04);
  scene.environment = environmentTarget.texture;
  room.dispose();
  pmrem.dispose();

  let aspect = 1;
  let model = createGlassesModel(initialProduct, initialOptions);
  let visualBounds = modelVisualBounds(model);
  scene.add(model);
  let mode = "live";
  let animationFrame = 0;
  let lastTime = performance.now();
  let disposed = false;
  let contextLost = false;
  let viewerYaw = 0;
  let viewerPitch = 0;
  let viewerZoom = 1;
  const current = { x: 0.5, y: 0.45, scale: 0.34, yaw: 0, pitch: 0, roll: 0, visible: 0 };
  const target = { ...current };
  let modelLoadVersion = 0;
  let appliedKey = "";

  const disposeObject = (object) => {
    const disposedTextures = new Set();
    object.traverse((child) => {
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value?.isTexture && !disposedTextures.has(value)) {
            disposedTextures.add(value);
            value.dispose?.();
          }
        });
        material.dispose?.();
      });
    });
  };

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    aspect = width / height;
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const renderLoop = (time) => {
    if (disposed || contextLost) return;
    const delta = Math.min(0.05, Math.max(0.001, (time - lastTime) / 1000));
    lastTime = time;
    if (mode === "viewer") {
      target.x = 0.5;
      target.y = 0.5;
      target.scale = 0.5;
      target.yaw = viewerYaw;
      target.pitch = viewerPitch;
      target.roll = 0;
      target.visible = 1;
    }
    current.x = damp(current.x, target.x, 13, delta);
    current.y = damp(current.y, target.y, 13, delta);
    current.scale = damp(current.scale, target.scale, 12, delta);
    current.yaw = damp(current.yaw, target.yaw, 11, delta);
    current.pitch = damp(current.pitch, target.pitch, 11, delta);
    current.roll = damp(current.roll, target.roll, 12, delta);
    current.visible = damp(current.visible, target.visible, 14, delta);
    model.visible = current.visible > 0.04;
    const viewFit = mode === "viewer" ? fitViewerBounds(visualBounds, current.yaw, current.pitch, aspect, viewerZoom) : null;
    // Fit the current interpolated angle, not the destination angle, so fast
    // preset changes cannot temporarily crop a temple while rotation catches up.
    const scale = viewFit ? viewFit.scale : current.scale * aspect;
    // Only product viewing centres the rotated volume. AR remains anchored at
    // the bridge: moving it by the temple-depth centroid makes it slide sideways.
    model.position.set((current.x - 0.5) * 2 * aspect - (viewFit?.center.x || 0) * scale, (0.5 - current.y) * 2 - (viewFit?.center.y || 0) * scale, 0);
    model.scale.setScalar(scale);
    model.rotation.set(current.pitch, current.yaw, -current.roll, "YXZ");
    if (model.userData.faceOccluder) model.userData.faceOccluder.visible = mode !== "viewer";
    renderer.render(scene, camera);
    if (!document.hidden && inViewport) animationFrame = requestAnimationFrame(renderLoop);
  };
  let inViewport = true;
  const resumeRender = () => {
    if (!disposed && !contextLost && !document.hidden && inViewport) {
      cancelAnimationFrame(animationFrame);
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(renderLoop);
    }
  };
  const viewportObserver = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; if (inViewport) resumeRender(); });
  viewportObserver.observe(host);
  const onContextLost = (event) => { event.preventDefault(); contextLost = true; cancelAnimationFrame(animationFrame); initialOptions.onContextLost?.(); };
  const onContextRestored = () => { contextLost = false; resize(); initialOptions.onContextRestored?.(); resumeRender(); };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
  document.addEventListener("visibilitychange", resumeRender);
  animationFrame = requestAnimationFrame(renderLoop);

  const replaceModel = (nextModel) => {
    visualBounds = modelVisualBounds(nextModel);
    if (nextModel.userData.faceOccluder) nextModel.userData.faceOccluder.visible = mode !== "viewer";
    scene.add(nextModel);
    scene.remove(model);
    disposeObject(model);
    model = nextModel;
    initialOptions.onModelSource?.(model.userData.source || "approximation");
  };

  const applyProduct = async (product, options = {}) => {
    const key = JSON.stringify([product, options.frameColor, options.lensColor, options.lensOpacity]);
    if (key === appliedKey || disposed) return;
    appliedKey = key;
    if (
      options.preferPhotoReconstruction !== false
      && !product?.model3d
      && model.userData.photoReconstructed
      && model.userData.productId === product?.id
    ) return;
    const requestVersion = ++modelLoadVersion;
    replaceModel(createGlassesModel(product, options));
    if (product?.model3d) {
      try {
        const imported = await loadCatalogModel(product, options);
        if (!imported || disposed || requestVersion !== modelLoadVersion) {
          if (imported) disposeObject(imported);
          return;
        }
        replaceModel(imported);
        return;
      } catch {
        initialOptions.onModelSource?.("unavailable");
      }
    }
    // Photo cutouts carry perspective and baked-in temples; they are never a
    // reliable automatic 3D source. Only an explicitly calibrated asset opts in.
    if (options.preferPhotoReconstruction !== true || !product?.tryOnFrontPhotoVerified) return;
    try {
      const reconstructed = await createPhotoReconstructedModel(product, options);
      if (!reconstructed || disposed || requestVersion !== modelLoadVersion) {
        if (reconstructed) disposeObject(reconstructed);
        return;
      }
      replaceModel(reconstructed);
    } catch {
      // The parametric model remains available if image analysis is not possible.
    }
  };

  return {
    setMode(nextMode) {
      mode = nextMode;
      if (mode !== "viewer") target.visible = 0;
      resumeRender();
    },
    setFacePose(pose) {
      if (!pose || ![pose.x, pose.y, pose.scale, pose.yaw, pose.pitch, pose.roll].every(Number.isFinite) || pose.x < -0.05 || pose.x > 1.05 || pose.y < -0.05 || pose.y > 1.05) {
        target.visible = 0;
        return;
      }
      Object.assign(target, {
        x: clamp(pose.x, 0.06, 0.94),
        y: clamp(pose.y, 0.08, 0.88),
        scale: clamp(pose.scale, 0.16, 0.72),
        yaw: clamp(pose.yaw, -1.05, 1.05),
        pitch: clamp(pose.pitch, -0.55, 0.55),
        roll: clamp(pose.roll, -0.7, 0.7),
        visible: pose.visible === false ? 0 : 1
      });
    },
    setViewerRotation(yaw, pitch = viewerPitch) {
      viewerYaw = clamp(yaw, -0.78, 0.78);
      viewerPitch = clamp(pitch, -0.2, 0.2);
    },
    setViewerZoom(value) {
      viewerZoom = clamp(value, 0.8, 1.25);
    },
    updateProduct(product, options = {}) {
      applyProduct(product, options);
    },
    getCanvas() {
      renderer.render(scene, camera);
      return renderer.domElement;
    },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      viewportObserver.disconnect();
      document.removeEventListener("visibilitychange", resumeRender);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      disposeObject(model);
      environmentTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
