// Shared by the TV and phone pages. Plain ES5 so it runs on old Fire TV browsers.
(function () {
  var cfg = window.GYM_CONFIG || {};
  var m = /[?&]room=([^&#]+)/.exec(location.search);
  if (m) cfg.room = decodeURIComponent(m[1]);

  function ts(v) { return Date.parse(String(v).replace(/(\.\d{3})\d+/, '$1')); }

  function configured() {
    return !!(cfg.supabaseUrl && cfg.supabaseKey && cfg.room);
  }

  function rpc(fn, args, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', cfg.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, true);
    xhr.setRequestHeader('apikey', cfg.supabaseKey);
    if (cfg.supabaseKey.indexOf('eyJ') === 0) xhr.setRequestHeader('Authorization', 'Bearer ' + cfg.supabaseKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    var finished = false;
    function finish(err, data) { if (finished) return; finished = true; cb && cb(err, data); }
    xhr.onload = function () {
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        data._recv = Date.now();
        finish(null, data);
      } else {
        finish(new Error((data && data.message) || ('Error ' + xhr.status)));
      }
    };
    xhr.onerror = function () { finish(new Error('Network error')); };
    xhr.ontimeout = function () { finish(new Error('Timed out')); };
    xhr.send(JSON.stringify(args));
  }

  // Seconds of rest left, using the server clock so the TV and phone agree.
  function restLeft(s) {
    if (!s || s.phase !== 'rest') return 0;
    if (s.paused_left !== null && s.paused_left !== undefined) return s.paused_left;
    var offset = ts(s.server_now) - s._recv;
    var nowServer = Date.now() + offset;
    return Math.max(0, Math.ceil((ts(s.rest_ends) - nowServer) / 1000));
  }

  // Elapsed workout seconds.
  function elapsed(s) {
    if (!s || !s.started_at) return 0;
    var offset = ts(s.server_now) - s._recv;
    return Math.max(0, Math.floor((Date.now() + offset - ts(s.started_at)) / 1000));
  }

  // The view of state: a rest that has run out shows as the next set.
  function view(s) {
    var phase = s.phase;
    if (phase === 'rest' && restLeft(s) <= 0 && (s.paused_left === null || s.paused_left === undefined)) phase = 'work';
    var days = (s.plan && s.plan.days) || [];
    var day = days[s.day] || { name: '', exercises: [] };
    var exs = day.exercises || [];
    return { phase: phase, days: days, day: day, exs: exs, cur: exs[s.ex] || null, ex: s.ex, set: s.set_no };
  }

  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), mnt = Math.floor((sec % 3600) / 60), x = sec % 60;
    var mm = (h ? (mnt < 10 ? '0' : '') : '') + mnt;
    return (h ? h + ':' : '') + mm + ':' + (x < 10 ? '0' : '') + x;
  }

  function esc(t) {
    return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.Gym = {
    cfg: cfg,
    configured: configured,
    get: function (cb) { rpc('gym_get', { p_room: cfg.room }, cb); },
    act: function (action, value, cb) {
      var args = { p_room: cfg.room, p_action: action };
      if (value !== undefined && value !== null) args.p_value = value;
      rpc('gym_action', args, cb);
    },
    restLeft: restLeft, elapsed: elapsed, view: view, clock: clock, esc: esc
  };
})();
