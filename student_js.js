const SUPABASE_URL = "https://aliyyqinorqlwmjhbqza.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsaXl5cWlub3JxbHdtamhicXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDY2OTgsImV4cCI6MjA3NDY4MjY5OH0.wqmf23uvtil0BJ0qlk8qm_Wq7LsaD1ClZKwnDr1OxME";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const SUPABASE_BUCKET_URL = "https://aliyyqinorqlwmjhbqza.supabase.co/storage/v1/object/public/";


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


let leaderLines = [];
let questions = [];
let currentIndex = 0;
let pendingLeft = null;

let STUDENT_ID = sessionStorage.getItem('student_id');

function showCustomAlert(title, message) {
    const alertBox = document.getElementById('customAlert');
    alertBox.querySelector('.custom-alert-header').textContent = title;
    alertBox.querySelector('.custom-alert-body').textContent = message;
    alertBox.style.display = 'block';
}

function closeCustomAlert() {
    document.getElementById('customAlert').style.display = 'none';
}

// ----------------- Background Music Setup -----------------
const bgMusic = document.getElementById('bgMusic');
bgMusic.volume = 0.2; // adjust volume (0 to 1)

const soundCorrect = document.getElementById('soundCorrect');
const soundWrong = document.getElementById('soundWrong');
const soundComplete = document.getElementById('soundComplete');

