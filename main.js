import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/build/pdf.min.js";
import { PDFDocument } from "pdf-lib";

GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const fileInput = document.getElementById("fileInput");
const compressBtn = document.getElementById("compressBtn");
const downloadLink = document.getElementById("downloadLink");

let file;

fileInput.addEventListener("change", (e) => {
  file = e.target.files[0];
});

/**
 * ✅ 动态 scale（根据原始尺寸）
 */
function getDynamicScale(width, height) {
  const megaPixels = (width * height) / 1e6;

  if (megaPixels > 5) return 0.65;     // 超大图 → 缩小
  if (megaPixels > 2) return 1.0;      // 中等 → 原始
  return 2;                          // 小图 → 放大
}

/**
 * ✅ 动态 JPEG 压缩率
 */
function getDynamicQuality(width, height) {
  const megaPixels = (width * height) / 1e6;

  let q = 1 - Math.log2(megaPixels + 1) * 0.12;

  if (q < 0.35) q = 0.35;
  if (q > 0.85) q = 0.85;

  return q;
}

compressBtn.onclick = async () => {
  if (!file) return alert("请选择PDF");

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await getDocument({ data: arrayBuffer }).promise;

  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // ✅ 原始尺寸
    const rawWidth = page.view[2];
    const rawHeight = page.view[3];

    // ✅ 动态 scale
    const scale = getDynamicScale(rawWidth, rawHeight);

    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    // ✅ 动态压缩率
    const quality = getDynamicQuality(canvas.width, canvas.height);

    const imgData = canvas.toDataURL("image/jpeg", quality);

    const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
    const img = await newPdf.embedJpg(imgBytes);

    const pdfPage = newPdf.addPage([viewport.width, viewport.height]);

    pdfPage.drawImage(img, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    });

    console.log(`第${i}页 scale=${scale} quality=${quality}`);
  }

  const pdfBytes = await newPdf.save();

  const blob = new Blob([pdfBytes], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);

  downloadLink.href = url;
  downloadLink.download = "compressed.pdf";
  downloadLink.textContent = "下载压缩后的PDF";
};