"use strict";

(() => {
  const STORAGE_KEY = "oneul-roulette-options";
  const TAU = Math.PI * 2;
  const COLORS = [
    "#dcebd9",
    "#f4dfc6",
    "#d9e8eb",
    "#f2d8d4",
    "#e6def0",
    "#f0e8c9",
    "#cfe4d9",
    "#f0dce9",
    "#dce2f0",
    "#e8e1d1",
  ];
  const TEXT_COLORS = ["#355644", "#735638", "#365961", "#7a4d48", "#5d4d76"];

  const form = document.querySelector("#option-form");
  const input = document.querySelector("#option-input");
  const addButton = form.querySelector("button");
  const optionList = document.querySelector("#option-list");
  const optionCount = document.querySelector("#option-count");
  const emptyMessage = document.querySelector("#empty-message");
  const clearButton = document.querySelector("#clear-button");
  const spinButton = document.querySelector("#spin-button");
  const wheelHint = document.querySelector("#wheel-hint");
  const resultMessage = document.querySelector("#result-message");
  const storageNote = document.querySelector("#storage-note");
  const canvas = document.querySelector("#wheel-canvas");
  const context = canvas.getContext("2d");
  const toast = document.querySelector("#toast");

  let options = loadOptions();
  let rotation = 0;
  let isSpinning = false;
  let toastTimer;

  function loadOptions() {
    try {
      const storedOptions = window.localStorage.getItem(STORAGE_KEY);
      if (!storedOptions) return [];

      const parsed = JSON.parse(storedOptions);
      if (!Array.isArray(parsed)) {
        storageNote.textContent = "저장된 후보 형식이 올바르지 않아 새 목록으로 시작했어요.";
        return [];
      }

      return parsed.filter(
        (option) => typeof option === "string" && option.trim().length > 0,
      );
    } catch {
      storageNote.textContent = "저장된 후보를 불러오지 못했어요. 현재 목록은 저장되지 않을 수 있어요.";
      return [];
    }
  }

  function saveOptions() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
      storageNote.textContent = "후보 목록은 이 브라우저에 자동 저장돼요.";
    } catch {
      storageNote.textContent = "브라우저 저장 공간을 사용할 수 없어 새로고침하면 후보가 사라질 수 있어요.";
    }
  }

  function colorFor(index) {
    return COLORS[index % COLORS.length];
  }

  function drawWheel() {
    const width = canvas.width;
    const center = width / 2;
    const radius = center - 8;
    const count = options.length;

    context.clearRect(0, 0, width, width);
    context.save();
    context.translate(center, center);

    if (count === 0) {
      context.beginPath();
      context.arc(0, 0, radius, 0, TAU);
      context.fillStyle = "#edf2ed";
      context.fill();
      context.setLineDash([5, 8]);
      context.lineWidth = 2;
      context.strokeStyle = "#c9d6cc";
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#82958a";
      context.font = '600 22px "Noto Sans KR", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("후보를 추가해 주세요", 0, 3);
      context.restore();
      return;
    }

    const slice = TAU / count;
    for (let index = 0; index < count; index += 1) {
      const start = -Math.PI / 2 + rotation + index * slice;
      const end = start + slice;

      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, start, end);
      context.closePath();
      context.fillStyle = colorFor(index);
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = "#fff";
      context.stroke();

      const middle = start + slice / 2;
      context.save();
      context.rotate(middle);
      context.translate(radius * 0.62, 0);
      if (Math.cos(middle) < 0) context.rotate(Math.PI);
      context.fillStyle = TEXT_COLORS[index % TEXT_COLORS.length];
      context.textAlign = "center";
      context.textBaseline = "middle";
      const maxTextWidth = Math.max(48, radius * Math.min(0.75, slice * 0.8));
      const fontSize = Math.max(13, Math.min(22, 15 + (count <= 4 ? 2 : 0)));
      context.font = `700 ${fontSize}px "Noto Sans KR", sans-serif`;
      context.fillText(options[index], 0, 0, maxTextWidth);
      context.restore();
    }

    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.lineWidth = 5;
    context.strokeStyle = "#fff";
    context.stroke();
    context.restore();
  }

  function updateInterface() {
    optionList.replaceChildren();
    options.forEach((option, index) => {
      const row = document.createElement("li");
      row.className = "option-row";

      const dot = document.createElement("span");
      dot.className = "option-dot";
      dot.style.backgroundColor = colorFor(index);
      dot.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "option-name";
      name.textContent = option;

      const removeButton = document.createElement("button");
      removeButton.className = "remove-button";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.disabled = isSpinning;
      removeButton.setAttribute("aria-label", `${option} 후보 삭제`);
      removeButton.addEventListener("click", () => removeOption(index));

      row.append(dot, name, removeButton);
      optionList.append(row);
    });

    optionCount.textContent = `${options.length}개`;
    input.disabled = isSpinning;
    addButton.disabled = isSpinning;
    emptyMessage.hidden = options.length > 0;
    clearButton.disabled = options.length === 0 || isSpinning;
    spinButton.disabled = options.length < 2 || isSpinning;
    wheelHint.textContent =
      options.length < 2
        ? "후보를 2개 이상 추가하면 돌릴 수 있어요."
        : isSpinning
          ? "두근두근, 결과를 기다려 주세요!"
          : "버튼을 눌러 오늘의 선택을 확인해 보세요.";
    drawWheel();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2400);
  }

  function addOption(value) {
    if (isSpinning) return;
    const option = value.trim();
    if (!option) {
      showToast("후보 내용을 입력해 주세요.");
      input.focus();
      return;
    }

    if (
      options.some((existingOption) => existingOption.toLocaleLowerCase() === option.toLocaleLowerCase())
    ) {
      showToast("이미 목록에 있는 후보예요.");
      input.focus();
      return;
    }

    options.push(option);
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    saveOptions();
    updateInterface();
    input.value = "";
    input.focus();
  }

  function removeOption(index) {
    if (isSpinning) return;
    options.splice(index, 1);
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    saveOptions();
    updateInterface();
  }

  function randomIndex(length) {
    if (window.crypto && window.crypto.getRandomValues) {
      const randomValues = new Uint32Array(1);
      const range = 0x100000000;
      const limit = range - (range % length);
      let value;
      do {
        window.crypto.getRandomValues(randomValues);
        value = randomValues[0];
      } while (value >= limit);
      return value % length;
    }

    return Math.floor(Math.random() * length);
  }

  function normalizeAngle(angle) {
    return ((angle % TAU) + TAU) % TAU;
  }

  function spinWheel() {
    if (isSpinning || options.length < 2) return;

    const winnerIndex = randomIndex(options.length);
    const slice = TAU / options.length;
    const desiredRotation = normalizeAngle(-(winnerIndex + 0.5) * slice);
    const currentRotation = normalizeAngle(rotation);
    const alignment = normalizeAngle(desiredRotation - currentRotation);
    const duration = 4600;
    const fullTurns = 5 + randomIndex(3);
    const startRotation = rotation;
    const targetRotation = rotation + fullTurns * TAU + alignment;
    const startTime = performance.now();

    isSpinning = true;
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    updateInterface();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      rotation = startRotation + (targetRotation - startRotation) * easedProgress;
      drawWheel();

      if (progress < 1) {
        window.requestAnimationFrame(animate);
        return;
      }

      rotation = normalizeAngle(targetRotation);
      isSpinning = false;
      resultMessage.textContent = `오늘의 선택은 ${options[winnerIndex]}!`;
      resultMessage.classList.remove("is-result");
      void resultMessage.offsetWidth;
      resultMessage.classList.add("is-result");
      updateInterface();
    }

    window.requestAnimationFrame(animate);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addOption(input.value);
  });

  clearButton.addEventListener("click", () => {
    if (isSpinning || options.length === 0) return;
    options = [];
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    saveOptions();
    updateInterface();
  });

  spinButton.addEventListener("click", spinWheel);

  updateInterface();
})();
