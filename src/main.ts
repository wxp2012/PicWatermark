type WatermarkOptions = {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotateDeg: number; // 文字旋转角度
  repeat: boolean;
  gapX: number;
  gapY: number;
  padding: number;
  image?: HTMLImageElement | null;
  imageScale: number; // percentage 100 = 1x
  imageOpacity: number; // 0..1
  layoutAngle: number; // 排列倾斜角度
  watermarkOpacity: number; // 整体水印透明度
  hardenEnabled: boolean; // 是否开启加固
  blendMode: GlobalCompositeOperation; // 混合模式
  jitterEnabled: boolean; // 随机扰动
  textureEnabled: boolean; // 微纹理
  textureAlpha: number; // 纹理强度
  invisibleEnabled: boolean; // 隐形水印
  hiddenText: string; // 隐形水印内容
  exportFormat: 'png' | 'jpeg'; // 导出格式
  jpegQuality: number; // JPEG 质量
};

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

const fileInput = $("#fileInput") as HTMLInputElement;
const canvas = $("#canvas") as HTMLCanvasElement;
const applyBtn = $("#applyBtn") as HTMLButtonElement;
const downloadBtn = $("#downloadBtn") as HTMLButtonElement;
const resetBtn = $("#resetBtn") as HTMLButtonElement;

// Controls
const textInput = $("#wmText") as HTMLInputElement;
const fontSizeInput = $("#wmFontSize") as HTMLInputElement;
const fontFamilyInput = $("#wmFontFamily") as HTMLInputElement;
const colorInput = $("#wmColor") as HTMLInputElement;
const rotateInput = $("#wmRotate") as HTMLInputElement;
const repeatInput = $("#wmRepeat") as HTMLInputElement;
const gapXInput = $("#wmGapX") as HTMLInputElement;
const gapYInput = $("#wmGapY") as HTMLInputElement;
const paddingInput = $("#wmPadding") as HTMLInputElement;
const layoutAngleInput = $("#wmLayoutAngle") as HTMLInputElement;
const watermarkOpacityInput = $("#wmOpacity") as HTMLInputElement;

const wmImageInput = $("#wmImageInput") as HTMLInputElement;
const wmImageScaleInput = $("#wmImageScale") as HTMLInputElement;
const wmImageOpacityInput = $("#wmImageOpacity") as HTMLInputElement;

// Anti-tamper controls
const hardenInput = $("#wmHarden") as HTMLInputElement;
const blendSelect = $("#wmBlend") as HTMLSelectElement;
const jitterInput = $("#wmJitter") as HTMLInputElement;
const textureInput = $("#wmTexture") as HTMLInputElement;
const textureAlphaInput = $("#wmTextureAlpha") as HTMLInputElement;
const invisibleInput = $("#wmInvisible") as HTMLInputElement;
const hiddenTextInput = $("#wmHiddenText") as HTMLInputElement;
const exportSelect = $("#wmExport") as HTMLSelectElement;
const jpegQInput = $("#wmJpegQ") as HTMLInputElement;

