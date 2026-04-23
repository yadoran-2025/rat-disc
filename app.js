/* ====================================================================
   수업용 프리젠터 — 애플리케이션 로직
<<<<<<< HEAD
   Firebase Realtime Database + 수업 코드 + QR 입장
   ==================================================================== */

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, push, set, get, remove,
  onChildAdded, onChildRemoved, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ── Firebase 설정 ── */
=======
   Firebase Realtime Database로 댓글 저장/실시간 동기화
   ==================================================================== */

/* ── Firebase 설정 ── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  onChildRemoved,
  get,
  remove,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
const firebaseConfig = {
  apiKey:            "AIzaSyB_wsXQ_THiDLIvlaQAKEJCzIlz5M5dbDY",
  authDomain:        "yadoran-2025.firebaseapp.com",
  databaseURL:       "https://yadoran-2025-default-rtdb.firebaseio.com",
  projectId:         "yadoran-2025",
  storageBucket:     "yadoran-2025.firebasestorage.app",
  messagingSenderId: "266288546185",
  appId:             "1:266288546185:web:727060b22ce9643d0c2158",
  measurementId:     "G-7MX74KVJCE",
};
<<<<<<< HEAD
const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

/* ── Firebase key 정규화 (. # $ [ ] / 금지) ── */
function toFbKey(str) {
  return str.replace(/[.#$[\]/]/g, "_");
}

/* ── 활성 Firebase 리스너 해제 관리 ── */
const activeUnsubscribers = [];
=======

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);

// 현재 구독 중인 Firebase 리스너 해제 함수 목록
// (섹션 이동 시 이전 리스너를 정리하기 위해)
const activeUnsubscribers = [];

>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
function clearListeners() {
  while (activeUnsubscribers.length) activeUnsubscribers.pop()();
}

<<<<<<< HEAD
=======
/* ── Firebase 댓글 key 정규화 ──
   Firebase 경로에 . # $ [ ] / 를 쓸 수 없으므로 :: → __ 로 치환 */
function toFirebaseKey(key) {
  return key.replace(/[.#$[\]/]/g, "_");
}

>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
/* ====================================================================
   앱 상태
   ==================================================================== */
const DEFAULT_LESSON = "rat-disc-1";

const app = {
<<<<<<< HEAD
  lesson:     null,
  currentIdx: 0,
  isTeacher:  false,
  sessionCode: null,   // 현재 수업 코드
=======
  lesson:    null,
  currentIdx: 0,
  isTeacher: false,
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
};

/* ====================================================================
   진입점 — 수업 코드 게이팅
   ==================================================================== */
async function init() {
<<<<<<< HEAD
  const params     = new URLSearchParams(location.search);
  const lessonId   = params.get("lesson") || DEFAULT_LESSON;
  app.isTeacher    = params.get("teacher") === "1";
  const codeInUrl  = params.get("code") || "";
=======
  const params    = new URLSearchParams(location.search);
  const lessonId  = params.get("lesson") || DEFAULT_LESSON;
  app.isTeacher   = params.get("teacher") === "1";
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e

  // 레슨 데이터 로드
  try {
    const res = await fetch(`lessons/${lessonId}.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}`);
    app.lesson = await res.json();
    await loadExternalAssets();
  } catch (err) {
    document.body.innerHTML = `
      <div style="padding:3rem;font-family:sans-serif;">
        <h1>수업 자료를 불러오지 못했습니다</h1>
        <p>파일: <code>lessons/${lessonId}.json</code></p>
        <p>오류: ${err.message}</p>
<<<<<<< HEAD
=======
        <p style="color:#888;margin-top:2rem;">
          로컬에서 열 때는 <code>file://</code>가 아니라 로컬 서버를 띄워야 합니다.<br>
          터미널에서: <code>python3 -m http.server</code> 또는 VS Code Live Server
        </p>
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
      </div>`;
    return;
  }

  // QR로 코드가 URL에 있으면 바로 입장
  if (codeInUrl) {
    enterSession(codeInUrl.trim());
    return;
  }

  // 교사 모드: 세션 관리 화면
  if (app.isTeacher) {
    showTeacherGate();
    return;
  }

  // 학생 모드: 코드 입력 화면
  showStudentGate();
}

/* ====================================================================
   게이트 화면 — 학생
   ==================================================================== */
function showStudentGate() {
  document.body.innerHTML = "";
  const gate = buildGateShell("학생 입장", "선생님이 알려준 수업 코드를 입력하세요");

  const input = document.createElement("input");
  input.type        = "text";
  input.placeholder = "예) 잠원중3반";
  input.className   = "gate__input";
  input.autofocus   = true;

  const btn = document.createElement("button");
  btn.className   = "gate__btn";
  btn.textContent = "입장하기 →";

  const err = document.createElement("div");
  err.className = "gate__error";

  const enter = async () => {
    const code = input.value.trim();
    if (!code) { showGateError(err, "수업 코드를 입력해주세요."); return; }
    btn.disabled    = true;
    btn.textContent = "확인 중…";
    // 학생은 코드 존재 여부 확인 없이 그냥 입장 (코드=방 이름)
    enterSession(code);
  };

  btn.addEventListener("click", enter);
  input.addEventListener("keydown", e => { if (e.key === "Enter") enter(); });

  gate.form.appendChild(input);
  gate.form.appendChild(err);
  gate.form.appendChild(btn);
  document.body.appendChild(gate.el);
  input.focus();
}

/* ====================================================================
   게이트 화면 — 교사
   ==================================================================== */
function showTeacherGate() {
  document.body.innerHTML = "";
  const gate = buildGateShell("교사 모드", "수업 코드를 만들거나 기존 코드로 입장하세요");

  // 새 수업 코드 생성 섹션
  const createLabel = document.createElement("div");
  createLabel.className   = "gate__section-label";
  createLabel.textContent = "새 수업 코드 만들기";

  const createInput = document.createElement("input");
  createInput.type        = "text";
  createInput.placeholder = "예) 잠원중3반";
  createInput.className   = "gate__input";

  const createBtn = document.createElement("button");
  createBtn.className   = "gate__btn";
  createBtn.textContent = "코드 생성 →";

  const createErr = document.createElement("div");
  createErr.className = "gate__error";

  createBtn.addEventListener("click", async () => {
    const code = createInput.value.trim();
    if (!code) { showGateError(createErr, "코드를 입력해주세요."); return; }

    createBtn.disabled    = true;
    createBtn.textContent = "확인 중…";

    // 중복 체크
    const snap = await get(ref(db, `sessions/${toFbKey(code)}`));
    if (snap.exists()) {
      createBtn.disabled    = false;
      createBtn.textContent = "코드 생성 →";
      showGateError(createErr, "이미 사용 중인 코드입니다. 다른 코드를 입력해주세요.");
      return;
    }

    // Firebase에 세션 등록
    await set(ref(db, `sessions/${toFbKey(code)}`), {
      code,
      createdAt: new Date().toISOString(),
    });

    enterSession(code);
  });

  // 기존 코드로 입장 섹션
  const joinLabel = document.createElement("div");
  joinLabel.className   = "gate__section-label gate__section-label--secondary";
  joinLabel.textContent = "기존 코드로 입장";

  const joinInput = document.createElement("input");
  joinInput.type        = "text";
  joinInput.placeholder = "기존 수업 코드";
  joinInput.className   = "gate__input gate__input--secondary";

  const joinBtn = document.createElement("button");
  joinBtn.className   = "gate__btn gate__btn--secondary";
  joinBtn.textContent = "입장하기 →";

  const joinErr = document.createElement("div");
  joinErr.className = "gate__error";

  const joinEnter = async () => {
    const code = joinInput.value.trim();
    if (!code) { showGateError(joinErr, "코드를 입력해주세요."); return; }
    joinBtn.disabled    = true;
    joinBtn.textContent = "확인 중…";
    const snap = await get(ref(db, `sessions/${toFbKey(code)}`));
    if (!snap.exists()) {
      joinBtn.disabled    = false;
      joinBtn.textContent = "입장하기 →";
      showGateError(joinErr, "존재하지 않는 코드입니다.");
      return;
    }
    enterSession(code);
  };

  joinBtn.addEventListener("click", joinEnter);
  joinInput.addEventListener("keydown", e => { if (e.key === "Enter") joinEnter(); });

  gate.form.appendChild(createLabel);
  gate.form.appendChild(createInput);
  gate.form.appendChild(createErr);
  gate.form.appendChild(createBtn);

  const divider = document.createElement("div");
  divider.className = "gate__divider";
  divider.innerHTML = "<span>또는</span>";
  gate.form.appendChild(divider);

  gate.form.appendChild(joinLabel);
  gate.form.appendChild(joinInput);
  gate.form.appendChild(joinErr);
  gate.form.appendChild(joinBtn);

  document.body.appendChild(gate.el);
  createInput.focus();
}

function buildGateShell(title, subtitle) {
  const el = document.createElement("div");
  el.className = "gate";

  const box = document.createElement("div");
  box.className = "gate__box";

  const logo = document.createElement("div");
  logo.className   = "gate__logo";
  logo.textContent = "🎓";

  const h1 = document.createElement("h1");
  h1.className   = "gate__title";
  h1.textContent = title;

  const sub = document.createElement("p");
  sub.className   = "gate__subtitle";
  sub.textContent = subtitle;

  const form = document.createElement("div");
  form.className = "gate__form";

  box.appendChild(logo);
  box.appendChild(h1);
  box.appendChild(sub);
  box.appendChild(form);
  el.appendChild(box);

  return { el, form };
}

function showGateError(el, msg) {
  el.textContent = msg;
  setTimeout(() => { el.textContent = ""; }, 4000);
}

/* ====================================================================
   수업 입장 — 공통
   ==================================================================== */
function enterSession(code) {
  app.sessionCode = code;

  // 코드를 localStorage에 저장 (새로고침 시 재입력 불필요)
  localStorage.setItem("session-code", code);

  document.body.innerHTML = "";
  document.body.style.cssText = "";

  buildAppShell();
  renderSidebar();
  renderNavFooter();

  if (app.isTeacher) {
<<<<<<< HEAD
    showQRPanel(code);
    const badge = document.createElement("div");
    badge.className   = "teacher-badge";
    badge.textContent = `👩‍🏫 교사 모드 · ${code}`;
    document.body.appendChild(badge);
  } else {
    const badge = document.createElement("div");
    badge.className   = "student-badge";
    badge.textContent = `📚 ${code}`;
=======
    const badge = document.createElement("div");
    badge.className   = "teacher-badge";
    badge.textContent = "👩‍🏫 교사 모드";
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
    document.body.appendChild(badge);
  }

  const hash = location.hash.replace("#", "");
  const idx  = app.lesson.sections.findIndex(s => s.id === hash);
  goTo(idx >= 0 ? idx : 0);

  bindKeyboard();
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    const i = app.lesson.sections.findIndex(s => s.id === h);
    if (i >= 0 && i !== app.currentIdx) goTo(i);
  });

  document.title = `${app.lesson.title} — ${app.lesson.lessonGroup || "수업 자료"}`;
}

<<<<<<< HEAD
function buildAppShell() {
  const appDiv = document.createElement("div");
  appDiv.className = "app";

  const aside = document.createElement("aside");
  aside.className = "sidebar";
  aside.innerHTML = `
    <div class="sidebar__group" id="sidebar-group"></div>
    <h1 class="sidebar__title" id="sidebar-title"></h1>
    <div class="sidebar__subtitle" id="sidebar-subtitle"></div>
    <nav id="sidebar-sections"></nav>
    <div class="sidebar__lesson-links" id="sidebar-lesson-links"></div>
    <div class="sidebar__hotkeys">
      <div><kbd>←</kbd> <kbd>→</kbd> 섹션 이동</div>
      <div><kbd>Space</kbd> 답 열기/닫기</div>
      <div><kbd>Click</kbd> 목차 점프</div>
    </div>
    <div class="sidebar__guide">
      <div class="sidebar__guide-label">📋 수업 지도안</div>
      <a class="sidebar__guide-link"
         href="https://booong.notion.site/rational-discrimination?source=copy_link"
         target="_blank" rel="noopener">지도안 열기</a>
    </div>
  `;

  const main = document.createElement("main");
  main.className = "main";
  main.innerHTML = `
    <div class="main__inner">
      <div id="main-content"></div>
      <div class="nav-footer">
        <button id="nav-prev">← 이전 섹션</button>
        <div class="nav-footer__progress" id="nav-progress"></div>
        <button id="nav-next">다음 섹션 →</button>
      </div>
    </div>
  `;

  appDiv.appendChild(aside);
  appDiv.appendChild(main);
  document.body.appendChild(appDiv);
}

/* ====================================================================
   QR 패널 (교사용)
   ==================================================================== */
function showQRPanel(code) {
  const params   = new URLSearchParams(location.search);
  const lessonId = params.get("lesson") || DEFAULT_LESSON;
  const baseUrl  = `${location.origin}${location.pathname}`;
  const studentUrl = `${baseUrl}?lesson=${lessonId}&code=${encodeURIComponent(code)}`;

  const panel = document.createElement("div");
  panel.className = "qr-panel";
  panel.id        = "qr-panel";

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

  // QR 이미지 생성 (Google Charts API — 외부 의존성 없이)
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

  // QR 버튼을 사이드바에 추가
  const qrBtn = document.createElement("button");
  qrBtn.className   = "sidebar__qr-btn";
  qrBtn.textContent = "📱 QR / 다운로드";
  qrBtn.addEventListener("click", () => panel.classList.toggle("is-open"));

  const guide = document.querySelector(".sidebar__guide");
  if (guide) guide.before(qrBtn);

  // 처음엔 열어서 보여줌
  requestAnimationFrame(() => panel.classList.add("is-open"));
}

/* ====================================================================
   CSV 다운로드
   ==================================================================== */
async function downloadCSV(code) {
  const snap = await get(ref(db, `comments/${toFbKey(code)}`));
  if (!snap.exists()) {
    alert("저장된 답변이 없습니다.");
    return;
  }

  const rows = [["섹션", "질문번호", "이름", "답변", "시간"]];

  snap.forEach(sectionSnap => {
    const rawKey = sectionSnap.key; // e.g. "rat-disc-1__1-1__0"
    sectionSnap.forEach(commentSnap => {
      const c = commentSnap.val();
      // key에서 섹션ID / promptIdx 파싱
      const parts     = (c.key || rawKey).split("__");
      const sectionId = parts[1] || rawKey;
      const promptIdx = parts[2] !== undefined ? `Q${Number(parts[2]) + 1}` : "";
      const time      = c.createdAt
        ? new Date(c.createdAt).toLocaleString("ko-KR")
        : "";
      rows.push([sectionId, promptIdx, c.name || "", c.text || "", time]);
    });
  });

  const csv = rows.map(r =>
    r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const bom  = "\uFEFF"; // Excel UTF-8 BOM
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${code}_answers.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ====================================================================
   외부 에셋
   ==================================================================== */
async function loadExternalAssets() {
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8z4eMwA6UaQLgnZTtj7Xk7-EzBagOfK8YDGUvfogcIa1RV_3h07ggcI2nbN93JbFFdciC9A6uph_4/pub?output=csv";
  try {
    const response = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`, { cache: "no-store" });
    const csvText  = await response.text();
    if (!app.lesson.assets) app.lesson.assets = {};
    parseCSV(csvText).forEach(columns => {
=======
/* ---------- 외부 에셋 ---------- */
async function loadExternalAssets() {
  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8z4eMwA6UaQLgnZTtj7Xk7-EzBagOfK8YDGUvfogcIa1RV_3h07ggcI2nbN93JbFFdciC9A6uph_4/pub?output=csv";
  try {
    const bustUrl  = `${SHEET_CSV_URL}&_=${Date.now()}`;
    const response = await fetch(bustUrl, { cache: "no-store" });
    const csvText  = await response.text();
    if (!app.lesson.assets) app.lesson.assets = {};
    const rows = parseCSV(csvText);
    rows.forEach(columns => {
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
      if (columns.length < 4) return;
      const key = columns[1].trim();
      const url = columns[3].trim();
      if (!key || !url || key === "JSON 상 호칭") return;
      app.lesson.assets[key] = url;
    });
<<<<<<< HEAD
=======
    console.log("External assets loaded:", app.lesson.assets);
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  } catch (err) {
    console.warn("Failed to load external assets:", err);
  }
}

function parseCSV(text) {
  const rows = [];
<<<<<<< HEAD
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') {
      if (inQ && n === '"') { field += '"'; i++; } else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      row.push(field); field = "";
    } else if ((c === '\r' || c === '\n') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      row.push(field); rows.push(row);
      row = []; field = "";
    } else { field += c; }
  }
  if (row.length || field) { row.push(field); rows.push(row); }
=======
  let currentRow   = [];
  let currentField = "";
  let inQuotes     = false;

  for (let i = 0; i < text.length; i++) {
    const char     = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { currentField += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField); currentField = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = []; currentField = "";
    } else {
      currentField += char;
    }
  }
  if (currentRow.length > 0 || currentField !== "") {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  return rows;
}

/* ====================================================================
   사이드바
   ==================================================================== */
function renderSidebar() {
  const groupEl = document.getElementById("sidebar-group");
  const titleEl = document.getElementById("sidebar-title");
  const subEl   = document.getElementById("sidebar-subtitle");
<<<<<<< HEAD
  if (!titleEl) return;
=======
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e

  if (app.lesson.lessonGroup) {
    groupEl.textContent   = app.lesson.lessonGroup;
    groupEl.style.display = "block";
  } else {
    groupEl.style.display = "none";
  }
  titleEl.textContent = app.lesson.title;
  subEl.textContent   = app.lesson.subtitle || "";

  const container = document.getElementById("sidebar-sections");
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "sidebar__section-list";
  app.lesson.sections.forEach((sec, idx) => {
    const li  = document.createElement("li");
    const btn = document.createElement("button");
    btn.className   = "sidebar__section";
    btn.dataset.idx = idx;
    btn.innerHTML   = `<span class="sidebar__section-id">${sec.id}</span>${escapeHtml(sec.title)}`;
    btn.addEventListener("click", () => goTo(idx));
    li.appendChild(btn);
    list.appendChild(li);
  });
  container.appendChild(list);
  renderLessonLinks();
}

function renderLessonLinks() {
  const wrap = document.getElementById("sidebar-lesson-links");
  if (!wrap) return;
  wrap.innerHTML = "";
  const { prev, next } = app.lesson;
  if (!prev && !next) { wrap.style.display = "none"; return; }
  wrap.style.display = "flex";
  if (prev) {
    const a = document.createElement("a");
    a.className = "sidebar__lesson-link";
    a.href      = `?lesson=${prev}`;
    a.innerHTML = `<span class="sidebar__lesson-link-arrow">←</span> 이전 차시`;
    wrap.appendChild(a);
<<<<<<< HEAD
  } else { wrap.appendChild(document.createElement("span")); }
=======
  } else {
    wrap.appendChild(document.createElement("span"));
  }
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  if (next) {
    const a = document.createElement("a");
    a.className = "sidebar__lesson-link";
    a.href      = `?lesson=${next}`;
    a.innerHTML = `다음 차시 <span class="sidebar__lesson-link-arrow">→</span>`;
    wrap.appendChild(a);
  }
}

/* ====================================================================
   섹션 이동 / 렌더링
   ==================================================================== */
function goTo(idx) {
  if (idx < 0 || idx >= app.lesson.sections.length) return;
<<<<<<< HEAD
  clearListeners();
=======

  // 이전 섹션의 Firebase 리스너 전부 해제
  clearListeners();

>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  app.currentIdx = idx;
  const sec      = app.lesson.sections[idx];

  document.querySelectorAll(".sidebar__section").forEach(el => {
    el.classList.toggle("is-active", Number(el.dataset.idx) === idx);
  });
  renderSection(sec);
  renderNavFooter();
  history.replaceState(null, "", `#${sec.id}`);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderSection(sec) {
  const main = document.getElementById("main-content");
  if (!main) return;
  main.innerHTML = "";

  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `
    <div class="section-header__id">${escapeHtml(sec.id)} · ${escapeHtml(app.lesson.title)}</div>
    <h1 class="section-header__title">${escapeHtml(sec.title)}</h1>
  `;
  main.appendChild(header);

  sec.blocks.forEach((block, idx) => {
    const el = renderBlock(block);
    if (el) {
      if (block.type !== "divider") attachFocusAffordance(el);
      main.appendChild(el);
    }
    if (sec.blocks[idx + 1]) main.appendChild(renderDivider());
  });
}

<<<<<<< HEAD
/* ====================================================================
   포커스 오버레이
   ==================================================================== */
function attachFocusAffordance(blockEl) {
  blockEl.classList.add("block--focusable");
  const btn = document.createElement("button");
  btn.className   = "focus-btn";
  btn.type        = "button";
=======
/* ---------- 포커스 오버레이 ---------- */
function attachFocusAffordance(blockEl) {
  blockEl.classList.add("block--focusable");
  const btn = document.createElement("button");
  btn.className = "focus-btn";
  btn.type      = "button";
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  btn.setAttribute("aria-label", "이 블록 화면 포커스");
  btn.setAttribute("title", "이 블록에 집중 (ESC로 닫기)");
  btn.textContent = "📺";
  btn.addEventListener("click", e => { e.stopPropagation(); openFocusOverlay(blockEl); });
  blockEl.appendChild(btn);
}

function openFocusOverlay(originalBlockEl) {
  closeFocusOverlay();
<<<<<<< HEAD
  const overlay = document.createElement("div");
  overlay.className = "focus-overlay";
  overlay.id        = "focus-overlay";
=======
  const overlay  = document.createElement("div");
  overlay.className = "focus-overlay";
  overlay.id        = "focus-overlay";

>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  const stage = document.createElement("div");
  stage.className = "focus-overlay__stage";
  const closeBtn = document.createElement("button");
  closeBtn.className   = "focus-overlay__close";
  closeBtn.type        = "button";
<<<<<<< HEAD
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", e => { e.stopPropagation(); closeFocusOverlay(); });
  const clone = originalBlockEl.cloneNode(true);
  clone.classList.add("block--focused");
  clone.querySelectorAll(".focus-btn, .comment-section").forEach(b => b.remove());
=======
  closeBtn.setAttribute("aria-label", "닫기");
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", e => { e.stopPropagation(); closeFocusOverlay(); });

  const clone = originalBlockEl.cloneNode(true);
  clone.classList.add("block--focused");
  clone.querySelectorAll(".focus-btn").forEach(b => b.remove());
  clone.querySelectorAll(".comment-section").forEach(b => b.remove());
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  rewireToggles(clone);
  stage.appendChild(closeBtn);
  stage.appendChild(clone);
  overlay.appendChild(stage);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeFocusOverlay(); });
  stage.addEventListener("click", e => e.stopPropagation());
<<<<<<< HEAD
=======

>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  document.body.appendChild(overlay);
  document.body.classList.add("is-focus-locked");
  requestAnimationFrame(() => overlay.classList.add("is-open"));
}

function closeFocusOverlay() {
  const overlay = document.getElementById("focus-overlay");
  if (!overlay) return;
  overlay.classList.remove("is-open");
  document.body.classList.remove("is-focus-locked");
  setTimeout(() => overlay.remove(), 200);
}

function rewireToggles(root) {
  root.querySelectorAll(".answer").forEach(ans => {
<<<<<<< HEAD
    const t = ans.querySelector(".answer__toggle");
    if (t) t.addEventListener("click", () => ans.classList.toggle("is-open"));
  });
  root.querySelectorAll(".expandable").forEach(exp => {
    const s = exp.querySelector(".expandable__summary");
    if (s) s.addEventListener("click", () => exp.classList.toggle("is-open"));
  });
}

/* ====================================================================
   블록 디스패처
   ==================================================================== */
function renderBlock(block) {
  const map = {
=======
    const toggle = ans.querySelector(".answer__toggle");
    if (toggle) toggle.addEventListener("click", () => ans.classList.toggle("is-open"));
  });
  root.querySelectorAll(".expandable").forEach(exp => {
    const summary = exp.querySelector(".expandable__summary");
    if (summary) summary.addEventListener("click", () => exp.classList.toggle("is-open"));
  });
}

/* ---------- 블록 디스패처 ---------- */
function renderBlock(block) {
  const render = {
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
    paragraph:        renderParagraph,
    heading:          renderHeading,
    case:             renderCase,
    question:         renderQuestion,
    concept:          renderConcept,
    "figure-concept": renderFigureConcept,
    "figure-quote":   renderFigureQuote,
    "image-row":      renderImageRow,
    expandable:       renderExpandable,
    summary:          renderSummary,
    media:            renderMedia,
    divider:          renderDivider,
<<<<<<< HEAD
  };
  const fn = map[block.type];
  if (!fn) { console.warn("Unknown block type:", block.type); return null; }
  return fn(block);
}

/* ====================================================================
   블록 렌더러
   ==================================================================== */
=======
  }[block.type];

  if (!render) { console.warn("Unknown block type:", block.type); return null; }
  return render(block);
}

