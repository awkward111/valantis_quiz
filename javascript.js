// =====================
// Valantis Quiz — JS
// =====================

const QUESTION_TIME = 20;
const STORAGE_NAME_KEY = "valantis_quiz_name";
const STORAGE_BOARD_KEY = "valantis_quiz_leaderboard";

// Supabase (глобальный realtime-лидерборд) + защищённый фолбэк на localStorage
const SUPABASE_URL  = (window.SUPABASE_URL || "").trim();
const SUPABASE_ANON = (window.SUPABASE_ANON_KEY || "").trim();
let   HAS_SUPABASE  = typeof window.supabase !== "undefined" && !!SUPABASE_URL && !!SUPABASE_ANON;
let   sb            = HAS_SUPABASE ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON) : null;

// ВОПРОСЫ (EN)
const BASE_QUESTIONS = [
  { q: "How does Valantis use a modular architecture to build DEXes?", options: ["Through centralized liquidity pools","Through custom modules with a shared data layer","Through separate DEXes for each module"], correct: 1 },
  { q: "How is stHYPE integrated with Hyperliquid via HyperEVM?", options: ["By syncing with the Ethereum blockchain","Via a shared liquidity pool and synthetic tokens","By bridging between HyperEVM and Binance Smart Chain"], correct: 1 },
  { q: "What is HyperCore’s role in the Valantis ecosystem?", options: ["Only for staking","A blockchain layer to run Valantis DEX modules","An analytics tool"], correct: 1 },
  { q: "How does Valantis ensure the decentralization of stHYPE?", options: ["Through centralized validators","Through DAO voting and a permissionless architecture","Through integrations with centralized exchanges"], correct: 1 },
  { q: "Which parameters of Valantis modules let DEXes adapt to different markets?", options: ["Fixed fees only","Custom parameters (limits, fees, liquidity)","A cap on the number of users"], correct: 1 },
  { q: "How does the stHYPE integration strengthen the Valantis ecosystem?", options: ["By expanding liquidity pools and synthetic tokens","By centralizing staking operations","By limiting DEX module functionality"], correct: 0 },
  { q: "How does Valantis achieve scalability for DEX modules?", options: ["By relying on centralized servers","Through a modular architecture and parallel transaction processing","By limiting the number of modules"], correct: 1 },
  { q: "Which technical parameters determine stHYPE pool efficiency in Valantis?", options: ["TVL only","Transaction speed and fees","The complexity of the staking algorithm"], correct: 1 },
  { q: "How does Valantis plan to expand the ecosystem beyond Hyperliquid?", options: ["By integrating with Ethereum only","By creating its own standalone blockchain","By bridging with other LST protocols"], correct: 2 },
  { q: "How does Valantis provide liquidity in its DEX modules?", options: ["Through centralized pools","Through custom parameters and liquidity aggregation","By limiting the number of transactions"], correct: 1 }
];

// UI
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");

const playerNameInput = document.getElementById("player-name");
const namePreview = document.getElementById("name-preview");
const playerNameDisplay = document.getElementById("player-name-display");
const resultName = document.getElementById("result-name");

const questionText = document.getElementById("question-text");
const optionsWrap = document.getElementById("options");
const nextBtn = document.getElementById("next-btn");
const startBtn = document.getElementById("start-btn");
const retryBtn = document.getElementById("retry-btn");
const counter = document.getElementById("question-counter");
const progressBar = document.getElementById("progress-bar");
const timerEl = document.getElementById("timer");
const shareBtn = document.getElementById("share-btn");

const scoreRaw = document.getElementById("score-raw");
const scorePct = document.getElementById("score-pct");
const scoreMsg = document.getElementById("score-message");

const leaderboardBody = document.getElementById("leaderboard-body");
const boardHint = document.getElementById("board-hint");

// STATE
let questions = [];
let current = 0;
let selectedIndex = null;
let correctCount = 0;
let playerName = "Anon";

let timeLeft = QUESTION_TIME;
let timerId = null;

// Utils
function getStoredName(){ const n=(localStorage.getItem(STORAGE_NAME_KEY)||"").trim(); return n.length?n:"Anon"; }
function setStoredName(n){ localStorage.setItem(STORAGE_NAME_KEY, n); }

function getBoardLocal(){ try{ const raw=localStorage.getItem(STORAGE_BOARD_KEY); return raw?JSON.parse(raw):[]; } catch { return []; } }
function setBoardLocal(arr){ localStorage.setItem(STORAGE_BOARD_KEY, JSON.stringify(arr)); }