let baseImage: HTMLImageElement | null = null;
let currentOptions: WatermarkOptions = {
  text: textInput.value,
  fontSize: Number(fontSizeInput.value),
  fontFamily: fontFamilyInput.value,
  color: colorInput.value,
  rotateDeg: Number(rotateInput.value),
  repeat: (repeatInput as HTMLInputElement).checked,
  gapX: Number(gapXInput.value),
  gapY: Number(gapYInput.value),
  padding: Number(paddingInput.value),
  image: null,
  imageScale: Number(wmImageScaleInput.value),
  imageOpacity: Number(wmImageOpacityInput.value),
  layoutAngle: Number(layoutAngleInput?.value || 0),
  watermarkOpacity: Number(watermarkOpacityInput?.value || 1),
  hardenEnabled: Boolean(hardenInput?.checked),
  blendMode: (blendSelect?.value as GlobalCompositeOperation) || 'source-over',
  jitterEnabled: Boolean(jitterInput?.checked),
  textureEnabled: Boolean(textureInput?.checked),
  textureAlpha: Number(textureAlphaInput?.value || 0.06),
  invisibleEnabled: Boolean(invisibleInput?.checked),
  hiddenText: hiddenTextInput?.value || 'Watermark',
  exportFormat: (exportSelect?.value as 'png' | 'jpeg') || 'png',
  jpegQuality: Number(jpegQInput?.value || 0.9),
};

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function downloadCanvas(canvasEl: HTMLCanvasElement, filename: string) {
  canvasEl.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function applyWatermark(
  base: HTMLImageElement,
  options: WatermarkOptions,
  targetCanvas: HTMLCanvasElement
) {
  const { width, height } = base;
  targetCanvas.width = width;
  targetCanvas.height = height;
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  // draw base image
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(base, 0, 0);

  // Build watermark tile
  const tileCanvas = document.createElement("canvas");
  const tileCtx = tileCanvas.getContext("2d")!;

  // Measure text size to decide tile size
  const font = `${options.fontSize}px ${options.fontFamily}`;
  tileCtx.font = font;
  const textMetrics = tileCtx.measureText(options.text);
  const textW = Math.ceil(
    Math.max(textMetrics.width, options.image ? (options.image.width * options.imageScale) / 100 : 0)
  );
  const textH = Math.ceil(
    Math.max(options.fontSize, options.image ? (options.image.height * options.imageScale) / 100 : 0)
  );

  const baseTileW = textW + options.padding * 2 + options.gapX;
  const baseTileH = textH + options.padding * 2 + options.gapY;

  // Expand tile size for rotation to avoid clipping
  const angle = (options.rotateDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const rotatedW = Math.ceil(baseTileW * cos + baseTileH * sin);
  const rotatedH = Math.ceil(baseTileW * sin + baseTileH * cos);

  tileCanvas.width = Math.max(1, rotatedW);
  tileCanvas.height = Math.max(1, rotatedH);

  // Draw watermark within tile centered
  tileCtx.clearRect(0, 0, tileCanvas.width, tileCanvas.height);
  tileCtx.save();
  tileCtx.translate(tileCanvas.width / 2, tileCanvas.height / 2);
  tileCtx.rotate(angle);

  // text
  tileCtx.font = font;
  tileCtx.textAlign = "center";
  tileCtx.textBaseline = "middle";
  tileCtx.fillStyle = options.color;
  tileCtx.fillText(options.text, 0, 0);

  // image watermark
  if (options.image) {
    const scaledW = (options.image.width * options.imageScale) / 100;
    const scaledH = (options.image.height * options.imageScale) / 100;
    tileCtx.globalAlpha = options.imageOpacity;
    tileCtx.drawImage(options.image, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
    tileCtx.globalAlpha = 1;
  }
  tileCtx.restore();

  if (options.repeat) {
    // 带布局倾斜与可选抖动的铺满
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, options.watermarkOpacity ?? 1));
    ctx.globalCompositeOperation = options.hardenEnabled
      ? (options.blendMode || 'source-over')
      : 'source-over';
    ctx.translate(width / 2, height / 2);
    const layoutRad = ((options.layoutAngle ?? 0) * Math.PI) / 180;
    ctx.rotate(layoutRad);

    if (options.jitterEnabled) {
      const stepX = tileCanvas.width;
      const stepY = tileCanvas.height;
      const startX = -width / 2 - stepX;
      const endX = width / 2 + stepX;
      const startY = -height / 2 - stepY;
      const endY = height / 2 + stepY;
      const ampX = Math.max(2, (options.gapX || 0) * 0.25);
      const ampY = Math.max(2, (options.gapY || 0) * 0.25);
      for (let y = startY; y <= endY; y += stepY) {
        for (let x = startX; x <= endX; x += stepX) {
          const dx = (Math.random() - 0.5) * 2 * ampX;
          const dy = (Math.random() - 0.5) * 2 * ampY;
          ctx.drawImage(tileCanvas, x + dx, y + dy);
        }
      }
    } else {
      const pattern = ctx.createPattern(tileCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }
    }
    ctx.restore();
  } else {
    // Single watermark placed at center
    const posX = width / 2 - tileCanvas.width / 2;
    const posY = height / 2 - tileCanvas.height / 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, options.watermarkOpacity ?? 1));
    ctx.globalCompositeOperation = options.hardenEnabled
      ? (options.blendMode || 'source-over')
      : 'source-over';
    ctx.drawImage(tileCanvas, posX, posY);
    ctx.restore();
  }

  // 微纹理覆盖，增加修复难度
  if (options.hardenEnabled && options.textureEnabled) {
    ctx.save();
    const noiseTile = document.createElement('canvas');
    const n = 128;
    noiseTile.width = n;
    noiseTile.height = n;
    const nctx = noiseTile.getContext('2d')!;
    const imgData = nctx.createImageData(n, n);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    nctx.putImageData(imgData, 0, 0);
    const noisePattern = ctx.createPattern(noiseTile, 'repeat');
    if (noisePattern) {
      ctx.globalAlpha = Math.min(1, Math.max(0, options.textureAlpha ?? 0.06));
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = noisePattern;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }
}

