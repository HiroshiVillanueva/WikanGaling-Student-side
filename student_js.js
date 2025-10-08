const SUPABASE_URL = "https://aliyyqinorqlwmjhbqza.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsaXl5cWlub3JxbHdtamhicXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDY2OTgsImV4cCI6MjA3NDY4MjY5OH0.wqmf23uvtil0BJ0qlk8qm_Wq7LsaD1ClZKwnDr1OxME";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const SUPABASE_BUCKET_URL = "https://aliyyqinorqlwmjhbqza.supabase.co/storage/v1/object/public/";

//const MODULE_ID = "51eea546-24a5-46c2-87f4-493d71ae8030"; // sample module id -- later to be replaced with generated url

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
    const normalizedName = fullName.replace(/\s+/g, ' '); // remove extra spaces
    if (!fullName) { alert("Enter your name"); return; }

    const firstName = fullName.split(' ')[0];

    try {
        const { data, error } = await supabase
          .from('students')
          .select('id')
          .ilike('name', normalizedName)
          .maybeSingle();

        if(!data) {
            // New student
            const newId = crypto.randomUUID();
            const { data: insertData, error: insertError } = await supabase
                .from('students')
                .insert([{ id: newId, name: fullName, username: firstName }])
                .select()
                .single();
            STUDENT_ID = newId;
            
            // Reset questions
            questions.forEach(q => {
                if(q.type==='multiple_choice') q._answeredIndex = null;
                if(q.type==='fill_in_blanks') q._answeredText = null;
                if(q.type==='connecting_dots') q._matchedPairs = {};
            });

        } else {
            STUDENT_ID = data.id;
        }


        sessionStorage.setItem('student_id', STUDENT_ID);

        document.getElementById('landing').style.display = 'none';
        document.getElementById('moduleLanding').style.display = 'block';

        const { data: moduleData, error: moduleError } = await supabase
            .from("forms_metadata")
            .select("title, form_data")
            .eq("id", MODULE_ID)
            .single();

        if (moduleError || !moduleData) { alert("Failed to load module info."); return; }

        document.getElementById('moduleLandingTitle').textContent = moduleData.form_data.title || "Untitled Module";
        document.getElementById('moduleLandingDesc').textContent = moduleData.form_data.description || "No description available.";

        document.getElementById('startModuleBtn').onclick = () => {
            document.getElementById('moduleLanding').style.display = 'none';
            loadModule();
        };

    } catch(err) {
        console.error("submitStudentInfo failed:", err);
        alert("Check console for Supabase errors.");
    }
}

// ----------------- Start Module Button -----------------
document.getElementById('startModuleBtn').onclick = () => {
    // Reset answers before starting
    questions.forEach(q => {
        if(q.type==='multiple_choice') q._answeredIndex = null;
        if(q.type==='fill_in_blanks') q._answeredText = null;
        if(q.type==='connecting_dots') q._matchedPairs = {};
    });

    document.getElementById('moduleLanding').style.display = 'none';
    document.getElementById('moduleContainer').style.display = 'block';
    renderQuestions();
    currentIndex = 0;
    showQuestion(currentIndex);
};

// ----------------- Load Module -----------------
async function loadModule() {
  document.getElementById('landing').style.display='none';
  document.getElementById('moduleContainer').style.display='block';

  const { data, error } = await supabase
    .from("forms_metadata")
    .select("title, form_data, user_id")
    .eq("id", MODULE_ID)
    .single();

  if (error || !data) {
    alert("Failed to load module.");
    console.error(error);
    return;
  }

  const moduleData = data.form_data;
  questions = moduleData.questions || [];
  document.getElementById('moduleTitle').textContent = moduleData.title || 'Untitled';
  renderQuestions();
  showQuestion(currentIndex);
}


