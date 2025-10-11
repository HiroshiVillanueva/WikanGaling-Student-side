const SUPABASE_URL = "https://aliyyqinorqlwmjhbqza.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsaXl5cWlub3JxbHdtamhicXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDY2OTgsImV4cCI6MjA3NDY4MjY5OH0.wqmf23uvtil0BJ0qlk8qm_Wq7LsaD1ClZKwnDr1OxME";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const SUPABASE_BUCKET_URL = "https://aliyyqinorqlwmjhbqza.supabase.co/storage/v1/object/public/";

//const MODULE_ID = "51eea546-24a5-46c2-87f4-493d71ae8030"; // sample module id -- later to be replaced with generated url

// ----------------- Helper for Signed URLs -----------------
async function getSignedUrl(path) {
  try {
    const { data, error } = await supabase
      .storage
      .from('form_images') 
      .createSignedUrl(path, 2592000); // valid for 30 days

    if (error) throw error;
    return data.signedUrl;
  } catch (err) {
    console.error("Signed URL error for:", path, err);
    return null;
  }
}


let MODULE_ID = null
window.onload = function() {
    const params = new URLSearchParams(window.location.search);
    MODULE_ID = params.get('form_id'); 
    if (!MODULE_ID) {
        alert("No module ID found in the URL!");
        console.error("Module ID missing in URL:", window.location.href);
    } else {
        console.log("Module ID:", MODULE_ID);
    }
};


let questions = [];
let currentIndex = 0;
let leaderLines = [];
let pendingLeft = null;

let STUDENT_ID = sessionStorage.getItem('student_id');

// ----------------- Submit Student Information -----------------
async function submitStudentInfo() {
    const fullName = document.getElementById('studentName').value.trim();
    if (!fullName) { alert("Enter your name"); return; }

    const firstName = fullName.split(' ')[0];

    try {
        const { data } = await supabase
          .from('students')
          .select('student_id')
          .ilike('Display_name', fullName)
          .maybeSingle();

        if(!data) {
            const newId = crypto.randomUUID();
            const { data: insertData } = await supabase
                .from('students')
                .insert([{ student_id: newId, Display_name: fullName, username: firstName }])
                .select()
                .single();
            STUDENT_ID = newId;
        } else {
            STUDENT_ID = data.student_id;
        }

        sessionStorage.setItem('student_id', STUDENT_ID);

        document.getElementById('landing').style.display = 'none';
        document.getElementById('moduleLanding').style.display = 'block';

        // Load module info
        const { data: moduleData, error: moduleError } = await supabase
            .from("module")
            .select("title, description, form_data")
            .eq("module_id", MODULE_ID)
            .single();

        if (moduleError || !moduleData) { 
            alert("Failed to load module info."); 
            return; 
        }

        document.getElementById('moduleLandingTitle').textContent = moduleData.title || "Untitled Module";
        document.getElementById('moduleLandingDesc').textContent = moduleData.description || "No description available.";

        document.getElementById('moduleTitle').textContent = moduleData.title || "Untitled Module";

        questions = moduleData.form_data?.questions || [];

    } catch(err) {
        console.error("submitStudentInfo failed:", err);
        alert("Check console for Supabase errors.");
    }
}

// ----------------- Load Module -----------------
async function loadModule() {

  document.getElementById('landing').style.display = 'none';
  document.getElementById('moduleContainer').style.display = 'none';
  document.getElementById('resultContainer').style.display = 'none';

  document.getElementById('moduleLanding').style.display = 'block';

  const { data, error } = await supabase
    .from("module")
    .select("title, description, form_data, teacher_id")
    .eq("module_id", MODULE_ID)
    .single();

  if (error || !data) {
    alert("Failed to load module.");
    console.error(error);
    return;
  }

  document.getElementById('moduleLandingTitle').textContent = data.title || 'Untitled Module';
  document.getElementById('moduleLandingDesc').textContent = data.description || '';

  document.getElementById('moduleTitle').textContent = data.title || 'Untitled Module';

  const moduleData = data.form_data;
  questions = moduleData.questions || [];

}
// ----------------- Start Module Button Handler -----------------
document.getElementById('startModuleBtn').onclick = () => {
  // Reset answers
  questions.forEach(q => {
    if (q.type === 'multiple_choice') q._answeredIndex = null;
    if (q.type === 'fill_in_blanks') q._answeredText = null;
    if (q.type === 'connecting_dots') q._matchedPairs = {};
  });

  document.getElementById('moduleTitle').textContent =
      document.getElementById('moduleLandingTitle').textContent || 'Untitled Module';

  document.getElementById('moduleLanding').style.display = 'none';
  document.getElementById('moduleContainer').style.display = 'block';

  currentIndex = 0;
  renderQuestions();
  showQuestion(currentIndex);
};