/* ---------- 블록 렌더러 ---------- */
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
function renderParagraph(block) {
  const p = document.createElement("p");
  p.className = "block paragraph";
  p.innerHTML = formatInline(block.text);
  return p;
}

function renderHeading(block) {
  const h = document.createElement("h2");
  h.className = "block section-sub-heading";
  h.innerHTML = formatInline(block.text);
  return h;
}

function renderImageRow(block) {
  const row = document.createElement("div");
  row.className = "block image-row";
  block.images.forEach(src => {
    const wrap = document.createElement("div");
    wrap.className = "image-row__item";
    wrap.appendChild(buildImage(src));
    row.appendChild(wrap);
  });
  return row;
}

function renderCase(block) {
  const div = document.createElement("div");
  div.className = "block callout case";
  let html = "";
  if (block.label) html += `<div class="callout__label">${escapeHtml(block.label)}</div>`;
  html += `<div class="case__text">${formatInline(block.text)}</div>`;
  if (block.sub) html += `<div class="case__sub">${formatInline(block.sub)}</div>`;
  div.innerHTML = html;
  if (block.answer) div.appendChild(buildAnswer(block.answer));
  return div;
}

function renderQuestion(block) {
  const div = document.createElement("div");
  div.className = "block callout question";
  div.innerHTML = `<div class="callout__label">🗨️ 생각해볼 문제</div>`;

  const sectionId = app.lesson.sections[app.currentIdx]?.id || "unknown";

  block.prompts.forEach((pr, promptIdx) => {
    const p = document.createElement("div");
    p.className = "question__prompt";
    p.innerHTML = `Q. ${formatInline(pr.q)}`;
    if (pr.note) p.innerHTML += `<div class="question__note">${formatInline(pr.note)}</div>`;
    div.appendChild(p);

    if (pr.answer) div.appendChild(buildAnswer({ text: pr.answer }, "답 보기"));

<<<<<<< HEAD
    // 댓글 key: "lessonId__sectionId__promptIdx"
=======
    // 댓글 섹션 — key: "lessonId__sectionId__promptIdx"
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
    const commentKey = `${app.lesson.id}__${sectionId}__${promptIdx}`;
    div.appendChild(buildCommentSection(commentKey));
  });

  if (block.imagePair) div.appendChild(buildImagePair(block.imagePair));
  if (block.conclusion) {
    const concl = document.createElement("div");
    concl.className = "question__conclusion";
    concl.innerHTML = formatInline(block.conclusion);
    div.appendChild(concl);
  }
  return div;
}