function shuffleArray(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

function prepareQuestions(){
  const qCopy = BASE_QUESTIONS.map(q=>({ q:q.q, options:q.options.map((t,idx)=>({text:t, correct: idx===q.correct})) }));
  shuffleArray(qCopy); qCopy.forEach(q=>shuffleArray(q.options));
  return qCopy;
}

function showScreen(el){ [startScreen,quizScreen,resultScreen].forEach(s=>{s.hidden=true;s.classList.remove("active");}); el.hidden=false; el.classList.add("active"); }

function renderQuestion(index){
  const item = questions[index];
  counter.textContent = `Question ${index+1} / ${questions.length}`;
  progressBar.style.width = `${Math.round((index/questions.length)*100)}%`;
  questionText.textContent = item.q;

  optionsWrap.innerHTML = ""; selectedIndex = null; nextBtn.disabled = true;

  item.options.forEach((opt,i)=>{
    const btn=document.createElement("button");
    btn.className="option"; btn.type="button"; btn.role="option";
    btn.setAttribute("aria-selected","false"); btn.textContent=opt.text;
    btn.addEventListener("click",()=>onSelectOption(i));
    optionsWrap.appendChild(btn);
  });

  resetTimer(); startTimer();
}

function onSelectOption(i){
  [...optionsWrap.children].forEach(c=>c.setAttribute("aria-selected","false"));
  optionsWrap.children[i].setAttribute("aria-selected","true");
  selectedIndex=i; nextBtn.disabled=false;

  const { options } = questions[current];
  lockOptionsAndMark(options.findIndex(o=>o.correct), i);
  if (options[i].correct) correctCount++;
  stopTimer();
}

function lockOptionsAndMark(correctIdx, pickedIdx){
  [...optionsWrap.children].forEach((btn,i)=>{
    btn.disabled=true;
    if (i===correctIdx) btn.classList.add("correct");
    if (pickedIdx>=0 && i===pickedIdx && pickedIdx!==correctIdx) btn.classList.add("wrong");
  });
}

function resultMessage(score){
  if (score <= 2) return "Rookie run — keep exploring the docs.";
  if (score <= 4) return "Warming up — you’re getting the idea.";
  if (score <= 6) return "Solid start — you know the basics.";
  if (score <= 8) return "Strong — builder energy unlocked.";
  return "Module maxi — flawless performance.";
}

// Timer
function resetTimer(){ stopTimer(); timeLeft=QUESTION_TIME; timerEl.textContent=`${timeLeft}s`; timerEl.classList.remove("warn","danger"); }
function startTimer(){
  stopTimer();
  timerId=setInterval(()=>{
    timeLeft-=1;
    if (timeLeft<=0){
      timerEl.textContent="0s"; timerEl.classList.add("danger"); stopTimer();
      if (selectedIndex===null){ const correctIdx=questions[current].options.findIndex(o=>o.correct); lockOptionsAndMark(correctIdx,-1); nextBtn.disabled=false; }
      return;
    }
    timerEl.textContent=`${timeLeft}s`;
    if (timeLeft<=5){ timerEl.classList.remove("warn"); timerEl.classList.add("danger"); }
    else if (timeLeft<=10){ timerEl.classList.add("warn"); timerEl.classList.remove("danger"); }
    else { timerEl.classList.remove("warn","danger"); }
  },1000);
}
function stopTimer(){ if (timerId){ clearInterval(timerId); timerId=null; } }

// Leaderboard (Supabase or local) — c фолбэком при ошибках
async function fetchBoard(){
  if (!HAS_SUPABASE) return getBoardLocal();
  try {
    const { data, error } = await sb.from("scores")
      .select("*")
      .order("percent",{ascending:false})
      .order("score",{ascending:false})
      .order("created_at",{ascending:true})
      .limit(10);
    if (error) throw error;
    return data.map(r=>({ name:r.name, score:r.score, percent:r.percent, ts:r.created_at?new Date(r.created_at).getTime():Date.now() }));
  } catch (e) {
    console.warn("Supabase select failed, switching to local:", e);
    switchToLocalMode("Read failed — using local leaderboard.");
    return getBoardLocal();
  }
}

async function pushResultToBoard(name, score, percent){
  if (!HAS_SUPABASE) {
    writeLocal(name, score, percent);
    return;
  }
  try {
    const { error } = await sb.from("scores").insert({ name, score, percent });
    if (error) throw error;
  } catch (e) {
    console.error("Supabase insert failed, switching to local:", e);
    switchToLocalMode("Insert failed — using local leaderboard.");
    writeLocal(name, score, percent);
  }
}

function writeLocal(name, score, percent){
  const entry={ name:name||"Anon", score, percent, ts:Date.now() };
  const board=getBoardLocal(); board.push(entry);
  board.sort((a,b)=>(b.percent-a.percent)||(b.score-a.score)||(a.ts-b.ts));
  setBoardLocal(board.slice(0,10));
}

function renderBoardRows(rows){
  leaderboardBody.innerHTML="";
  if (!rows.length){
    const tr=document.createElement("tr"); const td=document.createElement("td");
    td.colSpan=5; td.textContent="No scores yet — be the first!"; td.className="muted";
    tr.appendChild(td); leaderboardBody.appendChild(tr); return;
  }
  rows.forEach((row,idx)=>{
    const tr=document.createElement("tr");
    const d=new Date(row.ts);
    tr.innerHTML=`<td>${idx+1}</td><td>${escapeHTML(row.name)}</td><td>${row.score}/10</td><td>${row.percent}%</td><td>${d.toLocaleString()}</td>`;
    leaderboardBody.appendChild(tr);
  });
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[m])); }
async function refreshBoard(){ const rows=await fetchBoard(); renderBoardRows(rows); }