// ----------------- Randomizer -----------------
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ----------------- Render Questions -----------------
function renderQuestions() {

    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question';
        div.id = 'q' + index;

        // Question title
        const title = document.createElement('h3');
        title.textContent = `${index + 1}. ${q.text}`;
        div.appendChild(title);

        // Question image
        if (q.image) {
            const qImg = document.createElement('img');
            getSignedUrl(q.image).then(url => { if (url) qImg.src = url; });
            qImg.alt = 'Question image';
            qImg.style.maxWidth = '200px';
            qImg.style.display = 'block';
            qImg.style.margin = '10px 0';
            div.appendChild(qImg);
        }

        // ---------------- Multiple Choice ----------------
        if (q.type === 'multiple_choice') {
          const opts = document.createElement('div');
          opts.className = 'options';

          // ensure options exists
          if (!Array.isArray(q.options)) q.options = [];

          // give every option a stable unique id (if not present)
          q.options.forEach((opt, idx) => {
            if (!opt.id) opt.id = `${q.text.replace(/\s+/g,'_').slice(0,30)}_opt${idx}`;
          });

          // normalize/store the correct option id (supports both index or id)
          if (typeof q.correct === 'number') {
            q.correctId = q.options[q.correct] ? q.options[q.correct].id : null;
          } else if (typeof q.correct === 'string') {
            q.correctId = q.correct;
          } else {
            q.correctId = null;
          }

          // create shuffled copy for display 
          q.shuffledOptions = shuffleArray([...q.options]);

          // create option buttons 
          q.shuffledOptions.forEach((opt) => {
            const btn = document.createElement('div');
            btn.className = 'option';
            btn.dataset.optid = opt.id;
            btn.innerHTML = opt.text || '';

            if (opt.image) {
              const img = document.createElement('img');
              getSignedUrl(opt.image).then(url => { if (url) img.src = url; });
              img.alt = opt.text || 'Option image';
              img.style.maxWidth = '120px';
              img.style.display = 'block';
              img.style.marginTop = '5px';
              btn.appendChild(img);
            }

            // pass the option id to validator
            btn.onclick = () => validateMCQ(index, opt.id, btn);
            opts.appendChild(btn);
          });

          div.appendChild(opts);
          const fb = document.createElement('div');
          fb.className = 'feedback';
          div.appendChild(fb);
          document.getElementById('nextBtn').disabled = true;
        }

        // ---------------- Fill in the Blanks ----------------
        if (q.type === 'fill_in_blanks') {
            renderFillInBlanks(index, q, div);
        }

        // ---------------- Matching Type ----------------
        if (q.type === 'connecting_dots') {
          // Ensure options exist and each has an id
          q.options = q.options || [];
          q.options.forEach(opt => { if (!opt.id) opt.id = crypto.randomUUID(); });

          const matchContainer = document.createElement('div');
          matchContainer.className = 'match-container';
          matchContainer.style.display = 'flex';
          matchContainer.style.justifyContent = 'center';
          matchContainer.style.alignItems = 'flex-start';
          matchContainer.style.gap = '100px';
          matchContainer.style.marginTop = '40px';

          // Columns
          const leftCol = document.createElement('div');
          const rightCol = document.createElement('div');
          leftCol.className = 'match-col left-col';
          rightCol.className = 'match-col right-col';
          leftCol.style.display = rightCol.style.display = 'flex';
          leftCol.style.flexDirection = rightCol.style.flexDirection = 'column';
          leftCol.style.gap = rightCol.style.gap = '25px';
          leftCol.style.alignItems = rightCol.style.alignItems = 'center';

          // Maps
          const mapById = {};
          q.options.forEach(o => mapById[o.id] = o);

          const pairedIds = new Set();
          const pairs = [];

          // group by matchId value
          const groups = {};
          q.options.forEach(o => {
            const key = o.matchId ?? '__no__';
            if (!groups[key]) groups[key] = [];
            groups[key].push(o);
          });
          Object.values(groups).forEach(grp => {
            if (grp.length >= 2) {
              for (let i = 0; i + 1 < grp.length; i += 2) {
                const a = grp[i], b = grp[i + 1];
                if (!pairedIds.has(a.id) && !pairedIds.has(b.id)) {
                  pairs.push({ leftId: a.id, rightId: b.id });
                  pairedIds.add(a.id); pairedIds.add(b.id);
                }
              }
            }
          });

          // matchId points to partner id
          q.options.forEach(o => {
            if (pairedIds.has(o.id)) return;
            const target = mapById[o.matchId];
            if (target && !pairedIds.has(target.id)) {
              pairs.push({ leftId: o.id, rightId: target.id });
              pairedIds.add(o.id); pairedIds.add(target.id);
            }
          });

          // leftover -> pair by index
          const leftovers = q.options.filter(o => !pairedIds.has(o.id));
          for (let i = 0; i + 1 < leftovers.length; i += 2) {
            pairs.push({ leftId: leftovers[i].id, rightId: leftovers[i + 1].id });
            pairedIds.add(leftovers[i].id); pairedIds.add(leftovers[i + 1].id);
          }
          // If an odd leftover remains, pair with a placeholder (rightId null)
          if (leftovers.length % 2 === 1) {
            const last = leftovers[leftovers.length - 1];
            if (!pairedIds.has(last.id)) {
              pairs.push({ leftId: last.id, rightId: null });
              pairedIds.add(last.id);
            }
          }

          // persist correctPairs used for scoring
          q.correctPairs = pairs.map(p => ({ leftId: p.leftId, rightId: p.rightId }));

          // Build left/right item lists from pairs
          const leftItems = pairs.map(p => mapById[p.leftId]).filter(Boolean);
          const rightItems = pairs.map(p => p.rightId ? mapById[p.rightId] : null);

          // Helper to create item element incase item is null
          const makeItemDiv = (item, side) => {
            const div = document.createElement('div');
            div.className = `match-item ${side}`;
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.background = '#f8f8f8';
            div.style.borderRadius = '10px';
            div.style.padding = '15px';
            div.style.minWidth = '150px';
            div.style.height = '120px';
            div.style.cursor = item ? 'pointer' : 'default';

            if (!item) {
              // placeholder box to keep alignment when odd number
              const ph = document.createElement('div');
              ph.style.opacity = '0.35';
              ph.textContent = '—';
              div.appendChild(ph);
              return div;
            }

            div.dataset.id = item.id;
            div.dataset.matchId = item.matchId || '';
            div.dataset.side = side;

            if (item.text) {
              const text = document.createElement('div');
              text.textContent = item.text;
              text.style.fontSize = '16px';
              text.style.fontWeight = '500';
              text.style.textAlign = 'center';
              div.appendChild(text);
            }
            if (item.image) {
              const img = document.createElement('img');
              img.alt = 'Matching Image';
              img.style.width = '100px';
              img.style.borderRadius = '8px';
              img.style.marginTop = '6px';
              getSignedUrl(item.image).then(url => { if (url) img.src = url; });
              div.appendChild(img);
            }

            div.onclick = () => handleMatchClick(div, q);
            return div;
          };

          // Append items preserving pair order (left/right columns align)
          leftItems.forEach(item => leftCol.appendChild(makeItemDiv(item, 'left')));
          rightItems.forEach(item => rightCol.appendChild(makeItemDiv(item, 'right')));

          matchContainer.appendChild(leftCol);
          matchContainer.appendChild(rightCol);
          div.appendChild(matchContainer);

          const fb = document.createElement('div');
          fb.className = 'feedback';
          fb.style.marginTop = '12px';
          div.appendChild(fb);
        }
        container.appendChild(div);
    });
}