/* ====================================================================
   댓글 시스템 — Firebase Realtime Database
   ==================================================================== */

/**
 * 댓글 섹션 UI 생성 (토글 + 목록 + 입력 폼)
 */
function buildCommentSection(key) {
  const wrap = document.createElement("div");
  wrap.className = "comment-section";

  const toggle = document.createElement("button");
  toggle.className   = "comment-toggle";
  toggle.textContent = "💬 학생 답변 보기/남기기";
  toggle.type        = "button";

  const body = document.createElement("div");
  body.className = "comment-body";

  const list = document.createElement("div");
  list.className   = "comment-list";
  list.dataset.key = key;

  const form = buildCommentForm(key, list);

  body.appendChild(list);
  body.appendChild(form);

  toggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("is-open");
    toggle.classList.toggle("is-open", isOpen);

    if (isOpen && !body.dataset.loaded) {
      body.dataset.loaded = "1";
      subscribeComments(key, list);
    }
  });

  wrap.appendChild(toggle);
  wrap.appendChild(body);
  return wrap;
}

/**
 * Firebase onChildAdded / onChildRemoved 구독
 * 섹션 이동 시 clearListeners()로 해제됨
 */
function subscribeComments(key, list) {
  list.innerHTML = `<div class="comment-loading">불러오는 중…</div>`;

  const dbRef     = ref(db, `comments/${toFirebaseKey(key)}`);
  let firstBatch  = true;
  let loadedCount = 0;

  // onChildAdded: 기존 데이터 + 이후 실시간 추가 모두 수신
  const unsubAdded = onChildAdded(dbRef, snapshot => {
    // 첫 로드 시 "로딩 중" 제거
    if (firstBatch) {
      list.innerHTML = "";
      firstBatch = false;
    }

    const comment = { id: snapshot.key, ...snapshot.val() };
    appendCommentItem(list, comment);
    loadedCount++;
  });

  // 첫 로드가 빈 경우 처리: 500ms 후에도 아무것도 안 왔으면 "없음" 표시
  const emptyTimer = setTimeout(() => {
    if (loadedCount === 0) {
      list.innerHTML = `<div class="comment-empty">아직 답변이 없습니다. 첫 번째로 작성해보세요!</div>`;
      firstBatch = false;
    }
  }, 500);

  // onChildRemoved: 삭제 이벤트
  const unsubRemoved = onChildRemoved(dbRef, snapshot => {
    const item = list.querySelector(`.comment-item[data-id="${CSS.escape(snapshot.key)}"]`);
    if (item) item.remove();
    if (list.querySelectorAll(".comment-item").length === 0) {
      list.innerHTML = `<div class="comment-empty">아직 답변이 없습니다. 첫 번째로 작성해보세요!</div>`;
    }
  });

  // 섹션 이동 시 해제될 클린업 등록
  activeUnsubscribers.push(() => {
    clearTimeout(emptyTimer);
    unsubAdded();
    unsubRemoved();
  });
}

