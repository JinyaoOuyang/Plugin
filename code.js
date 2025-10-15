// Figma plugin controller for Amazon listing image generation

figma.showUI(__html__, { width: 420, height: 560 });

// Simple request bridge to UI for network calls (remove.bg)
var pendingRequests = {};
var nextRequestId = 1;
var lastGeneratedIds = [];

function requestUi(method, payload) {
  return new Promise(function (resolve, reject) {
    var id = String(nextRequestId++);
    pendingRequests[id] = { resolve: resolve, reject: reject };
    figma.ui.postMessage({ type: 'bridgeRequest', payload: { id: id, method: method, data: payload } });
    // Increase timeout to 3 minutes to account for large uploads/network slowness
    var timer = setTimeout(function () {
      if (pendingRequests[id]) {
        delete pendingRequests[id];
        reject(new Error('UI request timed out: ' + method));
      }
    }, 180000);
    // Clear timer on resolve/reject
    pendingRequests[id].clear = function () { try { clearTimeout(timer); } catch (e) {} };
  });
}

// Persist API key securely per-user in client storage
async function saveApiKey(key) {
  if (typeof key !== "string" || key.trim().length < 8) {
    figma.notify("Invalid API key");
    return { ok: false };
  }
  await figma.clientStorage.setAsync("removeBgApiKey", key.trim());
  figma.notify("API key saved");
  return { ok: true };
}

async function getApiKey() {
  return await figma.clientStorage.getAsync("removeBgApiKey");
}

function getSingleSelection() {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length !== 1) {
    throw new Error("Please select exactly one node containing the product image");
  }
  return selection[0];
}

async function exportSelectionAsPNGBytes(scale) {
  var s = typeof scale === 'number' && scale > 0 ? scale : 1;
  const node = getSingleSelection();
  const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: Math.max(1, s) } });
  return bytes;
}

async function removeBackgroundViaUi(imageBytes) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("Missing remove.bg API key. Save it in the UI first.");
  const result = await requestUi('removeBg', { apiKey: apiKey, imageBytes: Array.from(imageBytes) });
  if (!result || !result.ok) {
    throw new Error(result && result.error ? result.error : 'remove.bg failed');
  }
  return new Uint8Array(result.bytes);
}

function createMainImageFrame(sizePx) {
  const frame = figma.createFrame();
  frame.name = "01 Main " + sizePx + "x" + sizePx;
  frame.resizeWithoutConstraints(sizePx, sizePx);
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  frame.layoutMode = "NONE";
  figma.currentPage.appendChild(frame);
  return frame;
}

async function placeImageCentered(frame, imageBytes, targetFillRatio) {
  const fillRatio = typeof targetFillRatio === "number" ? targetFillRatio : 0.88;
  const image = figma.createImage(imageBytes);
  const node = figma.createRectangle();
  frame.appendChild(node);

  const frameSize = Math.min(frame.width, frame.height);
  const targetMax = frameSize * fillRatio;

  node.resize(targetMax, targetMax);

  node.fills = [{
    type: "IMAGE",
    scaleMode: "FIT",
    imageHash: image.hash
  }];

  node.x = (frame.width - node.width) / 2;
  node.y = (frame.height - node.height) / 2;

  return node;
}

async function ensureInterFont() {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  } catch (e) {}
}

function addHeading(frame, text, size) {
  try {
    const heading = figma.createText();
    frame.appendChild(heading);
    heading.characters = text;
    heading.fontName = { family: 'Inter', style: 'Bold' };
    heading.fontSize = size;
    heading.x = 48;
    heading.y = 48;
    return heading;
  } catch (e) { return null; }
}

function addBodyText(frame, text, size, y) {
  try {
    const t = figma.createText();
    frame.appendChild(t);
    t.characters = text;
    t.fontName = { family: 'Inter', style: 'Regular' };
    t.fontSize = size;
    t.x = 48;
    t.y = y;
    return t;
  } catch (e) { return null; }
}

