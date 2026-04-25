import { app } from "./state.js";
import { parseCSV, SHEET_URLS } from "./api.js";
import { renderBlock, renderDivider } from "./ui/blocks.js";
import { escapeHtml } from "./utils.js";

const BLOCK_TYPES = ["단락", "소제목", "구분선", "사례", "발문", "개념", "이미지곁글", "미디어", "기출문제", "접이식", "요약"];
const LOCAL_CACHE_KEY = "lessonAuthorDraft_v1";

const state = {
  lesson: loadLocalDraft() || createBlankLesson(),
  currentSection: 0,
  showAllPreview: false,
  assets: [],
  assetMap: {},
  assetTarget: null,
  assetMode: "single",
  assetSelection: new Set(),
  dragBlock: null,
  openDetails: new Map(),
};

const uiIds = new WeakMap();
let nextUiId = 1;
const root = document.getElementById("author-root");

init();

function init() {
  renderShell();
  bindRootEvents();
  renderEditor();
  refreshOutputs();
  loadAssetIndex();
}

function renderShell() {
  root.innerHTML = `
    <div class="author">
      <header class="author__topbar">
        <div class="author__brand">
          <a class="author__back" href="index.html" aria-label="대시보드로 이동">←</a>
          <div>
            <h1 class="author__title">수업 JSON 빌더</h1>
            <div class="author__subtitle">수업 정보, 섹션, 블록을 폼으로 구성하고 발표용 JSON을 생성합니다.</div>
          </div>
        </div>
        <div class="author__actions">
          <button class="btn" type="button" data-action="save-local">작업 저장</button>
          <button class="btn" type="button" data-action="load-local">저장본 불러오기</button>
          <button class="btn" type="button" data-action="reset">초기화</button>
          <button class="btn" type="button" data-action="copy-json">JSON 복사</button>
          <button class="btn btn--primary" type="button" data-action="download-json">JSON 다운로드</button>
        </div>
      </header>

      <div class="author__layout">
        <div class="author__panel">
          <section class="panel">
            <div class="panel__head">
              <h2 class="panel__title">수업 정보</h2>
            </div>
            <div class="panel__body">
              <div id="meta-editor"></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head">
              <h2 class="panel__title">섹션과 블록</h2>
              <button class="btn btn--sm" type="button" data-action="add-section">섹션 추가</button>
            </div>
            <div class="panel__body">
              <div id="section-editor"></div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__head">
              <h2 class="panel__title">생성된 JSON</h2>
            </div>
            <div class="panel__body">
              <textarea id="json-output" class="json-output" readonly spellcheck="false"></textarea>
            </div>
          </section>
        </div>

        <aside class="author__preview">
          <section class="panel">
            <div class="preview-toolbar">
              <h2 class="panel__title">실시간 미리보기</h2>
              <label class="check-field">
                <input type="checkbox" id="preview-all">
                전체 보기
              </label>
            </div>
            <div class="preview-stage">
              <div id="preview-errors"></div>
              <div id="main-content"></div>
            </div>
          </section>
        </aside>
      </div>

      <section class="panel asset-search" id="asset-search">
        <div class="panel__head">
          <h2 class="panel__title">외부자료 키 검색</h2>
          <button class="btn btn--sm" type="button" data-action="close-assets">닫기</button>
        </div>
        <div class="asset-search__body">
          <input class="asset-search__input" id="asset-query" type="search" placeholder="키, 설명, 키워드로 검색" autocomplete="off">
          <div class="asset-search__bar" id="asset-search-bar"></div>
          <div class="asset-results" id="asset-results"></div>
        </div>
      </section>
    </div>
  `;
}