/**
 * 댓글 아이템 DOM 추가
 */
function appendCommentItem(list, comment) {
  if (list.querySelector(`.comment-item[data-id="${CSS.escape(comment.id)}"]`)) return;

  const empty = list.querySelector(".comment-empty");
  if (empty) empty.remove();

  const item = document.createElement("div");
  item.className  = "comment-item";
  item.dataset.id  = comment.id;

  const time = new Date(comment.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit",
  });

  item.innerHTML = `
    <div class="comment-item__header">
      <span class="comment-item__name">${escapeHtml(comment.name)}</span>
      <span class="comment-item__time">${time}</span>
    </div>
    <div class="comment-item__text">${escapeHtml(comment.text)}</div>
  `;

  if (app.isTeacher) {
    const del = document.createElement("button");
    del.className   = "comment-item__delete";
    del.type        = "button";
    del.textContent = "✕";
    del.title       = "삭제";
    del.addEventListener("click", () => deleteComment(comment.id, comment.key || list.dataset.key));
    item.appendChild(del);
  }

  list.appendChild(item);
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * 댓글 입력 폼
 */
function buildCommentForm(key, list) {
  const form = document.createElement("div");
  form.className = "comment-form";

  const nameInput = document.createElement("input");
  nameInput.type        = "text";
  nameInput.placeholder = "이름";
  nameInput.className   = "comment-form__name";
  nameInput.maxLength   = 30;

  const savedName = localStorage.getItem("comment-name") || "";
  if (savedName) nameInput.value = savedName;
  nameInput.addEventListener("input", () => {
    localStorage.setItem("comment-name", nameInput.value);
  });

  const textarea = document.createElement("textarea");
  textarea.placeholder = "이 질문에 대한 내 생각을 적어보세요…";
  textarea.className   = "comment-form__text";
  textarea.rows        = 3;
  textarea.maxLength   = 500;

  const footer = document.createElement("div");
  footer.className = "comment-form__footer";

  const counter = document.createElement("span");
  counter.className   = "comment-form__counter";
  counter.textContent = "0 / 500";
  textarea.addEventListener("input", () => {
    counter.textContent = `${textarea.value.length} / 500`;
  });

  const submit = document.createElement("button");
  submit.type        = "button";
  submit.className   = "comment-form__submit";
  submit.textContent = "답변 제출";

  submit.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const text = textarea.value.trim();

    if (!name) { nameInput.focus(); showFormError(form, "이름을 입력해주세요."); return; }
    if (!text) { textarea.focus();  showFormError(form, "답변 내용을 입력해주세요."); return; }

    submit.disabled    = true;
    submit.textContent = "전송 중…";

    try {
      const dbRef = ref(db, `comments/${toFirebaseKey(key)}`);
      await push(dbRef, {
        key,
        name,
        text,
        createdAt: new Date().toISOString(),
      });

      textarea.value      = "";
      counter.textContent = "0 / 500";
      submit.textContent  = "✓ 제출됨";
      setTimeout(() => { submit.textContent = "답변 제출"; }, 2000);

    } catch (err) {
      console.error(err);
      showFormError(form, "저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      submit.disabled = false;
    }
  });

  footer.appendChild(counter);
  footer.appendChild(submit);
  form.appendChild(nameInput);
  form.appendChild(textarea);
  form.appendChild(footer);
  return form;
}