// ----------------- Multiple Choice -----------------
    function validateMCQ(qIndex, chosenId, element) {
      const q = questions[qIndex];
      if (!q) return;

      // prevent double answering
      if (q._answered) return;
      q._answered = true;
      q._chosenId = chosenId; // store chosen option id for summary/save

      const feedback = document.querySelector(`#q${qIndex} .feedback`);
      document.querySelectorAll(`#q${qIndex} .option`).forEach(o => o.classList.remove('correct', 'wrong', 'selected'));
      element.classList.add('selected');

      // compute correctId (use precomputed q.correctId if available)
      const correctId = q.correctId || (
        Array.isArray(q.options) && typeof q.correct === 'number' && q.options[q.correct]
          ? q.options[q.correct].id
          : null
      );

      if (correctId && chosenId === correctId) {
        element.classList.add('correct');
        if (feedback) { feedback.textContent = '✅ Correct!'; feedback.style.color = 'green'; }
        q._isCorrect = true;
      } else {
        element.classList.add('wrong');
        if (feedback) { feedback.textContent = '❌ Incorrect.'; feedback.style.color = 'red'; }
        q._isCorrect = false;

        // highlight the correct option visually 
        if (correctId) {
          const correctBtn = document.querySelector(`#q${qIndex} .option[data-optid="${correctId}"]`);
          if (correctBtn) correctBtn.classList.add('correct');
        }
      }

      document.getElementById('nextBtn').disabled = false;
      }


    // ----------------- Fill-in-Blanks -----------------
    function renderFillInBlanks(qIndex, q, container) {
      const blanksDiv = document.createElement('div');
      blanksDiv.className = 'blanks-container';

      const label = document.createElement('div');
      label.textContent = "Drag your answer here in the blank:";
      label.style.fontSize = "14.4px";
      label.style.marginBottom = "6px";
      blanksDiv.appendChild(label);

      const blank = document.createElement('span');
      blank.className = 'blank placeholder';
      blank.textContent = "Drop here";
      blank.dataset.correct = q.options[q.correct].text;
      blank.ondragover = (ev) => ev.preventDefault();
      blank.ondrop = (ev) => handleDrop(ev, blank, qIndex);
      blanksDiv.appendChild(blank);
      container.appendChild(blanksDiv);

      const optionsBank = document.createElement('div');
      optionsBank.className = 'options-bank';

      const shuffledOptions = shuffleArray([...q.options]);

      shuffledOptions.forEach(opt => {
          const div = document.createElement('div');
          div.className = 'option';
          div.textContent = opt.text;
          div.draggable = true;
          div.ondragstart = (ev) => ev.dataTransfer.setData('text', opt.text);
          optionsBank.appendChild(div);
      });

      container.appendChild(optionsBank);

      const fb = document.createElement('div');
      fb.className = 'feedback';
      container.appendChild(fb);

      document.getElementById('nextBtn').disabled = true;
}

