const STORAGE_KEY = 'fittrack.v4';

// Initial default app state (dynamic)
const DEFAULT_STATE = {
  overview: {
    steps: 8543,
    stepsGoal: 10000,
    calories: 2100,
    caloriesGoal: 2500,
    water: 6,
    waterGoal: 8,
    activeTimeMinutes: 135,
    avgHeartRate: 72,
    distanceKm: 6.8,
    streakDays: 7
  },
  activity: [
    { id: idGen(), name: 'Morning Run', period: 'morning', duration: 30, calories: 350, date: isoToday(-1) },
    { id: idGen(), name: 'Yoga Session', period: 'morning', duration: 45, calories: 180, date: isoToday(-2) },
    { id: idGen(), name: 'Cycling', period: 'afternoon', duration: 60, calories: 450, date: isoToday(-3) },
    { id: idGen(), name: 'Swimming', period: 'evening', duration: 40, calories: 320, date: isoToday(-4) }
  ],
  meals: {
    breakfast: ['Oatmeal with Berries — 350 cal', 'Scrambled Eggs — 280 cal'],
    lunch: ['Grilled Chicken Salad — 450 cal', 'Quinoa Bowl — 380 cal'],
    dinner: ['Salmon with Vegetables — 520 cal', 'Pasta Primavera — 480 cal']
  },
  // weekly arrays for 7 days (Mon..Sun) — default example numbers
  weekly: {
    activitiesCount: [3, 2, 4, 3, 5, 2, 3],
    caloriesBurned: [450, 380, 520, 410, 600, 320, 420]
  }
};

let state = loadState();

/* ===========================
   Utilities
   =========================== */
function idGen(){ return 'id-' + Math.random().toString(36).slice(2,9); }

function todayISO(){ return (new Date()).toISOString().slice(0,10); }
// isoToday(n) returns ISO date string n days ago (n can be 0 for today, negative for past)
function isoToday(n = 0){
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

function saveState(s = state){
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch(e) {
    console.error('saveState failed', e);
  }
}

function loadState(){
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(DEFAULT_STATE);
  } catch(e) {
    console.error('loadState failed', e);
    return structuredClone(DEFAULT_STATE);
  }
}

/* ===========================
   Clock & Sidebar date
   =========================== */
function startClock(){
  const clk = document.getElementById('live-clock');
  const sideDate = document.getElementById('sidebar-date');
  function tick(){
    const now = new Date();
    clk.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    sideDate.textContent = now.toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'});
  }
  tick();
  setInterval(tick, 1000);
}
startClock();

/* ===========================
   Router (hash-based)
   =========================== */
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router(){
  const page = (location.hash.replace('#','') || 'overview');
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  const active = document.getElementById('view-' + page);
  if(active) active.hidden = false;

  // set active nav link
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const link = Array.from(document.querySelectorAll('.nav-link')).find(a => a.getAttribute('href') === '#'+page);
  if(link) link.classList.add('active');

  // page title/subtitle
  const title = document.getElementById('page-title');
  const sub = document.getElementById('page-sub');
  title.textContent = capitalize(page);
  const subs = {
    overview: "Personal summary & today's snapshot",
    activity: "Track & manage activities",
    meals: "Plan and track meals",
    insights: "Insights & weekly summary"
  };
  sub.textContent = subs[page] || '';

  // render selected page
  renderPage(page);
}

/* ===========================
   Chart Loader (dynamic)
   =========================== */
function ensureChartJs(){
  if(window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s.onload = () => {
      // small timeout to ensure Chart is ready
      setTimeout(resolve, 80);
    };
    s.onerror = () => reject(new Error('Chart.js failed to load'));
    document.head.appendChild(s);
  });
}

/* ===========================
   Render Dispatcher
   =========================== */
let charts = { insights: null, activity: null, calories: null };

function renderPage(page){
  if(page === 'overview') renderOverview();
  else if(page === 'activity') renderActivity();
  else if(page === 'meals') renderMeals();
  else if(page === 'insights') renderInsights();
}

/* ===========================
   Page: OVERVIEW
   =========================== */
