import { app, DEFAULT_LESSON } from "../state.js";
import { db, ref, get } from "../firebase-config.js";
import { toFbKey, escapeHtml } from "../utils.js";

/* ── 포커스 오버레이 ── */

export function attachFocusAffordance(blockEl) {
  blockEl.classList.add("block--focusable");
  const btn = document.createElement("button");
  btn.className = "focus-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "이 블록 화면 포커스");
  btn.setAttribute("title", "이 블록에 집중 (ESC로 닫기)");
  btn.textContent = "📺";
  btn.addEventListener("click", e => { 
    e.stopPropagation(); 
    openFocusOverlay(blockEl); 
  });
  blockEl.appendChild(btn);
}

export function openFocusOverlay(originalBlockEl) {
  closeFocusOverlay();
  const overlay = document.createElement("div");
  overlay.className = "focus-overlay";
  overlay.id = "focus-overlay";
  const stage = document.createElement("div");
  stage.className = "focus-overlay__stage";
  const closeBtn = document.createElement("button");
  closeBtn.className = "focus-overlay__close";
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", e => { 
    e.stopPropagation(); 
    closeFocusOverlay(); 
  });
  
  const clone = originalBlockEl.cloneNode(true);
  clone.classList.add("block--focused");
  clone.querySelectorAll(".focus-btn, .comment-section").forEach(b => b.remove());
  
  rewireToggles(clone);
  
  stage.appendChild(closeBtn);
  stage.appendChild(clone);
  overlay.appendChild(stage);
  
  overlay.addEventListener("click", e => { 
    if (e.target === overlay) closeFocusOverlay(); 
  });
  stage.addEventListener("click", e => e.stopPropagation());
  
  document.body.appendChild(overlay);
  document.body.classList.add("is-focus-locked");
  requestAnimationFrame(() => overlay.classList.add("is-open"));
}

export function closeFocusOverlay() {
  const overlay = document.getElementById("focus-overlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  document.body.classList.remove("is-focus-locked");
  setTimeout(() => overlay.remove(), 200);
}

export function rewireToggles(root) {
  root.querySelectorAll(".answer").forEach(ans => {
    const t = ans.querySelector(".answer__toggle");
    if (t) t.addEventListener("click", () => ans.classList.toggle("is-open"));
  });
  root.querySelectorAll(".expandable").forEach(exp => {
    const s = exp.querySelector(".expandable__summary");
    if (s) s.addEventListener("click", () => exp.classList.toggle("is-open"));
  });
}

/* ── 이미지 라이트박스 ── */

export function openImageLightbox(src) {
  closeImageLightbox();
  const lightbox = document.createElement("div");
  lightbox.className = "image-lightbox";
  lightbox.id = "image-lightbox";
  
  const img = document.createElement("img");
  img.src = src;
  img.className = "image-lightbox__img";
  
  const closeBtn = document.createElement("button");
  closeBtn.className = "image-lightbox__close";
  closeBtn.innerHTML = "✕";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeImageLightbox();
  });

  lightbox.appendChild(img);
  lightbox.appendChild(closeBtn);
  
  lightbox.addEventListener("click", () => closeImageLightbox());
  img.addEventListener("click", (e) => e.stopPropagation());

  document.body.appendChild(lightbox);
  document.body.classList.add("is-focus-locked");
  
  requestAnimationFrame(() => lightbox.classList.add("is-open"));
}

export function closeImageLightbox() {
  const lightbox = document.getElementById("image-lightbox");
  if (!lightbox) return;
  lightbox.classList.remove("is-open");
  document.body.classList.remove("is-focus-locked");
  setTimeout(() => lightbox.remove(), 250);
}

/* ── QR 패널 ── */

export function showQRPanel(code) {
  const params = new URLSearchParams(location.search);
  const lessonId = params.get("lesson") || DEFAULT_LESSON;
  const baseUrl = `${location.origin}${location.pathname}`;
  const studentUrl = `${baseUrl}?lesson=${lessonId}&code=${encodeURIComponent(code)}`;

  const panel = document.createElement("div");
  panel.className = "qr-panel";
  panel.id = "qr-panel";

  panel.innerHTML = `
    <div class="qr-panel__inner">
      <div class="qr-panel__header">
        <div class="qr-panel__code-label">수업 코드</div>
        <div class="qr-panel__code">${escapeHtml(code)}</div>
      </div>
      <div class="qr-panel__qr" id="qr-image"></div>
      <div class="qr-panel__url">${escapeHtml(studentUrl)}</div>
      <div class="qr-panel__actions">
        <button class="qr-panel__btn" id="qr-download-csv">📥 CSV 다운로드</button>
        <button class="qr-panel__btn qr-panel__btn--close" id="qr-close">닫기</button>
      </div>
    </div>
  `;

  const qrImg = document.createElement("img");
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentUrl)}`;
  qrImg.alt = "QR 코드";
  qrImg.className = "qr-panel__qr-img";
  panel.querySelector("#qr-image").appendChild(qrImg);

  panel.querySelector("#qr-close").addEventListener("click", () => {
    panel.classList.remove("is-open");
  });

  panel.querySelector("#qr-download-csv").addEventListener("click", () => {
    downloadCSV(code);
  });

  document.body.appendChild(panel);

  const qrBtn = document.createElement("button");
  qrBtn.className = "sidebar__qr-btn";
  qrBtn.textContent = "📱 QR / 다운로드";
  qrBtn.addEventListener("click", () => panel.classList.toggle("is-open"));

  const guide = document.querySelector(".sidebar__guide");
  if (guide) guide.before(qrBtn);

  requestAnimationFrame(() => panel.classList.add("is-open"));
}

/* ── CSV 다운로드 ── */

export async function downloadCSV(code) {
  const snap = await get(ref(db, `comments/${toFbKey(code)}`));
  if (!snap.exists()) {
    alert("저장된 답변이 없습니다.");
    return;
  }

  const rows = [["섹션", "질문번호", "이름", "답변", "시간"]];

  snap.forEach(sectionSnap => {
    const rawKey = sectionSnap.key;
    sectionSnap.forEach(commentSnap => {
      const c = commentSnap.val();
      const parts = (c.key || rawKey).split("__");
      const sectionId = parts[1] || rawKey;
      const promptIdx = parts[2] !== undefined ? `Q${Number(parts[2]) + 1}` : "";
      const time = c.createdAt
        ? new Date(c.createdAt).toLocaleString("ko-KR")
        : "";
      rows.push([sectionId, promptIdx, c.name || "", c.text || "", time]);
    });
  });

  const csv = rows.map(r =>
    r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const bom = "\uFEFF"; 
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${code}_answers.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