// ----------------- Render Questions -----------------
function renderQuestions() {

    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question';
        div.id = 'q' + index;

        const title = document.createElement('h3');
        title.textContent = `${index + 1}. ${q.text}`;
        div.appendChild(title);

        if (q.image) {
          const qImg = document.createElement('img');
          qImg.src = `${SUPABASE_BUCKET_URL}${q.image}`;  
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

            q.options.forEach((opt, i) => {
                const btn = document.createElement('div');
                btn.className = 'option';
                btn.innerHTML = opt.text;

               if (opt.image) {
                  const img = document.createElement('img');
                  img.src = `${SUPABASE_BUCKET_URL}${opt.image}`; 
                  img.alt = opt.text || 'Option image';
                  img.style.maxWidth = '120px';
                  img.style.display = 'block';
                  img.style.marginTop = '5px';
                  btn.appendChild(img);
              }


                btn.onclick = () => validateMCQ(index, i, btn);
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

        // ---------------- Connecting Dots ----------------
        if (q.type === 'connecting_dots') {
            const matchContainer = document.createElement('div');
            matchContainer.className = 'match-container';
            const left = document.createElement('div');
            left.className = 'match-list';
            const right = document.createElement('div');
            right.className = 'match-list';

            const textItems = q.options.filter((_, i) => i % 2 === 0);
            const imageItems = q.options.filter((_, i) => i % 2 !== 0);

            q._matchedPairs = q._matchedPairs || {};

            textItems.forEach(item => {
                const divItem = document.createElement('div');
                divItem.className = 'match-item';
                divItem.textContent = item.text;
                divItem.dataset.id = item.id;
                if (item.matchId) divItem.dataset.matchId = item.matchId;
                divItem.onclick = () => handleMatchClick(divItem, q);
                left.appendChild(divItem);
            });

            imageItems.forEach(item => {
                const divItem = document.createElement('div');
                divItem.className = 'match-item';
                divItem.dataset.id = item.id;
                if (item.matchId) divItem.dataset.matchId = item.matchId;

                if (item.image) {
                  const img = document.createElement('img');
                  img.src = `${SUPABASE_BUCKET_URL}${item.image}`; 
                  img.alt = item.text || 'Matching image';
                  img.style.maxWidth = '120px';
                  img.style.display = 'block';
                  img.style.margin = '5px auto';
                  divItem.appendChild(img);
              }
              else {
                    divItem.textContent = item.text;
                }

                divItem.onclick = () => handleMatchClick(divItem, q);
                right.appendChild(divItem);
            });

            matchContainer.appendChild(left);
            matchContainer.appendChild(right);
            div.appendChild(matchContainer);

            const fb = document.createElement('div');
            fb.className = 'feedback';
            div.appendChild(fb);
        }

        container.appendChild(div);
    });
}


// ----------------- MCQ Validation -----------------
function validateMCQ(qIndex, chosenIndex, element) {
    const q = questions[qIndex];

    if (q._answeredIndex !== null && q._answeredIndex !== undefined) return;

    q._answeredIndex = chosenIndex;
    const feedback = document.querySelector(`#q${qIndex} .feedback`);
    document.querySelectorAll(`#q${qIndex} .option`).forEach(o => o.classList.remove('correct', 'wrong', 'selected'));
    element.classList.add('selected');

    if (chosenIndex === q.correct) {
        element.classList.add('correct');
        feedback.textContent = '✅ Correct!';
        feedback.style.color = 'green';
    } else {
        element.classList.add('wrong');
        feedback.textContent = '❌ Incorrect.';
        feedback.style.color = 'red';
    }

    document.getElementById('nextBtn').disabled = false;
}

// ----------------- Fill-in-Blanks -----------------
function renderFillInBlanks(qIndex,q,container){
    const blanksDiv=document.createElement('div'); blanksDiv.className='blanks-container';
    const label = document.createElement('div');
    label.textContent = "Drag your answer here in the blank:";
    label.style.fontSize = "0.9em"; label.style.marginBottom = "6px";
    blanksDiv.appendChild(label);

    const blank = document.createElement('span');
    blank.className = 'blank placeholder'; blank.textContent = "Drop here";
    blank.dataset.correct = q.options[q.correct].text;
    blank.ondragover = (ev) => ev.preventDefault();
    blank.ondrop = (ev) => handleDrop(ev, blank, qIndex);
    blanksDiv.appendChild(blank);
    container.appendChild(blanksDiv);

    const optionsBank=document.createElement('div'); optionsBank.className='options-bank';
    q.options.forEach(opt=>{
        const div=document.createElement('div'); div.className='option'; div.textContent=opt.text;
        div.draggable=true; div.ondragstart=(ev)=>ev.dataTransfer.setData('text', opt.text);
        optionsBank.appendChild(div);
    });
    container.appendChild(optionsBank);

    const fb=document.createElement('div'); fb.className='feedback'; container.appendChild(fb);
    document.getElementById('nextBtn').disabled=true;
}

// ----------------- Fill-in-blanks Validation (Single Click) -----------------
function handleDrop(ev, blank, qIndex) {
    ev.preventDefault();
    const q = questions[qIndex];

    if (q._answeredText !== null && q._answeredText !== undefined) return;

    const data = ev.dataTransfer.getData('text');
    blank.textContent = data;
    blank.classList.add('filled');

    q._answeredText = data;

    const correctAnswer = blank.dataset.correct.trim().toLowerCase();
    const fb = document.querySelector(`#q${qIndex} .feedback`);

    if (data.trim().toLowerCase() === correctAnswer) {
        fb.textContent = '✅ Correct!';
        fb.style.color = 'green';
        document.getElementById('nextBtn').disabled = false;
    } else {
        fb.textContent = '❌ Incorrect.';
        fb.style.color = 'red';
        document.getElementById('nextBtn').disabled = false; 
    }

    blank.style.pointerEvents = 'none'; 
}


// ----------------- Matching -----------------
function handleMatchClick(itemEl,question){
    if(itemEl.classList.contains('matched')) return;
    if(!pendingLeft){ clearSelectedInQuestion(question); pendingLeft=itemEl; itemEl.classList.add('selected'); return; }
    if(pendingLeft===itemEl){ pendingLeft.classList.remove('selected'); pendingLeft=null; return; }
    const container=itemEl.parentElement.parentElement;
    const leftColumn=container.querySelector('.match-list:first-child');
    const rightColumn=container.querySelector('.match-list:last-child');
    const clickedIsLeft=leftColumn.contains(itemEl);
    const clickedIsRight=rightColumn.contains(itemEl);
    const pendingIsLeft=leftColumn.contains(pendingLeft);
    if(pendingIsLeft && clickedIsLeft){ pendingLeft.classList.remove('selected'); pendingLeft=itemEl; pendingLeft.classList.add('selected'); return; }
    if(pendingIsLeft && clickedIsRight){ attemptMatch(pendingLeft,itemEl,question); return; }
    if(!pendingIsLeft && clickedIsLeft){ attemptMatch(itemEl,pendingLeft,question); return; }
    if(!pendingIsLeft && clickedIsRight){ pendingLeft.classList.remove('selected'); pendingLeft=itemEl; pendingLeft.classList.add('selected'); return; }
}

function attemptMatch(leftEl, rightEl, question) {
  leftEl.classList.remove('selected');
  const leftId = leftEl.dataset.id, rightId = rightEl.dataset.id;
  const isMatch = question.options.some(opt =>
    (opt.id === leftId && opt.matchId === rightId) ||
    (opt.id === rightId && opt.matchId === leftId)
  );

  const qContainer = leftEl.closest('.question');
  const fb = qContainer ? qContainer.querySelector('.feedback') : null;

  try {
    // Draw line with visual feedback
    const line = new LeaderLine(leftEl, rightEl, {
      color: isMatch ? 'blue' : 'red',
      size: 3,
      path: 'straight',
      startPlug: 'disc',
      endPlug: 'disc',
      dash: isMatch ? false : { animation: true }, // broken red line for wrong match
    });
    leaderLines.push(line);
  } catch (e) {
    console.warn('LeaderLine draw failed:', e);
  }

  if (isMatch) {
    leftEl.classList.add('matched');
    rightEl.classList.add('matched');
    question._matchedPairs = question._matchedPairs || {};
    question._matchedPairs[leftId] = rightId;

    if (fb) {
      fb.textContent = '✅ Correct pair!';
      fb.style.color = 'green';
    }
  } else {
    if (fb) {
      fb.textContent = '❌ Incorrect match, try again.';
      fb.style.color = 'red';
    }

    setTimeout(() => {
      const lastLine = leaderLines.pop();
      if (lastLine) lastLine.remove();
    }, 600);
  }

  const totalPairs = question.options.length / 2;
  const matchedCount = Object.keys(question._matchedPairs || {}).length;

  if (matchedCount >= totalPairs) {
    if (fb) {
      fb.textContent = '✅ All pairs matched!';
      fb.style.color = 'green';
    }
    document.getElementById('nextBtn').disabled = false;
  } else {
    document.getElementById('nextBtn').disabled = true;
  }

  pendingLeft = null;
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
    if (q.type === 'multiple_choice') q._answeredIndex = null;
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
      return {
        question: q.text,
        type: q.type,
        correct: q.options[q.correct].text,
        selected: q._answeredIndex !== undefined ? q.options[q._answeredIndex].text : null
      };
    } else if (q.type === 'fill_in_blanks') {
      const blank = document.querySelector(`#q${index} .blank`);
      return {
        question: q.text,
        type: q.type,
        correct: q.options[q.correct].text,
        selected: blank ? blank.textContent.trim() : null
      };
    } else if (q.type === 'connecting_dots') {
      const matchedPairs = {};
      if (q._matchedPairs) Object.keys(q._matchedPairs).forEach(leftId => {
        matchedPairs[leftId] = q._matchedPairs[leftId];
      });
      return {
        question: q.text,
        type: q.type,
        correct: q.options.map(opt => ({ id: opt.id, matchId: opt.matchId })), // store correct mapping
        selected: matchedPairs
      };
    } else {
      return { question: q.text, type: q.type };
    }
  });

  // Calculate score
  let correctCount = 0;
  questions.forEach((q, index) => {
    if (q.type === 'multiple_choice' && q._answeredIndex === q.correct) correctCount++;
    if (q.type === 'fill_in_blanks') {
      const blank = document.querySelector(`#q${index} .blank`);
      if (blank && blank.textContent.trim().toLowerCase() === q.options[q.correct].text.trim().toLowerCase())
        correctCount++;
    }
    if (q.type === 'connecting_dots') {
      const totalPairs = q.options.filter((_, i) => i % 2 === 0).length; // number of left items
      const matchedCount = Object.keys(q._matchedPairs || {}).filter(leftId => {
        const rightId = q._matchedPairs[leftId];
        return q.options.some(opt => (opt.id === leftId && opt.matchId === rightId) || (opt.id === rightId && opt.matchId === leftId));
      }).length;
      if (matchedCount === totalPairs) correctCount++;
    }
  });
  const scorePercent = Math.round((correctCount / questions.length) * 100);

  // Show score
  document.getElementById('scoreText').textContent = `You scored ${correctCount} out of ${questions.length} (${scorePercent}%)`;

  // Show result container
  document.getElementById('resultContainer').style.display = 'block';

  // Save attempt to DB
  await saveAttempt(MODULE_ID, {
    student_id: STUDENT_ID,
    score: scorePercent,
    total_correct: correctCount,
    total_questions: questions.length,
    answers: answersToSave
  });