function showFormError(form, msg) {
  let errEl = form.querySelector(".comment-form__error");
  if (!errEl) {
    errEl = document.createElement("div");
    errEl.className = "comment-form__error";
    form.insertBefore(errEl, form.querySelector(".comment-form__footer"));
  }
  errEl.textContent = msg;
  setTimeout(() => errEl.remove(), 3000);
}

/**
 * 댓글 삭제 (교사 전용)
 */
async function deleteComment(id, key) {
  if (!confirm("이 답변을 삭제할까요?")) return;
  try {
    const dbRef = ref(db, `comments/${toFirebaseKey(key)}/${id}`);
    await remove(dbRef);
  } catch (err) {
    console.error(err);
    alert("삭제에 실패했습니다.");
  }
}

/* ---------- 나머지 블록 렌더러 ---------- */
function renderConcept(block) {
  const div = document.createElement("div");
  div.className = "block callout concept";
  let html = "";
  if (block.title)   html += `<div class="concept__title">💡 ${escapeHtml(block.title)}</div>`;
  if (block.body)    html += `<div class="concept__body">${formatInline(block.body)}</div>`;
  if (block.bullets) {
    html += `<ul class="concept__bullets">`;
    block.bullets.forEach(b => { html += `<li>${formatInline(b)}</li>`; });
    html += `</ul>`;
  }
  div.innerHTML = html;
  if (block.image) {
    const img = buildImage(block.image);
    img.style.marginTop = "1rem";
    div.appendChild(img);
  }
  return div;
}

