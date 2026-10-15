// TV screen. Plain ES5 for old Fire TV web engines. Polls the backend every second.
(function () {
  var G = window.Gym, E = G.esc;
  var state = null, lastOk = 0, lastKey = '', lastBeep = -1;
  var viewEl = document.getElementById('view');
  var netEl = document.getElementById('net');
  var stage = document.getElementById('stage');

  // Scale the 1280x720 design to whatever the TV browser reports.
  // Old Fire TV browsers can report the wrong size at first, so this re-checks every half second.
  var fitKey = '';
  function smallest(a, b) { return a > 0 && b > 0 ? Math.min(a, b) : (a > 0 ? a : b); }
  function fit() {
    var de = document.documentElement;
    var w = smallest(de.clientWidth, window.innerWidth), h = smallest(de.clientHeight, window.innerHeight);
    if (!w || !h) return;
    var key = w + 'x' + h;
    if (key === fitKey) return;
    fitKey = key;
    var s = Math.min(w / 1280, h / 720);
    var x = Math.round((w - 1280 * s) / 2), y = Math.round((h - 720 * s) / 2);
    var t = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
    stage.style.webkitTransform = t;
    stage.style.transform = t;
  }
  window.addEventListener('resize', function () { fitKey = ''; fit(); });
  window.addEventListener('load', function () { fitKey = ''; fit(); });
  setInterval(fit, 500);
  fit();

  function remoteUrl() {
    return location.href.replace(/[?#].*$/, '').replace(/tv\.html$/, '').replace(/\/$/, '') + '/remote.html';
  }

  function nameSize(n) {
    var l = String(n || '').length;
    return l <= 14 ? 120 : l <= 20 ? 96 : l <= 28 ? 76 : 60;
  }

  function detail(x) {
    var s = (x.sets || 1) + ' × ' + E(x.reps || '');
    if (x.weight) s += ' · ' + E(x.weight);
    return s;
  }

  function topbar(v) {
    var right = state.started_at ? '<span id="elapsed">' + G.clock(G.elapsed(state)) + '</span> elapsed' : '';
    return '<div class="row between topbar mono muted"><div>' + E(String(v.day.name).toUpperCase()) +
      ' · EXERCISE ' + (v.ex + 1) + ' OF ' + v.exs.length + '</div><div>' + right + '</div></div>';
  }

  function sideList(v) {
    var h = '<div class="label mono muted">UP NEXT</div>';
    var from = Math.max(0, v.ex - 1);
    for (var i = from; i < v.exs.length && i < from + 6; i++) {
      var x = v.exs[i], cls = i < v.ex ? 'done' : i === v.ex ? 'now' : '';
      var d = i < v.ex ? 'Done · ' + detail(x) : i === v.ex ? 'Now · ' + detail(x) : detail(x) + ' · rest ' + (x.rest || 0) + 's';
      h += '<div class="item ' + cls + '"><div class="n">' + E(x.name) + '</div><div class="d">' + d + '</div></div>';
    }
    return '<div class="side">' + h + '</div>';
  }

  function renderWork(v) {
    var x = v.cur, sets = x.sets || 1, last = state.log && state.log[x.name];
    var stats = '<div class="stat"><div class="label mono muted">REPS</div><div class="v">' + E(x.reps || '') + '</div></div>';
    if (x.weight) stats += '<div class="stat"><div class="label mono muted">WEIGHT</div><div class="v">' + E(x.weight) + '</div></div>';
    if (last) stats += '<div class="stat"><div class="label mono muted">LAST TIME</div><div class="v dim">' + E(last) + '</div></div>';
    var pips = '';
    for (var i = 1; i <= sets && i <= 10; i++) pips += '<div class="pip ' + (i < v.set ? 'on' : i === v.set ? 'now' : '') + '"></div>';
    return '<div class="screen">' + topbar(v) +
      '<div style="position:absolute;left:56px;top:150px;width:780px">' +
        '<div class="accent" style="font-size:28px;font-weight:600">SET ' + v.set + ' OF ' + sets + '</div>' +
        '<h1 class="big" style="font-size:' + nameSize(x.name) + 'px;margin-top:20px">' + E(x.name) + '</h1>' +
        '<div class="row" style="margin-top:36px">' + stats + '</div>' +
        '<div class="row" style="margin-top:28px">' + pips + '</div>' +
      '</div>' + sideList(v) +
      '<div class="foot mono">Tap Set done on your phone or watch to start rest</div></div>';
  }

  var R = 210, CIRC = 2 * Math.PI * R;
  function renderRest(v) {
    var x = v.cur, nxt = v.exs[v.ex + 1];
    var then = nxt ? '<div class="label mono muted" style="margin-top:28px">THEN</div><div style="font-size:30px;font-weight:600;margin-top:6px">' + E(nxt.name) + ' · ' + detail(nxt) + '</div>' : '';
    return '<div class="screen">' + topbar(v) +
      '<div style="position:absolute;left:56px;top:150px;width:460px;height:460px">' +
        '<svg width="460" height="460" viewBox="0 0 460 460" style="position:absolute;left:0;top:0">' +
          '<circle cx="230" cy="230" r="' + R + '" fill="none" stroke="#2A2A2A" stroke-width="24"></circle>' +
          '<circle id="ring" cx="230" cy="230" r="' + R + '" fill="none" stroke="#FF6A2B" stroke-width="24" stroke-linecap="round" stroke-dasharray="' + CIRC + '" stroke-dashoffset="0" transform="rotate(-90 230 230)"></circle>' +
        '</svg>' +
        '<div style="position:absolute;left:0;top:140px;width:460px;text-align:center">' +
          '<div id="restlabel" class="mono muted" style="font-size:22px;letter-spacing:0.1em">REST</div>' +
          '<div id="left" style="font-size:150px;font-weight:800;letter-spacing:-0.03em;line-height:1">0:00</div>' +
          '<div class="mono muted" style="font-size:20px;margin-top:6px">of ' + G.clock(state.rest_total) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="position:absolute;left:600px;top:200px;width:620px">' +
        '<div class="accent" style="font-size:26px;font-weight:600">NEXT: SET ' + v.set + ' OF ' + (x.sets || 1) + '</div>' +
        '<div class="big" style="font-size:' + Math.min(76, nameSize(x.name)) + 'px;margin-top:10px;line-height:1">' + E(x.name) + '</div>' +
        '<div style="font-size:36px;font-weight:600;color:#CFCFCF;margin-top:10px">' + E(x.reps || '') + ' reps' + (x.weight ? ' · ' + E(x.weight) : '') + '</div>' +
        '<div style="height:2px;width:520px;background:#2A2A2A;margin-top:28px"></div>' + then +
      '</div>' +
      '<div class="foot mono">Tap Set done to skip rest · +30s from phone or watch</div></div>';
  }

  function renderIdle(v) {
    var cards = '';
    for (var i = 0; i < v.days.length && i < 3; i++) {
      var d = v.days[i], names = [];
      for (var j = 0; j < (d.exercises || []).length && j < 6; j++) names.push(E(d.exercises[j].name));
      if ((d.exercises || []).length > 6) names.push('+' + (d.exercises.length - 6) + ' more');
      cards += '<div class="day' + (i === state.day ? ' sel' : '') + '"><div class="t">' + E(d.name) + '</div>' +
        '<div class="mono muted" style="font-size:16px;margin-top:6px">' + (d.exercises || []).length + ' EXERCISES</div>' +
        '<div class="e">' + names.join('<br>') + '</div></div>';
    }
    return '<div class="screen">' +
      '<div class="mono muted topbar">READY WHEN YOU ARE, RORY</div>' +
      '<h1 class="big" style="font-size:96px;margin-top:18px">Pick a workout</h1>' +
      '<div class="row" style="margin-top:44px;-webkit-align-items:flex-start;align-items:flex-start">' + cards + '</div>' +
      '<div class="foot mono">Start from your phone: ' + E(remoteUrl()) + '</div></div>';
  }

  function renderDone(v) {
    return '<div class="screen">' +
      '<div class="mono muted topbar">' + E(String(v.day.name).toUpperCase()) + ' · COMPLETE</div>' +
      '<h1 class="big accent" style="font-size:140px;margin-top:120px">Done.</h1>' +
      '<div style="font-size:44px;font-weight:600;margin-top:28px">' + v.exs.length + ' exercises' +
      (state.started_at ? ' in <span id="elapsed">' + G.clock(G.elapsed(state)) + '</span>' : '') + '</div>' +
      '<div class="foot mono">End the workout on your phone to go back to the start</div></div>';
  }

  function message(t) { viewEl.innerHTML = '<div id="msg">' + t + '</div>'; }

  function render() {
    if (!state) return;
    var v = G.view(state);
    var phase = v.phase;
    if ((phase === 'work' || phase === 'rest' || phase === 'done') && !v.cur) phase = 'idle';
    var key = [phase, state.day, state.ex, state.set_no, state.updated_at, state.paused_left === null].join('|');
    if (key !== lastKey) {
      lastKey = key;
      viewEl.innerHTML = phase === 'work' ? renderWork(v) : phase === 'rest' ? renderRest(v) : phase === 'done' ? renderDone(v) : renderIdle(v);
    }
    tick();
  }

  function tick() {
    if (!state) return;
    var el = document.getElementById('elapsed');
    if (el && state.phase !== 'done') el.innerHTML = G.clock(G.elapsed(state));
    var left = document.getElementById('left');
    if (left) {
      var s = G.restLeft(state), paused = state.paused_left !== null && state.paused_left !== undefined;
      if (s <= 0 && !paused) { render(); return; }
      left.innerHTML = G.clock(s);
      document.getElementById('restlabel').innerHTML = paused ? 'PAUSED' : 'REST';
      var ring = document.getElementById('ring');
      var frac = state.rest_total > 0 ? s / state.rest_total : 0;
      ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - Math.max(0, Math.min(1, frac)))));
      if (!paused && s !== lastBeep && s <= 3) { lastBeep = s; beep(s === 0 ? 900 : 600, s === 0 ? 0.6 : 0.15); }
    }
    netEl.style.display = Date.now() - lastOk > 5000 ? 'block' : 'none';
  }

  var audio = null;
  function beep(freq, dur) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = audio || new AC();
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
      g.gain.value = 0.3; o.start(0); o.stop(audio.currentTime + dur);
    } catch (e) {}
  }

  // When a rest finishes on its own, play the final beep once.
  var wasResting = false;
  setInterval(function () {
    if (!state) return;
    var resting = state.phase === 'rest' && G.restLeft(state) > 0;
    if (wasResting && !resting && G.view(state).phase === 'work' && lastBeep !== 0) { lastBeep = 0; beep(900, 0.6); }
    if (resting && G.restLeft(state) > 3) lastBeep = -1;
    wasResting = resting;
    tick();
  }, 250);

  function poll() {
    G.get(function (err, s) {
      if (!err) { state = s; lastOk = Date.now(); render(); }
      else if (!state) message('Can’t reach the gym server yet. Retrying…<br><span class="muted" style="font-size:22px">' + E(err.message) + '</span>');
      setTimeout(poll, 1000);
    });
  }

  if (!G.configured()) {
    message('Almost there. Open <b>config.js</b> and add your Supabase URL, key and room code (see the README).');
  } else {
    message('Connecting…');
    poll();
  }
})();
