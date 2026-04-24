import { app } from "../state.js";
import { db, ref, get, set } from "../firebase-config.js";
import { toFbKey } from "../utils.js";

/**
 * 게이트 화면 — 학생
 */
export function showStudentGate(onEnter) {
  document.body.innerHTML = "";
  const gate = buildGateShell("학생 입장", "선생님이 알려준 수업 코드를 입력하세요");

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "예) 잠원중3반";
  input.className = "gate__input";
  input.autofocus = true;

  const btn = document.createElement("button");
  btn.className = "gate__btn";
  btn.textContent = "입장하기 →";

  const err = document.createElement("div");
  err.className = "gate__error";

  const enter = async () => {
    const code = input.value.trim();
    if (!code) { showGateError(err, "수업 코드를 입력해주세요."); return; }
    btn.disabled = true;
    btn.textContent = "확인 중…";
    onEnter(code);
  };

  btn.addEventListener("click", enter);
  input.addEventListener("keydown", e => { if (e.key === "Enter") enter(); });

  gate.form.appendChild(input);
  gate.form.appendChild(err);
  gate.form.appendChild(btn);
  document.body.appendChild(gate.el);
  input.focus();
}

/**
 * 게이트 화면 — 교사
 */
export function showTeacherGate(onEnter) {
  document.body.innerHTML = "";
  const gate = buildGateShell("교사 모드", "수업 코드를 만들거나 기존 코드로 입장하세요");

  // 새 수업 코드 생성 섹션
  const createLabel = document.createElement("div");
  createLabel.className = "gate__section-label";
  createLabel.textContent = "새 수업 코드 만들기";

  const createInput = document.createElement("input");
  createInput.type = "text";
  createInput.placeholder = "예) 잠원중3반";
  createInput.className = "gate__input";

  const createBtn = document.createElement("button");
  createBtn.className = "gate__btn";
  createBtn.textContent = "코드 생성 →";

  const createErr = document.createElement("div");
  createErr.className = "gate__error";

  createBtn.addEventListener("click", async () => {
    const code = createInput.value.trim();
    if (!code) { showGateError(createErr, "코드를 입력해주세요."); return; }

    createBtn.disabled = true;
    createBtn.textContent = "확인 중…";

    const snap = await get(ref(db, `sessions/${toFbKey(code)}`));
    if (snap.exists()) {
      createBtn.disabled = false;
      createBtn.textContent = "코드 생성 →";
      showGateError(createErr, "이미 사용 중인 코드입니다. 다른 코드를 입력해주세요.");
      return;
    }

    await set(ref(db, `sessions/${toFbKey(code)}`), {
      code,
      createdAt: new Date().toISOString(),
    });

    onEnter(code);
  });

  // 기존 코드로 입장 섹션
  const joinLabel = document.createElement("div");
  joinLabel.className = "gate__section-label gate__section-label--secondary";
  joinLabel.textContent = "기존 코드로 입장";

  const joinInput = document.createElement("input");
  joinInput.type = "text";
  joinInput.placeholder = "기존 수업 코드";
  joinInput.className = "gate__input gate__input--secondary";

  const joinBtn = document.createElement("button");
  joinBtn.className = "gate__btn gate__btn--secondary";
  joinBtn.textContent = "입장하기 →";

  const joinErr = document.createElement("div");
  joinErr.className = "gate__error";

  const joinEnter = async () => {
    const code = joinInput.value.trim();
    if (!code) { showGateError(joinErr, "코드를 입력해주세요."); return; }
    joinBtn.disabled = true;
    joinBtn.textContent = "확인 중…";
    const snap = await get(ref(db, `sessions/${toFbKey(code)}`));
    if (!snap.exists()) {
      joinBtn.disabled = false;
      joinBtn.textContent = "입장하기 →";
      showGateError(joinErr, "존재하지 않는 코드입니다.");
      return;
    }
    onEnter(code);
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
  logo.className = "gate__logo";
  logo.textContent = "🎓";

  const h1 = document.createElement("h1");
  h1.className = "gate__title";
  h1.textContent = title;

  const sub = document.createElement("p");
  sub.className = "gate__subtitle";
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