function renderOverview(){
  const root = document.getElementById('view-overview');
  const ov = state.overview;

  const stepsPct = Math.round((ov.steps / (ov.stepsGoal || 1)) * 100);
  const calPct = Math.round((ov.calories / (ov.caloriesGoal || 1)) * 100);
  const waterPct = Math.round((ov.water / (ov.waterGoal || 1)) * 100);

  root.innerHTML = `
    <div class="card">
      <h2>Daily Wellness Overview</h2>
      <div class="overview-grid">
        <div>
          <div class="metrics-grid">
            <div class="metric">
              <h3>Steps</h3>
              <div class="big">${numberWithCommas(ov.steps)}</div>
              <div class="progress"><i id="p-steps" style="width:0%"></i></div>
              <div class="small-muted">${stepsPct}% of ${numberWithCommas(ov.stepsGoal)}</div>
            </div>

            <div class="metric">
              <h3>Calories</h3>
              <div class="big">${numberWithCommas(ov.calories)}</div>
              <div class="progress"><i id="p-cal" style="width:0%"></i></div>
              <div class="small-muted">${calPct}% of ${numberWithCommas(ov.caloriesGoal)}</div>
            </div>

            <div class="metric">
              <h3>Water (glasses)</h3>
              <div class="big">${ov.water}</div>
              <div class="progress"><i id="p-water" style="width:0%"></i></div>
              <div class="small-muted">${waterPct}% hydrated</div>
            </div>
          </div>

          <div class="card" style="margin-top:12px">
            <div class="kv"><div class="k">Active Time</div><div class="v">${Math.floor(ov.activeTimeMinutes/60)}h ${ov.activeTimeMinutes%60}m</div></div>
            <div class="kv"><div class="k">Avg Heart Rate</div><div class="v">${ov.avgHeartRate} bpm</div></div>
            <div class="kv"><div class="k">Distance</div><div class="v">${ov.distanceKm} km</div></div>
            <div class="kv"><div class="k">Streak</div><div class="v">${ov.streakDays} days</div></div>
          </div>
        </div>

        <div>
          <div class="card">
            <h3 class="h3">Summary</h3>
            <div class="kv"><div class="k">Total Activities</div><div class="v">${state.activity.length}</div></div>
            <div class="kv"><div class="k">Total Calories</div><div class="v">${totalMealCalories()}</div></div>
            <div class="kv"><div class="k">Avg Activities/Day</div><div class="v">${avgActivitiesPerDay().toFixed(1)}</div></div>
            <div class="kv"><div class="k">Avg Calories/Day</div><div class="v">${Math.round(avgCaloriesPerDay())}</div></div>
          </div>

          <div class="card" style="margin-top:12px">
            <h3 class="h3">Recent Activities</h3>
            <div id="mini-acts"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // animate progress values after paint
  requestAnimationFrame(() => {
    const pSteps = document.getElementById('p-steps');
    const pCal = document.getElementById('p-cal');
    const pWater = document.getElementById('p-water');
    if(pSteps) pSteps.style.width = Math.min(100, stepsPct) + '%';
    if(pCal) pCal.style.width = Math.min(100, calPct) + '%';
    if(pWater) pWater.style.width = Math.min(100, waterPct) + '%';
  });

  // mini activities
  const mini = document.getElementById('mini-acts');
  mini.innerHTML = state.activity.slice(0,5).map(a => `
    <div class="kv">
      <div>
        <strong>${escapeHtml(a.name)}</strong>
        <div class="small-muted">${a.duration} min • ${a.calories} kcal</div>
      </div>
      <div class="small-muted">${a.period}</div>
    </div>
  `).join('');
}

/* ===========================
   Page: ACTIVITY
   =========================== */
function renderActivity(){
  const root = document.getElementById('view-activity');
  root.innerHTML = `
    <div class="card">
      <div class="activity-controls">
        <div>
          <h2>Activity Log</h2>
          <div class="small-muted">Track & manage your daily activities</div>
        </div>
        <div>
          <button class="btn" id="open-add-activity">Add New Activity</button>
        </div>
      </div>

      <div class="filter-row">
        <button class="filter-btn active" data-filter="all">all</button>
        <button class="filter-btn" data-filter="morning">morning</button>
        <button class="filter-btn" data-filter="afternoon">afternoon</button>
        <button class="filter-btn" data-filter="evening">evening</button>
      </div>

      <div class="activity-list" id="activity-list"></div>
    </div>
  `;

  // attach handlers
  document.getElementById('open-add-activity').onclick = openAddActivityModal;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadActivityList(btn.dataset.filter);
    };
  });

  loadActivityList('all');
}

function loadActivityList(filter = 'all'){
  const list = document.getElementById('activity-list');
  if(!list) return;
  let arr = state.activity;
  if(filter && filter !== 'all') arr = arr.filter(a => a.period === filter);
  if(arr.length === 0){
    list.innerHTML = '<div class="small-muted">No activities recorded.</div>';
    return;
  }
  list.innerHTML = arr.map(a => `
    <div class="activity-item">
      <div>
        <strong>${escapeHtml(a.name)}</strong>
        <div class="meta small-muted">${escapeHtml(a.period)} • ${a.duration} min • ${a.calories} kcal</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <div class="small-muted">${a.calories} kcal</div>
        <button class="btn ghost" onclick="deleteActivity('${a.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Expose deleteActivity globally for onclicks
window.deleteActivity = function(id){
  state.activity = state.activity.filter(a => a.id !== id);
  recalcWeeklyFromActivity();
  saveState(state);
  renderPage('activity');
};

/* Add Activity modal */
function openAddActivityModal(){
  showModal(`
    <div class="modal-card">
      <h3>Add New Activity</h3>
      <input class="input" id="m-name" placeholder="Activity Name (e.g., Morning Run)" />
      <div style="display:flex; gap:8px; margin-top:8px;">
        <input class="input" id="m-duration" type="number" placeholder="Duration (mins)" />
        <input class="input" id="m-cal" type="number" placeholder="Calories" />
      </div>
      <select class="input" id="m-period" style="margin-top:8px;">
        <option value="morning">Morning</option>
        <option value="afternoon">Afternoon</option>
        <option value="evening">Evening</option>
      </select>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
        <button class="btn ghost" id="m-cancel">Cancel</button>
        <button class="btn" id="m-add">Add Activity</button>
      </div>
    </div>
  `);

  document.getElementById('m-cancel').onclick = closeModal;
  document.getElementById('m-add').onclick = () => {
    const name = (document.getElementById('m-name').value || '').trim();
    const dur = Number(document.getElementById('m-duration').value || 0);
    const cal = Number(document.getElementById('m-cal').value || 0);
    const period = document.getElementById('m-period').value || 'morning';
    if(!name || !dur || !cal){ alert('Please fill all fields'); return; }
    const item = { id: idGen(), name, duration: dur, calories: cal, period, date: todayISO() };
    state.activity.unshift(item);
    recalcWeeklyFromActivity(); // update weekly aggregates
    saveState(state);
    closeModal();
    renderPage('activity');
  };
}

/* ===========================
   Page: MEALS
   =========================== */
function renderMeals(){
  const root = document.getElementById('view-meals');
  root.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div><h2>Meal Planner</h2><div class="small-muted">Plan and track your daily nutrition</div></div>
        <div><button class="btn" id="open-add-meal">Add Meal</button></div>
      </div>

      <div style="margin-top:12px" class="meal-columns">
        <div class="card">
          <h3 class="h3">Breakfast <div class="small-muted">${sumMealCalories('breakfast')} kcal</div></h3>
          <div class="meal-list">${state.meals.breakfast.map((m,i)=>`<div class="meal-item">${escapeHtml(m)} <button class="btn ghost" onclick="removeMeal('breakfast',${i})">Delete</button></div>`).join('')}</div>
        </div>

        <div class="card">
          <h3 class="h3">Lunch <div class="small-muted">${sumMealCalories('lunch')} kcal</div></h3>
          <div class="meal-list">${state.meals.lunch.map((m,i)=>`<div class="meal-item">${escapeHtml(m)} <button class="btn ghost" onclick="removeMeal('lunch',${i})">Delete</button></div>`).join('')}</div>
        </div>

        <div class="card">
          <h3 class="h3">Dinner <div class="small-muted">${sumMealCalories('dinner')} kcal</div></h3>
          <div class="meal-list">${state.meals.dinner.map((m,i)=>`<div class="meal-item">${escapeHtml(m)} <button class="btn ghost" onclick="removeMeal('dinner',${i})">Delete</button></div>`).join('')}</div>
        </div>
      </div>

      <div style="margin-top:12px" class="kv"><div class="k">Total Daily Intake</div><div class="v">${totalMealCalories()} kcal</div></div>
    </div>
  `;

  document.getElementById('open-add-meal').onclick = openAddMealModal;
}
window.removeMeal = function(slot, idx){
  state.meals[slot].splice(idx,1);
  saveState(state);
  renderPage('meals');
};

/* Add Meal modal */
function openAddMealModal(){
  showModal(`
    <div class="modal-card">
      <h3>Add New Meal</h3>
      <input class="input" id="mm-name" placeholder="Meal name e.g. Grilled Chicken Salad" />
      <input class="input" id="mm-cal" type="number" placeholder="Calories e.g. 450" />
      <select class="input" id="mm-type" style="margin-top:8px;">
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner">Dinner</option>
      </select>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
        <button class="btn ghost" id="mm-cancel">Cancel</button>
        <button class="btn" id="mm-add">Add Meal</button>
      </div>
    </div>
  `);

  document.getElementById('mm-cancel').onclick = closeModal;
  document.getElementById('mm-add').onclick = () => {
    const name = (document.getElementById('mm-name').value || '').trim();
    const cal = Number(document.getElementById('mm-cal').value || 0);
    const type = document.getElementById('mm-type').value || 'breakfast';
    if(!name || !cal){ alert('Please fill meal name and calories'); return; }
    state.meals[type].push(`${name} — ${cal} cal`);
    saveState(state);
    closeModal();
    renderPage('meals');
  };
}

/* ===========================
   Page: INSIGHTS
   =========================== */
async function renderInsights(){
  const root = document.getElementById('view-insights');
  const acts = state.weekly.activitiesCount;
  const cals = state.weekly.caloriesBurned;
  const totalActs = acts.reduce((s,v)=>s+v,0);
  const totalCals = cals.reduce((s,v)=>s+v,0);

  root.innerHTML = `
    <div class="card">
      <h2>Insights & Summary</h2>

      <div style="display:flex; gap:12px; margin-top:12px;">
        <button class="btn" id="download-summary">Download Summary</button>
        <button class="btn ghost" id="reset-dashboard">Reset Dashboard</button>
      </div>

      <div class="insights-grid" style="margin-top:12px;">
        <div class="insight-card"><div class="small-muted">Total Activities</div><div class="stat-big">${totalActs}</div></div>
        <div class="insight-card"><div class="small-muted">Total Calories</div><div class="stat-big">${totalCals}</div></div>
        <div class="insight-card"><div class="small-muted">Avg Activities/Day</div><div class="stat-big">${(totalActs/7).toFixed(1)}</div></div>
        <div class="insight-card"><div class="small-muted">Avg Calories/Day</div><div class="stat-big">${Math.round(totalCals/7)}</div></div>
      </div>

      <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap;">
        <div class="card" style="flex:1; min-width:320px;">
          <h3 class="h3">Weekly Activities</h3>
          ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>`
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0;">
              <div><strong>${d}</strong><div class="small-muted">${acts[i]} activities</div></div>
              <div class="small-muted">${acts[i]}</div>
            </div>`).join('')}
        </div>

        <div class="card" style="flex:1; min-width:320px;">
          <h3 class="h3">Weekly Calories Burned</h3>
          <canvas id="ins-cal-chart" height="160"></canvas>
          <div style="display:flex; gap:12px; margin-top:8px; color:var(--muted); font-size:13px;">
            ${cals.map((v,i)=>`<div style="flex:1; text-align:center;"><div>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</div><div style="font-weight:700">${v} kcal</div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('download-summary').onclick = () => downloadJSON(state, `fittrack-summary-${todayISO()}.json`);
  document.getElementById('reset-dashboard').onclick = () => {
    if(confirm('Reset dashboard to defaults?')){
      sessionStorage.removeItem(STORAGE_KEY);
      state = structuredClone(DEFAULT_STATE);
      saveState(state);
      router();
    }
  };

  // draw chart using Chart.js if available
  try {
    await ensureChartJs();
    const ctx = document.getElementById('ins-cal-chart').getContext('2d');
    if(charts.insights) charts.insights.destroy();
    charts.insights = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets: [{ label: 'Calories Burned', data: cals, backgroundColor: cals.map((v,i)=>chooseColor(i)) }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  } catch(e){
    // fallback: create simple CSS bars if Chart.js fails
    const canvas = document.getElementById('ins-cal-chart');
    if(canvas) canvas.style.display = 'none';
    const parent = canvas.parentElement;
    const fallback = document.createElement('div');
    fallback.className = 'bar-chart';
    const max = Math.max(...cals);
    cals.forEach(v => {
      const b = document.createElement('div');
      b.className = 'bar';
      b.style.height = Math.max(20, Math.round((v/max)*160)) + 'px';
      fallback.appendChild(b);
    });
    parent.appendChild(fallback);
  }
}

/* ===========================
   Helper: choose color for bars (cycled)
   =========================== */
function chooseColor(i){
  const palette = [
    'rgba(138,99,255,0.95)',  // lavender
    'rgba(138,99,255,0.95)',
    'rgba(31,182,167,0.95)',  // teal
    'rgba(138,99,255,0.95)',
    'rgba(255,111,145,0.95)', // rose
    'rgba(31,182,167,0.95)',
    'rgba(138,99,255,0.95)'
  ];
  return palette[i % palette.length];
}

/* ===========================
   Calculations & Recalc helpers
   =========================== */

// Sum calories from meals (parses "123 cal" substrings)
function sumMealCalories(slot){
  let total = 0;
  (state.meals[slot] || []).forEach(s => {
    const m = s.match(/(\d+)\s*cal/i);
    if(m) total += Number(m[1]);
  });
  return total;
}
function totalMealCalories(){
  return sumMealCalories('breakfast') + sumMealCalories('lunch') + sumMealCalories('dinner');
}

function avgActivitiesPerDay(){
  const arr = state.weekly.activitiesCount || [0,0,0,0,0,0,0];
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}
function avgCaloriesPerDay(){
  const arr = state.weekly.caloriesBurned || [0,0,0,0,0,0,0];
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}

// When activities change, derive weekly arrays from recent activity dates
function recalcWeeklyFromActivity(){
  // Build a mapping for last 7 days (Mon-Sun standard ordering)
  // We'll compute counts and burned totals for last 7 calendar days, but align to Mon..Sun for display.
  const counts = [0,0,0,0,0,0,0]; // Mon..Sun
  const totals = [0,0,0,0,0,0,0];
  // For each activity, if it has a date, map to weekday index
  state.activity.forEach(act => {
    const d = act.date ? new Date(act.date) : null;
    if(!d || isNaN(d)) return;
    // weekday: 0 Sun..6 Sat -> want Mon..Sun index (Mon=0)
    const jsWeek = d.getDay(); // 0..6
    const monIndex = (jsWeek + 6) % 7; // convert Sun(0)->6; Mon(1)->0 ... Sun->6
    counts[monIndex] += 1;
    totals[monIndex] += Number(act.calories || 0);
  });
  // If counts are all zero (no dates provided), fallback to existing weekly data
  const hasAny = counts.some(c => c > 0);
  if(hasAny){
    state.weekly.activitiesCount = counts;
    state.weekly.caloriesBurned = totals;
  } else {
    // keep existing weekly if available
    if(!state.weekly.activitiesCount) state.weekly.activitiesCount = [0,0,0,0,0,0,0];
    if(!state.weekly.caloriesBurned) state.weekly.caloriesBurned = [0,0,0,0,0,0,0];
  }
}

/* ===========================
   Modal system
   =========================== */
function showModal(innerHtml){
  const modal = document.getElementById('modal');
  modal.innerHTML = `<div class="modal-card">${innerHtml}</div>`;
  modal.classList.add('show');
  // close when clicking outside the modal content
  modal.onclick = (e) => {
    if(e.target === modal) closeModal();
  };
  // allow closing with Escape
  document.addEventListener('keydown', escCloseHandler);
}
function escCloseHandler(e){
  if(e.key === 'Escape') closeModal();
}
function closeModal(){
  const modal = document.getElementById('modal');
  modal.classList.remove('show');
  modal.innerHTML = '';
  modal.onclick = null;
  document.removeEventListener('keydown', escCloseHandler);
}

/* ===========================
   Small helpers
   =========================== */
function capitalize(s){ return s && s[0] ? s[0].toUpperCase() + s.slice(1) : s; }
function numberWithCommas(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function escapeHtml(str){
  return String(str || '').replace(/[&<>"'`]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'}[ch]));
}
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ===========================
   Page-level helpers for external buttons
   =========================== */
// open add meal modal from anywhere
window.openAddMeal = openAddMealModal;
window.openAddActivity = openAddActivityModal;

/* ===========================
   Ensure UI hooks (sidebar reset)
   =========================== */
document.getElementById('clear-storage').onclick = () => {
  if(confirm('Clear session (reset to defaults)?')){
    sessionStorage.removeItem(STORAGE_KEY);
    state = structuredClone(DEFAULT_STATE);
    saveState(state);
    router();
  }
};

/* ===========================
   Persist initial state & route
   =========================== */
saveState(state); // ensure saved
router();         // render current page

window.removeMeal = function(slot, idx){ state.meals[slot].splice(idx,1); saveState(state); renderPage('meals'); };
window.deleteActivity = function(id){ state.activity = state.activity.filter(a=>a.id !== id); recalcWeeklyFromActivity(); saveState(state); renderPage('activity'); };