function renderFigureConcept(block) {
  const div  = document.createElement("div");
  div.className = "block figure-row";
  const left = document.createElement("div");
  left.className = "figure-row__image-wrap";
  left.appendChild(buildImage(block.figure.image, block.figure.caption));
  if (block.figure.caption) {
    const cap = document.createElement("div");
    cap.className   = "figure-row__caption";
    cap.textContent = block.figure.caption;
    left.appendChild(cap);
  }
  const right = document.createElement("div");
  right.className    = "callout concept";
  right.style.margin = "0";
  right.innerHTML    = `
    <div class="concept__title">💡 ${escapeHtml(block.concept.title)}</div>
    <div class="concept__body">${formatInline(block.concept.body)}</div>
  `;
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function renderFigureQuote(block) {
  const div  = document.createElement("div");
  div.className = "block figure-row";
  const left = document.createElement("div");
  left.className = "figure-row__image-wrap";
  left.appendChild(buildImage(block.figure.image, block.figure.caption));
  if (block.figure.caption) {
    const cap = document.createElement("div");
    cap.className   = "figure-row__caption";
    cap.textContent = block.figure.caption;
    left.appendChild(cap);
  }
  const right = document.createElement("div");
  const q = document.createElement("div");
  q.className = "figure-row__quote";
  q.innerHTML = formatInline(block.quote);
  right.appendChild(q);
  if (block.note) {
    const n = document.createElement("div");
    n.className = "figure-row__note";
    n.innerHTML = formatInline(block.note);
    right.appendChild(n);
  }
  div.appendChild(left);
  div.appendChild(right);
  return div;
}

function renderExpandable(block) {
  const div = document.createElement("div");
  div.className = "block expandable";
  const btn = document.createElement("button");
  btn.className   = "expandable__summary";
  btn.textContent = block.summary;
  const content = document.createElement("div");
  content.className = "expandable__content";
  block.children.forEach(child => {
    const el = renderBlock(child);
    if (el) content.appendChild(el);
  });
  btn.addEventListener("click", () => div.classList.toggle("is-open"));
  div.appendChild(btn);
  div.appendChild(content);
  return div;
}

function renderSummary(block) {
  const div = document.createElement("div");
  div.className = "block summary";
  let html = "<ol>";
  block.items.forEach(item => { html += `<li>${formatInline(item)}</li>`; });
  html += "</ol>";
  div.innerHTML = html;
  return div;
}

function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.searchParams.has("v")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    const m = u.pathname.match(/^\/embed\/([^/?]+)/);
    if (m) return m[1];
  } catch (_) {}
  return null;
}

function renderMedia(block) {
  const div = document.createElement("div");
  div.className = "block media";
  if (block.kind === "image") {
    div.classList.add("media--image");
    div.appendChild(buildImage(block.src, block.caption || ""));
    if (block.caption) {
      const cap = document.createElement("div");
      cap.className   = "media__caption";
      cap.textContent = block.caption;
      div.appendChild(cap);
    }
  } else if (block.kind === "video-link") {
    div.classList.add("media--video-link");
<<<<<<< HEAD
    const videoId = extractYouTubeId(block.url);
    const link    = document.createElement("a");
    link.href     = block.url; link.target = "_blank"; link.rel = "noopener noreferrer";
=======
    const videoId  = extractYouTubeId(block.url);
    const thumbSrc = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : "";
    const link     = document.createElement("a");
    link.href      = block.url;
    link.target    = "_blank";
    link.rel       = "noopener noreferrer";
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
    link.className = "media__thumb-link";
    link.setAttribute("aria-label", block.caption || "영상 보기");
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "media__thumb-wrap";
<<<<<<< HEAD
    if (videoId) {
      const img = document.createElement("img");
      img.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      img.alt = block.caption || "YouTube 썸네일"; img.loading = "lazy";
      img.onerror = () => { const ph = document.createElement("div"); ph.className = "image-placeholder"; ph.textContent = "썸네일 없음"; img.replaceWith(ph); };
      thumbWrap.appendChild(img);
    }
    const play = document.createElement("div");
    play.className = "media__play-icon"; play.setAttribute("aria-hidden","true"); play.textContent = "▶";
    thumbWrap.appendChild(play); link.appendChild(thumbWrap); div.appendChild(link);
    if (block.caption) {
      const cap = document.createElement("div");
      cap.className = "media__caption"; cap.textContent = block.caption; div.appendChild(cap);
=======
    if (thumbSrc) {
      const img   = document.createElement("img");
      img.src     = thumbSrc;
      img.alt     = block.caption || "YouTube 썸네일";
      img.loading = "lazy";
      img.onerror = () => {
        const ph = document.createElement("div");
        ph.className = "image-placeholder";
        ph.textContent = "썸네일을 불러올 수 없습니다";
        img.replaceWith(ph);
      };
      thumbWrap.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className   = "image-placeholder";
      ph.textContent = "알 수 없는 URL 형식";
      thumbWrap.appendChild(ph);
    }
    const playIcon = document.createElement("div");
    playIcon.className = "media__play-icon";
    playIcon.setAttribute("aria-hidden", "true");
    playIcon.textContent = "▶";
    thumbWrap.appendChild(playIcon);
    link.appendChild(thumbWrap);
    div.appendChild(link);
    if (block.caption) {
      const cap = document.createElement("div");
      cap.className   = "media__caption";
      cap.textContent = block.caption;
      div.appendChild(cap);
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
    }
  }
  return div;
}

function renderDivider() {
  const hr = document.createElement("hr");
  hr.className = "block divider";
  return hr;
}

<<<<<<< HEAD
/* ====================================================================
   댓글 시스템
   ==================================================================== */
function buildCommentSection(key) {
  const wrap   = document.createElement("div");
  wrap.className = "comment-section";

  const toggle = document.createElement("button");
  toggle.className   = "comment-toggle";
  toggle.textContent = "💬 학생 답변 보기/남기기";
  toggle.type        = "button";

  const body = document.createElement("div");
  body.className = "comment-body";

  const list = document.createElement("div");
  list.className   = "comment-list";
  list.dataset.key = key;

  body.appendChild(list);
  body.appendChild(buildCommentForm(key, list));

  toggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("is-open");
    toggle.classList.toggle("is-open", isOpen);
    if (isOpen && !body.dataset.loaded) {
      body.dataset.loaded = "1";
      subscribeComments(key, list);
    }
  });

  wrap.appendChild(toggle);
  wrap.appendChild(body);
  return wrap;
}