function createTemplateFrame(sizePx, name, bg) {
  const frame = figma.createFrame();
  frame.name = name + " " + sizePx + "x" + sizePx;
  frame.resizeWithoutConstraints(sizePx, sizePx);
  frame.fills = [{ type: "SOLID", color: bg }];
  frame.layoutMode = 'NONE';
  figma.currentPage.appendChild(frame);
  return frame;
}

async function generateSixImages(sizePx) {
  await ensureInterFont();
  const selectionBytes = await exportSelectionAsPNGBytes(2);
  const cutoutBytes = await removeBackgroundViaUi(selectionBytes);

  const main = createMainImageFrame(sizePx);
  await placeImageCentered(main, cutoutBytes, 0.88);

  const lifestyle = createTemplateFrame(sizePx, '02 Lifestyle', { r: 0.97, g: 0.97, b: 0.97 });
  await placeImageCentered(lifestyle, cutoutBytes, 0.8);
  addHeading(lifestyle, 'In Your Daily Life', 64);
  addBodyText(lifestyle, 'Showcasing real-world usage and context.', 28, 120);

  const infographic = createTemplateFrame(sizePx, '03 Infographic', { r: 1, g: 1, b: 1 });
  await placeImageCentered(infographic, cutoutBytes, 0.75);
  addHeading(infographic, 'Key Features', 64);
  addBodyText(infographic, '• Feature 1  • Feature 2  • Feature 3', 28, 120);

  const features = createTemplateFrame(sizePx, '04 Features', { r: 1, g: 1, b: 1 });
  const band = figma.createRectangle();
  band.resize(sizePx, Math.max(120, sizePx * 0.08));
  band.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.95 } }];
  features.appendChild(band);
  band.x = 0; band.y = 0;
  addHeading(features, 'Why Choose This Product', 56);
  await placeImageCentered(features, cutoutBytes, 0.8);

  const dims = createTemplateFrame(sizePx, '05 Dimensions', { r: 1, g: 1, b: 1 });
  await placeImageCentered(dims, cutoutBytes, 0.8);
  addHeading(dims, 'Dimensions', 56);
  const line = figma.createRectangle();
  dims.appendChild(line);
  line.resize(sizePx * 0.6, 4);
  line.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  line.x = (sizePx - line.width) / 2; line.y = sizePx - 120;
  addBodyText(dims, 'Width ~ XXX mm | Height ~ YYY mm', 28, sizePx - 100);

  const inbox = createTemplateFrame(sizePx, '06 In-Box', { r: 1, g: 1, b: 1 });
  await placeImageCentered(inbox, cutoutBytes, 0.7);
  addHeading(inbox, 'What’s in the Box', 56);
  addBodyText(inbox, '• Item A  • Item B  • Item C', 28, 120);

  return [main, lifestyle, infographic, features, dims, inbox];
}

function arrangeFramesGrid(frames, columns, gap) {
  var cols = typeof columns === 'number' && columns > 0 ? columns : 3;
  var spacing = typeof gap === 'number' ? gap : 80;
  var rows = Math.ceil(frames.length / cols);

  // Assume similar sizes; derive cell size from first frame
  var cellW = frames[0].width;
  var cellH = frames[0].height;

  var parent = figma.createFrame();
  parent.name = 'Amazon Listing Set';
  parent.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  parent.layoutMode = 'NONE';
  var totalW = cols * cellW + (cols - 1) * spacing;
  var totalH = rows * cellH + (rows - 1) * spacing;
  parent.resizeWithoutConstraints(totalW, totalH);
  figma.currentPage.appendChild(parent);

  for (var i = 0; i < frames.length; i++) {
    var f = frames[i];
    var c = i % cols;
    var r = Math.floor(i / cols);
    f.x = c * (cellW + spacing);
    f.y = r * (cellH + spacing);
    parent.appendChild(f);
  }
  return parent;
}

