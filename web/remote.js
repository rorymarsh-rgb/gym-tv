// Phone remote and plan editor.
(function () {
  var G = window.Gym, E = G.esc;
  var state = null, tab = 'live', lastKey = '', lastOk = 0, busy = false;
  var draft = null, draftDay = 0, dirty = false;
  var main = document.getElementById('main');
  var statusEl = document.getElementById('status');
  var titleEl = document.getElementById('dayTitle');

  var ICON = {
    up: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    del: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>'
  };

  function toast(t) {
    var el = document.getElementById('toast');
    el.textContent = t; el.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.style.display = 'none'; }, 2200);
  }

  function act(action, value, okMsg) {
    if (busy) return;
    busy = true;
    if (navigator.vibrate) navigator.vibrate(15);
    G.act(action, value, function (err, s) {
      busy = false;
      if (err) return toast(err.message);
      state = s; lastOk = Date.now();
      if (okMsg) toast(okMsg);
      render(true);
    });
  }

  // ---------- Live tab ----------
  function detail(x) { return (x.sets || 1) + ' × ' + E(x.reps || '') + (x.weight ? ' · ' + E(x.weight) : ''); }

  function liveIdle(v) {
    var h = '<div class="kicker mono">START A WORKOUT</div>';
    v.days.forEach(function (d, i) {
      var n = (d.exercises || []).length;
      h += '<div class="card"><div class="day"><div><div class="dn">' + E(d.name) + '</div><div class="sub">' + n + ' exercise' + (n === 1 ? '' : 's') + '</div></div>' +
        '<button type="button" class="start" data-start="' + i + '"' + (n ? '' : ' disabled') + '>Start</button></div></div>';
    });
    return h;
  }

  function liveActive(v) {
    var x = v.cur, resting = v.phase === 'rest', paused = state.paused_left !== null && state.paused_left !== undefined;
    var last = state.log && state.log[x.name];
    var h = '<div class="card">' +
      '<div class="tag">' + (resting ? 'RESTING · NEXT SET ' : 'SET ') + v.set + ' OF ' + (x.sets || 1) + ' · EXERCISE ' + (v.ex + 1) + ' OF ' + v.exs.length + '</div>' +
      (resting ? '<div class="countdown" id="cd">' + G.clock(G.restLeft(state)) + '</div>' : '') +
      '<div class="name">' + E(x.name) + '</div>' +
      '<div class="sub">' + E(x.reps || '') + ' reps' + (x.weight ? ' · ' + E(x.weight) : '') + (last ? ' · last time ' + E(last) : '') + '</div>' +
      '<form class="weight" id="wform"><label for="kg">Weight used</label><input id="kg" inputmode="decimal" autocomplete="off" placeholder="' + E(last || x.weight || 'e.g. 60kg') + '"><button type="submit">Save</button></form>' +
      '</div>' +
      '<button type="button" class="big" data-act="done">' + (resting ? 'Skip rest · start set' : 'Set done · start rest') + '</button>' +
      '<div class="grid">' +
        '<button type="button" class="btn" data-act="toggle_pause"' + (resting ? '' : ' disabled') + '>' + (paused ? 'Resume' : 'Pause rest') + '</button>' +
        '<button type="button" class="btn" data-act="add30"' + (resting ? '' : ' disabled') + '>+30s rest</button>' +
        '<button type="button" class="btn" data-act="prev">Previous</button>' +
        '<button type="button" class="btn" data-act="next">Skip exercise</button>' +
      '</div>';
    var rest = v.exs.slice(v.ex + 1, v.ex + 4);
    if (rest.length) {
      h += '<div class="list"><div class="kicker mono">UP NEXT</div>';
      rest.forEach(function (n) { h += '<div class="li"><span>' + E(n.name) + '</span><span>' + detail(n) + '</span></div>'; });
      h += '</div>';
    }
    h += '<button type="button" class="link" data-act="end" style="margin-top:auto">End workout</button>';
    return h;
  }

  function liveDone(v) {
    return '<div class="card"><div class="tag">COMPLETE</div><div class="name">' + E(v.day.name) + ' done</div>' +
      '<div class="sub">' + v.exs.length + ' exercises in ' + G.clock(G.elapsed(state)) + '</div></div>' +
      '<button type="button" class="big" data-act="end">Back to start</button>' +
      '<button type="button" class="link" data-act="prev">Oops, go back a set</button>';
  }

  // ---------- Plan tab ----------
  function openPlan() {
    draft = JSON.parse(JSON.stringify(state.plan));
    draftDay = Math.min(state.day, draft.days.length - 1);
    dirty = false;
  }

  function planView() {
    var d = draft.days[draftDay];
    var h = '<div class="chips" role="group" aria-label="Workout days">';
    draft.days.forEach(function (x, i) {
      h += '<button type="button" class="chip" data-day="' + i + '" aria-pressed="' + (i === draftDay) + '">' + E(x.name || 'Untitled') + '</button>';
    });
    h += '<button type="button" class="chip" data-p="addday" aria-label="Add day">+ Day</button></div>';
    h += '<div class="ex"><label class="kicker mono" for="dayname">DAY NAME</label><div class="top">' +
      '<input id="dayname" class="nm" data-dayname value="' + E(d.name) + '">' +
      '<button type="button" class="icon" data-p="delday" aria-label="Delete this day">' + ICON.del + '</button></div></div>';
    d.exercises.forEach(function (x, i) {
      h += '<div class="ex"><div class="top">' +
        '<input class="nm" aria-label="Exercise name" data-i="' + i + '" data-f="name" value="' + E(x.name) + '">' +
        '<button type="button" class="icon" data-p="up" data-i="' + i + '" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ICON.up + '</button>' +
        '<button type="button" class="icon" data-p="down" data-i="' + i + '" aria-label="Move down"' + (i < d.exercises.length - 1 ? '' : ' disabled') + '>' + ICON.down + '</button>' +
        '<button type="button" class="icon" data-p="del" data-i="' + i + '" aria-label="Delete exercise">' + ICON.del + '</button></div>' +
        '<div class="fields">' +
          '<label>Sets<input inputmode="numeric" data-i="' + i + '" data-f="sets" data-num value="' + E(x.sets) + '"></label>' +
          '<label>Reps<input data-i="' + i + '" data-f="reps" value="' + E(x.reps) + '"></label>' +
          '<label>Rest (s)<input inputmode="numeric" data-i="' + i + '" data-f="rest" data-num value="' + E(x.rest) + '"></label>' +
          '<label>Weight<input data-i="' + i + '" data-f="weight" value="' + E(x.weight || '') + '"></label>' +
        '</div></div>';
    });
    h += '<button type="button" class="dashed" data-p="add">+ Add exercise</button>';
    h += '<button type="button" class="save" data-p="save"' + (dirty ? '' : ' disabled') + '>' + (dirty ? 'Save plan' : 'Saved') + '</button>';
    return h;
  }

  function markDirty() {
    dirty = true;
    var b = main.querySelector('[data-p="save"]');
    if (b) { b.disabled = false; b.textContent = 'Save plan'; }
  }

  function cleanDraft() {
    draft.days.forEach(function (d) {
      d.name = String(d.name || '').trim() || 'Workout';
      d.exercises = d.exercises.filter(function (x) { return String(x.name || '').trim(); }).map(function (x) {
        return { name: String(x.name).trim(), sets: Math.max(1, parseInt(x.sets, 10) || 1), reps: String(x.reps || '').trim(), rest: Math.max(0, parseInt(x.rest, 10) || 0), weight: String(x.weight || '').trim() };
      });
    });
  }

  // ---------- Rendering ----------
  function render(force) {
    if (!state) return;
    var v = G.view(state);
    titleEl.textContent = v.day.name || 'Gym';
    if (tab === 'plan') {
      if (!draft) openPlan();
      if (force === 'plan') main.innerHTML = planView();
      return;
    }
    var phase = (v.phase === 'work' || v.phase === 'rest' || v.phase === 'done') && !v.cur ? 'idle' : v.phase;
    var key = [phase, state.day, state.ex, state.set_no, state.updated_at, state.paused_left === null].join('|');
    if (force === true || key !== lastKey) {
      lastKey = key;
      main.innerHTML = phase === 'idle' ? liveIdle(v) : phase === 'done' ? liveDone(v) : liveActive(v);
    }
  }

  function setTab(t) {
    if (t === tab) return;
    if (tab === 'plan' && dirty && !confirm('Discard plan changes?')) return;
    tab = t;
    document.getElementById('tabLive').setAttribute('aria-pressed', t === 'live');
    document.getElementById('tabPlan').setAttribute('aria-pressed', t === 'plan');
    if (t === 'plan') { openPlan(); render('plan'); } else { draft = null; dirty = false; render(true); }
  }
  document.getElementById('tabLive').onclick = function () { setTab('live'); };
  document.getElementById('tabPlan').onclick = function () { if (state) setTab('plan'); };

  main.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-start')) return act('start', { day: +b.getAttribute('data-start') });
    if (b.hasAttribute('data-act')) {
      var a = b.getAttribute('data-act');
      if (a === 'end' && G.view(state).phase !== 'done' && !confirm('End this workout?')) return;
      return act(a);
    }
    if (b.hasAttribute('data-day')) { draftDay = +b.getAttribute('data-day'); return render('plan'); }
    var p = b.getAttribute('data-p'), i = +b.getAttribute('data-i'), list = draft && draft.days[draftDay].exercises;
    if (p === 'add') { list.push({ name: 'New exercise', sets: 3, reps: '10', rest: 60, weight: '' }); markDirty(); render('plan'); var ins = main.querySelectorAll('input.nm'); ins[ins.length - 1].select(); return; }
    if (p === 'del') { list.splice(i, 1); markDirty(); return render('plan'); }
    if (p === 'up' && i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); markDirty(); return render('plan'); }
    if (p === 'down' && i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); markDirty(); return render('plan'); }
    if (p === 'addday') { draft.days.push({ name: 'Day ' + (draft.days.length + 1), exercises: [] }); draftDay = draft.days.length - 1; markDirty(); return render('plan'); }
    if (p === 'delday') {
      if (draft.days.length < 2) return toast('You need at least one day');
      if (!confirm('Delete ' + (draft.days[draftDay].name || 'this day') + '?')) return;
      draft.days.splice(draftDay, 1); draftDay = 0; markDirty(); return render('plan');
    }
    if (p === 'save') {
      cleanDraft();
      G.act('save_plan', draft, function (err, s) {
        if (err) return toast(err.message);
        state = s; dirty = false; toast('Plan saved'); openPlan(); render('plan');
      });
    }
  });

  main.addEventListener('input', function (e) {
    var t = e.target;
    if (!draft) return;
    if (t.hasAttribute('data-dayname')) {
      draft.days[draftDay].name = t.value;
      var chip = main.querySelector('[data-day="' + draftDay + '"]');
      if (chip) chip.textContent = t.value || 'Untitled';
      return markDirty();
    }
    if (t.hasAttribute('data-f')) { draft.days[draftDay].exercises[+t.getAttribute('data-i')][t.getAttribute('data-f')] = t.value; markDirty(); }
  });

  main.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('kg'), val = input.value.trim(), x = G.view(state).cur;
    if (!val || !x) return;
    if (/^\d+(\.\d+)?$/.test(val)) val += 'kg';
    input.blur();
    act('weight', { name: x.name, weight: val }, 'Saved ' + val + ' for ' + x.name);
  });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Loop ----------
  function poll() {
    G.get(function (err, s) {
      if (!err) { state = s; lastOk = Date.now(); render(false); }
      setTimeout(poll, document.hidden ? 5000 : 1500);
    });
  }
  setInterval(function () {
    if (!state) return;
    var ok = Date.now() - lastOk < 6000;
    statusEl.textContent = ok ? 'LIVE ON GYM TV' : 'RECONNECTING';
    statusEl.className = 'kicker mono status' + (ok ? '' : ' bad');
    if (tab === 'live') {
      var cd = document.getElementById('cd');
      if (cd) {
        var s = G.restLeft(state), paused = state.paused_left !== null && state.paused_left !== undefined;
        if (s <= 0 && !paused) render(true); else cd.textContent = G.clock(s);
      }
    }
  }, 250);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) G.get(function (err, s) { if (!err) { state = s; lastOk = Date.now(); render(false); } }); });

  if (!G.configured()) {
    main.innerHTML = '<div class="card"><div class="name">Almost there</div><div class="sub">Open config.js and add your Supabase URL, key and room code. The README walks through it.</div></div>';
    statusEl.textContent = 'NOT SET UP';
  } else {
    poll();
  }
})();