function subscribeComments(key, list) {
  list.innerHTML = `<div class="comment-loading">불러오는 중…</div>`;

  // 경로: comments / 수업코드 / 댓글key
  const dbRef    = ref(db, `comments/${toFbKey(app.sessionCode)}/${toFbKey(key)}`);
  let firstBatch = true;
  let count      = 0;

  const unsubAdded = onChildAdded(dbRef, snap => {
    if (firstBatch) { list.innerHTML = ""; firstBatch = false; }
    appendCommentItem(list, { id: snap.key, ...snap.val() });
    count++;
  });

  const emptyTimer = setTimeout(() => {
    if (count === 0) {
      list.innerHTML = `<div class="comment-empty">아직 답변이 없습니다. 첫 번째로 작성해보세요!</div>`;
      firstBatch = false;
    }
  }, 600);

  const unsubRemoved = onChildRemoved(dbRef, snap => {
    const item = list.querySelector(`.comment-item[data-id="${CSS.escape(snap.key)}"]`);
    if (item) item.remove();
    if (!list.querySelector(".comment-item")) {
      list.innerHTML = `<div class="comment-empty">아직 답변이 없습니다. 첫 번째로 작성해보세요!</div>`;
    }
  });

  activeUnsubscribers.push(() => {
    clearTimeout(emptyTimer);
    unsubAdded();
    unsubRemoved();
  });
}

