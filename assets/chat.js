/* ---------------------------------------------------------------------------
 * Shared chat behaviour for both pages.
 *
 * The planner page mounts it full-width; the briefing mounts it inside a
 * floating panel. Keeping one copy matters more than the few lines it saves:
 * two hand-maintained SSE parsers would drift, and the drift would show up as
 * one page answering differently from the other.
 *
 * Exposes window.AikoChat.create(...) — no modules, because both pages are
 * plain static files served straight off Pages.
 * ------------------------------------------------------------------------ */

(function () {
  'use strict';

  /* Escape first, then add the small amount of markup the model actually emits.
     Order matters: markdown links are converted before bare URLs, and the
     bare-URL pattern requires whitespace or '(' before the scheme so it cannot
     match a URL already sitting inside an href. */
  function render(md) {
    const esc = String(md)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{3}\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^#{1,2}\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
               '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
               '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  }

  /* opts:
   *   workerUrl   deployed Worker base; empty disables the chat and shows setup
   *   transcript  element the conversation is appended to
   *   form        the composer <form>
   *   input       the <textarea>
   *   button      the submit <button>
   *   starters    optional NodeList/array of clickable prompt buttons
   *   onPlan      optional (wrapper, data) => void for planning-mode results
   *   setupNote   optional element revealed when workerUrl is empty
   */
  function create(opts) {
    const {
      workerUrl, transcript, form, input, button,
      starters = [], onPlan = null, setupNote = null,
    } = opts;

    const history = [];
    let busy = false;
    const extraDisable = [];

    if (!workerUrl) {
      if (setupNote) setupNote.hidden = false;
      input.disabled = button.disabled = true;
      input.placeholder = 'Backend not configured — see the note above';
      /* starters are the containing groups, so reach the buttons inside them. */
      Array.from(starters).forEach((group) => {
        group.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      });
    }

    function addMessage(kind, who, text) {
      const el = document.createElement('div');
      el.className = 'msg ' + kind;
      const w = document.createElement('div');
      w.className = 'who';
      w.textContent = who;
      const b = document.createElement('div');
      b.className = 'bubble';
      b.textContent = text || '';
      el.append(w, b);
      transcript.append(el);
      el.scrollIntoView({ block: 'end', behavior: 'smooth' });
      return { wrapper: el, bubble: b };
    }

    function setBusy(state) {
      busy = state;
      button.disabled = state;
      extraDisable.forEach((el) => { el.disabled = state; });
    }

    async function run(payload, userLabel, botLabel) {
      setBusy(true);

      const shown = payload.brief || ('Plan ' + payload.count + ' videos.');
      addMessage('user', userLabel, shown);

      const { wrapper, bubble } = addMessage('bot', botLabel, '');
      const searches = document.createElement('div');
      searches.className = 'searches';
      wrapper.insertBefore(searches, bubble);
      bubble.classList.add('cursor');

      let answer = '';
      try {
        const res = await fetch(workerUrl.replace(/\/+$/, '') + '/ideas', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.error || ('request failed (' + res.status + ')'));
        }

        /* Parse the SSE stream by hand — EventSource cannot POST. Frames can be
           cut mid-boundary, so keep the trailing partial in the buffer. */
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';

          for (const frame of frames) {
            const lines = frame.split('\n');
            const evLine = lines.find((l) => l.indexOf('event: ') === 0);
            const dataLine = lines.find((l) => l.indexOf('data: ') === 0);
            if (!evLine || !dataLine) continue;
            const event = evLine.slice(7).trim();
            let data;
            try { data = JSON.parse(dataLine.slice(6)); } catch (e) { continue; }

            if (event === 'token') {
              answer += data;
              bubble.innerHTML = render(answer);
              bubble.scrollIntoView({ block: 'end' });
            } else if (event === 'tool') {
              const row = document.createElement('div');
              row.className = 'search' + (data.failed ? ' failed' : '');
              const tag = document.createElement('span');
              tag.className = 'tag';
              tag.textContent = data.failed ? (data.label + ' — search failed') : data.label;
              const detail = document.createElement('span');
              detail.textContent = data.detail;
              const n = document.createElement('span');
              n.className = 'n';
              n.textContent = data.failed ? '' : ('→ ' + data.count);
              row.append(tag, detail, n);
              searches.append(row);
              row.scrollIntoView({ block: 'end' });
            } else if (event === 'plan') {
              if (onPlan) onPlan(wrapper, data);
            } else if (event === 'note') {
              const nte = document.createElement('div');
              nte.className = 'usage';
              nte.textContent = data.message;
              wrapper.append(nte);
            } else if (event === 'error') {
              bubble.classList.remove('cursor');
              addMessage('error', 'Problem', data.message);
            } else if (event === 'done') {
              const u = document.createElement('div');
              u.className = 'usage';
              const cached = data.usage.cacheRead
                ? (' · ' + data.usage.cacheRead.toLocaleString() + ' cached') : '';
              u.textContent = data.model + ' · ' + data.usage.searches + ' searches · '
                + data.usage.output.toLocaleString() + ' output tokens' + cached;
              wrapper.append(u);
            }
          }
        }
      } catch (err) {
        addMessage('error', 'Problem', err.message);
      } finally {
        bubble.classList.remove('cursor');
        if (answer) history.push({ role: 'user', content: shown },
                                 { role: 'assistant', content: answer });
        setBusy(false);
        input.focus();
      }
    }

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const brief = input.value.trim();
      if (!brief || busy || !workerUrl) return;
      input.value = '';
      input.style.height = 'auto';
      run({ brief, history }, opts.userLabel || 'You', opts.botLabel || 'Answer');
    });

    Array.from(starters).forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || busy || !workerUrl) return;
        input.value = btn.textContent.trim();
        form.requestSubmit();
      });
    });

    return {
      run,
      render,
      addMessage,
      history,
      isBusy: () => busy,
      /* Extra controls that should grey out while a request is in flight —
         the planner's Propose button, for instance. */
      disableWhileBusy: (el) => { extraDisable.push(el); },
    };
  }

  window.AikoChat = { create, render };
})();