function bindRootEvents() {
  root.addEventListener("input", event => {
    const target = event.target;
    if (target.matches("[data-path]") && !target.dataset.path.endsWith(".__commonImageInput")) {
      writeField(target);
      refreshOutputs();
    }
    if (target.id === "asset-query") renderAssetResults();
  });

  root.addEventListener("keydown", event => {
    const target = event.target;
    if (event.key === "Enter" && target.matches("[data-path$='.__commonImageInput']")) {
      event.preventDefault();
      writeField(target);
      refreshOutputs();
    }
  });

  root.addEventListener("dragstart", event => {
    const card = event.target.closest(".block-card[data-block]");
    if (!card) return;
    state.dragBlock = {
      section: Number(card.dataset.section),
      block: Number(card.dataset.block),
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(state.dragBlock));
    card.classList.add("is-dragging");
  });

  root.addEventListener("dragend", event => {
    event.target.closest(".block-card")?.classList.remove("is-dragging");
    state.dragBlock = null;
    clearBlockDropIndicators();
  });

  root.addEventListener("dragover", event => {
    const blockList = event.target.closest(".section-card__blocks[data-section]");
    if (!blockList || !state.dragBlock) return;
    event.preventDefault();
    clearBlockDropIndicators();
    const { card, position } = getBlockDropTarget(event, blockList);
    if (card) card.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
    else blockList.classList.add("is-drop-empty");
  });

  root.addEventListener("drop", event => {
    const blockList = event.target.closest(".section-card__blocks[data-section]");
    if (!blockList) return;
    event.preventDefault();
    const from = state.dragBlock || JSON.parse(event.dataTransfer.getData("text/plain") || "{}");
    const toSection = Number(blockList.dataset.section);
    if (from.section !== toSection) return;
    const insertIdx = getBlockInsertIndex(event, blockList);
    moveBlockTo(from.section, from.block, insertIdx);
    clearBlockDropIndicators();
    renderEditor();
    refreshOutputs();
  });

  root.addEventListener("toggle", event => {
    const details = event.target.closest("details[data-detail-id]");
    if (!details) return;
    state.openDetails.set(details.dataset.detailId, details.open);
  }, true);

  root.addEventListener("change", event => {
    const target = event.target;
    if (target.id === "preview-all") {
      state.showAllPreview = target.checked;
      refreshOutputs();
      return;
    }
    if (target.matches("[data-path]")) {
      writeField(target);
      refreshOutputs();
    }
    if (target.matches("[data-action='change-block-type']")) {
      const sectionIdx = Number(target.dataset.section);
      const blockIdx = Number(target.dataset.block);
      state.lesson.sections[sectionIdx].blocks[blockIdx] = createBlock(target.value);
      renderEditor();
      refreshOutputs();
    }
    if (target.matches("[data-action='change-child-type']")) {
      setPath(target.dataset.path, createBlock(target.value));
      renderEditor();
      refreshOutputs();
    }
  });

  root.addEventListener("click", event => {
    if (event.target.closest("button, select, input, textarea, a") && event.target.closest("summary")) {
      event.preventDefault();
      event.stopPropagation();
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const sectionIdx = numberOrNull(button.dataset.section);
    const blockIdx = numberOrNull(button.dataset.block);
    const itemIdx = numberOrNull(button.dataset.item);
    const path = button.dataset.path;

    if (action === "save-local") {
      saveLocalDraft();
      toast("현재 작업을 브라우저에 저장했습니다.");
    } else if (action === "load-local") {
      const draft = loadLocalDraft();
      if (!draft) return toast("저장된 작업이 없습니다.");
      state.lesson = draft;
      state.currentSection = 0;
      renderEditor();
      refreshOutputs();
      toast("저장된 작업을 불러왔습니다.");
    } else if (action === "reset") {
      state.lesson = createBlankLesson();
      state.currentSection = 0;
      renderEditor();
      refreshOutputs();
      toast("새 수업으로 초기화했습니다.");
    } else if (action === "copy-json") {
      copyJson();
    } else if (action === "download-json") {
      downloadJson();
    } else if (action === "add-section") {
      state.lesson.sections.push(createSection(state.lesson.sections.length + 1));
      state.currentSection = state.lesson.sections.length - 1;
      renderEditor();
      refreshOutputs();
    } else if (action === "select-section") {
      state.currentSection = sectionIdx;
      renderEditor();
      refreshOutputs();
    } else if (action === "duplicate-section") {
      const clone = structuredClone(state.lesson.sections[sectionIdx]);
      clone.id = uniqueSectionId(clone.id || "section");
      clone.title = `${clone.title || "새 섹션"} 복사본`;
      state.lesson.sections.splice(sectionIdx + 1, 0, clone);
      state.currentSection = sectionIdx + 1;
      renderEditor();
      refreshOutputs();
    } else if (action === "delete-section") {
      if (state.lesson.sections.length <= 1) return toast("섹션은 최소 1개가 필요합니다.");
      state.lesson.sections.splice(sectionIdx, 1);
      state.currentSection = Math.max(0, Math.min(state.currentSection, state.lesson.sections.length - 1));
      renderEditor();
      refreshOutputs();
    } else if (action === "move-section") {
      moveItem(state.lesson.sections, sectionIdx, Number(button.dataset.dir));
      state.currentSection = Math.max(0, Math.min(state.lesson.sections.length - 1, sectionIdx + Number(button.dataset.dir)));
      renderEditor();
      refreshOutputs();
    } else if (action === "add-block") {
      state.lesson.sections[sectionIdx].blocks.push(createBlock(button.dataset.type || "단락"));
      renderEditor();
      refreshOutputs();
    } else if (action === "duplicate-block") {
      const blocks = state.lesson.sections[sectionIdx].blocks;
      blocks.splice(blockIdx + 1, 0, structuredClone(blocks[blockIdx]));
      renderEditor();
      refreshOutputs();
    } else if (action === "delete-block") {
      state.lesson.sections[sectionIdx].blocks.splice(blockIdx, 1);
      renderEditor();
      refreshOutputs();
    } else if (action === "array-add") {
      const arr = getPath(path);
      arr.push(createArrayItem(button.dataset.kind));
      renderEditor();
      refreshOutputs();
    } else if (action === "array-delete") {
      getPath(path).splice(itemIdx, 1);
      renderEditor();
      refreshOutputs();
    } else if (action === "array-move") {
      moveItem(getPath(path), itemIdx, Number(button.dataset.dir));
      renderEditor();
      refreshOutputs();
    } else if (action === "remove-common-image") {
      removeCommonImage(path, itemIdx);
      renderEditor();
      refreshOutputs();
    } else if (action === "pick-asset") {
      state.assetTarget = path;
      openAssetSearch("single");
    } else if (action === "pick-assets") {
      state.assetTarget = path;
      openAssetSearch("multi");
    } else if (action === "choose-asset") {
      if (state.assetMode === "multi") {
        toggleAssetSelection(button.dataset.key);
        return;
      }
      if (state.assetTarget) setPath(state.assetTarget, button.dataset.key);
      closeAssetSearch();
      renderEditor();
      refreshOutputs();
      toast("외부자료 키를 넣었습니다.");
    } else if (action === "apply-assets") {
      applyAssetSelection();
    } else if (action === "close-assets") {
      closeAssetSearch();
    }
  });
}

function renderEditor() {
  renderMetaEditor();
  renderSectionEditor();
}

function renderMetaEditor() {
  document.getElementById("meta-editor").innerHTML = `
    <div class="form-grid">
      ${inputField("id", "수업 ID", "lesson.id", "rat-disc-1", "다운로드 파일명과 URL의 lesson 값으로 사용됩니다.")}
      ${inputField("title", "수업 제목", "lesson.title", "1차시: 제목")}
      ${inputField("subtitle", "부제", "lesson.subtitle", "짧은 설명")}
      ${inputField("imageBase", "이미지 기본 경로", "lesson.imageBase", "assets/images/")}
      ${inputField("prev", "이전 차시 ID", "lesson.prev", "없으면 비워두세요")}
      ${inputField("next", "다음 차시 ID", "lesson.next", "없으면 비워두세요")}
    </div>
  `;
}

function renderSectionEditor() {
  const current = state.lesson.sections[state.currentSection] || state.lesson.sections[0];
  const sectionIdx = state.lesson.sections.indexOf(current);
  const sectionDetail = getDetailState(current, "section");
  const tabs = state.lesson.sections.map((section, idx) => `
    <button class="btn btn--sm section-tab ${idx === sectionIdx ? "is-active" : ""}" type="button" data-action="select-section" data-section="${idx}">
      ${escapeHtml(section.id || `section-${idx + 1}`)} · ${escapeHtml(section.title || "제목 없음")}
    </button>
  `).join("");

  document.getElementById("section-editor").innerHTML = `
    <div class="sections-tabs">${tabs}</div>
    <details class="section-card" data-detail-id="${sectionDetail.id}" ${sectionDetail.open ? "open" : ""}>
      <summary class="section-card__head">
        <span class="section-card__title">
          <strong>${escapeHtml(current.id || "새 섹션")}</strong>
          <span>${escapeHtml(current.title || "제목 없음")}</span>
        </span>
        <div class="block-card__actions">
          <button class="btn btn--sm" type="button" data-action="move-section" data-section="${sectionIdx}" data-dir="-1">위</button>
          <button class="btn btn--sm" type="button" data-action="move-section" data-section="${sectionIdx}" data-dir="1">아래</button>
          <button class="btn btn--sm" type="button" data-action="duplicate-section" data-section="${sectionIdx}">복제</button>
          <button class="btn btn--sm btn--danger" type="button" data-action="delete-section" data-section="${sectionIdx}">삭제</button>
        </div>
      </summary>
      <div class="block-card__body">
        <div class="form-grid">
          ${inputField("section-id", "섹션 ID", `lesson.sections.${sectionIdx}.id`, "1-1")}
          ${inputField("section-title", "섹션 제목", `lesson.sections.${sectionIdx}.title`, "섹션 제목")}
        </div>
        <div class="section-card__blocks-head">
          <h3 class="panel__title">블록</h3>
          <div class="block-card__actions">
            ${BLOCK_TYPES.map(type => `<button class="btn btn--sm" type="button" data-action="add-block" data-section="${sectionIdx}" data-type="${type}">${type}</button>`).join("")}
          </div>
        </div>
        <div class="section-card__blocks" data-section="${sectionIdx}">
          ${current.blocks.length ? current.blocks.map((block, idx) => renderBlockEditor(block, sectionIdx, idx, `lesson.sections.${sectionIdx}.blocks.${idx}`)).join("") : `<p class="field__hint" style="margin:1rem 0 0;">아직 블록이 없습니다. 위 버튼으로 블록을 추가하세요.</p>`}
        </div>
      </div>
    </details>
  `;
}

function renderBlockEditor(block, sectionIdx, blockIdx, basePath) {
  const detail = getDetailState(block, "block");
  return `
    <details class="block-card" data-detail-id="${detail.id}" data-section="${sectionIdx}" data-block="${blockIdx}" draggable="true" ${detail.open ? "open" : ""}>
      <summary class="block-card__head">
        <div class="block-card__type">
          <span class="drag-handle" title="드래그해서 순서 변경" aria-label="드래그해서 순서 변경">⋮⋮</span>
          <strong>#${blockIdx + 1}</strong>
          <select data-action="change-block-type" data-section="${sectionIdx}" data-block="${blockIdx}">
            ${BLOCK_TYPES.map(type => `<option value="${type}" ${block.type === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </div>
        <div class="block-card__actions">
          <button class="btn btn--sm" type="button" data-action="duplicate-block" data-section="${sectionIdx}" data-block="${blockIdx}">복제</button>
          <button class="btn btn--sm btn--danger" type="button" data-action="delete-block" data-section="${sectionIdx}" data-block="${blockIdx}">삭제</button>
        </div>
      </summary>
      <div class="block-card__body">
        ${renderFieldsForBlock(block, basePath)}
      </div>
    </details>
  `;
}

function renderFieldsForBlock(block, basePath) {
  if (block.type === "구분선") return `<p class="field__hint">구분선은 추가 입력 없이 렌더링됩니다.</p>`;
  if (block.type === "단락" || block.type === "소제목") {
    return `<div class="form-grid">${textareaField("text", "텍스트", `${basePath}.text`)}</div>${commonImageFields(basePath)}`;
  }
  if (block.type === "사례") {
    return `
      <div class="form-grid">
        ${inputField("title", "상단 태그/제목", `${basePath}.title`, "사례")}
        ${selectField("style", "스타일", `${basePath}.style`, [["", "기본"], ["news", "신문 기사"]])}
        ${textareaField("body", "본문", `${basePath}.body`)}
        ${textareaField("footer", "출처/부연", `${basePath}.footer`)}
        ${textareaField("answer", "답 보기", `${basePath}.answerText`, "줄마다 항목을 적으면 배열로 저장됩니다.")}
        ${checkboxField("comments", "학생 의견 받기", `${basePath}.comments`)}
      </div>
      ${commonImageFields(basePath)}
    `;
  }
  if (block.type === "개념") {
    return `
      <div class="form-grid">
        ${inputField("title", "개념 제목", `${basePath}.title`, "핵심 개념")}
        ${textareaField("body", "본문", `${basePath}.body`)}
        ${listTextarea("bullets", "불릿", `${basePath}.bullets`)}
        ${textareaField("footer", "추가 설명", `${basePath}.footer`)}
      </div>
      ${commonImageFields(basePath)}
    `;
  }
  if (block.type === "발문") {
    return `
      ${arrayEditor("질문", `${basePath}.prompts`, "prompt")}
      <div class="form-grid" style="margin-top:0.85rem;">
        ${textareaField("conclusion", "마무리 문장", `${basePath}.conclusion`)}
        ${checkboxField("comments", "학생 의견 받기", `${basePath}.comments`)}
      </div>
      ${assetArrayEditor("이미지 2장 비교", `${basePath}.imagePair`, "imagePair")}
      ${commonImageFields(basePath)}
    `;
  }
  if (block.type === "이미지곁글") {
    return `
      <div class="form-grid">
        ${selectField("kind", "형태", `${basePath}.kind`, [["concept", "개념"], ["quote", "인용"]])}
        ${assetInput("image", "이미지 키/URL", `${basePath}.image`)}
        ${inputField("caption", "캡션", `${basePath}.caption`)}
        ${inputField("title", "제목", `${basePath}.title`)}
        ${textareaField("body", "본문/인용문", `${basePath}.body`)}
        ${textareaField("note", "추가 설명", `${basePath}.note`)}
      </div>
    `;
  }
  if (block.type === "미디어") {
    return `
      <div class="form-grid">
        ${selectField("kind", "미디어 종류", `${basePath}.kind`, [["image", "이미지"], ["video", "YouTube 영상"], ["row", "이미지 여러 장"], ["text", "텍스트 컷아웃"]])}
        ${assetInput("src", "이미지 키/URL", `${basePath}.src`)}
        ${inputField("url", "영상 URL", `${basePath}.url`)}
        ${inputField("caption", "캡션", `${basePath}.caption`)}
        ${inputField("headline", "기사 제목", `${basePath}.headline`)}
        ${textareaField("body", "기사 본문", `${basePath}.body`)}
        ${inputField("source", "출처", `${basePath}.source`)}
      </div>
      ${assetArrayEditor("이미지 여러 장", `${basePath}.images`, "image")}
    `;
  }
  if (block.type === "기출문제") return arrayEditor("문제", `${basePath}.items`, "quiz");
  if (block.type === "접이식") {
    return `
      <div class="form-grid">${inputField("summary", "접이식 제목", `${basePath}.summary`)}</div>
      ${arrayEditor("하위 블록", `${basePath}.children`, "childBlock")}
    `;
  }
  if (block.type === "요약") return listTextarea("items", "요약 항목", `${basePath}.items`);
  return "";
}

function commonImageFields(basePath) {
  const images = getCommonImages(basePath);
  return `
    <div class="array-card">
      <div class="array-card__head">
        <strong>공통 이미지</strong>
      </div>
      <div class="array-card__body">
        <label class="field field--full">
          <span class="field__label">이미지</span>
          <span class="asset-field">
            <input data-path="${basePath}.__commonImageInput" value="" placeholder="키, 파일명, 이미지 URL">
            <button class="btn btn--sm" type="button" data-action="pick-assets" data-path="${basePath}.__commonImages">키 찾기</button>
          </span>
          ${renderImageChips(images, basePath)}
          <span class="field__hint">키 찾기에서 하나 또는 여러 개를 선택하거나, 직접 입력 후 입력 완료로 추가합니다.</span>
        </label>
      </div>
    </div>
  `;
}

function getCommonImages(basePath) {
  const block = getPath(basePath) || {};
  return [block.image, ...(Array.isArray(block.images) ? block.images : [])].filter(Boolean);
}

function appendCommonImages(basePath, values) {
  const block = getPath(basePath);
  if (!block) return;
  const merged = getCommonImages(basePath);
  values.map(v => String(v).trim()).filter(Boolean).forEach(value => {
    if (!merged.includes(value)) merged.push(value);
  });
  syncCommonImages(block, merged);
}

function removeCommonImage(basePath, index) {
  const block = getPath(basePath);
  if (!block) return;
  const merged = getCommonImages(basePath);
  merged.splice(index, 1);
  syncCommonImages(block, merged);
}

function syncCommonImages(block, values) {
  delete block.image;
  delete block.images;
  if (values[0]) block.image = values[0];
  if (values.length > 1) block.images = values.slice(1);
}

function renderImageChips(images, basePath) {
  if (!images.length) return `<div class="image-chip-list image-chip-list--empty">선택된 이미지가 없습니다.</div>`;
  return `
    <div class="image-chip-list">
      ${images.map((image, idx) => `
        <span class="image-chip">
          <span>${escapeHtml(image)}</span>
          <button class="image-chip__remove" type="button" data-action="remove-common-image" data-path="${basePath}" data-item="${idx}" title="이미지 제거" aria-label="이미지 제거">×</button>
        </span>
      `).join("")}
    </div>
  `;
}

function arrayEditor(title, path, kind) {
  const items = getPath(path) || [];
  return `
    <div class="array-card">
      <div class="array-card__head">
        <strong>${title}</strong>
        <button class="btn btn--sm" type="button" data-action="array-add" data-path="${path}" data-kind="${kind}">추가</button>
      </div>
      <div class="array-card__body row-list">
        ${items.length ? items.map((item, idx) => renderArrayItem(item, idx, path, kind)).join("") : `<p class="field__hint">항목을 추가하세요.</p>`}
      </div>
    </div>
  `;
}

function renderArrayItem(item, idx, path, kind) {
  const itemPath = `${path}.${idx}`;
  let body = "";
  if (kind === "prompt") {
    body = `
      <div class="form-grid">
        ${textareaField("q", "질문", `${itemPath}.q`)}
        ${textareaField("note", "힌트/보충", `${itemPath}.note`)}
        ${textareaField("answer", "답", `${itemPath}.answer`)}
      </div>
    `;
  } else if (kind === "quiz") {
    body = `
      <div class="form-grid">
        ${assetInput("image", "문제 이미지 키", `${itemPath}.image`)}
        ${textareaField("answer", "정답/해설", `${itemPath}.answerText`, "줄마다 항목을 적으면 배열로 저장됩니다.")}
      </div>
    `;
  } else if (kind === "childBlock") {
    body = `
      <details class="block-card" style="margin-top:0;" open>
        <summary class="block-card__head">
          <div class="block-card__type">
            <strong>하위 #${idx + 1}</strong>
            <select data-action="change-child-type" data-path="${itemPath}">
              ${BLOCK_TYPES.map(type => `<option value="${type}" ${item.type === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </div>
        </summary>
        <div class="block-card__body">
          ${renderFieldsForBlock(item, itemPath)}
        </div>
      </details>
    `;
  }
  return `
    <div class="row-item">
      <div>${body}</div>
      <div class="inline-tools">
        <button class="btn btn--sm" type="button" data-action="array-move" data-path="${path}" data-item="${idx}" data-dir="-1">위</button>
        <button class="btn btn--sm" type="button" data-action="array-move" data-path="${path}" data-item="${idx}" data-dir="1">아래</button>
        <button class="btn btn--sm btn--danger" type="button" data-action="array-delete" data-path="${path}" data-item="${idx}">삭제</button>
      </div>
    </div>
  `;
}

function assetArrayEditor(title, path, kind) {
  const items = getPath(path) || [];
  return `
    <div class="array-card">
      <div class="array-card__head">
        <strong>${title}</strong>
        <button class="btn btn--sm" type="button" data-action="array-add" data-path="${path}" data-kind="${kind}">추가</button>
      </div>
      <div class="array-card__body row-list">
        ${items.length ? items.map((_, idx) => `
          <div class="row-item">
            ${assetInput(`asset-${idx}`, `이미지 ${idx + 1}`, `${path}.${idx}`)}
            <div class="inline-tools">
              <button class="btn btn--sm" type="button" data-action="array-move" data-path="${path}" data-item="${idx}" data-dir="-1">위</button>
              <button class="btn btn--sm" type="button" data-action="array-move" data-path="${path}" data-item="${idx}" data-dir="1">아래</button>
              <button class="btn btn--sm btn--danger" type="button" data-action="array-delete" data-path="${path}" data-item="${idx}">삭제</button>
            </div>
          </div>
        `).join("") : `<p class="field__hint">필요하면 이미지를 추가하세요.</p>`}
      </div>
    </div>
  `;
}

function inputField(id, label, path, placeholder = "", hint = "") {
  return `
    <label class="field">
      <span class="field__label">${label}</span>
      <input id="${id}" data-path="${path}" value="${escapeAttr(readDisplayValue(path))}" placeholder="${escapeAttr(placeholder)}">
      ${hint ? `<span class="field__hint">${hint}</span>` : ""}
    </label>
  `;
}

function textareaField(id, label, path, hint = "") {
  return `
    <label class="field field--full">
      <span class="field__label">${label}</span>
      <textarea id="${id}" data-path="${path}" spellcheck="false">${escapeHtml(readDisplayValue(path))}</textarea>
      ${hint ? `<span class="field__hint">${hint}</span>` : ""}
    </label>
  `;
}

function listTextarea(id, label, path, hint = "한 줄에 하나씩 적습니다.") {
  return `
    <label class="field field--full">
      <span class="field__label">${label}</span>
      <textarea id="${id}" data-path="${path}" data-kind="list" spellcheck="false">${escapeHtml((getPath(path) || []).join("\n"))}</textarea>
      <span class="field__hint">${hint}</span>
    </label>
  `;
}

function assetListTextarea(id, label, path, hint = "한 줄에 하나씩 적습니다.") {
  return `
    <label class="field field--full">
      <span class="field__label">${label}</span>
      <span class="asset-list-field">
        <textarea id="${id}" data-path="${path}" data-kind="list" spellcheck="false">${escapeHtml((getPath(path) || []).join("\n"))}</textarea>
        <button class="btn btn--sm" type="button" data-action="pick-assets" data-path="${path}">여러 키 찾기</button>
      </span>
      <span class="field__hint">${hint}</span>
    </label>
  `;
}

function selectField(id, label, path, options) {
  const value = getPath(path) ?? "";
  return `
    <label class="field">
      <span class="field__label">${label}</span>
      <select id="${id}" data-path="${path}">
        ${options.map(([key, text]) => `<option value="${escapeAttr(key)}" ${value === key ? "selected" : ""}>${text}</option>`).join("")}
      </select>
    </label>
  `;
}

function checkboxField(id, label, path) {
  return `
    <label class="check-field">
      <input id="${id}" type="checkbox" data-path="${path}" ${getPath(path) ? "checked" : ""}>
      ${label}
    </label>
  `;
}

function assetInput(id, label, path) {
  return `
    <label class="field">
      <span class="field__label">${label}</span>
      <span class="asset-field">
        <input id="${id}" data-path="${path}" value="${escapeAttr(readDisplayValue(path))}" placeholder="키, 파일명, 이미지 URL">
        <button class="btn btn--sm" type="button" data-action="pick-asset" data-path="${path}">키 찾기</button>
      </span>
    </label>
  `;
}

function writeField(target) {
  const path = target.dataset.path;
  if (target.type === "checkbox") {
    setPath(path, target.checked);
  } else if (target.dataset.kind === "list") {
    setPath(path, target.value.split("\n").map(line => line.trim()).filter(Boolean));
  } else if (path.endsWith(".answerText")) {
    const answerPath = path.replace(/\.answerText$/, ".answer");
    setPath(answerPath, normalizeAnswer(target.value));
  } else if (path.endsWith(".__commonImageInput")) {
    const value = target.value.trim();
    const basePath = path.replace(/\.__commonImageInput$/, "");
    if (value) {
      appendCommonImages(basePath, [value]);
      target.value = "";
      renderEditor();
    }
  } else {
    setPath(path, target.value);
  }
}

function readDisplayValue(path) {
  if (path.endsWith(".answerText")) {
    const answer = getPath(path.replace(/\.answerText$/, ".answer"));
    return Array.isArray(answer) ? answer.join("\n") : answer || "";
  }
  return getPath(path) ?? "";
}

function normalizeAnswer(value) {
  const lines = value.split("\n").map(line => line.trim()).filter(Boolean);
  if (lines.length <= 1) return lines[0] || "";
  return lines;
}

function refreshOutputs() {
  const json = JSON.stringify(cleanLesson({ includeComments: true }), null, 2);
  document.getElementById("json-output").value = json;
  renderPreview();
}

function renderPreview() {
  const main = document.getElementById("main-content");
  const errors = document.getElementById("preview-errors");
  main.innerHTML = "";
  errors.innerHTML = "";

  const lesson = structuredClone(state.lesson);
  stripComments(lesson);
  lesson.assets = state.assetMap;
  app.lesson = lesson;

  const sections = state.showAllPreview ? lesson.sections : [lesson.sections[state.currentSection] || lesson.sections[0]];
  sections.forEach((sec, secOffset) => {
    if (!sec) return;
    app.currentIdx = state.showAllPreview ? secOffset : state.currentSection;
    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `
      <div class="section-header__id">${escapeHtml(sec.id)} · ${escapeHtml(lesson.title || "수업 제목")}</div>
      <h1 class="section-header__title">${escapeHtml(sec.title || "섹션 제목")}</h1>
    `;
    main.appendChild(header);

    (sec.blocks || []).forEach((block, idx) => {
      try {
        const el = renderBlock(block, idx);
        if (el) main.appendChild(el);
        if (sec.blocks[idx + 1] && block.type !== "소제목") main.appendChild(renderDivider());
      } catch (err) {
        const div = document.createElement("div");
        div.className = "preview-error";
        div.textContent = `${block.type || "알 수 없는 블록"} 렌더링 오류: ${err.message}`;
        errors.appendChild(div);
      }
    });
  });
}

function cleanLesson({ includeComments }) {
  const lesson = {
    id: state.lesson.id,
    title: state.lesson.title,
    subtitle: state.lesson.subtitle,
    imageBase: state.lesson.imageBase,
    prev: state.lesson.prev,
    next: state.lesson.next,
    sections: state.lesson.sections.map(section => ({
      id: section.id,
      title: section.title,
      blocks: section.blocks.map(block => cleanBlock(block, includeComments)).filter(Boolean),
    })),
  };
  return pruneEmpty(lesson);
}

function cleanBlock(block, includeComments) {
  const copy = structuredClone(block);
  if (!includeComments) stripComments(copy);
  if (copy.type === "미디어") {
    if (copy.kind !== "image") delete copy.src;
    if (copy.kind !== "video") delete copy.url;
    if (copy.kind !== "row") delete copy.images;
    if (copy.kind !== "text") {
      delete copy.headline;
      delete copy.source;
      if (copy.kind !== "image" && copy.kind !== "video") delete copy.caption;
      if (copy.kind !== "text") delete copy.body;
    }
  }
  return pruneEmpty(copy);
}

function stripComments(value) {
  if (!value || typeof value !== "object") return;
  delete value.comments;
  Object.values(value).forEach(child => {
    if (Array.isArray(child)) child.forEach(stripComments);
    else stripComments(child);
  });
}

function pruneEmpty(value) {
  if (Array.isArray(value)) {
    return value.map(pruneEmpty).filter(item => {
      if (item == null) return false;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object") return Object.keys(item).length > 0;
      return item !== "";
    });
  }
  if (!value || typeof value !== "object") return value;
  const out = {};
  Object.entries(value).forEach(([key, child]) => {
    const pruned = pruneEmpty(child);
    if (pruned === "" || pruned == null || pruned === false) return;
    if (Array.isArray(pruned) && pruned.length === 0) return;
    if (typeof pruned === "object" && !Array.isArray(pruned) && Object.keys(pruned).length === 0) return;
    out[key] = pruned;
  });
  return out;
}

async function loadAssetIndex() {
  const results = await Promise.allSettled(
    SHEET_URLS.map(url => fetch(url, { cache: "no-store" }).then(res => res.text()))
  );
  const rows = [];
  const map = {};
  results.forEach(result => {
    if (result.status !== "fulfilled") return;
    parseCSV(result.value).forEach((columns, idx) => {
      if (idx === 0 || columns.length < 2) return;
      const key = (columns[0] || "").trim();
      const url = (columns[1] || "").trim();
      const keywords = (columns[2] || "").split(",").map(v => v.trim()).filter(Boolean);
      const reason = normalizeSheetText(columns[4] || "");
      if (!key || !url || key === "JSON 상 호칭" || key === "JSON 코드") return;
      map[key] = url;
      rows.push({ key, url, keywords, reason });
    });
  });
  state.assets = rows;
  state.assetMap = map;
  renderAssetResults();
  refreshOutputs();
}

function openAssetSearch(mode = "single") {
  state.assetMode = mode;
  state.assetSelection = new Set();
  document.getElementById("asset-search").classList.add("is-open");
  document.getElementById("asset-query").focus();
  renderAssetResults();
}

function closeAssetSearch() {
  document.getElementById("asset-search").classList.remove("is-open");
  state.assetTarget = null;
  state.assetMode = "single";
  state.assetSelection.clear();
}

function renderAssetResults() {
  const box = document.getElementById("asset-results");
  const bar = document.getElementById("asset-search-bar");
  if (!box) return;
  if (bar) {
    bar.innerHTML = state.assetMode === "multi"
      ? `<span>${state.assetSelection.size}개 선택됨</span><button class="btn btn--sm btn--primary" type="button" data-action="apply-assets">선택 추가</button>`
      : `<span>키를 선택하면 현재 입력칸에 바로 들어갑니다.</span>`;
  }
  const query = (document.getElementById("asset-query")?.value || "").toLowerCase().trim();
  const rows = state.assets
    .filter(row => !query || [row.key, row.reason, ...row.keywords].join(" ").toLowerCase().includes(query))
    .slice(0, 80);
  if (!state.assets.length) {
    box.innerHTML = `<p class="field__hint">외부자료 목록을 불러오는 중입니다.</p>`;
    return;
  }
  if (!rows.length) {
    box.innerHTML = `<p class="field__hint">검색 결과가 없습니다.</p>`;
    return;
  }
  box.innerHTML = rows.map(row => `
    <button class="asset-result ${state.assetSelection.has(row.key) ? "is-selected" : ""}" type="button" data-action="choose-asset" data-key="${escapeAttr(row.key)}">
      <span class="asset-result__thumb">${renderAssetThumb(row)}</span>
      <span class="asset-result__content">
        <span class="asset-result__key">${escapeHtml(row.key)}</span>
        <span class="asset-result__meta">${escapeHtml(row.reason || row.keywords.join(", ") || "설명 없음")}</span>
      </span>
    </button>
  `).join("");
}

function normalizeSheetText(value) {
  return String(value).replace(/\\n/g, "\n").trim();
}

function renderAssetThumb(row) {
  const src = getPreviewImageUrl(row.url);
  if (!src) return `<span class="asset-result__placeholder">자료</span>`;
  return `<img src="${escapeAttr(src)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'asset-result__placeholder', textContent: '자료' }))">`;
}

function getPreviewImageUrl(url) {
  if (!url) return "";
  const videoId = extractYoutubeId(url);
  if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  if (url.includes("drive.google.com")) {
    const match = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
    if (match?.[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url)) return url;
  if (/^https?:\/\/[^ ]+$/i.test(url)) return url;
  return "";
}

function extractYoutubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("v")) return parsed.searchParams.get("v");
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    const match = parsed.pathname.match(/^\/embed\/([^/?]+)/);
    if (match) return match[1];
  } catch {}
  return "";
}

function toggleAssetSelection(key) {
  if (state.assetSelection.has(key)) state.assetSelection.delete(key);
  else state.assetSelection.add(key);
  renderAssetResults();
}

function applyAssetSelection() {
  if (!state.assetTarget) return;
  if (state.assetTarget.endsWith(".__commonImages")) {
    const basePath = state.assetTarget.replace(/\.__commonImages$/, "");
    const count = state.assetSelection.size;
    appendCommonImages(basePath, [...state.assetSelection]);
    closeAssetSearch();
    renderEditor();
    refreshOutputs();
    toast(`${count}개 키를 추가했습니다.`);
    return;
  }
  const current = Array.isArray(getPath(state.assetTarget)) ? getPath(state.assetTarget) : [];
  const merged = [...current];
  const count = state.assetSelection.size;
  state.assetSelection.forEach(key => {
    if (!merged.includes(key)) merged.push(key);
  });
  setPath(state.assetTarget, merged);
  closeAssetSearch();
  renderEditor();
  refreshOutputs();
  toast(`${count}개 키를 추가했습니다.`);
}

function copyJson() {
  const value = document.getElementById("json-output").value;
  navigator.clipboard?.writeText(value)
    .then(() => toast("JSON을 복사했습니다."))
    .catch(() => {
      document.getElementById("json-output").select();
      document.execCommand("copy");
      toast("JSON을 복사했습니다.");
    });
}

function downloadJson() {
  const json = document.getElementById("json-output").value;
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.lesson.id || "lesson"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function saveLocalDraft() {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      lesson: state.lesson,
    }));
  } catch (err) {
    console.warn("작업 저장 실패:", err);
  }
}