// ----------------- Load Module -----------------
async function loadModule() {

  bgMusic.play().catch(err => console.warn("bgMusic play failed:", err));

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

// ----------------- Submit Student Information -----------------
async function submitStudentInfo() {
    const fullName = document.getElementById('studentName').value.trim();
    if (!fullName) { 
        showCustomAlert("⚠️ Input Required", "Please enter your name before continuing.");
        return; 
    }
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

// ----------------- Start Module Button Handler -----------------
document.getElementById('startModuleBtn').onclick = () => {
  // Reset answers
  questions.forEach(q => {
    if (q.type === 'multiple_choice') q._answeredIndex = null;
    if (q.type === 'fill_in_blanks') q._answeredText = null;
    if (q.type === 'connecting_dots') q._matchedPairs = {};
  });
  
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

        if (q.type === 'connecting_dots') {
            q.options = q.options || [];
            q.options.forEach(opt => { if (!opt.id) opt.id = crypto.randomUUID(); });

            const matchContainer = document.createElement('div');
            matchContainer.className = 'match-container';
            matchContainer.style.display = 'flex';
            matchContainer.style.justifyContent = 'center';
            matchContainer.style.gap = '100px';
            matchContainer.style.marginTop = '40px';
            matchContainer.style.overflowX = 'auto';

            const leftCol = document.createElement('div');
            const rightCol = document.createElement('div');
            leftCol.className = 'match-col left-col';
            rightCol.className = 'match-col right-col';
            leftCol.style.display = rightCol.style.display = 'flex';
            leftCol.style.flexDirection = rightCol.style.flexDirection = 'column';
            leftCol.style.gap = rightCol.style.gap = '25px';
            leftCol.style.alignItems = rightCol.style.alignItems = 'center';

            // Map options by id
            const mapById = {};
            q.options.forEach(o => mapById[o.id] = o);

            // Build unique pairs set
            const pairSet = new Set();
            const pairs = [];
            q.options.forEach(o => {
                if (o.matchId) {
                    const key = [o.id, o.matchId].sort().join('_'); // unique key regardless of order
                    if (!pairSet.has(key)) {
                        pairs.push({ leftId: o.id, rightId: o.matchId });
                        pairSet.add(key);
                    }
                } else {
                    pairs.push({ leftId: o.id, rightId: null });
                }
            });

            q.correctPairs = pairs.map(p => ({ leftId: p.leftId, rightId: p.rightId }));

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

            pairs.forEach(p => {
                const leftDiv = makeItemDiv(mapById[p.leftId], 'left');
                const rightDiv = makeItemDiv(p.rightId ? mapById[p.rightId] : null, 'right');
                leftCol.appendChild(leftDiv);
                rightCol.appendChild(rightDiv);
            });

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
    const allOptions = document.querySelectorAll(`#q${qIndex} .option`);
    allOptions.forEach(o => o.classList.remove('correct', 'wrong', 'selected'));
    element.classList.add('selected');

    // determine correctId
    if (typeof q.correct === 'number') {
        q.correctId = q.options[q.correct] ? q.options[q.correct].id : null;
    } else if (typeof q.correct === 'string') {
        q.correctId = q.correct;
    } else {
        q.correctId = null;
    }

    // highlight selected option
    if (chosenId === q.correctId) {
        element.classList.add('correct');
        if (feedback) { feedback.textContent = '✅ Tama ang sagot mo!'; feedback.style.color = 'green'; }
        q._isCorrect = true;
        if (window.soundCorrect) soundCorrect.play();
    } else {
        element.classList.add('wrong');
        if (feedback) { feedback.textContent = '❌ Mali ang sagot mo!'; feedback.style.color = 'red'; }
        q._isCorrect = false;
        if (window.soundWrong) soundWrong.play();

        // highlight the correct option even if wrong
        if (q.correctId) {
            const correctBtn = document.querySelector(`#q${qIndex} .option[data-optid="${q.correctId}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
        }
    }

    // enable next button after selecting
    document.getElementById('nextBtn').disabled = false;
}



    // ----------------- Fill-in-Blanks ----------------
    function renderFillInBlanks(qIndex, q, container) {
      const blanksDiv = document.createElement('div');
      blanksDiv.className = 'blanks-container';

      const label = document.createElement('div');
      label.textContent = "I-drag ang sagot mo dito sa patlang:";
      label.style.fontSize = "14.4px";
      label.style.marginBottom = "6px";
      blanksDiv.appendChild(label);

      // ensure answeredBlanks exists on question
      q._answeredBlanks = q._answeredBlanks || {};

      // create a single blank element (if you want >1 blanks per question adapt this)
      const blank = document.createElement('span');
      blank.className = 'blank placeholder';
      blank.textContent = "Ihulog Dito";

      // create a stable id for this blank
      blank.dataset.id = `q${qIndex}_blank0`;

      // store correct answer text on dataset (normalize)
      blank.dataset.correct = (q.options && q.options[q.correct] && q.options[q.correct].text) ? q.options[q.correct].text : '';

      blank.ondragover = (ev) => ev.preventDefault();
      blank.ondrop = (ev) => handleDrop(ev, blank, qIndex);
      blanksDiv.appendChild(blank);
      container.appendChild(blanksDiv);

      // Options bank
      const optionsBank = document.createElement('div');
      optionsBank.className = 'options-bank';

      const shuffledOptions = shuffleArray([...q.options || []]);

      shuffledOptions.forEach(opt => {
          const div = document.createElement('div');
          div.className = 'option';
          div.textContent = opt.text;
          div.draggable = true;
          // store an id in the dataTransfer so we can track which option exactly
          div.ondragstart = (ev) => {
              try {
                  ev.dataTransfer.setData('text/plain', opt.text);
                  ev.dataTransfer.setData('application/option-id', opt.id || opt.text);
              } catch (e) {
                  // fallback
                  ev.dataTransfer.setData('text', opt.text);
              }
          };
          optionsBank.appendChild(div);
      });

      container.appendChild(optionsBank);

      const fb = document.createElement('div');
      fb.className = 'feedback';
      container.appendChild(fb);

      // If there's already an answered value for this blank, populate it
      const existing = q._answeredBlanks[blank.dataset.id];
      if (existing) {
          blank.textContent = existing;
          blank.classList.add('filled');
          blank.style.pointerEvents = 'none';
          // apply visual correctness if matches
          const correctAnswer = (blank.dataset.correct || '').trim().toLowerCase();
          if (existing.trim().toLowerCase() === correctAnswer) {
              fb.textContent = '✅ Tama ang sagot mo!';
              fb.style.color = 'green';
              blank.style.backgroundColor = 'lightgreen';
              blank.style.border = '2px solid green';
          } else {
              fb.textContent = '❌ Mali ang sagot mo!';
              fb.style.color = 'red';
              blank.style.backgroundColor = 'lightcoral';
              blank.style.border = '2px solid red';
              const correctSpan = document.createElement('span');
              correctSpan.textContent = ` (${blank.dataset.correct})`;
              correctSpan.style.color = 'green';
              correctSpan.style.marginLeft = '6px';
              blank.insertAdjacentElement('afterend', correctSpan);
          }
      }

      // Set initial next button state for this question
      const totalBlanks = container.querySelectorAll('.blank').length;
      const answeredCount = Object.keys(q._answeredBlanks).length;
      document.getElementById('nextBtn').disabled = answeredCount < totalBlanks;
    }

  function handleDrop(ev, blank, qIndex) {
    ev.preventDefault();
    const q = questions[qIndex];
    if (!q) return;

    // try to prefer option-id if provided, but fallback to text
    let dataText = '';
    try {
        dataText = ev.dataTransfer.getData('text/plain').trim() || ev.dataTransfer.getData('text').trim();
    } catch (e) {
        dataText = ev.dataTransfer.getData('text').trim();
    }
    if (!dataText) return;

    // Mark this blank as filled
    blank.textContent = dataText;
    blank.classList.add('filled');
    blank.style.pointerEvents = 'none';

    // Ensure q._answeredBlanks exists and use blank.dataset.id as key
    q._answeredBlanks = q._answeredBlanks || {};
    q._answeredBlanks[blank.dataset.id] = dataText;

    const correctAnswer = (blank.dataset.correct || '').trim().toLowerCase();
    const fb = document.querySelector(`#q${qIndex} .feedback`);

    // clear any previous helper correctSpan next to blank
    const nextSibling = blank.nextElementSibling;
    if (nextSibling && nextSibling.tagName === 'SPAN') nextSibling.remove();

    if (dataText.toLowerCase() === correctAnswer) {
        if (fb) { fb.textContent = '✅ Tama ang sagot mo!'; fb.style.color = 'green'; }
        blank.style.backgroundColor = 'lightgreen';
        blank.style.border = '2px solid green';
        try { if (window.soundCorrect) soundCorrect.play(); } catch(e) {}
    } else {
        if (fb) { fb.textContent = '❌ Mali ang sagot mo!'; fb.style.color = 'red'; }
        blank.style.backgroundColor = 'lightcoral';
        blank.style.border = '2px solid red';
        const correctSpan = document.createElement('span');
        correctSpan.textContent = ` (${blank.dataset.correct})`;
        correctSpan.style.color = 'green';
        correctSpan.style.marginLeft = '6px';
        blank.insertAdjacentElement('afterend', correctSpan);
        try { if (window.soundWrong) soundWrong.play(); } catch(e) {}
    }

    // Update answered status on question
    const totalBlanks = document.querySelectorAll(`#q${qIndex} .blank`).length;
    const answeredCount = Object.keys(q._answeredBlanks).length;

    // mark question as answered if all blanks filled
    if (answeredCount === totalBlanks) {
        q._answered = true;
        q._answeredText = Object.values(q._answeredBlanks).join(', ');
    }

    // Update Next button for the currently visible question only
    const visibleQIndex = currentIndex;
    if (visibleQIndex === qIndex) {
        document.getElementById('nextBtn').disabled = answeredCount < totalBlanks;
    }
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
    if (fb) { 
      fb.textContent = '✅ Tamang pares!'; fb.style.color = 'green'; 
      if (window.soundCorrect) soundCorrect.play();
    }
  } else {
    const fb = leftEl.closest('.question').querySelector('.feedback');
    if (fb) { 
      fb.textContent = '❌ Hindi tugma'; fb.style.color = 'red'; 
      if (window.soundWrong) soundWrong.play();
    }
    // do NOT save wrong pair (so students can try again)
  }

  updateMatchingProgress(question);
}

function drawLeaderLine(el1, el2, isCorrect) {
  if (!el1 || !el2) return;

  if (typeof LeaderLine === 'undefined') {
    console.error("LeaderLine library not loaded!");
    return;
  }
  const container = document.getElementById('moduleContainer'); // full module container
  const matchContainer = el1.closest('.match-container') || document.body; // full match container

  const line = new LeaderLine(el1, el2, {
    color: isCorrect ? 'blue' : 'red',
    size: 3,
    path: 'straight',
    startPlug: 'disc',
    endPlug: 'disc',
    dash: isCorrect ? false : { animation: true },
    container: container,      // attach to the full module container
    startSocket: 'middle',
    endSocket: 'middle'
  });

  leaderLines.push(line);

  if (!isCorrect) {
    setTimeout(() => {
      try { line.remove(); } catch (e) {}
    }, 1500);
  }

  container.addEventListener('scroll', () => line.position());
  matchContainer.addEventListener('scroll', () => line.position());
  window.addEventListener('resize', () => line.position());
}


// ----------------- Update progress and enable Next -----------------
function updateMatchingProgress(question) {
  const studentPairs = question._matchedPairs || {};
  const correctPairs = (question.correctPairs || []).filter(p => p.leftId && p.rightId);
  const matchedCorrectCount = correctPairs.filter(p => studentPairs[p.leftId] === p.rightId).length;

  const fb = document.querySelector(`#q${questions.indexOf(question)} .feedback`);
  const totalPairs = correctPairs.length;

  if (totalPairs > 0 && matchedCorrectCount === totalPairs) {
    if (fb) { 
      fb.textContent = '✅ Tama lahat ng pares!'; fb.style.color = 'green'; 
      if (window.soundCorrect) soundCorrect.play();
    }
    document.getElementById('nextBtn').disabled = false;
  } else {
    if (fb && matchedCorrectCount > 0) { 
      fb.textContent = `${matchedCorrectCount} / ${totalPairs} tama`; fb.style.color = 'black'; 
      if (window.soundCorrect) soundCorrect.play();
    }
    document.getElementById('nextBtn').disabled = true;
  }
}


// ----------------- Utility -----------------
function clearLeaderLines(){ if(leaderLines && leaderLines.length){ leaderLines.forEach(l=>{try{l.remove();}catch(e){}});} leaderLines = []; }
function clearSelectedInQuestion(question){ const container=document.getElementById('q'+questions.indexOf(question)); if(!container)return; container.querySelectorAll('.match-item.selected').forEach(el=>el.classList.remove('selected')); }

// ----------------- Navigation -----------------
function showQuestion(index){
    clearLeaderLines();
    document.querySelectorAll('.question').forEach(q=>q.classList.remove('active'));
    const el = document.getElementById('q'+index);
    if(!el){
        document.getElementById('questionsContainer').innerHTML="<p>No questions.</p>"; 
        return;
    }
    el.classList.add('active');

    const q = questions[index];
    const nextBtn = document.getElementById('nextBtn');

    if(q){
        if(q.type === 'multiple_choice'){
            nextBtn.disabled = !q._answered;
        } 
        else if (q.type === 'fill_in_blanks') {
    // determine blanks count from DOM and compare to stored answered blanks
    const totalBlanks = document.querySelectorAll(`#q${index} .blank`).length;
    q._answeredBlanks = q._answeredBlanks || {};
    const answeredCount = Object.keys(q._answeredBlanks).length;

    // If blanks were previously answered but DOM isn't populated (edge case), populate DOM now
    if (answeredCount > 0) {
        document.querySelectorAll(`#q${index} .blank`).forEach(b => {
            const existing = q._answeredBlanks[b.dataset.id];
            if (existing) {
                b.textContent = existing;
                b.classList.add('filled');
                b.style.pointerEvents = 'none';
                // update feedback appearance if needed
                const correctAnswer = (b.dataset.correct || '').trim().toLowerCase();
                const fb = document.querySelector(`#q${index} .feedback`);
                if (existing.trim().toLowerCase() === correctAnswer) {
                    if (fb) { fb.textContent = '✅ Tama ang sagot mo!'; fb.style.color = 'green'; }
                    b.style.backgroundColor = 'lightgreen';
                    b.style.border = '2px solid green';
                } else {
                    if (fb) { fb.textContent = '❌ Mali ang sagot mo!'; fb.style.color = 'red'; }
                    b.style.backgroundColor = 'lightcoral';
                    b.style.border = '2px solid red';
                    // show correct answer text near it if not present
                    if (!b.nextElementSibling || b.nextElementSibling.tagName !== 'SPAN') {
                        const cs = document.createElement('span');
                        cs.textContent = ` (${b.dataset.correct})`;
                        cs.style.color = 'green';
                        cs.style.marginLeft = '6px';
                        b.insertAdjacentElement('afterend', cs);
                    }
                }
            }
        });
    }

    nextBtn.disabled = answeredCount < totalBlanks;
}

        else if(q.type === 'connecting_dots'){
            const studentPairs = q._matchedPairs || {};
            const correctPairs = (q.correctPairs || []).filter(p => p.leftId && p.rightId);
            const matchedCorrectCount = correctPairs.filter(p => studentPairs[p.leftId] === p.rightId).length;
            nextBtn.disabled = matchedCorrectCount !== correctPairs.length;
        }
    }

    // Update progress bar
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    progressText.textContent = `Tanong ${index + 1} of ${questions.length}`;
    const progressPercent = ((index + 1) / questions.length) * 100;
    progressBar.style.width = `${progressPercent}%`;
}


function nextQuestion(){
    if(currentIndex < questions.length - 1){
        currentIndex++; 
        showQuestion(currentIndex);
    } else { 
        // fill progress bar to 100% on completion
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = '100%';
        showResult(); 
    }
}

// ----------------- Reset Module (Reusable for Retry or Exit) -----------------
function resetModule(clearSession = false) {
  clearLeaderLines();

  // Reset variables for all question types
  currentIndex = 0;
  questions.forEach(q => {
    if (q.type === 'multiple_choice') {
      q._answered = false;
      q._chosenId = null;
      q._isCorrect = false;
      q._answeredIndex = null;
    }

    // ✅ Reset fill-in-the-blanks (new structure)
    if (q.type === 'fill_in_blanks') {
      q._answeredText = null;
      q._answeredBlanks = {}; // Clears all blank entries
      q._isCorrect = false;
    }

    // ✅ Reset matching (connecting dots)
    if (q.type === 'connecting_dots') {
      q._matchedPairs = {};
      q._isCorrect = false;
    }
  });

  // ✅ Clear all question/score/summary UI
  document.getElementById('questionsContainer').innerHTML = '';
  document.getElementById('scoreText').textContent = '';

  // ✅ Summary Reset (important fix)
  const summaryDiv = document.getElementById('summaryContent');
  const summaryBtn = document.getElementById('summaryBtn');
  if (summaryDiv) {
    summaryDiv.innerHTML = ''; // Remove old summary items
    summaryDiv.style.display = 'none'; // Hide it by default
  }
  if (summaryBtn) summaryBtn.textContent = 'View Summary'; // Reset button label

  // ✅ Reset student input
  const studentNameInput = document.getElementById('studentName');
  if (studentNameInput) studentNameInput.value = '';

  // ✅ Hide all containers
  const containers = ['moduleContainer', 'resultContainer', 'moduleLanding'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // ✅ Clear confetti canvas if any
  const confettiCanvas = document.querySelector('canvas.confetti-canvas');
  if (confettiCanvas) confettiCanvas.remove();

  // ✅ Reset session (Exit flow)
  if (clearSession) {
    sessionStorage.removeItem('student_id'); // clear stored ID
    STUDENT_ID = null;
    questions = [];
    currentIndex = 0;
    clearLeaderLines();
    const landing = document.getElementById('landing');
    if (landing) landing.style.display = 'block';
  } else {
    // ✅ Retry flow
    const landing = document.getElementById('moduleLanding');
    if (landing) landing.style.display = 'block';
  }

  // ✅ Scroll up for clean start
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // ✅ Reset navigation
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.disabled = true;
}


function launchConfetti() {
  const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF8C00"];
  const confettiCount = 80;
  const container = document.body;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement("div");
    confetti.classList.add("confetti");
    confetti.style.left = Math.random() * window.innerWidth + "px";
    confetti.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
    confetti.style.animationDuration = 2 + Math.random() * 2 + "s";
    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 4000);
  }
}

// ----------------- Show Result (robust replacement) -----------------
async function showResult() {
  try {
    
    try { document.getElementById('moduleContainer').style.display = 'none'; } catch(e){}
    try { if (typeof clearLeaderLines === 'function') clearLeaderLines(); } catch(e){}

    // Play confetti and sound later 
    try { if (typeof soundComplete !== 'undefined' && soundComplete) soundComplete.play(); } catch(e){ console.warn('soundComplete play failed', e); }

    const answersToSave = questions.map((q, index) => {
      try {
        if (!q) return { question: `Question ${index+1}`, type: 'unknown', selected: null, correct: null };

        // multiple choice
        if (q.type === 'multiple_choice') {
          const correctText = q.options?.[q.correct]?.text ?? null;
          const chosen = q._chosenId ? (q.shuffledOptions?.find(o => o.id === q._chosenId)?.text ?? null) : null;
          return { question: q.text ?? null, type: q.type, correct: correctText, selected: chosen };
        }

        // fill in blanks 
        if (q.type === 'fill_in_blanks') {
          const selected = q._answeredBlanks ? Object.values(q._answeredBlanks).join(', ') : (q._answeredText ?? null);
          const correctText = q.options?.[q.correct]?.text ?? null;
          return { question: q.text ?? null, type: q.type, correct: correctText, selected };
        }

        // connecting dots
        if (q.type === 'connecting_dots') {
          const matched = {};
          if (q._matchedPairs) Object.keys(q._matchedPairs).forEach(k => matched[k] = q._matchedPairs[k]);
          const correct = (q.options || []).map(opt => ({ id: opt.id, matchId: opt.matchId }));
          return { question: q.text ?? null, type: q.type, correct, selected: matched };
        }

        // fallback
        return { question: q.text ?? `Question ${index+1}`, type: q.type ?? 'unknown', selected: null, correct: null };
      } catch (innerErr) {
        console.error(`Error mapping question ${index}`, innerErr);
        return { question: q?.text ?? `Question ${index+1}`, type: q?.type ?? 'unknown', selected: null, correct: null };
      }
    });

    // Calculate score 
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q) continue;
      try {
        if (q.type === 'multiple_choice') {
          if (q._isCorrect) correctCount++;
        } else if (q.type === 'fill_in_blanks') {
          const user = q._answeredBlanks ? Object.values(q._answeredBlanks).join(', ').trim().toLowerCase() : (q._answeredText || '').trim().toLowerCase();
          const correct = (q.options?.[q.correct]?.text || '').trim().toLowerCase();
          if (correct && user === correct) correctCount++;
        } else if (q.type === 'connecting_dots') {
          const studentPairs = q._matchedPairs || {};
          let matchedCorrectCount = 0;
          (q.correctPairs || []).forEach(pair => {
            if (studentPairs[pair.leftId] === pair.rightId) matchedCorrectCount++;
          });
          if (matchedCorrectCount === (q.correctPairs?.length || 0) && (q.correctPairs?.length || 0) > 0) {
            correctCount++;
          }
        }
      } catch (err) {
        console.warn('Score calc error for question', i, err);
      }
    }

    const totalQuestions = questions.length || 1;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);

    // Ensure resultContainer exists — if not, create a minimal one so user sees something
    let resultContainer = document.getElementById('resultContainer');
    if (!resultContainer) {
      resultContainer = document.createElement('div');
      resultContainer.id = 'resultContainer';
      resultContainer.style = "position:fixed;inset:0;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.4);z-index:9999;";
      resultContainer.innerHTML = `
        <div class="result-card" style="background:#fff;padding:20px;border-radius:12px;max-width:520px;width:90%;text-align:center;">
          <h2 class="result-title">🎉 Module Results 🎉</h2>
          <p id="scoreText" class="score-text"></p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
            <button id="retryBtn" style="padding:8px 12px;border-radius:8px;">Retry</button>
            <button id="exitBtn" style="padding:8px 12px;border-radius:8px;">Exit</button>
            <button id="summaryBtn" style="padding:8px 12px;border-radius:8px;">View Summary</button>
          </div>
          <div id="summaryContent" style="margin-top:12px;display:none;text-align:left;max-height:300px;overflow:auto;"></div>
        </div>`;
      document.body.appendChild(resultContainer);
    }

    // Show (use flex so it centers)
    resultContainer.style.display = resultContainer.style.display === 'none' ? 'flex' : 'flex';
    // Put score text
    try {
      const scoreTextEl = document.getElementById('scoreText') || resultContainer.querySelector('#scoreText');
      if (scoreTextEl) scoreTextEl.textContent = `Ang marka mo ay ${correctCount} sa ${totalQuestions} (${scorePercent}%)`;
    } catch(e){ console.warn('Failed to set scoreText', e); }

    // Play confetti 
    try {
      if (typeof launchConfetti === 'function') launchConfetti();
      else if (typeof confetti === 'function') confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }});
    } catch (e) { console.warn('Confetti failed', e); }

    // Save attempt 
    try {
      if (typeof saveAttempt === 'function') {
        await saveAttempt(MODULE_ID, {
          student_id: STUDENT_ID,
          score: scorePercent,
          total_correct: correctCount,
          total_questions: totalQuestions,
          answers: answersToSave
        });
      } else {
        console.warn('saveAttempt not defined');
      }
    } catch (saveErr) {
      console.error('Failed to save attempt', saveErr);
    }

    // Wire up retry/exit/summary handlers if present
    try {
      const retryBtn = document.getElementById('retryBtn');
      if (retryBtn) retryBtn.onclick = () => resetModule(false);
      const exitBtn = document.getElementById('exitBtn');
      if (exitBtn) exitBtn.onclick = () => resetModule(true);
      const summaryBtn = document.getElementById('summaryBtn');
      const summaryDiv = document.getElementById('summaryContent');
      if (summaryBtn && summaryDiv) {
        summaryBtn.onclick = async () => {
  if (summaryDiv.style.display === 'none' || summaryDiv.style.display === '') {
    summaryDiv.innerHTML = '';

    for (let i = 0; i < answersToSave.length; i++) {
      const a = answersToSave[i];
      const q = questions[i] || {};
      const questionNumber = i + 1;

      // Wrapper for each question
      const div = document.createElement('div');
      div.classList.add('summary-item');
      div.style.marginBottom = '25px';
      div.style.padding = '15px';
      div.style.border = '2px solid #2c3e85';
      div.style.borderRadius = '12px';
      div.style.background = '#fffdf5';
      div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

      const header = `<h3 style="margin-top:0;">${questionNumber}. ${a.question || '(Untitled Question)'}</h3>`;
      let content = '';

      // ---------------- MULTIPLE CHOICE / FILL-IN ----------------
      if (a.type === 'multiple_choice' || a.type === 'fill_in_blanks') {
        let yourAnswerText = a.selected || 'Not answered';
        let correctAnswerText = a.correct || 'No correct answer set';

        const qObj = questions[i];
        const questionImage = qObj.image ? await getSignedUrl(qObj.image) : null;
        const correctOption = qObj.options[qObj.correct];
        const correctOptionImage = (correctOption && correctOption.image)
          ? await getSignedUrl(correctOption.image) : null;
        const chosenOpt = qObj.shuffledOptions?.find(opt => opt.id === qObj._chosenId);
        const selectedOptionImage = (chosenOpt && chosenOpt.image)
          ? await getSignedUrl(chosenOpt.image) : null;

        content = `
          ${questionImage ? `<img src="${questionImage}" style="max-width:150px;display:block;margin-bottom:10px;">` : ''}
          <div><strong>Your answer:</strong> ${yourAnswerText}</div>
          ${selectedOptionImage ? `<img src="${selectedOptionImage}" style="max-width:100px;display:block;margin:5px 0;">` : ''}
          <div><strong>Correct answer:</strong> ${correctAnswerText}</div>
          ${correctOptionImage ? `<img src="${correctOptionImage}" style="max-width:100px;display:block;margin:5px 0;">` : ''}
        `;
      }

        // ---------------- MATCHING (SIDE-BY-SIDE WITH TITLES + TEXT ABOVE IMAGES) ----------------
        else if (a.type === 'connecting_dots') {
          const qObj = questions[i];
          const studentPairs = qObj._matchedPairs || {};
          const correctPairs = qObj.correctPairs || [];

          let pairsHTML = `
            <div style="margin-top:15px;">
              <h4 style="color:#2c3e85;margin-bottom:5px;">Your Pairs</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr;text-align:center;font-weight:bold;color:#2c3e85;margin-bottom:8px;">
                <div>Left Side</div>
                <div>Right Side</div>
              </div>
          `;

          // ---------- YOUR PAIRS ----------
          const yourPairEntries = Object.entries(studentPairs);
          if (yourPairEntries.length === 0) {
            pairsHTML += `<div style="text-align:center;font-style:italic;">No pairs matched.</div>`;
          } else {
            for (const [leftId, rightId] of yourPairEntries) {
              const left = qObj.options.find(o => o.id === leftId);
              const right = qObj.options.find(o => o.id === rightId);

              const leftCell = left
                ? `
                  <div style="font-size:16px;">
                    ${left.text ? `<div style="margin-bottom:4px;">${left.text}</div>` : ''}
                    ${left.image ? `<img src="${await getSignedUrl(left.image)}" style="max-width:120px;border-radius:10px;">` : ''}
                  </div>
                `
                : '';

              const rightCell = right
                ? `
                  <div style="font-size:16px;">
                    ${right.text ? `<div style="margin-bottom:4px;">${right.text}</div>` : ''}
                    ${right.image ? `<img src="${await getSignedUrl(right.image)}" style="max-width:120px;border-radius:10px;">` : ''}
                  </div>
                `
                : '';

              pairsHTML += `
                <div style="display:grid;grid-template-columns:1fr 1fr;align-items:center;text-align:center;border-bottom:1px dashed #ccc;padding:10px 0;">
                  <div>${leftCell}</div>
                  <div>${rightCell}</div>
                </div>
              `;
            }
          }

          // ---------- CORRECT PAIRS ----------
          pairsHTML += `
              <h4 style="color:#2c3e85;margin-top:20px;margin-bottom:5px;">Correct Pairs</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr;text-align:center;font-weight:bold;color:#2c3e85;margin-bottom:8px;">
                <div>Left Side</div>
                <div>Right Side</div>
              </div>
          `;

          if (correctPairs.length === 0) {
            pairsHTML += `<div style="text-align:center;font-style:italic;">No correct pairs set.</div>`;
          } else {
            for (const { leftId, rightId } of correctPairs) {
              const left = qObj.options.find(o => o.id === leftId);
              const right = qObj.options.find(o => o.id === rightId);

              const leftCell = left
                ? `
                  <div style="font-size:16px;">
                    ${left.text ? `<div style="margin-bottom:4px;">${left.text}</div>` : ''}
                    ${left.image ? `<img src="${await getSignedUrl(left.image)}" style="max-width:120px;border-radius:10px;">` : ''}
                  </div>
                `
                : '';

              const rightCell = right
                ? `
                  <div style="font-size:16px;">
                    ${right.text ? `<div style="margin-bottom:4px;">${right.text}</div>` : ''}
                    ${right.image ? `<img src="${await getSignedUrl(right.image)}" style="max-width:120px;border-radius:10px;">` : ''}
                  </div>
                `
                : '';

              pairsHTML += `
                <div style="display:grid;grid-template-columns:1fr 1fr;align-items:center;text-align:center;border-bottom:1px dashed #ccc;padding:10px 0;">
                  <div>${leftCell}</div>
                  <div>${rightCell}</div>
                </div>
              `;
            }
          }

          pairsHTML += `</div>`;
          content = pairsHTML;
        }

      div.innerHTML = header + content;
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
    } catch (wireErr) { console.warn('Failed wiring result buttons', wireErr); }

  } catch (err) {
    console.error('Unhandled error in showResult():', err);
    // As a last resort, still reveal any basic result UI so user isn't left with just confetti
    try {
      const rc = document.getElementById('resultContainer') || document.body.appendChild(document.createElement('div'));
      if (rc) rc.style.display = 'block';
    } catch(e){}
    alert('Nagka-problema habang pinapakita ang resulta — tingnan ang console (F12) para sa detalye.');
  }
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