function refreshOptionsFromInputs(): WatermarkOptions {
  currentOptions = {
    text: textInput.value,
    fontSize: Number(fontSizeInput.value) || 36,
    fontFamily: fontFamilyInput.value || "Arial, sans-serif",
    color: colorInput.value || "rgba(255,255,255,0.8)",
    rotateDeg: Number(rotateInput.value) || 0,
    repeat: repeatInput.checked,
    gapX: Math.max(0, Number(gapXInput.value) || 0),
    gapY: Math.max(0, Number(gapYInput.value) || 0),
    padding: Math.max(0, Number(paddingInput.value) || 0),
    image: currentOptions.image ?? null,
    imageScale: Math.max(1, Number(wmImageScaleInput.value) || 100),
    imageOpacity: Math.min(1, Math.max(0, Number(wmImageOpacityInput.value) || 0.6)),
    layoutAngle: Number(layoutAngleInput?.value || 0),
    watermarkOpacity: Math.min(1, Math.max(0, Number(watermarkOpacityInput?.value || 1))),
    hardenEnabled: Boolean(hardenInput?.checked),
    blendMode: (blendSelect?.value as GlobalCompositeOperation) || 'source-over',
    jitterEnabled: Boolean(jitterInput?.checked),
    textureEnabled: Boolean(textureInput?.checked),
    textureAlpha: Math.min(1, Math.max(0, Number(textureAlphaInput?.value || 0.06))),
    invisibleEnabled: Boolean(invisibleInput?.checked),
    hiddenText: hiddenTextInput?.value || 'Watermark',
    exportFormat: (exportSelect?.value as 'png' | 'jpeg') || 'png',
    jpegQuality: Math.min(1, Math.max(0, Number(jpegQInput?.value || 0.9))),
  };
  return currentOptions;
}

function maybePreview() {
  if (!baseImage) return;
  const options = refreshOptionsFromInputs();
  applyWatermark(baseImage, options, canvas);
  downloadBtn.disabled = false;
}

// Events
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const img = await readFileAsImage(file);
  baseImage = img;
  // Fit canvas visually (CSS handles sizing), we render native size
  maybePreview();
});

wmImageInput.addEventListener("change", async () => {
  const file = wmImageInput.files?.[0];
  if (!file) {
    currentOptions.image = null;
    maybePreview();
    return;
  }
  const img = await readFileAsImage(file);
  currentOptions.image = img;
  maybePreview();
});

// live preview on inputs
[
  textInput,
  fontSizeInput,
  fontFamilyInput,
  colorInput,
  rotateInput,
  repeatInput,
  gapXInput,
  gapYInput,
  paddingInput,
  wmImageScaleInput,
  wmImageOpacityInput,
  layoutAngleInput,
  watermarkOpacityInput,
  hardenInput,
  blendSelect,
  jitterInput,
  textureInput,
  textureAlphaInput,
  invisibleInput,
  hiddenTextInput,
  exportSelect,
  jpegQInput,
].forEach((el) => el && el.addEventListener("input", maybePreview));

applyBtn.addEventListener("click", () => {
  if (!baseImage) return alert("请先选择图片");
  maybePreview();
});

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const cctx = c.getContext('2d')!;
  cctx.drawImage(src, 0, 0);
  return c;
}

function embedInvisibleWatermark(dest: HTMLCanvasElement, text: string) {
  if (!text) return;
  const dctx = dest.getContext('2d');
  if (!dctx) return;
  const { width, height } = dest;
  const imageData = dctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const payload = new Uint8Array(2 + bytes.length);
  payload[0] = (bytes.length >> 8) & 0xff;
  payload[1] = bytes.length & 0xff;
  payload.set(bytes, 2);
  const totalBits = payload.length * 8;
  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < totalBits; i += 4) {
    const byteIdx = (bitIndex / 8) | 0;
    const bitPos = 7 - (bitIndex % 8);
    const bit = (payload[byteIdx] >> bitPos) & 1;
    data[i + 2] = (data[i + 2] & 0xfe) | bit; // 写入 B 通道 LSB
    bitIndex++;
  }
  dctx.putImageData(imageData, 0, 0);
}

function downloadWithOptions(viewCanvas: HTMLCanvasElement, options: WatermarkOptions) {
  const temp = cloneCanvas(viewCanvas);
  if (options.invisibleEnabled) {
    embedInvisibleWatermark(temp, options.hiddenText || 'Watermark');
  }
  const type = options.exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = options.exportFormat === 'jpeg' ? options.jpegQuality : undefined;
  temp.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watermark.${options.exportFormat}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, type, quality);
}

downloadBtn.addEventListener("click", () => {
  if (!baseImage) return;
  const options = refreshOptionsFromInputs();
  applyWatermark(baseImage, options, canvas);
  downloadWithOptions(canvas, options);
});

resetBtn.addEventListener("click", () => {
  fileInput.value = "";
  wmImageInput.value = "";
  baseImage = null;
  currentOptions.image = null;
  canvas.width = 0;
  canvas.height = 0;
  downloadBtn.disabled = true;
});