function appendCommentItem(list, comment) {
  if (list.querySelector(`.comment-item[data-id="${CSS.escape(comment.id)}"]`)) return;
  list.querySelector(".comment-empty")?.remove();

  const item = document.createElement("div");
  item.className  = "comment-item";
  item.dataset.id = comment.id;

  const time = comment.createdAt
    ? new Date(comment.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : "";

  item.innerHTML = `
    <div class="comment-item__header">
      <span class="comment-item__name">${escapeHtml(comment.name)}</span>
      <span class="comment-item__time">${time}</span>
    </div>
    <div class="comment-item__text">${escapeHtml(comment.text)}</div>
  `;

  if (app.isTeacher) {
    const del = document.createElement("button");
    del.className   = "comment-item__delete";
    del.type        = "button";
    del.textContent = "✕";
    del.title       = "삭제";
    del.addEventListener("click", () => {
      if (confirm("이 답변을 삭제할까요?")) {
        remove(ref(db, `comments/${toFbKey(app.sessionCode)}/${toFbKey(comment.key || list.dataset.key)}/${comment.id}`));
      }
    });
    item.appendChild(del);
  }

  list.appendChild(item);
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function buildCommentForm(key, list) {
  const form = document.createElement("div");
  form.className = "comment-form";

  const nameInput = document.createElement("input");
  nameInput.type        = "text";
  nameInput.placeholder = "이름";
  nameInput.className   = "comment-form__name";
  nameInput.maxLength   = 30;
  const saved = localStorage.getItem("comment-name") || "";
  if (saved) nameInput.value = saved;
  nameInput.addEventListener("input", () => localStorage.setItem("comment-name", nameInput.value));

  const textarea = document.createElement("textarea");
  textarea.placeholder = "이 질문에 대한 내 생각을 적어보세요…";
  textarea.className   = "comment-form__text";
  textarea.rows        = 3;
  textarea.maxLength   = 500;

  const footer  = document.createElement("div");
  footer.className = "comment-form__footer";

  const counter = document.createElement("span");
  counter.className   = "comment-form__counter";
  counter.textContent = "0 / 500";
  textarea.addEventListener("input", () => { counter.textContent = `${textarea.value.length} / 500`; });

  const submit = document.createElement("button");
  submit.type        = "button";
  submit.className   = "comment-form__submit";
  submit.textContent = "답변 제출";

  submit.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const text = textarea.value.trim();
    if (!name) { nameInput.focus(); showFormError(form, "이름을 입력해주세요."); return; }
    if (!text) { textarea.focus();  showFormError(form, "답변 내용을 입력해주세요."); return; }

    submit.disabled    = true;
    submit.textContent = "전송 중…";

    try {
      await push(ref(db, `comments/${toFbKey(app.sessionCode)}/${toFbKey(key)}`), {
        key, name, text, createdAt: new Date().toISOString(),
      });
      textarea.value      = "";
      counter.textContent = "0 / 500";
      submit.textContent  = "✓ 제출됨";
      setTimeout(() => { submit.textContent = "답변 제출"; }, 2000);
    } catch (err) {
      console.error(err);
      showFormError(form, "저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      submit.disabled = false;
    }
  });

  footer.appendChild(counter);
  footer.appendChild(submit);
  form.appendChild(nameInput);
  form.appendChild(textarea);
  form.appendChild(footer);
  return form;
}

function showFormError(form, msg) {
  let el = form.querySelector(".comment-form__error");
  if (!el) {
    el = document.createElement("div");
    el.className = "comment-form__error";
    form.insertBefore(el, form.querySelector(".comment-form__footer"));
  }
  el.textContent = msg;
  setTimeout(() => el.remove(), 3000);
}

/* ====================================================================
   헬퍼
   ==================================================================== */
=======
/* ---------- 헬퍼 ---------- */
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
function buildAnswer(answer, label = "답 보기") {
  const wrap = document.createElement("div");
  wrap.className = "answer";
  const btn = document.createElement("button");
  btn.className   = "answer__toggle";
  btn.textContent = label;
  btn.addEventListener("click", () => wrap.classList.toggle("is-open"));
  const content = document.createElement("div");
  content.className = "answer__content";
  if (answer.bullets) {
    let html = "<ul>";
    answer.bullets.forEach(b => { html += `<li>${formatInline(b)}</li>`; });
    html += "</ul>";
    content.innerHTML = html;
  } else if (answer.text) {
    content.innerHTML = `<p>${formatInline(answer.text)}</p>`;
  }
  wrap.appendChild(btn);
  wrap.appendChild(content);
  return wrap;
}

function buildImagePair(paths) {
  const pair = document.createElement("div");
  pair.className = "image-pair";
  paths.forEach(p => pair.appendChild(buildImage(p)));
  return pair;
}

function buildImage(key, alt = "") {
  let resolved = key;
<<<<<<< HEAD
  if (app.lesson.assets?.[key]) resolved = app.lesson.assets[key];
  if (typeof resolved === "string" && resolved.startsWith("text:")) return buildTextCutout(resolved.slice(5), alt);

  const videoId = extractYouTubeId(resolved);
  if (videoId) {
    const wrap = document.createElement("div"); wrap.className = "media__thumb-wrap";
    const link = document.createElement("a"); link.href = resolved; link.target = "_blank"; link.rel = "noopener noreferrer"; link.className = "media__thumb-link"; link.setAttribute("aria-label", alt || "YouTube 영상 보기");
    const thumb = document.createElement("img"); thumb.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; thumb.alt = alt || "YouTube 썸네일"; thumb.loading = "lazy";
    thumb.onerror = () => { const ph = document.createElement("div"); ph.className = "image-placeholder"; ph.textContent = "썸네일 없음"; thumb.replaceWith(ph); };
    const play = document.createElement("div"); play.className = "media__play-icon"; play.setAttribute("aria-hidden","true"); play.textContent = "▶";
    link.appendChild(thumb); link.appendChild(play); wrap.appendChild(link); return wrap;
=======
  if (app.lesson.assets && app.lesson.assets[key]) resolved = app.lesson.assets[key];

  if (typeof resolved === "string" && resolved.startsWith("text:")) {
    return buildTextCutout(resolved.slice(5), alt);
  }

  const videoId = extractYouTubeId(resolved);
  if (videoId) {
    const wrap = document.createElement("div");
    wrap.className = "media__thumb-wrap";
    const link = document.createElement("a");
    link.href      = resolved;
    link.target    = "_blank";
    link.rel       = "noopener noreferrer";
    link.className = "media__thumb-link";
    link.setAttribute("aria-label", alt || "YouTube 영상 보기");
    const thumb = document.createElement("img");
    thumb.src     = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    thumb.alt     = alt || "YouTube 썸네일";
    thumb.loading = "lazy";
    thumb.onerror = () => {
      const ph = document.createElement("div");
      ph.className   = "image-placeholder";
      ph.textContent = "썸네일을 불러올 수 없습니다";
      thumb.replaceWith(ph);
    };
    const playIcon = document.createElement("div");
    playIcon.className = "media__play-icon";
    playIcon.setAttribute("aria-hidden", "true");
    playIcon.textContent = "▶";
    link.appendChild(thumb);
    link.appendChild(playIcon);
    wrap.appendChild(link);
    return wrap;
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  }

  const src = /^https?:\/\//.test(resolved) ? resolved : app.lesson.imageBase + resolved;
  const img = document.createElement("img");
<<<<<<< HEAD
  img.src = src; img.alt = alt; img.loading = "lazy";
  img.onerror = () => { const ph = document.createElement("div"); ph.className = "image-placeholder"; ph.textContent = `이미지: ${key}`; img.replaceWith(ph); };
=======
  img.src     = src;
  img.alt     = alt;
  img.loading = "lazy";
  img.onerror = () => {
    const ph = document.createElement("div");
    ph.className   = "image-placeholder";
    ph.textContent = `이미지: ${key}`;
    img.replaceWith(ph);
  };
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  return img;
}

function formatInline(text) {
  if (!text) return "";
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\n/g, "<br>");
  return s;
}

function buildTextCutout(body, alt = "") {
<<<<<<< HEAD
  const wrap = document.createElement("div"); wrap.className = "text-cutout";
  const [mainPart, sourcePart] = body.split(/\n---\n/);
  const lines = mainPart.split("\n"); let headline = null, rest = lines;
  if (lines[0]?.startsWith("## ")) { headline = lines[0].slice(3).trim(); rest = lines.slice(1); while (rest.length && !rest[0].trim()) rest.shift(); }
  if (headline) { const h = document.createElement("div"); h.className = "text-cutout__headline"; h.innerHTML = formatInline(headline); wrap.appendChild(h); }
  const bodyEl = document.createElement("div"); bodyEl.className = "text-cutout__body"; bodyEl.innerHTML = formatInline(rest.join("\n")); wrap.appendChild(bodyEl);
  if (sourcePart?.trim()) { const src = document.createElement("div"); src.className = "text-cutout__source"; src.innerHTML = formatInline(sourcePart.trim()); wrap.appendChild(src); }
=======
  const wrap = document.createElement("div");
  wrap.className = "text-cutout";
  const [mainPart, sourcePart] = body.split(/\n---\n/);
  const lines  = mainPart.split("\n");
  let headline = null;
  let rest     = lines;
  if (lines[0] && lines[0].startsWith("## ")) {
    headline = lines[0].slice(3).trim();
    rest     = lines.slice(1);
    while (rest.length && rest[0].trim() === "") rest.shift();
  }
  if (headline) {
    const h = document.createElement("div");
    h.className = "text-cutout__headline";
    h.innerHTML = formatInline(headline);
    wrap.appendChild(h);
  }
  const bodyEl = document.createElement("div");
  bodyEl.className = "text-cutout__body";
  bodyEl.innerHTML = formatInline(rest.join("\n"));
  wrap.appendChild(bodyEl);
  if (sourcePart && sourcePart.trim()) {
    const src = document.createElement("div");
    src.className = "text-cutout__source";
    src.innerHTML = formatInline(sourcePart.trim());
    wrap.appendChild(src);
  }
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  return wrap;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* ====================================================================
   하단 네비 / 키보드
   ==================================================================== */
function renderNavFooter() {
  const prev = document.getElementById("nav-prev");
  const next = document.getElementById("nav-next");
  const prog = document.getElementById("nav-progress");
  if (!prev) return;
<<<<<<< HEAD
  const total = app.lesson.sections.length;
  prev.disabled    = app.currentIdx === 0;
  next.disabled    = app.currentIdx >= total - 1;
=======
  const total   = app.lesson.sections.length;
  prev.disabled = app.currentIdx === 0;
  next.disabled = app.currentIdx >= total - 1;
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
  prog.textContent = `${app.currentIdx + 1} / ${total}`;
  prev.onclick = () => goTo(app.currentIdx - 1);
  next.onclick = () => goTo(app.currentIdx + 1);
}

function bindKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.target.matches("input, textarea")) return;
<<<<<<< HEAD
    if (document.getElementById("focus-overlay")) {
      if (e.key === "Escape") { e.preventDefault(); closeFocusOverlay(); }
      return;
    }
    if      (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goTo(app.currentIdx + 1); }
    else if (e.key === "ArrowLeft"  || e.key === "PageUp")   { e.preventDefault(); goTo(app.currentIdx - 1); }
    else if (e.key === " " || e.key === "Enter") {
=======
    const overlayOpen = !!document.getElementById("focus-overlay");
    if (overlayOpen) {
      if (e.key === "Escape") { e.preventDefault(); closeFocusOverlay(); }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault(); goTo(app.currentIdx + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault(); goTo(app.currentIdx - 1);
    } else if (e.key === " " || e.key === "Enter") {
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
      if (e.target.tagName === "BUTTON") return;
      e.preventDefault(); toggleFirstVisibleAnswer();
    }
  });
}

function toggleFirstVisibleAnswer() {
  const answers = document.querySelectorAll(".answer");
  for (const a of answers) {
    const rect = a.getBoundingClientRect();
    if (rect.top >= 0 && rect.top < window.innerHeight * 0.7) { a.classList.toggle("is-open"); return; }
  }
  if (answers.length) answers[0].classList.toggle("is-open");
}

<<<<<<< HEAD
/* ====================================================================
   시작
   ==================================================================== */
=======
/* ---------- 시작 ---------- */
>>>>>>> a7ff54be63a919cb97e005920e2ce9dfbf0c982e
init();
