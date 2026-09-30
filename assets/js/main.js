/* ============================================================
   АнапаДом — landing interactions
   reveal · parallax · tilt · counters · timer · form · nav
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     0. КОНФИГ ОТПРАВКИ ЗАЯВОК
     ------------------------------------------------------------
     Вставьте сюда URL вашего приёмника — код больше трогать
     не придётся. Поддерживаются (инструкции в README.md):

       • Google Таблица   → Apps Script doPost
       • Airtable         → Make / Zapier / n8n webhook
       • amoCRM / Bitrix24 → вебхук или REST-эндпоинт
       • Telegram         → через бота relay (см. README)

     Пустая строка = режим «демо»: заявка пишется в консоль
     браузера, интерфейс отрабатывает как обычно.
     ============================================================ */
  var LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwzT9i2QzEsbF6fIVEuRneRrblf5PW8nEkop4JcsOc_UEKa05S3BN1LsUywriErF9mB/exec';        // ← ВСТАВЬТЕ ССЫЛКУ СЮДА
  var LEAD_TIMEOUT   = 12000;    // мс до таймаута запроса
  var LEAD_CORS_MODE = 'text';   // 'text' — без preflight (Google Apps Script)
                                // 'json'  — обычный JSON POST (Airtable, CRM)

  /* ---------------------------------------------------------
     1. SCROLL REVEAL (IntersectionObserver + stagger)
     --------------------------------------------------------- */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    // read optional per-item delay
    items.forEach(function (el) {
      var d = el.getAttribute('data-reveal-delay');
      if (d) el.style.setProperty('--d', d + 'ms');
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     2. PARALLAX  (scroll + rAF, single loop)
     --------------------------------------------------------- */
  var parallaxNodes = [];
  var scrollY = 0, ticking = false;

  function collectParallax() {
    parallaxNodes = $$('[data-speed], [data-parallax]').map(function (el) {
      var attr = el.getAttribute('data-speed');
      return {
        el: el,
        speed: attr !== null ? parseFloat(attr)
              : parseFloat(el.getAttribute('data-parallax')) || 0,
        top: 0
      };
    });
    parallaxNodes.forEach(function (n) {
      n.top = n.el.getBoundingClientRect().top + scrollY;
    });
  }

  function applyParallax() {
    var vh = window.innerHeight;
    for (var i = 0; i < parallaxNodes.length; i++) {
      var n = parallaxNodes[i];
      if (!n.speed) continue;
      // distance of element centre from viewport centre
      var centre = n.top + n.el.offsetHeight / 2;
      var delta  = centre - (scrollY + vh / 2);
      var shift  = delta * n.speed;
      n.el.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'px,0)';
    }
  }

  function requestParallax() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(function () {
        applyParallax();
        ticking = false;
      });
    }
  }

  /* ---------------------------------------------------------
     3. SCROLL UI  (progress bar, header, sticky CTA, active nav)
     --------------------------------------------------------- */
  var header    = $('#header');
  var scrollBar = $('#scrollBar');
  var stickyCta = $('#stickyCta');
  var lastY     = 0;
  var navLinks  = $$('.nav a');
  var sections  = navLinks.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
  var heroEl    = $('.hero');
  var ctaEl     = $('#cta');

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    scrollY = y;

    // progress bar
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollBar) scrollBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';

    // header: compact + hide on scroll down
    if (header) {
      header.classList.toggle('is-stuck', y > 40);
      if (y > 460 && y > lastY) header.classList.add('is-hidden');
      else header.classList.remove('is-hidden');
    }
    lastY = y;

    // sticky CTA: show after hero, hide when form is in view
    if (stickyCta) {
      var pastHero   = heroEl ? y > heroEl.offsetHeight - 120 : y > 600;
      var formInView = false;
      if (ctaEl) {
        var r = ctaEl.getBoundingClientRect();
        formInView = r.top < window.innerHeight * 0.85 && r.bottom > 0;
      }
      var show = pastHero && !formInView;
      stickyCta.classList.toggle('is-visible', show);
      // `inert` (not aria-hidden) so the CTA link also leaves the tab order
      if (show) stickyCta.removeAttribute('inert');
      else stickyCta.setAttribute('inert', '');
    }

    // active nav link
    var probe = y + window.innerHeight * 0.32;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var isActive = s.offsetTop <= probe && s.offsetTop + s.offsetHeight > probe;
      if (isActive) {
        navLinks.forEach(function (a) { a.classList.remove('is-active'); });
        navLinks[i].classList.add('is-active');
      }
    }

    updateHeaderTheme();
    requestParallax();
  }

  /* ---------------------------------------------------------
     4. COUNTERS
     --------------------------------------------------------- */
  function initCounters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      nums.forEach(function (el) { el.textContent = formatCount(el); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    nums.forEach(function (el) { io.observe(el); });
  }

  function formatCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    return target.toLocaleString('ru-RU');
  }

  function countUp(el) {
    var target  = parseFloat(el.getAttribute('data-count')) || 0;
    var dur     = 1500;
    var start   = null;
    // the "0 ₽" tile should just show its label, no animation
    if (target === 0) { el.textContent = '0'; return; }

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('ru-RU');
      if (p < 1) window.requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString('ru-RU');
    }
    window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------
     5. COUNTDOWN  →  today 23:59:59
     --------------------------------------------------------- */
  function initTimer() {
    var h = $('#tH'), m = $('#tM'), s = $('#tS');
    if (!h || !m || !s) return;

    function deadline() {
      var now = new Date();
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      if (now > end) end.setDate(end.getDate() + 1);   // roll to tomorrow
      return end;
    }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function tick() {
      var end = deadline();
      var diff = Math.max(0, end - new Date());
      var total = Math.floor(diff / 1000);
      var hh = Math.floor(total / 3600);
      var mm = Math.floor((total % 3600) / 60);
      var ss = total % 60;
      h.textContent = pad(hh);
      m.textContent = pad(mm);
      s.textContent = pad(ss);
    }

    tick();
    window.setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------
     6. SLOTS COUNTER
     --------------------------------------------------------- */
  function initSlots() {
    var label = $('#slotsLeft');
    if (!label) return;
    var free = 2, total = 3, shown = free;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var t0 = null, dur = 1400;
        function step(ts) {
          if (t0 === null) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1);
          var e = 1 - Math.pow(1 - p, 3);
          var cur = Math.round(total - (total - shown) * e);
          if (p < 1) {
            label.textContent = 'Осталось ' + cur + ' из ' + total;
            window.requestAnimationFrame(step);
          } else {
            label.textContent = 'Осталось ' + shown + ' из ' + total;
          }
        }
        if (reduceMotion) { label.textContent = 'Осталось ' + shown + ' из ' + total; }
        else window.requestAnimationFrame(step);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    io.observe(label);
  }

  /* ---------------------------------------------------------
     7. CARD TILT  (subtle 3D, pointer-only)
     --------------------------------------------------------- */
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
    var MAX = 7; // degrees

    $$('[data-tilt]').forEach(function (el) {
      el.style.transformStyle = 'preserve-3d';

      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;   // 0..1
        var py = (e.clientY - r.top) / r.height;   // 0..1

        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');

        var ry = (px - 0.5) * MAX * 2;
        var rx = (0.5 - py) * MAX * 2;
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-10px)';
      });

      el.addEventListener('pointerleave', function () {
        el.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------
     8. MOBILE MENU
     --------------------------------------------------------- */
  function initMenu() {
    var burger = $('#burger');
    var menu   = $('#mobileMenu');
    if (!burger || !menu) return;

    function setOpen(open) {
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.classList.toggle('is-open', open);
      if (open) menu.removeAttribute('hidden');
      else {
        // delay removal so the fade-out can play
        window.setTimeout(function () {
          if (!burger.classList.contains('is-open')) menu.setAttribute('hidden', '');
        }, 340);
      }
    }

    burger.addEventListener('click', function () {
      setOpen(!burger.classList.contains('is-open'));
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.classList.contains('is-open')) setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1180 && burger.classList.contains('is-open')) setOpen(false);
    });
  }

  /* ---------------------------------------------------------
     9. FAQ  (animated accordion, single-open)
     --------------------------------------------------------- */
  function initFaq() {
    var items = $$('.acc');
    if (!items.length) return;

    items.forEach(function (item) {
      var summary = $('summary', item);
      var body    = $('.acc__body', item);

      summary.addEventListener('click', function (e) {
        e.preventDefault();
        var opening = !item.open;

        // close others
        items.forEach(function (other) {
          if (other !== item && other.open) close(other);
        });

        if (opening) open(item); else close(item);
      });

      function open(el) {
        var b = $('.acc__body', el);
        b.style.height = b.scrollHeight + 'px';
        el.open = true;
        b.addEventListener('transitionend', function te(ev) {
          if (ev.propertyName !== 'height') return;
          b.style.height = 'auto';
          b.removeEventListener('transitionend', te);
        });
      }

      function close(el) {
        var b = $('.acc__body', el);
        b.style.height = b.scrollHeight + 'px';
        // force reflow
        void b.offsetHeight;
        b.style.height = '0px';
        el.open = false;
      }
    });

    // make sure the first one is closed initially
    items.forEach(function (el) {
      el.open = false;
      var b = $('.acc__body', el);
      if (b) { b.style.height = '0px'; b.style.transition = 'height .45s cubic-bezier(.22,1,.36,1)'; }
    });
  }

  /* ---------------------------------------------------------
     10. PHONE MASK  +7 (999) 123-45-67
     --------------------------------------------------------- */
  function initPhoneMask() {
    var input = $('#fPhone');
    if (!input) return;

    function digits(v) { return (v || '').replace(/\D/g, ''); }

    function format(v) {
      var d = digits(v);
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);

      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 4) out += ')';
      if (d.length > 4) out += ' ' + d.slice(4, 7);
      if (d.length > 7) out += '-' + d.slice(7, 9);
      if (d.length > 9) out += '-' + d.slice(9, 11);
      return out;
    }

    input.addEventListener('input', function () {
      input.value = format(input.value);
      if (input.value.replace(/\D/g, '').length > 10) blurInput();
    });
    input.addEventListener('focus', function () { if (!input.value) input.value = '+7 ('; });
    input.addEventListener('blur', function () {
      if (digits(input.value).length <= 1) input.value = '';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && input.selectionStart <= 3) input.value = '';
    });

    function blurInput() {
      var f = input.closest('.field');
      if (f) f.classList.remove('has-error');
      var err = $('[data-err="phone"]');
      if (err) err.classList.remove('is-shown');
    }
  }

  /* ---------------------------------------------------------
     11. FORM
     --------------------------------------------------------- */
  function initForm() {
    var form   = $('#leadForm');
    var btn    = $('#submitBtn');
    var ok     = $('#leadSuccess');
    if (!form || !btn) return;

    function setError(name, msg) {
      var box = $('[data-err="' + name + '"]', form);
      if (box) {
        box.textContent = msg || '';
        box.classList.toggle('is-shown', !!msg);
      }
      var field = form.querySelector('[name="' + name + '"]');
      if (field && field.closest('.field')) {
        field.closest('.field').classList.toggle('has-error', !!msg);
      }
    }

    function validate() {
      var okAll = true;
      var name  = $('#fName');
      var phone = $('#fPhone');
      var agree = $('#fAgree');

      if (!name.value.trim() || name.value.trim().length < 2) {
        setError('name', 'Укажите, как к вам обращаться');
        okAll = false;
      } else setError('name', '');

      var pd = phone.value.replace(/\D/g, '');
      if (pd.length !== 11) {
        setError('phone', 'Введите полный номер телефона');
        okAll = false;
      } else setError('phone', '');

      if (!agree.checked) {
        setError('agree', 'Нужно согласие на обработку данных');
        okAll = false;
      } else setError('agree', '');

      return okAll;
    }

    // clear error on input
    ['#fName', '#fPhone'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      el.addEventListener('input', function () {
        setError(el.name, '');
        var f = el.closest('.field');
        if (f) f.classList.remove('has-error');
      });
    });
    var agreeEl = $('#fAgree');
    if (agreeEl) agreeEl.addEventListener('change', function () { if (agreeEl.checked) setError('agree', ''); });

    /* ---------- сбор заявки ---------- */
    function collect() {
      var q    = new URLSearchParams(window.location.search);
      return {
        name:    $('#fName').value.trim(),
        phone:   $('#fPhone').value.trim(),
        price:   '9 999 999 ₽',
        project: 'Дом под ключ, Анапа',
        src:     'landing-anapa',
        page:    window.location.href,
        ua:      navigator.userAgent,
        ts:      new Date().toISOString(),
        utm_source:   q.get('utm_source')   || '',
        utm_medium:   q.get('utm_medium')   || '',
        utm_campaign: q.get('utm_campaign') || '',
        utm_content:  q.get('utm_content')  || ''
      };
    }

    /* ---------- POST на приёмник ---------- */
    function send(payload) {
      if (!LEAD_ENDPOINT) {
        // демо-режим: эндпоинт не задан
        console.log('[lead] LEAD_ENDPOINT не задан — заявка:', payload);
        return Promise.resolve({ ok: true, demo: true });
      }

      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var timer = ctrl ? window.setTimeout(function () { ctrl.abort(); }, LEAD_TIMEOUT) : null;

      var opts = {
        method: 'POST',
        mode:   'cors',
        headers: LEAD_CORS_MODE === 'json'
          ? { 'Content-Type': 'application/json' }
          : { 'Content-Type': 'text/plain;charset=utf-8' },  // без preflight
        body:   JSON.stringify(payload),
        redirect: 'follow'
      };
      if (ctrl) opts.signal = ctrl.signal;

      return fetch(LEAD_ENDPOINT, opts)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text().catch(function () { return ''; });
        })
        .finally(function () { if (timer) window.clearTimeout(timer); });
    }

    /* ---------- состояния кнопки ---------- */
    var errBox  = $('[data-err="send"]', form);
    var btnText = $('span', btn);
    var btnIdle = btnText ? btnText.textContent : '';

    function setSending(on) {
      btn.classList.toggle('is-loading', on);
      btn.disabled = on;
      if (btnText) btnText.textContent = on ? 'Отправляем…' : btnIdle;
    }

    function showSendError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.classList.add('is-shown');
    }

    function clearSendError() {
      if (errBox) {
        errBox.textContent = '';
        errBox.classList.remove('is-shown');
      }
    }

    function showSuccess() {
      form.classList.add('is-hidden');
      ok.hidden = false;
      if (window.innerWidth > 900) {
        ok.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearSendError();

      if (!validate()) {
        var firstBad = form.querySelector('.has-error input') || $('#fName');
        if (firstBad) firstBad.focus();
        return;
      }

      // ловушка для ботов: скрытое поле должно остаться пустым
      var trap = $('[name="company"]', form);
      if (trap && trap.value) return;

      var payload = collect();
      setSending(true);

      send(payload)
        .then(function () {
          showSuccess();
          console.log('[lead] отправлено', payload);
        })
        .catch(function (err) {
          var aborted = err && err.name === 'AbortError';
          console.error('[lead] ошибка отправки', err);
          setSending(false);
          showSendError(
            aborted
              ? 'Сервер не ответил вовремя. Попробуйте ещё раз или позвоните нам.'
              : 'Не удалось отправить заявку. Проверьте интернет или позвоните нам.'
          );
          // сохраняем введённое, чтобы не заставлять вводить заново
          form.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    });
  }

  /* ---------------------------------------------------------
     12. SMOOTH ANCHOR (header offset)
     --------------------------------------------------------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var el = $(id);
        if (!el) return;
        e.preventDefault();
        var headerH = header ? header.offsetHeight + 12 : 0;
        var top = el.getBoundingClientRect().top + window.pageYOffset - headerH;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------------------------------------------------------
     13. PARALLAX MOUSE (hero visual depth)
     Uses the standalone `translate` property so it composes
     with the tilt `transform` instead of fighting it.
     --------------------------------------------------------- */
  function initMouseParallax() {
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
    var visual = $('.hero__visual');
    var card   = $('.house-card');
    if (!visual || !card) return;

    function move(e) {
      var r = visual.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      card.style.translate = (dx * 12).toFixed(2) + 'px ' + (dy * 10).toFixed(2) + 'px';
    }
    function reset() { card.style.translate = '0px 0px'; }

    visual.addEventListener('pointermove', move);
    visual.addEventListener('pointerleave', reset);
  }

  /* ---------------------------------------------------------
     14. HEADER THEME — switch to light glass over light bands
     Pure geometry, evaluated from onScroll() so it can never
     lag or fight an observer.
     --------------------------------------------------------- */
  var lightZones = $$('.section--light');
  function updateHeaderTheme() {
    if (!header || !lightZones.length) return;
    var probe = header.offsetHeight * 0.6;
    var under = false;
    for (var i = 0; i < lightZones.length; i++) {
      var r = lightZones[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { under = true; break; }
    }
    header.classList.toggle('is-light', under);
  }

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  function boot() {
    collectParallax();
    initReveal();
    initCounters();
    initTimer();
    initSlots();
    initTilt();
    initMenu();
    initFaq();
    initPhoneMask();
    initForm();
    initAnchors();
    initMouseParallax();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      collectParallax();
      onScroll();
    }, { passive: true });
    window.addEventListener('load', function () { collectParallax(); onScroll(); });

    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