// ----------------- Fill-in-blanks Validation (Single Click) -----------------
function handleDrop(ev, blank, qIndex) {
    ev.preventDefault();
    const q = questions[qIndex];

    // Prevent re-answering
    if (q._answeredText !== null && q._answeredText !== undefined) return;

    const data = ev.dataTransfer.getData('text').trim();
    blank.textContent = data;
    blank.classList.add('filled');

    q._answeredText = data;

    const correctAnswer = blank.dataset.correct.trim().toLowerCase();
    const fb = document.querySelector(`#q${qIndex} .feedback`);

    if (data.toLowerCase() === correctAnswer) {
        fb.textContent = '✅ Correct!';
        fb.style.color = 'green';
        blank.style.backgroundColor = 'lightgreen';
        blank.style.border = '2px solid green';
    } else {
        fb.textContent = '❌ Incorrect.';
        fb.style.color = 'red';
        blank.style.backgroundColor = 'lightcoral';
        blank.style.border = '2px solid red';

        const correctSpan = document.createElement('span');
        correctSpan.textContent = ` (${blank.dataset.correct})`;
        correctSpan.style.color = 'green';
        correctSpan.style.marginLeft = '6px';
        blank.insertAdjacentElement('afterend', correctSpan);
    }

    document.getElementById('nextBtn').disabled = false;
    blank.style.pointerEvents = 'none';
}

