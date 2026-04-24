import { app, clearListeners, DEFAULT_LESSON } from "./state.js";
import { loadExternalAssets } from "./api.js";
import { showDashboard } from "./ui/dashboard.js";
import { showStudentGate, showTeacherGate } from "./ui/gate.js";
import { buildAppShell, renderSidebar, renderNavFooter, bindKeyboard, toggleFirstVisibleAnswer } from "./ui/layout.js";
import { showQRPanel, closeImageLightbox, closeFocusOverlay } from "./ui/components.js";
import { renderBlock, renderDivider } from "./ui/blocks.js";
import { escapeHtml } from "./utils.js";

/* ====================================================================
   진입점 — 수업 코드 게이팅
   ==================================================================== */
async function init() {
  const params = new URLSearchParams(location.search);
  const lessonId = params.get("lesson");
  app.isTeacher = params.get("teacher") === "1";
  const codeInUrl = params.get("code") || "";

  // 레슨 파라미터가 없으면 대시보드 표시
  if (!lessonId) {
    await showDashboard();
    return;
  }

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
    showTeacherGate(enterSession);
    return;
  }

  // 학생 모드: 코드 입력 화면
  showStudentGate(enterSession);
}

/* ====================================================================
   수업 입장 및 섹션 이동
   ==================================================================== */
function enterSession(code) {
  app.sessionCode = code;
  localStorage.setItem("session-code", code);

  document.body.innerHTML = "";
  document.body.style.cssText = "";

  buildAppShell();
  renderSidebar(goTo);
  renderNavFooter(goTo);

  if (app.isTeacher) {
    showQRPanel(code);
    const badge = document.createElement("div");
    badge.className = "teacher-badge";
    badge.textContent = `👩‍🏫 교사 모드 · ${code}`;
    document.body.appendChild(badge);
  } else {
    const badge = document.createElement("div");
    badge.className = "student-badge";
    badge.textContent = `📚 ${code}`;
    document.body.appendChild(badge);
  }

  const hash = location.hash.replace("#", "");
  const idx = app.lesson.sections.findIndex(s => s.id === hash);
  goTo(idx >= 0 ? idx : 0);

  bindKeyboard({
    goToIdx: goTo,
    toggleFirstVisibleAnswer,
    closeImageLightbox,
    closeFocusOverlay
  });

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    const i = app.lesson.sections.findIndex(s => s.id === h);
    if (i >= 0 && i !== app.currentIdx) goTo(i);
  });

  document.title = `${app.lesson.title} — ${app.lesson.lessonGroup || "수업 자료"}`;
}

function goTo(idx) {
  if (idx < 0 || idx >= app.lesson.sections.length) return;
  clearListeners();
  app.currentIdx = idx;
  const sec = app.lesson.sections[idx];

  document.querySelectorAll(".sidebar__section").forEach(el => {
    el.classList.toggle("is-active", Number(el.dataset.idx) === idx);
  });
  renderSection(sec);
  renderNavFooter(goTo);
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
    const el = renderBlock(block, idx);
    if (el) {
      main.appendChild(el);
    }
    if (sec.blocks[idx + 1] && block.type !== "heading") {
      main.appendChild(renderDivider());
    }
  });
}

// 시작
init();