const questions = window.QUESTION_BANK || [];
const STORAGE_KEY = "mobile-quiz-progress-v1";

const els = {
  chapterFilter: document.querySelector("#chapterFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  modeFilter: document.querySelector("#modeFilter"),
  questionJump: document.querySelector("#questionJump"),
  jumpButton: document.querySelector("#jumpButton"),
  shuffleToggle: document.querySelector("#shuffleToggle"),
  resetProgress: document.querySelector("#resetProgress"),
  totalCount: document.querySelector("#totalCount"),
  doneCount: document.querySelector("#doneCount"),
  correctRate: document.querySelector("#correctRate"),
  overviewToggle: document.querySelector("#overviewToggle"),
  overviewBody: document.querySelector("#overviewBody"),
  overviewCount: document.querySelector("#overviewCount"),
  overviewSummary: document.querySelector("#overviewSummary"),
  overviewGrid: document.querySelector("#overviewGrid"),
  emptyState: document.querySelector("#emptyState"),
  quizCard: document.querySelector("#quizCard"),
  questionMeta: document.querySelector("#questionMeta"),
  questionProgress: document.querySelector("#questionProgress"),
  questionText: document.querySelector("#questionText"),
  options: document.querySelector("#options"),
  resultBox: document.querySelector("#resultBox"),
  favoriteButton: document.querySelector("#favoriteButton"),
  prevButton: document.querySelector("#prevButton"),
  checkButton: document.querySelector("#checkButton"),
  nextButton: document.querySelector("#nextButton"),
};

function defaultProgress() {
  return {
    answers: {},
    favorites: {},
    ui: {
      chapter: "",
      type: "",
      mode: "all",
      shuffle: false,
      overviewOpen: true,
      currentIndex: 0,
      currentQuestionId: "",
    },
  };
}

const state = {
  filtered: [],
  currentIndex: 0,
  selected: new Set(),
  checked: false,
  progress: loadProgress(),
};

function loadProgress() {
  const fallback = defaultProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return {
      ...fallback,
      ...saved,
      answers: saved.answers || {},
      favorites: saved.favorites || {},
      ui: { ...fallback.ui, ...(saved.ui || {}) },
    };
  } catch {
    return fallback;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function saveUiState() {
  const question = state.filtered[state.currentIndex];
  state.progress.ui = {
    chapter: els.chapterFilter.value,
    type: els.typeFilter.value,
    mode: els.modeFilter.value,
    shuffle: els.shuffleToggle.checked,
    overviewOpen: !els.overviewBody.classList.contains("hidden"),
    currentIndex: state.currentIndex,
    currentQuestionId: question?.id || "",
  };
  saveProgress();
}

function restoreUiState() {
  const ui = state.progress.ui || {};
  els.chapterFilter.value = ui.chapter || "";
  els.typeFilter.value = ui.type || "";
  els.modeFilter.value = ui.mode || "all";
  els.shuffleToggle.checked = Boolean(ui.shuffle);
  els.overviewBody.classList.toggle("hidden", ui.overviewOpen === false);
  els.overviewToggle.setAttribute("aria-expanded", String(ui.overviewOpen !== false));
}

function normalizeChapter(chapter) {
  return (chapter || "未分章").replace(/^\/+/, "");
}

function isMultiple(question) {
  return question.type.includes("多") || question.answer.length > 1;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sameAnswer(left, right) {
  return [...left].sort().join("") === [...right].sort().join("");
}

function fillFilters() {
  const chapters = [...new Set(questions.map((q) => normalizeChapter(q.chapter)))];
  const types = [...new Set(questions.map((q) => q.type))];

  els.chapterFilter.innerHTML = `<option value="">全部章节</option>${chapters
    .map((chapter) => `<option value="${chapter}">${chapter}</option>`)
    .join("")}`;
  els.typeFilter.innerHTML = `<option value="">全部题型</option>${types
    .map((type) => `<option value="${type}">${type}</option>`)
    .join("")}`;
}

function buildFilteredQuestions() {
  const chapter = els.chapterFilter.value;
  const type = els.typeFilter.value;
  const mode = els.modeFilter.value;

  const next = questions.filter((question) => {
    const record = state.progress.answers[question.id];
    const matchesChapter = !chapter || normalizeChapter(question.chapter) === chapter;
    const matchesType = !type || question.type === type;
    const matchesMode =
      mode === "all" ||
      (mode === "wrong" && record?.status === "wrong") ||
      (mode === "favorite" && state.progress.favorites[question.id]) ||
      (mode === "unanswered" && !record);

    return matchesChapter && matchesType && matchesMode;
  });

  return els.shuffleToggle.checked ? shuffle(next) : next;
}

function applyFilters({ resetIndex = true } = {}) {
  state.filtered = buildFilteredQuestions();
  const savedQuestionIndex = state.filtered.findIndex((question) => question.id === state.progress.ui.currentQuestionId);
  const savedIndex = Math.min(state.progress.ui.currentIndex || 0, Math.max(state.filtered.length - 1, 0));
  state.currentIndex = resetIndex ? 0 : savedQuestionIndex >= 0 ? savedQuestionIndex : savedIndex;
  saveUiState();
  render();
}

function renderStats() {
  const records = state.filtered.map((question) => state.progress.answers[question.id]).filter(Boolean);
  const correct = records.filter((record) => record.status === "correct").length;
  const rate = records.length ? Math.round((correct / records.length) * 100) : 0;

  els.totalCount.textContent = state.filtered.length;
  els.doneCount.textContent = records.length;
  els.correctRate.textContent = `${rate}%`;
}

function render() {
  renderStats();
  renderOverview();

  if (!state.filtered.length) {
    els.quizCard.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
    return;
  }

  els.quizCard.classList.remove("hidden");
  els.emptyState.classList.add("hidden");

  const question = state.filtered[state.currentIndex];
  const record = state.progress.answers[question.id];
  state.selected = new Set(record?.selected || []);
  state.checked = Boolean(record);

  els.questionMeta.textContent = `${normalizeChapter(question.chapter)} · ${question.type}${question.difficulty ? ` · ${question.difficulty}` : ""}`;
  els.questionProgress.textContent = `第 ${state.currentIndex + 1} / ${state.filtered.length} 题`;
  els.questionText.textContent = question.text;
  els.favoriteButton.textContent = state.progress.favorites[question.id] ? "★" : "☆";

  renderOptions(question);
  renderResult(question);

  els.prevButton.disabled = state.currentIndex === 0;
  els.nextButton.disabled = state.currentIndex === state.filtered.length - 1;
  els.checkButton.textContent = state.checked ? "已提交" : "提交答案";
  els.checkButton.disabled = state.checked;
  els.questionJump.max = state.filtered.length;
  els.questionJump.value = state.currentIndex + 1;
}

function getQuestionStatus(question) {
  const status = state.progress.answers[question.id]?.status;
  return status === "correct" || status === "wrong" ? status : "unanswered";
}

function renderOverview() {
  const counts = state.filtered.reduce(
    (total, question) => {
      total[getQuestionStatus(question)] += 1;
      return total;
    },
    { correct: 0, wrong: 0, unanswered: 0 },
  );

  els.overviewCount.textContent = `${state.filtered.length} 题`;
  els.overviewSummary.textContent = `正确 ${counts.correct} · 错误 ${counts.wrong} · 未做 ${counts.unanswered}`;
  els.overviewGrid.innerHTML = "";

  state.filtered.forEach((question, index) => {
    const button = document.createElement("button");
    const status = getQuestionStatus(question);
    button.type = "button";
    button.className = `overview-item ${status}`;
    button.textContent = index + 1;
    button.title = `第 ${index + 1} 题：${status === "correct" ? "正确" : status === "wrong" ? "错误" : "未做"}`;
    button.setAttribute("aria-label", button.title);

    if (index === state.currentIndex) {
      button.classList.add("current");
    }

    button.addEventListener("click", () => jumpToIndex(index));
    els.overviewGrid.appendChild(button);
  });
}

function renderKeepingAnchor(anchor) {
  const top = anchor?.getBoundingClientRect().top ?? 0;
  render();
  requestAnimationFrame(() => {
    const nextTop = anchor?.getBoundingClientRect().top ?? top;
    window.scrollBy({ top: nextTop - top, behavior: "auto" });
  });
}

function renderOptions(question) {
  const correct = new Set(question.answer.split(""));
  const record = state.progress.answers[question.id];

  els.options.innerHTML = "";
  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.dataset.letter = option.letter;

    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = option.letter;

    const text = document.createElement("span");
    text.textContent = option.text;

    button.append(letter, text);

    if (state.selected.has(option.letter)) {
      button.classList.add("selected");
    }
    if (record && correct.has(option.letter)) {
      button.classList.add("correct");
    }
    if (record?.status === "wrong" && state.selected.has(option.letter) && !correct.has(option.letter)) {
      button.classList.add("wrong");
    }

    button.addEventListener("click", () => selectOption(question, option.letter));
    els.options.appendChild(button);
  });
}

function selectOption(question, letter) {
  if (state.checked) return;

  if (isMultiple(question)) {
    if (state.selected.has(letter)) {
      state.selected.delete(letter);
    } else {
      state.selected.add(letter);
    }
  } else {
    state.selected = new Set([letter]);
  }

  renderOptions(question);
}

function checkAnswer() {
  const question = state.filtered[state.currentIndex];
  if (!question || !state.selected.size) {
    els.resultBox.className = "result bad";
    els.resultBox.textContent = "请先选择答案。";
    els.resultBox.classList.remove("hidden");
    return;
  }

  const correct = sameAnswer(state.selected, question.answer);
  state.progress.answers[question.id] = {
    selected: [...state.selected],
    status: correct ? "correct" : "wrong",
    answeredAt: Date.now(),
  };
  saveProgress();

  if (els.modeFilter.value !== "all") {
    state.filtered = buildFilteredQuestions();
    state.currentIndex = Math.min(state.currentIndex, Math.max(state.filtered.length - 1, 0));
    saveUiState();
    renderKeepingAnchor(els.checkButton);
    return;
  }

  saveUiState();
  renderKeepingAnchor(els.checkButton);
}

function renderResult(question) {
  const record = state.progress.answers[question.id];
  if (!record) {
    els.resultBox.className = "result hidden";
    els.resultBox.textContent = "";
    return;
  }

  const selected = record.selected.join("");
  const prefix = record.status === "correct" ? "回答正确" : "回答错误";
  const explanation = question.explanation ? `\n解析：${question.explanation}` : "";
  els.resultBox.className = `result ${record.status === "correct" ? "good" : "bad"}`;
  els.resultBox.innerText = `${prefix}。你的答案：${selected}；正确答案：${question.answer}。${explanation}`;
}

function toggleFavorite() {
  const question = state.filtered[state.currentIndex];
  if (!question) return;

  if (state.progress.favorites[question.id]) {
    delete state.progress.favorites[question.id];
  } else {
    state.progress.favorites[question.id] = true;
  }
  saveProgress();
  render();
}

function move(delta) {
  jumpToIndex(state.currentIndex + delta);
}

function jumpToIndex(index) {
  if (!state.filtered.length) return;

  state.currentIndex = Math.min(Math.max(index, 0), state.filtered.length - 1);
  saveUiState();
  render();
  els.quizCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function jumpToQuestion() {
  const target = Number.parseInt(els.questionJump.value, 10);
  if (!Number.isFinite(target) || target < 1 || target > state.filtered.length) {
    els.questionJump.value = state.currentIndex + 1;
    return;
  }

  jumpToIndex(target - 1);
}

fillFilters();
restoreUiState();
applyFilters({ resetIndex: false });

[els.chapterFilter, els.typeFilter, els.modeFilter, els.shuffleToggle].forEach((input) => {
  input.addEventListener("change", () => applyFilters());
});

els.checkButton.addEventListener("click", checkAnswer);
els.prevButton.addEventListener("click", () => move(-1));
els.nextButton.addEventListener("click", () => move(1));
els.overviewToggle.addEventListener("click", () => {
  els.overviewBody.classList.toggle("hidden");
  els.overviewToggle.setAttribute("aria-expanded", String(!els.overviewBody.classList.contains("hidden")));
  saveUiState();
});
els.jumpButton.addEventListener("click", jumpToQuestion);
els.questionJump.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    jumpToQuestion();
  }
});
els.favoriteButton.addEventListener("click", toggleFavorite);
els.resetProgress.addEventListener("click", () => {
  if (!confirm("确定清空所有答题记录吗？")) return;
  state.progress = defaultProgress();
  saveProgress();
  applyFilters();
});
