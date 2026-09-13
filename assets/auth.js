/* ---------------------------------------------------------------------------
 * Sign-in, for every page behind it.
 *
 * Loaded in <head>, before anything else draws. With no session it sends you
 * to signin.html, and back to this page afterwards. It gives pages
 * AikoAuth.fetch, which adds the session to Worker calls, refreshes it before
 * it runs out, and sends you back to sign in when the Worker stops accepting
 * it. It also puts a Sign out button in the nav.
 *
 * The session is only a key for the Worker. The Worker checks it on every call
 * and holds the database key, so nothing on this side is trusted for access.
 * ------------------------------------------------------------------------ */
(function () {
  'use strict';

  var WORKER = 'https://trilith-ask.jenna-cbd.workers.dev';
  var KEY = 'aiko-session';

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }

  var session = read();
  var leaving = false;

  function toSignIn(why) {
    if (leaving) return;
    leaving = true;
    document.documentElement.style.visibility = 'hidden';
    var here = (location.pathname.split('/').pop() || '') + location.search;
    var q = 'next=' + encodeURIComponent(here);
    if (why) q += '&why=' + encodeURIComponent(why);
    location.replace('./signin.html?' + q);
  }

  /* An error the Worker gave for the session itself, as opposed to the
     network failing. Only these send you back to sign in. */
  function authError(message) {
    var e = new Error(message || 'Sign in again.');
    e.auth = true;
    return e;
  }

  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = window.fetch(WORKER + '/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: session && session.refresh_token }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok || !body.session) throw authError(body.error);
        session = body.session;
        write(session);
        return session;
      });
    });
    refreshing.then(function () { refreshing = null; }, function () { refreshing = null; });
    return refreshing;
  }

  function fresh() {
    if (!session) return Promise.reject(authError());
    var soon = Math.floor(Date.now() / 1000) + 60;
    return (session.expires_at || 0) > soon ? Promise.resolve(session) : refresh();
  }

  function withAuth(init, s) {
    var next = Object.assign({}, init || {});
    var h = new Headers(next.headers || {});
    h.set('authorization', 'Bearer ' + s.access_token);
    next.headers = h;
    return next;
  }

  /* fetch for Worker calls. On a 401 it refreshes once and retries; if the
     Worker still says no, or says this email isn't on the list, it sends you
     to sign in. Other responses come back to the page as they are. */
  function authFetch(url, init) {
    return fresh()
      .then(function (s) { return window.fetch(url, withAuth(init, s)); })
      .then(function (res) {
        if (res.status === 401) {
          return refresh().then(function (s2) { return window.fetch(url, withAuth(init, s2)); })
            .then(function (again) {
              if (again.status === 401) throw authError();
              return again;
            });
        }
        if (res.status === 403) {
          return res.clone().json().then(function (body) {
            if (body && body.signin) { clear(); toSignIn('not-listed'); }
            return res;
          }, function () { return res; });
        }
        return res;
      })
      .catch(function (err) {
        if (err && err.auth) { clear(); toSignIn('expired'); }
        throw err;
      });
  }

  function signOut() {
    var s = session;
    session = null;
    clear();
    var done = function () { location.replace('./signin.html'); };
    if (!s) { done(); return; }
    window.fetch(WORKER + '/auth/signout', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + s.access_token },
    }).then(done, done);
  }

  function mountButton() {
    var nav = document.querySelector('.site-nav');
    if (!nav || document.getElementById('sign-out')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'sign-out';
    b.className = 'theme-toggle';
    b.textContent = 'Sign out';
    if (session && session.email) b.title = 'Signed in as ' + session.email;
    b.addEventListener('click', signOut);
    nav.append(b);
  }

  window.AikoAuth = {
    fetch: authFetch,
    signOut: signOut,
    email: function () { return session && session.email; },
  };

  if (!session || !session.refresh_token) {
    clear();
    toSignIn();
    return;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton);
  else mountButton();
})();
