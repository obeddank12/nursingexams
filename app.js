const STORAGE_KEY = 'quizSessions';

function getQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

function toDisplayName(course) {
  return course.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function resolveAnswerIndex(answer, options) {
  if (typeof answer === 'number') return answer;
  if (typeof answer === 'string') {
    const normalized = answer.trim().toUpperCase();
    if (/^[A-D]$/.test(normalized)) return normalized.charCodeAt(0) - 65;
    for (let idx = 0; idx < options.length; idx++) {
      if (options[idx].toLowerCase().includes(answer.trim().toLowerCase())) return idx;
    }
  }
  return 0;
}

async function loadQuiz() {
  const quizSidebar = document.getElementById('quizSidebar');
  if (!quizSidebar) return;

  const params = getQueryParams();
  const course = params.course || 'medical';
  const initialSet = Math.max(1, parseInt(params.set, 10) || 1);
  
  // Logic State
  let allSets = [];
  let currentSetQuestions = [];
  let currentIndex = 0;
  let quizState = [];
  let timerInterval = null;
  let remainingSeconds = 20 * 60;

  // 1. DATA LOADING (FIXED PATH)
  async function fetchQuestions() {
    try {
      const module = await import(`./data/${course}.js`); 
      // This handles all export styles we used
      return module.default || module[`${course}Data`] || module.medicalData || Object.values(module)[0];
    } catch (e) {
      console.error("Path Error: Could not find ./data/" + course + ".js", e);
      return null;
    }
  }

  // 2. SET UP UI
  function initSetSelector(sets) {
    const selector = document.getElementById('setSelector');
    selector.innerHTML = '';
    sets.forEach((_, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = `Set ${String(i + 1).padStart(2, '0')}`;
      if (i + 1 === initialSet) opt.selected = true;
      selector.appendChild(opt);
    });

    selector.onchange = (e) => loadSet(parseInt(e.target.value));
  }

  function loadSet(setNum) {
    currentIndex = 0;
    currentSetQuestions = allSets[setNum - 1] || [];
    quizState = currentSetQuestions.map(() => ({ selected: null, confirmed: false }));
    
    document.getElementById('breadcrumbText').textContent = toDisplayName(course);
    document.getElementById('currentSetTitle').textContent = `Practice Set ${setNum}`;
    document.getElementById('questionCountDisplay').textContent = currentSetQuestions.length;
    
    buildSidebar(currentSetQuestions.length);
    renderQuestion();
  }

  function buildSidebar(count) {
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button');
      btn.className = 'qb-item';
      btn.textContent = i + 1;
      btn.onclick = () => { currentIndex = i; renderQuestion(); };
      grid.appendChild(btn);
    }
  }

  function renderQuestion() {
    const q = currentSetQuestions[currentIndex];
    const s = quizState[currentIndex];
    if (!q) return;

    document.getElementById('qNumberLabel').textContent = `Question ${currentIndex + 1} of ${currentSetQuestions.length}`;
    const statusEl = document.getElementById('qStatus');
    statusEl.textContent = s.confirmed ? 'Confirmed' : (s.selected !== null ? 'Answered' : 'Unanswered');
    statusEl.className = `question-state ${s.confirmed ? 'confirmed' : (s.selected !== null ? 'answered' : 'unanswered')}`;

    document.getElementById('mainQuestionText').textContent = q.question;
    const container = document.getElementById('optionsContainer');
    container.innerHTML = '';

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = `option-btn ${s.selected === i ? 'selected' : ''}`;
      
      if (s.confirmed) {
        btn.disabled = true;
        const correct = resolveAnswerIndex(q.correctAnswer, q.options);
        if (i === correct) btn.classList.add('correct');
        else if (i === s.selected) btn.classList.add('incorrect');
      }

      btn.innerHTML = `<span class="option-label">${String.fromCharCode(65+i)}</span><span>${opt}</span>`;
      btn.onclick = () => {
        if (!s.confirmed) {
          quizState[currentIndex].selected = i;
          renderQuestion();
        }
      };
      container.appendChild(btn);
    });

    document.querySelectorAll('.qb-item').forEach((btn, i) => {
      btn.classList.toggle('active', i === currentIndex);
      btn.classList.toggle('answered', quizState[i].selected !== null);
      btn.classList.toggle('confirmed', quizState[i].confirmed);
    });
  }

  // Footer Actions
  document.getElementById('prevBtn').onclick = () => { if (currentIndex > 0) { currentIndex--; renderQuestion(); } };
  document.getElementById('nextBtn').onclick = () => { if (currentIndex < currentSetQuestions.length - 1) { currentIndex++; renderQuestion(); } };
  document.getElementById('confirmBtn').onclick = () => { 
    if (quizState[currentIndex].selected !== null) {
      quizState[currentIndex].confirmed = true;
      renderQuestion();
    }
  };
  document.getElementById('endBtn').onclick = () => { if (confirm("End quiz and save?")) window.location.href = 'index.html'; };

  // 3. INITIALIZE
  allSets = await fetchQuestions();
  if (allSets) {
    initSetSelector(allSets);
    loadSet(initialSet);
  } else {
    document.getElementById('mainQuestionText').innerHTML = `<span style="color:red">Error: Could not load data/${course}.js</span>`;
  }
}

loadQuiz();