// Retry Module
document.getElementById('retryBtn').onclick = () => resetModule(false);

// Exit Module
document.getElementById('exitBtn').onclick = () => resetModule(true);


// View Summary toggle 
const summaryBtn = document.getElementById('summaryBtn');
const summaryDiv = document.getElementById('summaryContent');

summaryBtn.onclick = () => {
  if(summaryDiv.style.display === 'none') {
    // Generate summary if hidden
    summaryDiv.innerHTML = '';
    answersToSave.forEach((a, i) => {
      const div = document.createElement('div');
      div.style.marginBottom = '15px';
      let answerHTML = '';

      if(a.type==='multiple_choice' || a.type==='fill_in_blanks') {
        answerHTML = `<div>Your answer: ${a.selected || 'Not answered'}</div>
                      <div>Correct answer: ${a.correct}</div>`;
      }

      if(a.type==='connecting_dots') {
        const yourPairs = Object.keys(a.selected||{}).map(leftId => {
          const rightId = a.selected[leftId];
          const leftItem = questions[i].options.find(opt => opt.id===leftId);
          const rightItem = questions[i].options.find(opt => opt.id===rightId);
          if(!leftItem||!rightItem) return '';
          let text = `${leftItem.text} - ${rightItem.text}`;
          if(rightItem.image) text += `<br><img src="https://aliyyqinorqlwmjhbqza.supabase.co/storage/v1/object/public/${rightItem.image}" style="max-width:100px; display:block; margin-top:3px;">`;
          return text;
        }).join('<br>');

        const correctPairs = [];
        const leftItems = a.correct.filter((_, idx)=>idx%2===0);
        leftItems.forEach(leftOpt => {
          const leftItem = questions[i].options.find(o => o.id===leftOpt.id);
          const rightItem = questions[i].options.find(o => o.id===leftOpt.matchId);
          if(!leftItem||!rightItem) return;
          let text = `${leftItem.text} - ${rightItem.text}`;
          if(rightItem.image) text += `<br><img src="https://aliyyqinorqlwmjhbqza.supabase.co/storage/v1/object/public/${rightItem.image}" style="max-width:100px; display:block; margin-top:3px;">`;
          correctPairs.push(text);
        });

        answerHTML = `<div><strong>Your pairs:</strong><br>${yourPairs || 'Not answered'}</div>
                      <div><strong>Correct pairs:</strong><br>${correctPairs.join('<br>')}</div>`;
      }

      div.innerHTML = `<strong>${a.question}</strong><br>${answerHTML}`;
      summaryDiv.appendChild(div);
    });

    summaryDiv.style.display = 'block';
    summaryBtn.textContent = 'Back';
    summaryDiv.scrollIntoView({ behavior: 'smooth' });

  } else {
    // Hide summary
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
            id: attemptId,
            student_id: STUDENT_ID,
            module_id: moduleId,
            attempt_data: attemptData,
            created_at: new Date().toISOString()
        }]);
        if(error) console.error("Failed to save attempt:", error);
        else console.log("Attempt saved:", data);
    } catch(e){ console.error("Exception in saveAttempt:", e); }
}

// ----------------- Expose Functions Globally -----------------
window.loadModule = loadModule;
window.nextQuestion = nextQuestion;
window.submitStudentInfo = submitStudentInfo;