// ----------------- Matching click handler -----------------
function handleMatchClick(itemEl, question) {
  if (!itemEl) return;
  // ignore placeholders
  if (!itemEl.dataset || !itemEl.dataset.id) return;
  if (itemEl.classList.contains('matched')) return;

  // First click: select item
  if (!pendingLeft) {
    // mark selection and store pending
    clearSelectedInQuestion(question);
    pendingLeft = itemEl;
    itemEl.classList.add('selected');
    return;
  }

  // If same element clicked again -> deselect
  if (pendingLeft === itemEl) {
    pendingLeft.classList.remove('selected');
    pendingLeft = null;
    return;
  }

  // If same side clicked -> treat it as selecting a new left
  if (pendingLeft.dataset.side && itemEl.dataset.side && pendingLeft.dataset.side === itemEl.dataset.side) {
    pendingLeft.classList.remove('selected');
    pendingLeft = itemEl;
    itemEl.classList.add('selected');
    return;
  }


  let leftEl = pendingLeft;
  let rightEl = itemEl;
  if (itemEl.dataset.side === 'left' && pendingLeft.dataset.side === 'right') {
    // swap so leftEl is left side
    leftEl = itemEl;
    rightEl = pendingLeft;
  }

  attemptMatch(leftEl, rightEl, question);

  // reset pending
  if (pendingLeft) { pendingLeft.classList.remove('selected'); }
  pendingLeft = null;
}

// ----------------- Attempt Match -----------------
function attemptMatch(leftEl, rightEl, question) {
  if (!leftEl || !rightEl) return;

  leftEl.classList.remove('selected');

  const leftId = leftEl.dataset.id;
  const rightId = rightEl.dataset.id;

  if (!leftId || !rightId) return;

  question._matchedPairs = question._matchedPairs || {};

  // prevent matching same elements twice
  if (question._matchedPairs[leftId] || Object.values(question._matchedPairs).includes(rightId)) {
    const fb = leftEl.closest('.question').querySelector('.feedback');
    if (fb) { fb.textContent = '❌ One of these is already matched'; fb.style.color = 'red'; }
    // still draw a temporary red line to indicate invalid match
    drawLeaderLine(leftEl, rightEl, false);
    return;
  }

  // correctness check 
  const isCorrect = (question.correctPairs || []).some(p => p.leftId === leftId && p.rightId === rightId);

  // draw line
  drawLeaderLine(leftEl, rightEl, isCorrect);

  if (isCorrect) {
    leftEl.classList.add('matched');
    rightEl.classList.add('matched');

    // store left->right mapping for scoring
    question._matchedPairs[leftId] = rightId;

    const fb = leftEl.closest('.question').querySelector('.feedback');
    if (fb) { fb.textContent = '✅ Correct pair!'; fb.style.color = 'green'; }
  } else {
    const fb = leftEl.closest('.question').querySelector('.feedback');
    if (fb) { fb.textContent = '❌ Not a match'; fb.style.color = 'red'; }
    // do NOT save wrong pair (so students can try again)
  }

  updateMatchingProgress(question);
}

// ----------------- Draw leaderline -----------------
function drawLeaderLine(el1, el2, isCorrect) {
  try {
    const line = new LeaderLine(el1, el2, {
      color: isCorrect ? 'blue' : 'red',
      size: 3,
      path: 'straight',
      startPlug: 'disc',
      endPlug: 'disc',
      dash: isCorrect ? false : { animation: true },
    });

    leaderLines.push(line);

    if (!isCorrect) {
      setTimeout(() => {
        line.remove();
      }, 1500); // 2 seconds delay
    }

  } catch (e) {
    console.warn('LeaderLine draw failed:', e);
  }
}


