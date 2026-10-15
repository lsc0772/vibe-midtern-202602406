"use strict";

(() => {
  const STORAGE_KEY = "oneul-roulette-options";
  const TAU = Math.PI * 2;
  const SPIN_SPEED = TAU / 450;
  const MAX_WEIGHT = 1000;
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
  const DARK_COLORS = [
    "#526f5c",
    "#81664a",
    "#4f7180",
    "#805954",
    "#6d5d82",
    "#786e43",
    "#477464",
    "#815b73",
    "#586b8a",
    "#6c6554",
  ];
  const DARK_TEXT_COLORS = ["#f1f7f2", "#fff2df", "#edf8fa", "#ffefeb", "#f5eeff"];

  const form = document.querySelector("#option-form");
  const input = document.querySelector("#option-input");
  const addButton = form.querySelector("button");
  const optionList = document.querySelector("#option-list");
  const optionCount = document.querySelector("#option-count");
  const emptyMessage = document.querySelector("#empty-message");
  const clearButton = document.querySelector("#clear-button");
  const spinButton = document.querySelector("#spin-button");
  const spinButtonIcon = document.querySelector("#spin-button-icon");
  const spinButtonLabel = document.querySelector("#spin-button-label");
  const wheelHint = document.querySelector("#wheel-hint");
  const resultMessage = document.querySelector("#result-message");
  const storageNote = document.querySelector("#storage-note");
  const themeToggle = document.querySelector("#theme-toggle");
  const themeIcon = document.querySelector("#theme-icon");
  const themeLabel = document.querySelector("#theme-label");
  const viewModeButtons = document.querySelectorAll(".view-mode-button");
  const pointerOption = document.querySelector("#pointer-option");
  const wheelResultOverlay = document.querySelector("#wheel-result-overlay");
  const wheelResultName = document.querySelector("#wheel-result-name");
  const canvas = document.querySelector("#wheel-canvas");
  const context = canvas.getContext("2d");
  const toast = document.querySelector("#toast");

  let options = loadOptions();
  let rotation = 0;
  let spinState = "idle";
  let lastFrameTime = 0;
  let toastTimer;
  let resultOverlayTimer;
  let resultOverlayHideTimer;

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    drawWheel();
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute(
      "aria-label",
      isDark ? "라이트 모드로 전환" : "다크 모드로 전환",
    );
    themeIcon.textContent = isDark ? "☀" : "☾";
    themeLabel.textContent = isDark ? "라이트 모드" : "다크 모드";
  }

  function loadTheme() {
    try {
      return window.localStorage.getItem("todays-meal-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  }

  function applyViewMode(mode) {
    const selectedMode = mode === "mobile" ? "mobile" : "desktop";
    document.querySelector(".app-shell").dataset.viewMode = selectedMode;
    viewModeButtons.forEach((button) => {
      const isSelected = button.dataset.viewMode === selectedMode;
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  function loadViewMode() {
    try {
      const savedMode = window.localStorage.getItem("todays-meal-view-mode");
      if (savedMode === "mobile" || savedMode === "desktop") return savedMode;
    } catch {
      return window.matchMedia("(max-width: 800px)").matches ? "mobile" : "desktop";
    }
    return window.matchMedia("(max-width: 800px)").matches ? "mobile" : "desktop";
  }

  function loadOptions() {
    try {
      const storedOptions = window.localStorage.getItem(STORAGE_KEY);
      if (!storedOptions) return [];

      const parsed = JSON.parse(storedOptions);
      if (!Array.isArray(parsed)) {
        storageNote.textContent = "저장된 후보 형식이 올바르지 않아 새 목록으로 시작했어요.";
        return [];
      }

      return parsed.flatMap((option) => {
        if (typeof option === "string" && option.trim()) {
          return [{ name: option.trim(), weight: 1 }];
        }
        if (
          option &&
          typeof option.name === "string" &&
          option.name.trim()
        ) {
          const weight =
            Number.isInteger(option.weight) && option.weight >= 1
              ? Math.min(option.weight, MAX_WEIGHT)
              : 1;
          return [{ name: option.name.trim(), weight }];
        }
        return [];
      });
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
    const palette =
      document.documentElement.dataset.theme === "dark" ? DARK_COLORS : COLORS;
    return palette[index % palette.length];
  }

  function canvasColor(variable) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  }

  function totalWeight() {
    return options.reduce((total, option) => total + option.weight, 0);
  }

  function formatProbability(weight) {
    const percentage = (weight / totalWeight()) * 100;
    if (percentage > 0 && percentage < 0.01) return "<0.01%";
    return `${new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 2,
    }).format(percentage)}%`;
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
      context.fillStyle = canvasColor("--wheel-empty");
      context.fill();
      context.setLineDash([5, 8]);
      context.lineWidth = 2;
      context.strokeStyle = canvasColor("--wheel-empty-border");
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = canvasColor("--wheel-empty-text");
      context.font = '600 22px "Noto Sans KR", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("후보를 추가해 주세요", 0, 3);
      context.restore();
      updatePointerOption();
      return;
    }

    const weightSum = totalWeight();
    let cumulativeWeight = 0;
    for (let index = 0; index < count; index += 1) {
      const option = options[index];
      const slice = (option.weight / weightSum) * TAU;
      const start = -Math.PI / 2 + rotation + (cumulativeWeight / weightSum) * TAU;
      const end = start + slice;

      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, start, end);
      context.closePath();
      context.fillStyle = colorFor(index);
      context.fill();
      context.lineWidth = Math.max(0.5, Math.min(3, radius * slice * 0.12));
      context.strokeStyle =
        document.documentElement.dataset.theme === "dark" ? "#202c24" : "#fff";
      context.stroke();

      if (slice >= 0.035) {
        const middle = start + slice / 2;
        context.save();
        context.rotate(middle);
        context.translate(radius * 0.62, 0);
        if (Math.cos(middle) < 0) context.rotate(Math.PI);
        const textPalette =
          document.documentElement.dataset.theme === "dark"
            ? DARK_TEXT_COLORS
            : TEXT_COLORS;
        context.fillStyle = textPalette[index % textPalette.length];
        context.textAlign = "center";
        context.textBaseline = "middle";
        const maxTextWidth = Math.max(24, radius * 0.72);
        const baselineSlice = TAU / 4;
        const fontSize = Math.max(
          8,
          Math.min(30, 28 * Math.sqrt(slice / baselineSlice)),
        );
        context.font = `700 ${fontSize}px "Noto Sans KR", sans-serif`;
        context.fillText(option.name, 0, 0, maxTextWidth);
        context.restore();
      }
      cumulativeWeight += option.weight;
    }

    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.lineWidth = 5;
    context.strokeStyle =
      document.documentElement.dataset.theme === "dark" ? "#202c24" : "#fff";
    context.stroke();
    context.restore();
    updatePointerOption();
  }

  function updatePointerOption() {
    if (options.length === 0) {
      pointerOption.textContent = "후보 대기 중";
      return;
    }

    const position = (normalizeAngle(-rotation) / TAU) * totalWeight();
    let cumulativeWeight = 0;
    for (const option of options) {
      cumulativeWeight += option.weight;
      if (position < cumulativeWeight) {
        pointerOption.textContent = option.name;
        return;
      }
    }
    pointerOption.textContent = options[options.length - 1].name;
  }

  function updateInterface() {
    const isActive = spinState !== "idle";
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
      name.textContent = option.name;

      const settings = document.createElement("span");
      settings.className = "option-settings";

      const weightLabel = document.createElement("label");
      weightLabel.className = "weight-control";
      weightLabel.textContent = "비율";

      const weightInput = document.createElement("input");
      weightInput.className = "weight-input";
      weightInput.type = "number";
      weightInput.min = "1";
      weightInput.max = String(MAX_WEIGHT);
      weightInput.step = "1";
      weightInput.value = String(option.weight);
      weightInput.disabled = isActive;
      weightInput.setAttribute("aria-label", `${option.name} 당첨 비율`);
      weightInput.addEventListener("change", () => {
        const newWeight = Number(weightInput.value);
        if (!Number.isInteger(newWeight) || newWeight < 1 || newWeight > MAX_WEIGHT) {
          showToast(`비율은 1부터 ${MAX_WEIGHT}까지 입력해 주세요.`);
          updateInterface();
          return;
        }
        option.weight = newWeight;
        resultMessage.textContent = "";
        resultMessage.classList.remove("is-result");
        saveOptions();
        updateInterface();
      });
      weightLabel.append(weightInput);

      const probability = document.createElement("span");
      probability.className = "probability";
      probability.textContent = formatProbability(option.weight);
      probability.setAttribute(
        "aria-label",
        `${option.name} 당첨 확률 ${probability.textContent}`,
      );
      settings.append(weightLabel, probability);

      const removeButton = document.createElement("button");
      removeButton.className = "remove-button";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.disabled = isActive;
      removeButton.setAttribute("aria-label", `${option.name} 후보 삭제`);
      removeButton.addEventListener("click", () => removeOption(index));

      row.append(dot, name, settings, removeButton);
      optionList.append(row);
    });

    optionCount.textContent = `${options.length}개`;
    input.disabled = isActive;
    addButton.disabled = isActive;
    emptyMessage.hidden = options.length > 0;
    clearButton.disabled = options.length === 0 || isActive;
    spinButton.disabled = options.length < 2 || spinState === "stopping";
    spinButtonLabel.textContent =
      spinState === "spinning"
        ? "룰렛 멈추기"
        : spinState === "stopping"
          ? "멈추는 중..."
          : "룰렛 돌리기";
    spinButtonIcon.textContent = spinState === "spinning" ? "■" : "↻";
    wheelHint.textContent =
      options.length < 2
        ? "후보를 2개 이상 추가하면 돌릴 수 있어요."
        : spinState === "spinning"
          ? "원하는 순간에 ‘룰렛 멈추기’를 눌러주세요."
          : spinState === "stopping"
            ? "천천히 멈추고 있어요. 결과를 기다려 주세요!"
            : "버튼을 눌러 룰렛을 시작해 보세요.";
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
    if (spinState !== "idle") return;
    const option = value.trim();
    if (!option) {
      showToast("후보 내용을 입력해 주세요.");
      input.focus();
      return;
    }

    if (
      options.some(
        (existingOption) =>
          existingOption.name.toLocaleLowerCase() === option.toLocaleLowerCase(),
      )
    ) {
      showToast("이미 목록에 있는 후보예요.");
      input.focus();
      return;
    }

    options.push({ name: option, weight: 1 });
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    saveOptions();
    updateInterface();
    input.value = "";
    input.focus();
  }

  function removeOption(index) {
    if (spinState !== "idle") return;
    options.splice(index, 1);
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    saveOptions();
    updateInterface();
  }

  function randomUnit() {
    if (window.crypto && window.crypto.getRandomValues) {
      const randomValues = new Uint32Array(2);
      window.crypto.getRandomValues(randomValues);
      const value = (randomValues[0] & 0x1fffff) * 0x100000000 + randomValues[1];
      return value / 0x20000000000000;
    }
    return Math.random();
  }

  function selectWeightedPosition() {
    let pick = randomUnit() * totalWeight();
    let precedingWeight = 0;
    for (let index = 0; index < options.length; index += 1) {
      const weight = options[index].weight;
      if (pick < weight) {
        return { index, position: precedingWeight + pick };
      }
      pick -= weight;
      precedingWeight += weight;
    }
    return {
      index: options.length - 1,
      position: totalWeight() - Number.EPSILON,
    };
  }

  function normalizeAngle(angle) {
    return ((angle % TAU) + TAU) % TAU;
  }

  function startWheel() {
    if (spinState !== "idle" || options.length < 2) return;

    hideWheelResult();
    spinState = "spinning";
    lastFrameTime = 0;
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    updateInterface();
    window.requestAnimationFrame(animateSpin);
  }

  function animateSpin(now) {
    if (spinState !== "spinning") return;

    if (lastFrameTime !== 0) {
      const elapsed = Math.min(now - lastFrameTime, 50);
      rotation += SPIN_SPEED * elapsed;
    }
    lastFrameTime = now;
    drawWheel();
    window.requestAnimationFrame(animateSpin);
  }

  function stopWheel() {
    if (spinState !== "spinning") return;

    const selected = selectWeightedPosition();
    const winnerIndex = selected.index;
    const weightSum = totalWeight();
    const desiredRotation = normalizeAngle(-(selected.position / weightSum) * TAU);
    const currentRotation = normalizeAngle(rotation);
    const alignment = normalizeAngle(desiredRotation - currentRotation);
    const startRotation = rotation;
    const stopDistance = 3 * TAU + alignment;
    const duration = (2 * stopDistance) / SPIN_SPEED;
    const startTime = performance.now();

    spinState = "stopping";
    updateInterface();

    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const deceleratedProgress = 2 * progress - progress * progress;
      rotation = startRotation + stopDistance * deceleratedProgress;
      drawWheel();

      if (progress < 1) {
        window.requestAnimationFrame(animate);
        return;
      }

      rotation = normalizeAngle(startRotation + stopDistance);
      spinState = "idle";
      resultMessage.textContent = `오늘의 선택은 ${options[winnerIndex].name}!`;
      resultMessage.classList.remove("is-result");
      void resultMessage.offsetWidth;
      resultMessage.classList.add("is-result");
      showWheelResult(options[winnerIndex].name);
      updateInterface();
    }

    window.requestAnimationFrame(animate);
  }

  function hideWheelResult() {
    window.clearTimeout(resultOverlayTimer);
    window.clearTimeout(resultOverlayHideTimer);
    wheelResultOverlay.classList.remove("is-visible");
    wheelResultOverlay.hidden = true;
  }

  function showWheelResult(name) {
    wheelResultName.textContent = name;
    wheelResultOverlay.hidden = false;
    window.requestAnimationFrame(() => {
      wheelResultOverlay.classList.add("is-visible");
    });
    resultOverlayTimer = window.setTimeout(() => {
      wheelResultOverlay.classList.remove("is-visible");
      resultOverlayHideTimer = window.setTimeout(() => {
        wheelResultOverlay.hidden = true;
      }, 350);
    }, 2200);
  }

  function handleSpinButton() {
    if (spinState === "spinning") {
      stopWheel();
      return;
    }
    startWheel();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addOption(input.value);
  });

  clearButton.addEventListener("click", () => {
    if (spinState !== "idle" || options.length === 0) return;
    options = [];
    resultMessage.textContent = "";
    resultMessage.classList.remove("is-result");
    saveOptions();
    updateInterface();
  });

  spinButton.addEventListener("click", handleSpinButton);
  themeToggle.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem("todays-meal-theme", nextTheme);
    } catch {
      showToast("테마를 저장할 수 없어 새로고침하면 라이트 모드로 돌아가요.");
    }
  });
  viewModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.viewMode;
      applyViewMode(mode);
      try {
        window.localStorage.setItem("todays-meal-view-mode", mode);
      } catch {
        showToast("화면 모드를 저장할 수 없어요.");
      }
    });
  });

  applyTheme(loadTheme());
  applyViewMode(loadViewMode());
  updateInterface();
})();