function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lesson = parsed.lesson || null;
    if (!isValidLessonDraft(lesson)) {
      localStorage.removeItem(LOCAL_CACHE_KEY);
      return null;
    }
    return normalizeLessonDraft(lesson);
  } catch {
    try {
      localStorage.removeItem(LOCAL_CACHE_KEY);
    } catch {}
    return null;
  }
}

function isValidLessonDraft(lesson) {
  return Boolean(
    lesson &&
    typeof lesson === "object" &&
    Array.isArray(lesson.sections)
  );
}

function normalizeLessonDraft(lesson) {
  const normalized = {
    ...createBlankLesson(),
    ...lesson,
    sections: lesson.sections.length ? lesson.sections : [createSection(1)],
  };
  normalized.sections = normalized.sections.map((section, idx) => ({
    id: section?.id || `section-${idx + 1}`,
    title: section?.title || "새 섹션",
    blocks: Array.isArray(section?.blocks) ? section.blocks : [],
  }));
  return normalized;
}

function createBlankLesson() {
  return {
    id: "new-lesson",
    title: "새 수업",
    subtitle: "",
    imageBase: "assets/images/",
    prev: "",
    next: "",
    sections: [createSection(1)],
  };
}

function createSampleLesson() {
  return {
    id: "sample-lesson",
    title: "샘플 수업",
    subtitle: "폼으로 작성한 수업 예시",
    imageBase: "assets/images/",
    prev: "",
    next: "",
    sections: [
      {
        id: "1-1",
        title: "첫 번째 섹션",
        blocks: [
          { type: "단락", text: "본문은 이곳에 입력합니다. **굵게**와 줄바꿈을 사용할 수 있습니다." },
          { type: "발문", prompts: [{ q: "학생들에게 던질 질문을 적어보세요.", note: "", answer: "" }], comments: true },
          { type: "개념", title: "핵심 개념", body: "개념 설명을 적습니다.", bullets: ["중요한 항목 1", "중요한 항목 2"] },
        ],
      },
    ],
  };
}