// ----------------- Update progress and enable Next -----------------
function updateMatchingProgress(question) {
  const studentPairs = question._matchedPairs || {};
  const correctPairs = (question.correctPairs || []).filter(p => p.leftId && p.rightId);
  const matchedCorrectCount = correctPairs.filter(p => studentPairs[p.leftId] === p.rightId).length;

  const fb = document.querySelector(`#q${questions.indexOf(question)} .feedback`);
  const totalPairs = correctPairs.length;

  if (totalPairs > 0 && matchedCorrectCount === totalPairs) {
    if (fb) { fb.textContent = '✅ All pairs matched!'; fb.style.color = 'green'; }
    document.getElementById('nextBtn').disabled = false;
  } else {
    if (fb && matchedCorrectCount > 0) { fb.textContent = `${matchedCorrectCount} / ${totalPairs} correct`; fb.style.color = 'black'; }
    document.getElementById('nextBtn').disabled = true;
  }
}


// ----------------- Utility -----------------
function clearLeaderLines(){ if(leaderLines && leaderLines.length){ leaderLines.forEach(l=>{try{l.remove();}catch(e){}});} leaderLines=[]; }
function clearSelectedInQuestion(question){ const container=document.getElementById('q'+questions.indexOf(question)); if(!container)return; container.querySelectorAll('.match-item.selected').forEach(el=>el.classList.remove('selected')); }

// ----------------- Navigation -----------------
function showQuestion(index){
    clearLeaderLines();
    document.querySelectorAll('.question').forEach(q=>q.classList.remove('active'));
    const el=document.getElementById('q'+index);
    if(!el){ document.getElementById('questionsContainer').innerHTML="<p>No questions.</p>"; return;}
    el.classList.add('active');
    const q=questions[index];
    if(q && (q.type==='connecting_dots'||q.type==='fill_in_blanks'||q.type==='multiple_choice')) document.getElementById('nextBtn').disabled=true;
}

function nextQuestion(){
    if(currentIndex < questions.length - 1){ currentIndex++; showQuestion(currentIndex); } 
    else { showResult(); }
}

// ----------------- Reset Module (Reusable for Retry or Exit) -----------------
function resetModule(clearSession = false) {
  clearLeaderLines();
  // Reset variables
  currentIndex = 0;
  questions.forEach(q => {
  if (q.type === 'multiple_choice') {
    q._answered = false;
    q._chosenId = null;
    q._isCorrect = false;
    q._answeredIndex = null; 
  }
  if (q.type === 'fill_in_blanks') q._answeredText = null;
  if (q.type === 'connecting_dots') q._matchedPairs = {};
});

  // Clear UI
  document.getElementById('questionsContainer').innerHTML = '';
  document.getElementById('scoreText').textContent = '';
  document.getElementById('summaryContent').innerHTML = '';

  // Reset input
  document.getElementById('studentName').value = '';

  // Hide all screens
  document.getElementById('moduleContainer').style.display = 'none';
  document.getElementById('resultContainer').style.display = 'none';
  document.getElementById('moduleLanding').style.display = 'none';

  // Reset session if it's a full exit (new student)
  if (clearSession) {
    sessionStorage.removeItem('student_id'); // clear stored ID
    STUDENT_ID = null;
    questions = [];
    currentIndex = 0;
    clearLeaderLines();
    document.getElementById('landing').style.display = 'block';
  } else {
    // Retry: show module landing again
    document.getElementById('moduleLanding').style.display = 'block';
  }
}

