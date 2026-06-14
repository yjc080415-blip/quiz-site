const questions = window.QUESTION_BANK || [];
const STORAGE_KEY = "mobile-quiz-progress-v1";

const els = {
  chapterFilter: document.querySelector("#chapterFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  modeFilter: document.querySelector("#modeFilter"),
  shuffleToggle: document.querySelector("#shuffleToggle"),
  resetProgress: document.querySelector("#resetProgress"),
  totalCount: document.querySelector("#totalCount"),
  doneCount: document.querySelector("#doneCount"),
  correctRate: document.querySelector("#correctRate"),
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

const state = {
  filtered: [],
  currentIndex: 0,
  selected: new Set(),
  checked: false,
  progress: loadProgress(),
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { answers: {}, favorites: {} };
  } catch {
    return { answers: {}, favorites: {} };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
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

function applyFilters() {
  state.filtered = buildFilteredQuestions();
  state.currentIndex = 0;
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
    render();
    return;
  }

  render();
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
  state.currentIndex = Math.min(Math.max(state.currentIndex + delta, 0), state.filtered.length - 1);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

fillFilters();
applyFilters();

[els.chapterFilter, els.typeFilter, els.modeFilter, els.shuffleToggle].forEach((input) => {
  input.addEventListener("change", applyFilters);
});

els.checkButton.addEventListener("click", checkAnswer);
els.prevButton.addEventListener("click", () => move(-1));
els.nextButton.addEventListener("click", () => move(1));
els.favoriteButton.addEventListener("click", toggleFavorite);
els.resetProgress.addEventListener("click", () => {
  if (!confirm("确定清空所有答题记录吗？")) return;
  state.progress = { answers: {}, favorites: {} };
  saveProgress();
  applyFilters();
});
