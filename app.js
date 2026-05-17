const STORAGE_KEY = 'quizSessions';

function getQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

// Upgraded name utility to handle both hyphens and underscores seamlessly
function toDisplayName(course) {
  return course
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
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
  
  // App Logic State Variables
  let allSets = [];
  let currentSetQuestions = [];
  let currentIndex = 0;
  let quizState = [];
  let isStudyMode = true;
  let timerInterval = null;
  let remainingSeconds = 20 * 60; // 20 Minutes standard clock allocation

  // 1. DYNAMIC DATA LOADING AND PLACEHOLDER FALLBACKS
  async function fetchQuestions() {
    try {
      // Handles dynamic runtime routing for all assets
      const module = await import(`./data/${course}.js`);
      return module.default || module[`${course}Data`] || module.medicalData || Object.values(module)[0];
    } catch (e) {
      console.warn(`Dynamic Asset Notice: Target ./data/${course}.js not loaded yet. Checking fallbacks.`);
      
      // Dynamic fallback template layout for your future general_paper module
      if (course === 'general_paper') {
        return [
          [
            {
              "id": 1,
              "question": "General Paper Placeholder Module: Ready for integration.",
              "options": ["System Option A", "System Option B", "System Option C"],
              "correctAnswer": 0,
              "predictedByAI": false
            }
          ]
        ];
      }
      console.error("Path Error: Could not resolve dynamic imports", e);
      return null;
    }
  }

  // 2. COUNTDOWN TIMER ENGINE
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        alert("Time is up! Processing your submission details.");
        calculateAndDisplayResults();
        return;
      }
      remainingSeconds--;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
  }

  function updateTimerDisplay() {
    const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const secs = String(remainingSeconds % 60).padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `00:${mins}:${secs}`;
  }

  // 3. CORE PERFORMANCE ANALYTICS ENGINE
  function calculateAndDisplayResults() {
    stopTimer();
    let totalQuestions = currentSetQuestions.length;
    let correctAnswersCount = 0;

    currentSetQuestions.forEach((q, idx) => {
      const state = quizState[idx];
      const correctIdx = resolveAnswerIndex(q.correctAnswer, q.options);
      if (state.selected === correctIdx) {
        correctAnswersCount++;
      }
    });

    const scorePercentage = totalQuestions > 0 ? Math.round((correctAnswersCount / totalQuestions) * 100) : 0;
    
    // Process display output elements inside resultsModal overlay template
    document.getElementById('modalPercentage').textContent = `${scorePercentage}%`;
    document.getElementById('modalTotalCorrect').textContent = `${correctAnswersCount} / ${totalQuestions}`;
    
    const timeSpentSecs = (20 * 60) - remainingSeconds;
    const spentMins = String(Math.floor(timeSpentSecs / 60)).padStart(2, '0');
    const spentSecs = String(timeSpentSecs % 60).padStart(2, '0');
    document.getElementById('modalTimeSpent').textContent = `${spentMins}:${spentSecs}`;

    document.getElementById('resultsModal').classList.remove('hidden');
  }

  // 4. INTERFACE SETUP AND DISPLAY ENGINES
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
    
    // Reset timer when a user hops across data sets
    remainingSeconds = 20 * 60;
    updateTimerDisplay();
    if (!isStudyMode) startTimer();

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
      btn.onclick = () => { 
        currentIndex = i; 
        renderQuestion();
        // Auto-close sidebar on mobile sheets layout upon tap action
        if (window.innerWidth <= 768) {
          quizSidebar.classList.remove('open');
        }
      };
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
      
      // Study Mode instantly updates single item states upon confirmation
      if (s.confirmed && isStudyMode) {
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

  // 5. INTERACTION ASSIGNMENTS & DOM HANDLERS
  document.getElementById('prevBtn').onclick = () => { if (currentIndex > 0) { currentIndex--; renderQuestion(); } };
  document.getElementById('nextBtn').onclick = () => { if (currentIndex < currentSetQuestions.length - 1) { currentIndex++; renderQuestion(); } };
  
  document.getElementById('confirmBtn').onclick = () => { 
    if (quizState[currentIndex].selected !== null) {
      quizState[currentIndex].confirmed = true;
      renderQuestion();
      
      // Auto advance to the next step inside Study Mode configuration setups
      if (isStudyMode && currentIndex < currentSetQuestions.length - 1) {
        setTimeout(() => {
          currentIndex++;
          renderQuestion();
        }, 800);
      }
    }
  };

  document.getElementById('endBtn').onclick = () => {
    if (confirm("Are you sure you want to end this practice session and calculate metrics?")) {
      calculateAndDisplayResults();
    }
  };

  // Operational Strategy Mode Toggles
  const studyModeBtn = document.getElementById('studyModeBtn');
  const timedModeBtn = document.getElementById('timedModeBtn');

  studyModeBtn.onclick = () => {
    if (!isStudyMode) {
      isStudyMode = true;
      studyModeBtn.classList.add('active');
      timedModeBtn.classList.remove('active');
      stopTimer();
      remainingSeconds = 20 * 60;
      updateTimerDisplay();
      renderQuestion();
    }
  };

  timedModeBtn.onclick = () => {
    if (isStudyMode) {
      isStudyMode = false;
      timedModeBtn.classList.add('active');
      studyModeBtn.classList.remove('active');
      startTimer();
    }
  };

  // Focus View Manipulation Layout Configuration Toggles
  document.getElementById('focusToggle').onclick = (e) => {
    const isFocus = document.body.classList.toggle('focus-mode');
    e.target.textContent = isFocus ? 'Exit Focus' : 'Focus Mode';
    e.target.classList.toggle('button-primary', isFocus);
  };

  // Sidebar Drawer Controller for Mobile Screens
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.onclick = () => {
      quizSidebar.classList.toggle('open');
    };
  }

  // Modal Control Button Handlers
  document.getElementById('modalReviewBtn').onclick = () => {
    document.getElementById('resultsModal').classList.add('hidden');
    // Forces confirmation across all metrics to let users inspect correct items safely
    quizState.forEach(state => { if(state.selected !== null) state.confirmed = true; });
    isStudyMode = true; // Temporary shift to inspect color tracks without clocks ticking
    studyModeBtn.classList.add('active');
    timedModeBtn.classList.remove('active');
    renderQuestion();
  };

  document.getElementById('modalCloseBtn').onclick = () => {
    window.location.href = 'index.html';
  };

  // 6. INITIALIZATION AND START ENGINE RUNTIME
  allSets = await fetchQuestions();
  if (allSets && allSets.length > 0) {
    initSetSelector(allSets);
    loadSet(initialSet);
  } else {
    document.getElementById('mainQuestionText').innerHTML = `
      <div style="color:var(--text-danger, #e53e3e); padding: 1.5rem; background: rgba(229,62,62,0.1); border-radius: 8px;">
        <strong>System Initialization Warning:</strong><br>
        The module <code>data/${course}.js</code> is currently empty or unresolvable. Update repositories to proceed.
      </div>`;
  }
}

// Active application runtime invocation
loadQuiz();