function createSection(number) {
  return {
    id: `section-${number}`,
    title: "새 섹션",
    blocks: [createBlock("단락")],
  };
}

function createBlock(type) {
  switch (type) {
    case "단락":
    case "소제목":
      return { type, text: "" };
    case "구분선":
      return { type };
    case "사례":
      return { type, title: "사례", body: "", footer: "", answer: "", comments: false };
    case "발문":
      return { type, prompts: [{ q: "", note: "", answer: "" }], conclusion: "", comments: false, imagePair: [] };
    case "개념":
      return { type, title: "", body: "", bullets: [], footer: "" };
    case "이미지곁글":
      return { type, kind: "concept", image: "", caption: "", title: "", body: "", note: "" };
    case "미디어":
      return { type, kind: "image", src: "", url: "", caption: "", images: [], headline: "", body: "", source: "" };
    case "기출문제":
      return { type, items: [{ image: "", answer: "" }] };
    case "접이식":
      return { type, summary: "클릭해서 펼치기", children: [createBlock("단락")] };
    case "요약":
      return { type, items: [] };
    default:
      return { type: "단락", text: "" };
  }
}

function createArrayItem(kind) {
  if (kind === "prompt") return { q: "", note: "", answer: "" };
  if (kind === "quiz") return { image: "", answer: "" };
  if (kind === "childBlock") return createBlock("단락");
  return "";
}