// ----------------- Show Result -----------------
async function showResult() {
  document.getElementById('moduleContainer').style.display = 'none';
  clearLeaderLines();

  // Prepare answers array
  const answersToSave = questions.map((q, index) => {
    if (q.type === 'multiple_choice') {
      const correctOpt = q.options[q.correct];
      const chosenOpt = q.shuffledOptions?.find(opt => opt.id === q._chosenId);
      return {
        question: q.text,
        type: q.type,
        correct: correctOpt ? correctOpt.text : null,
        selected: chosenOpt ? chosenOpt.text : null
      };
    } 
    else if (q.type === 'fill_in_blanks') {
      const blank = document.querySelector(`#q${index} .blank`);
      const correctOpt = q.options[q.correct];
      return {
        question: q.text,
        type: q.type,
        correct: correctOpt ? correctOpt.text : null,
        selected: blank ? blank.textContent.trim() : null
      };
    } 
    else if (q.type === 'connecting_dots') {
      // copy matched pairs as-is
      const matchedPairs = {};
      if (q._matchedPairs) Object.keys(q._matchedPairs).forEach(id => {
        matchedPairs[id] = q._matchedPairs[id];
      });
      return {
        question: q.text,
        type: q.type,
        correct: q.options.map(opt => ({ id: opt.id, matchId: opt.matchId })), // correct mapping
        selected: matchedPairs
      };
    } 
    else {
      return { question: q.text, type: q.type };
    }
  });

  // ---------------- Calculate Score ----------------
  let correctCount = 0;
  questions.forEach((q, index) => {
    if (q.type === 'multiple_choice' && q._isCorrect) correctCount++;
    if (q.type === 'fill_in_blanks') {
      const blank = document.querySelector(`#q${index} .blank`);
      if (
        blank &&
        q.options[q.correct] &&
        blank.textContent.trim().toLowerCase() === q.options[q.correct].text.trim().toLowerCase()
      ) correctCount++;
    }
    if (q.type === 'connecting_dots') {
  const studentPairs = q._matchedPairs || {};
  let matchedCorrectCount = 0;

  (q.correctPairs || []).forEach(pair => {
    if (studentPairs[pair.leftId] === pair.rightId) {
      matchedCorrectCount++;
    }
  });

  if (matchedCorrectCount === (q.correctPairs?.length || 0)) {
    correctCount++;
  }
}

  });

  const scorePercent = Math.round((correctCount / questions.length) * 100);

  // ---------------- Show Score ----------------
  document.getElementById('scoreText').textContent = 
    `You scored ${correctCount} out of ${questions.length} (${scorePercent}%)`;
  document.getElementById('resultContainer').style.display = 'block';

  // ---------------- Save Attempt ----------------
  await saveAttempt(MODULE_ID, {
    student_id: STUDENT_ID,
    score: scorePercent,
    total_correct: correctCount,
    total_questions: questions.length,
    answers: answersToSave
  });

  // ---------------- Retry / Exit ----------------
  document.getElementById('retryBtn').onclick = () => resetModule(false);
  document.getElementById('exitBtn').onclick = () => resetModule(true);

  // ---------------- View Summary toggle ----------------
  const summaryBtn = document.getElementById('summaryBtn');
  const summaryDiv = document.getElementById('summaryContent');

  summaryBtn.onclick = async () => {
    if (summaryDiv.style.display === 'none') {
      summaryDiv.innerHTML = '';

      for (let i = 0; i < answersToSave.length; i++) {
        const a = answersToSave[i];
        const div = document.createElement('div');
        div.style.marginBottom = '15px';
        let answerHTML = '';

        // ========== Multiple Choice & Fill-in-the-blanks ==========
        if (a.type === 'multiple_choice' || a.type === 'fill_in_blanks') {
          let yourAnswerText = a.selected || 'Not answered';
          let correctAnswerText = a.correct || 'No correct answer set';

          const q = questions[i];
          const questionImage = q.image ? await getSignedUrl(q.image) : null;
          const correctOption = q.options[q.correct];
          const correctOptionImage = (correctOption && correctOption.image) 
            ? await getSignedUrl(correctOption.image) : null;
          const chosenOpt = q.shuffledOptions?.find(opt => opt.id === q._chosenId);
          const selectedOptionImage = (chosenOpt && chosenOpt.image)
            ? await getSignedUrl(chosenOpt.image) : null;

          answerHTML = `<div><strong>Your answer:</strong> ${yourAnswerText}`;
          if (selectedOptionImage) answerHTML += `<br><img src="${selectedOptionImage}" style="max-width:100px;display:block;margin-top:3px;">`;
          answerHTML += `</div>`;

          answerHTML += `<div><strong>Correct answer:</strong> ${correctAnswerText}`;
          if (correctOptionImage) answerHTML += `<br><img src="${correctOptionImage}" style="max-width:100px;display:block;margin-top:3px;">`;
          answerHTML += `</div>`;

          if (questionImage) {
            answerHTML = `<div><strong>Question:</strong><br><img src="${questionImage}" style="max-width:150px;display:block;margin-bottom:5px;"></div>` + answerHTML;
          }
        }

        // ========== Matching / Connecting Dots ==========
        if (a.type === 'connecting_dots') {
          const yourPairs = await Promise.all(Object.keys(a.selected || {}).map(async leftId => {
            const rightId = a.selected[leftId];
            const leftItem = questions[i].options.find(opt => opt.id === leftId);
            const rightItem = questions[i].options.find(opt => opt.id === rightId);
            if (!leftItem || !rightItem) return '';

            let text = `${leftItem.text} - ${rightItem.text}`;
            if (leftItem.image) {
              const url = await getSignedUrl(leftItem.image);
              if (url) text += `<br><img src="${url}" style="max-width:100px;display:block;margin-top:3px;">`;
            }
            if (rightItem.image) {
              const url = await getSignedUrl(rightItem.image);
              if (url) text += `<br><img src="${url}" style="max-width:100px;display:block;margin-top:3px;">`;
            }
            return text;
          }));

          const correctPairs = await Promise.all(
            (questions[i].correctPairs || []).map(async ({ leftId, rightId }) => {
              const leftItem = questions[i].options.find(o => o.id === leftId);
              const rightItem = questions[i].options.find(o => o.id === rightId);
              if (!leftItem || !rightItem) return '';

              let text = `${leftItem.text} - ${rightItem.text}`;

              if (leftItem.image) {
                const url = await getSignedUrl(leftItem.image);
                if (url) text += `<br><img src="${url}" style="max-width:100px; display:block; margin-top:3px;">`;
              }
              if (rightItem.image) {
                const url = await getSignedUrl(rightItem.image);
                if (url) text += `<br><img src="${url}" style="max-width:100px; display:block; margin-top:3px;">`;
              }
              return text;
            })
          );

          answerHTML = `<div><strong>Your pairs:</strong><br>${yourPairs.join('<br>') || 'Not answered'}</div>
                        <div><strong>Correct pairs:</strong><br>${correctPairs.join('<br>')}</div>`;
        }

        div.innerHTML = `<strong>${a.question}</strong><br>${answerHTML}`;
        summaryDiv.appendChild(div);
      }

      summaryDiv.style.display = 'block';
      summaryBtn.textContent = 'Back';
      summaryDiv.scrollIntoView({ behavior: 'smooth' });
    } else {
      summaryDiv.style.display = 'none';
      summaryBtn.textContent = 'View Summary';
    }
  };
}

// ----------------- Save Attempt -----------------
async function saveAttempt(moduleId, attemptData){
    if(!STUDENT_ID) { console.error("Student ID not set."); return; }
    const attemptId = crypto.randomUUID();
    try {
        const { data, error } = await supabase.from('activity_attempts').insert([{
            attempt_id: attemptId,
            student_id: STUDENT_ID,
            module_id: moduleId,
            attempt_data: attemptData,
            createdAt: new Date().toISOString()
        }]);
        if(error) console.error("Failed to save attempt:", error);
        else console.log("Attempt saved:", data);
    } catch(e){ console.error("Exception in saveAttempt:", e); }
}

// ----------------- Expose Functions Globally -----------------
window.loadModule = loadModule;
window.nextQuestion = nextQuestion;
window.submitStudentInfo = submitStudentInfo;
window.showQuestion = showQuestion;
window.renderFillInBlanks = renderFillInBlanks;