async function exportFrame(frame, format, sizePx) {
  const actualFormat = format === "PNG" ? "PNG" : "JPEG";
  const bytes = await frame.exportAsync({
    format: actualFormat,
    constraint: { type: "WIDTH", value: sizePx },
    useAbsoluteBounds: true,
    contentsOnly: false
  });
  const lower = actualFormat.toLowerCase();
  figma.ui.postMessage({ type: "exportDone", payload: { name: frame.name + "." + lower, bytes: bytes } });
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'bridgeResponse') {
      var resp = msg.payload || {};
      var id = resp.id;
      if (id && pendingRequests[id]) {
        var handler = pendingRequests[id];
        if (handler.clear) { try { handler.clear(); } catch (e) {} }
        delete pendingRequests[id];
        if (resp.ok) handler.resolve(resp.data);
        else handler.reject(new Error(resp.error || 'Unknown UI error'));
      }
      return;
    }

    if (msg.type === "saveApiKey") {
      const payload = msg.payload || {};
      const res = await saveApiKey(payload.key || "");
      figma.ui.postMessage({ type: "saveApiKeyResult", payload: res });
      return;
    }

    if (msg.type === "generateMainImage") {
      const payload = msg.payload || {};
      const sizePx = Number(payload.sizePx) || 2000;
      figma.notify("Generating main image…");
      const frame = await (async function(size){
        const selectionBytes = await exportSelectionAsPNGBytes(2);
        const cutoutBytes = await removeBackgroundViaUi(selectionBytes);
        const f = createMainImageFrame(size);
        await placeImageCentered(f, cutoutBytes, 0.88);
        return f;
      })(sizePx);
      figma.notify("Main image created");
      figma.ui.postMessage({ type: "generatedFrameId", payload: { id: frame.id } });
      return;
    }

    if (msg.type === "generateSix") {
      const payload = msg.payload || {};
      const sizePx = Number(payload.sizePx) || 2000;
      figma.notify("Generating 6 listing images…");
      const frames = await generateSixImages(sizePx);
      lastGeneratedIds = frames.map(function(f){ return f.id; });
      figma.notify("6 images created");
      figma.ui.postMessage({ type: 'generatedFrameList', payload: { ids: lastGeneratedIds } });
      return;
    }

    if (msg.type === 'arrangeSix') {
      if (!lastGeneratedIds.length) { throw new Error('Nothing generated yet'); }
      var frames = [];
      for (var i = 0; i < lastGeneratedIds.length; i++) {
        var n = figma.getNodeById(lastGeneratedIds[i]);
        if (n && n.type === 'FRAME') frames.push(n);
      }
      if (!frames.length) throw new Error('Frames not found');
      arrangeFramesGrid(frames, 3, 80);
      figma.notify('Arranged on canvas');
      return;
    }

    if (msg.type === "exportGenerated") {
      const payload = msg.payload || {};
      const nodeId = payload.id;
      const format = payload.format || "PNG";
      const sizePx = Number(payload.sizePx) || 2000;
      const node = figma.getNodeById(nodeId);
      if (!node || node.type !== "FRAME") throw new Error("Generated frame not found");
      await exportFrame(node, format, sizePx);
      figma.notify("Export ready");
      return;
    }

    if (msg.type === 'exportAllGenerated') {
      const payload = msg.payload || {};
      const ids = Array.isArray(payload.ids) ? payload.ids : [];
      const format = payload.format || 'PNG';
      const sizePx = Number(payload.sizePx) || 2000;
      // Collect all in memory then send one batch to UI
      var entries = [];
      for (var i = 0; i < ids.length; i++) {
        var n = figma.getNodeById(ids[i]);
        if (n && n.type === 'FRAME') {
          const actualFormat = format === 'PNG' ? 'PNG' : 'JPEG';
          const bytes = await n.exportAsync({
            format: actualFormat,
            constraint: { type: 'WIDTH', value: sizePx },
            useAbsoluteBounds: true,
            contentsOnly: false
          });
          var lower = actualFormat.toLowerCase();
          entries.push({ name: n.name + '.' + lower, bytes: bytes });
        }
      }
      figma.ui.postMessage({ type: 'batchExportDone', payload: { entries: entries } });
      figma.notify('All exports ready');
      return;
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    figma.notify(message, { timeout: 4000 });
    figma.ui.postMessage({ type: "error", payload: { message: message } });
  }
};