function getPath(path) {
  const parts = normalizePath(path);
  let current = windowProxyRoot();
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setPath(path, value) {
  const parts = normalizePath(path);
  let current = windowProxyRoot();
  parts.slice(0, -1).forEach(part => {
    if (current[part] == null) current[part] = {};
    current = current[part];
  });
  current[parts.at(-1)] = value;
}

function normalizePath(path) {
  return path.replace(/^lesson\./, "").split(".").map(part => /^\d+$/.test(part) ? Number(part) : part);
}

function windowProxyRoot() {
  return state.lesson;
}

function moveItem(list, index, dir) {
  const next = index + dir;
  if (!Array.isArray(list) || next < 0 || next >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
}

function clearBlockDropIndicators() {
  root.querySelectorAll(".block-card.is-drop-before, .block-card.is-drop-after, .section-card__blocks.is-drop-empty").forEach(el => {
    el.classList.remove("is-drop-before", "is-drop-after");
    el.classList.remove("is-drop-empty");
  });
}

function getBlockDropTarget(event, blockList) {
  const cards = [...blockList.querySelectorAll(".block-card[data-block]:not(.is-dragging)")];
  if (!cards.length) return { card: null, position: "after" };
  const insertIdx = getBlockInsertIndex(event, blockList);
  if (insertIdx <= 0) return { card: cards[0], position: "before" };
  if (insertIdx >= cards.length) return { card: cards[cards.length - 1], position: "after" };
  return { card: cards[insertIdx], position: "before" };
}

function getBlockInsertIndex(event, blockList) {
  const cards = [...blockList.querySelectorAll(".block-card[data-block]:not(.is-dragging)")];
  const afterCard = cards.find(card => {
    const rect = card.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  if (!afterCard) return cards.length;
  return Number(afterCard.dataset.block);
}

function moveBlockTo(sectionIdx, fromIdx, insertIdx) {
  const blocks = state.lesson.sections[sectionIdx]?.blocks;
  if (!Array.isArray(blocks) || fromIdx < 0 || fromIdx >= blocks.length) return;
  insertIdx = Math.max(0, Math.min(insertIdx, blocks.length));
  if (fromIdx < insertIdx) insertIdx -= 1;
  if (fromIdx === insertIdx) return;
  const [item] = blocks.splice(fromIdx, 1);
  blocks.splice(insertIdx, 0, item);
}

function getDetailState(item, prefix) {
  const id = getUiId(item, prefix);
  if (!state.openDetails.has(id)) state.openDetails.set(id, true);
  return { id, open: state.openDetails.get(id) };
}

function getUiId(item, prefix) {
  if (!item || typeof item !== "object") return `${prefix}-unknown`;
  if (!uiIds.has(item)) uiIds.set(item, `${prefix}-${nextUiId++}`);
  return uiIds.get(item);
}

function uniqueSectionId(base) {
  const ids = new Set(state.lesson.sections.map(section => section.id));
  let i = 2;
  let next = `${base}-${i}`;
  while (ids.has(next)) {
    i += 1;
    next = `${base}-${i}`;
  }
  return next;
}

function numberOrNull(value) {
  return value == null ? null : Number(value);
}

function escapeAttr(value) {
  return escapeHtml(String(value ?? ""));
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