// realtime с переподпиской + авто-фолбэк при разрыве
let scoresChannel = null;
function subscribeRealtime(){
  if (!HAS_SUPABASE) return;

  try { if (scoresChannel) sb.removeChannel(scoresChannel); } catch(e){}

  scoresChannel = sb.channel("public:scores");
  scoresChannel
    .on("postgres_changes",
      { event:"INSERT", schema:"public", table:"scores" },
      () => refreshBoard()
    )
    .subscribe((status) => {
      console.log("[Realtime] status:", status);
      if (status === "SUBSCRIBED" && boardHint) boardHint.textContent = "Realtime leaderboard is active (Supabase).";
      if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        // Уйдём в локальный режим, чтобы пользователь всё равно видел результат
        switchToLocalMode("Realtime disconnected — local leaderboard is used.");
      }
    });
}

function switchToLocalMode(reason){
  if (boardHint) boardHint.textContent = `Local leaderboard (${reason})`;
  HAS_SUPABASE = false;
  sb = null;
}

// --- Share в X (только имя+балл и @valantislabs, БЕЗ текстовой «оценки») ---
function shareOnX(name, score, percent){
  const pageUrl = window.location.href.split("#")[0];
  const paragraphs = [
    `${name ? name + " — " : ""}I scored ${score}/10 (${percent}%) in the Valantis Quiz.`,
    "@valantislabs"
  ];
  const text = paragraphs.join("\n\n");
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
  window.open(intent, "_blank", "noopener,noreferrer");
}

// Результат
async function showResult(){
  const percent = Math.round((correctCount/questions.length)*100);
  scoreRaw.textContent = `${correctCount}/${questions.length}`;
  scorePct.textContent = `${percent}%`;
  const msg = resultMessage(correctCount); // На экране показываем, но в share не добавляем
  scoreMsg.textContent = msg;
  resultName.textContent = playerName;

  progressBar.style.width="100%";

  await pushResultToBoard(playerName, correctCount, percent);
  await refreshBoard();

  showScreen(resultScreen);
  shareBtn.onclick = () => shareOnX(playerName, correctCount, percent);
}

// Навигация
nextBtn.addEventListener("click", ()=>{
  if (selectedIndex===null && timerId) return;
  stopTimer(); current++;
  if (current>=questions.length) showResult(); else renderQuestion(current);
});
document.addEventListener("keydown",(e)=>{
  if (quizScreen.classList.contains("active") && e.key==="Enter" && !nextBtn.disabled) nextBtn.click();
});

// Старт/Рестарт
startBtn.addEventListener("click", ()=>{
  questions=prepareQuestions(); current=0; correctCount=0;
  playerName = sanitizeName(playerNameInput.value) || "Anon";
  setStoredName(playerName); syncNameUI();
  showScreen(quizScreen); renderQuestion(current);
});
retryBtn.addEventListener("click", ()=>{
  questions=prepareQuestions(); current=0; correctCount=0;
  syncNameUI(); showScreen(quizScreen); renderQuestion(current);
});

// Имя realtime
function sanitizeName(n){ return (n||"").replace(/\s+/g," ").trim().slice(0,24); }
function syncNameUI(){
  playerNameDisplay.textContent = playerName || "Anon";
  resultName.textContent = playerName || "Anon";
  namePreview.textContent = playerNameInput.value.trim().length ? `Hello, ${sanitizeName(playerNameInput.value)} 👋` : "";
}
playerNameInput.addEventListener("input",(e)=>{
  const n=sanitizeName(e.target.value); playerName=n || "Anon"; setStoredName(n); syncNameUI();
});

// Init
(async function init(){
  const storedName = getStoredName();
  playerName = storedName; playerNameInput.value = storedName==="Anon" ? "" : storedName; syncNameUI();

  if (HAS_SUPABASE) subscribeRealtime();
  else if (boardHint) boardHint.textContent = "Local leaderboard (Supabase not configured).";

  await refreshBoard();
})();
