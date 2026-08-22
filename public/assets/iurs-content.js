/* IURS live content binder — gallery + training sessions.
   Progressive enhancement: the page already contains the full static content.
   This script only REPLACES it when the API answers successfully, so a database
   or network problem can never leave the page empty. */
(function () {
  'use strict';

  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Only allow same-origin image paths / absolute http(s) URLs.
  var safeSrc = function (v) {
    var s = String(v || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^(assets|uploads)\//.test(s) || /^\/(assets|uploads)\//.test(s)) return s;
    return '';
  };

  var getJSON = function (url) {
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error(url + ' -> ' + r.status);
      return r.json();
    });
  };

  // Make newly inserted .reveal elements animate in, and guarantee they can
  // never remain invisible even if IntersectionObserver is unavailable.
  var reveal = function (nodes) {
    var list = Array.prototype.slice.call(nodes);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
        });
      }, { threshold: 0.08 });
      list.forEach(function (n) { io.observe(n); });
    }
    setTimeout(function () { list.forEach(function (n) { n.classList.add('visible'); }); }, 1200);
  };

  /* ---------------- gallery.html ---------------- */
  function galleryCard(row, extraClass) {
    var art = document.createElement('article');
    art.className = 'gallery-card reveal' + (extraClass || '');
    art.dataset.category = row.category || 'Events';
    var src = safeSrc(row.image_url);
    var fit = row.fit === 'contain' ? 'contain' : 'cover';
    art.innerHTML =
      '<button class="gallery-open" type="button" data-image="' + esc(src) + '" data-meta="' +
        esc(row.caption || '') + '" data-title="' + esc(row.title || '') + '">' +
        '<div class="gallery-image-wrap">' +
          '<img loading="lazy" decoding="async" alt="' + esc(row.title || 'IURS gallery image') +
            '" src="' + esc(src) + '" style="object-fit:' + fit + ';">' +
          '<span class="gallery-view"><i class="fas fa-expand"></i></span>' +
        '</div>' +
      '</button>' +
      '<div class="gallery-card-body">' +
        '<span class="gallery-cat">' + esc(row.category || '') + '</span>' +
        '<h3>' + esc(row.title || '') + '</h3>' +
        (row.caption ? '<p>' + esc(row.caption) + '</p>' : '') +
        '<span aria-hidden="true" class="gallery-card-arrow">↗</span>' +
      '</div>';
    return art;
  }

  function bindGallery() {
    var grid = document.querySelector('.gallery-grid');
    if (!grid) return;

    getJSON('/api/public/gallery').then(function (data) {
      var rows = (data && data.gallery) || [];
      if (!rows.length) return; // keep the static content

      var featured = rows.filter(function (r) { return +r.featured === 1; });
      var rest = rows.filter(function (r) { return +r.featured !== 1; });

      // The curated strip is a fixed 5-slot CSS layout; only rebuild it when we
      // genuinely have 5 featured photos, otherwise leave the designed block alone.
      var fGrid = document.querySelector('.gallery-featured-grid');
      if (fGrid && featured.length >= 5) {
        fGrid.innerHTML = '';
        featured.slice(0, 5).forEach(function (r, i) {
          fGrid.appendChild(galleryCard(r, (i ? ' reveal-delay-' + i : '') + ' gallery-featured-card feature-' + (i + 1)));
        });
      }

      var pool = (fGrid && featured.length >= 5) ? rest : rows;
      grid.innerHTML = '';
      pool.forEach(function (r, i) {
        grid.appendChild(galleryCard(r, i % 4 ? ' reveal-delay-' + (i % 4) : ''));
      });

      reveal(document.querySelectorAll('.gallery-card.reveal:not(.visible)'));
      wireFilters();
    }).catch(function (e) { console.warn('[IURS] gallery kept static:', e.message); });

    // Delegated so it keeps working after the cards are replaced.
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('.gallery-open');
      if (!btn) return;
      var lb = document.getElementById('galleryLightbox');
      if (!lb) return;
      var img = document.getElementById('galleryLightboxImage');
      var title = document.getElementById('galleryLightboxTitle');
      var meta = document.getElementById('galleryLightboxMeta');
      if (img) { img.src = btn.dataset.image || ''; img.alt = btn.dataset.title || 'IURS gallery image'; }
      if (title) title.textContent = btn.dataset.title || '';
      if (meta) meta.textContent = btn.dataset.meta || '';
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }

  function wireFilters() {
    var buttons = document.querySelectorAll('.gallery-filter');
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.onclick = function () {
        var f = btn.dataset.filter;
        buttons.forEach(function (b) { b.classList.toggle('active', b === btn); });
        document.querySelectorAll('.gallery-card').forEach(function (c) {
          c.classList.toggle('is-hidden', f !== 'All' && c.dataset.category !== f);
        });
      };
    });
  }

  /* ---------------- training-session.html ---------------- */
  function bindTraining() {
    var grid = document.querySelector('[data-live-training]');
    if (!grid) return;

    getJSON('/api/public/training').then(function (data) {
      var rows = (data && data.training) || [];
      if (!rows.length) return; // keep the static content

      grid.innerHTML = '';
      rows.forEach(function (r, i) {
        var src = safeSrc(r.image_url);
        var art = document.createElement('article');
        art.className = 'placeholder-card reveal' + (i % 4 ? ' reveal-delay-' + (i % 4) : '');
        art.style.overflow = 'hidden';
        art.style.background = '#fff';
        art.innerHTML =
          (src
            ? '<div class="placeholder-thumb" style="height:260px;background:#f4f5f7;display:flex;align-items:center;justify-content:center;padding:10px;">' +
                '<img loading="lazy" decoding="async" alt="' + esc(r.title || '') + '" src="' + esc(src) +
                '" style="width:100%;height:100%;object-fit:contain;"></div>'
            : '') +
          '<div class="placeholder-body">' +
            '<div class="p-title">' + esc(r.title || '') + '</div>' +
            (r.trainer ? '<div class="p-meta"><i class="fas fa-user"></i> Trainer: ' + esc(r.trainer) + '</div>' : '') +
            (r.date_label ? '<div class="p-meta" style="margin-top:5px;"><i class="fas fa-calendar"></i> ' + esc(r.date_label) + '</div>' : '') +
            (r.description ? '<p class="p-meta" style="margin-top:8px;">' + esc(r.description) + '</p>' : '') +
            (safeSrc(r.link_url) ? '<a class="p-meta" style="margin-top:8px;display:inline-block;" href="' + esc(safeSrc(r.link_url)) + '">Details</a>' : '') +
          '</div>';
        grid.appendChild(art);
      });
      reveal(grid.querySelectorAll('.reveal:not(.visible)'));
    }).catch(function (e) { console.warn('[IURS] training kept static:', e.message); });
  }

  /* ---------------- executive-committee.html ---------------- */
  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '·';
  }

  function execCard(row, i) {
    var src = safeSrc(row.photo_url);
    var div = document.createElement('div');
    div.className = 'exec-card reveal' + (i % 4 ? ' reveal-delay-' + (i % 4) : '');
    var mail = row.email ? 'mailto:' + encodeURIComponent(row.email).replace(/%40/g, '@') : '';
    var link = safeSrc(row.linkedin_url);
    var fb = safeSrc(row.facebook_url);
    div.innerHTML =
      '<div class="exec-photo">' +
        (src ? '<img loading="lazy" decoding="async" alt="' + esc(row.name || '') + '" src="' + esc(src) + '">'
             : '<div class="exec-photo-placeholder">' + esc(initials(row.name)) + '</div>') +
      '</div>' +
      '<div class="exec-name">' + esc(row.name || '') + '</div>' +
      '<div class="exec-role">' + esc(row.designation || '') + '</div>' +
      '<div class="exec-dept">' + esc(row.department || '') + '</div>' +
      '<div class="exec-socials">' +
        (link ? '<a href="' + esc(link) + '" rel="noopener" target="_blank" title="LinkedIn"><i class="fab fa-linkedin-in"></i></a>' : '') +
        (fb ? '<a href="' + esc(fb) + '" rel="noopener" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>' : '') +
        (mail ? '<a href="' + esc(mail) + '" title="Email"><i class="fas fa-envelope"></i></a>' : '') +
      '</div>';
    return div;
  }

  function paintCommittee(session) {
    var grid = document.getElementById('exec-leadership');
    var body = document.getElementById('exec-roster');
    var lead = (session.leadership || []);
    var roster = (session.roster || []);
    if (grid && lead.length) {
      grid.innerHTML = '';
      lead.forEach(function (r, i) { grid.appendChild(execCard(r, i)); });
      reveal(grid.querySelectorAll('.reveal:not(.visible)'));
    }
    if (body && roster.length) {
      body.innerHTML = roster.map(function (r, i) {
        return '<tr><td>' + esc(r.sl_no != null ? r.sl_no : i + 1) + '</td><td>' +
          esc(r.designation || '') + '</td><td>' + esc(r.name || '') + '</td><td>' +
          esc(r.department || '') + '</td></tr>';
      }).join('');
    }
    var p = document.getElementById('committee-lead');
    if (p && session.description) p.textContent = session.description;
    var badge = document.getElementById('committee-badge');
    if (badge) badge.textContent = session.isCurrent ? 'Current committee' : 'Previous committee';
  }

  function bindCommittee() {
    if (!document.getElementById('exec-leadership')) return;

    getJSON('/api/public/committee').then(function (data) {
      var all = [];
      if (data && data.current) all.push(data.current);
      (data && data.archive ? data.archive : []).forEach(function (s) { all.push(s); });
      if (!all.length) return; // keep the static content

      paintCommittee(all[0]);

      var wrap = document.getElementById('committee-switch');
      var sel = document.getElementById('committee-select');
      if (!wrap || !sel) return;
      if (all.length < 2) return; // only one term on record — no need for a switcher

      sel.innerHTML = all.map(function (s, i) {
        return '<option value="' + i + '">' + esc(s.label) + (s.isCurrent ? ' — current' : '') + '</option>';
      }).join('');
      wrap.hidden = false;
      sel.onchange = function () { paintCommittee(all[+sel.value] || all[0]); };
    }).catch(function (e) { console.warn('[IURS] committee kept static:', e.message); });
  }

  /* ---------------- alumni.html ---------------- */
  function alumnusCard(row, i) {
    var src = safeSrc(row.photo_url);
    var d = document.createElement('div');
    d.className = 'iu-person reveal' + (i % 4 ? ' reveal-delay-' + (i % 4) : '');
    var meta = [row.department, row.session_label, row.graduation_year ? 'Class of ' + row.graduation_year : '']
      .filter(Boolean).map(esc).join(' · ');
    var role = [row.occupation, row.organization].filter(Boolean).map(esc).join(', ');
    d.innerHTML =
      '<div class="iu-person-photo">' +
        (src ? '<img loading="lazy" decoding="async" alt="' + esc(row.name || '') + '" src="' + esc(src) + '">'
             : '<div class="exec-photo-placeholder" style="font-size:44px;">' + esc(initials(row.name)) + '</div>') +
      '</div>' +
      '<div class="iu-person-body">' +
        '<p class="iu-person-name">' + esc(row.name || '') + '</p>' +
        (role ? '<p class="iu-person-role">' + role + '</p>' : '') +
        (meta ? '<p class="iu-person-meta">' + meta + '</p>' : '') +
        (row.bio ? '<p class="iu-person-bio">' + esc(row.bio) + '</p>' : '') +
      '</div>';
    return d;
  }

  function bindAlumni() {
    var cur = document.getElementById('alumni-current');
    if (!cur) return;

    getJSON('/api/public/alumni').then(function (data) {
      var current = (data && data.current) || [];
      var previous = (data && data.previous) || [];
      if (!current.length && !previous.length) return; // keep the honest empty state

      if (current.length) {
        cur.innerHTML = '';
        current.forEach(function (r, i) { cur.appendChild(alumnusCard(r, i)); });
      }
      var prevWrap = document.getElementById('alumni-previous-wrap');
      var prev = document.getElementById('alumni-previous');
      if (previous.length && prevWrap && prev) {
        prev.innerHTML = '';
        previous.forEach(function (r, i) { prev.appendChild(alumnusCard(r, i)); });
        prevWrap.hidden = false;
      }
      reveal(document.querySelectorAll('.iu-person.reveal:not(.visible)'));
    }).catch(function (e) { console.warn('[IURS] alumni kept static:', e.message); });
  }

  /* ---------------- blog.html ---------------- */
  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) {
      return p.trim() ? '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>' : '';
    }).join('');
  }

  function bindBlog() {
    var grid = document.getElementById('blog-grid');
    if (!grid) return;

    var slug = new URLSearchParams(location.search).get('post');
    if (slug) {
      var listView = document.getElementById('blog-list-view');
      var postView = document.getElementById('blog-post-view');
      var target = document.getElementById('blog-post');
      if (listView) listView.hidden = true;
      if (postView) postView.hidden = false;
      if (target) target.innerHTML = '<p class="iu-note">Loading article…</p>';

      getJSON('/api/public/blog/' + encodeURIComponent(slug)).then(function (d) {
        var p = d && d.post;
        if (!p || !target) throw new Error('missing');
        document.title = p.title + ' | IURS';
        var img = safeSrc(p.image_url);
        var meta = [p.author, p.category, p.post_date].filter(Boolean).map(esc).join(' · ');
        target.innerHTML =
          '<h1>' + esc(p.title) + '</h1>' +
          (meta ? '<p class="iu-article-meta">' + meta + '</p>' : '') +
          (img ? '<img class="iu-article-img" alt="' + esc(p.title) + '" src="' + esc(img) + '">' : '') +
          '<div class="iu-article-body">' + (paragraphs(p.content) || '<p>' + esc(p.excerpt || '') + '</p>') + '</div>';
      }).catch(function () {
        if (target) target.innerHTML = '<div class="iu-empty">That article is not available. ' +
          '<a href="blog.html" style="color:var(--primaryColor);font-weight:700;">See all articles</a>.</div>';
      });
      return;
    }

    getJSON('/api/public/blog').then(function (data) {
      var rows = (data && data.posts) || [];
      if (!rows.length) return; // keep the honest empty state

      grid.innerHTML = '';
      rows.forEach(function (p, i) {
        var img = safeSrc(p.image_url);
        var a = document.createElement('article');
        a.className = 'iu-post reveal' + (i % 4 ? ' reveal-delay-' + (i % 4) : '');
        var href = 'blog.html?post=' + encodeURIComponent(p.slug);
        a.innerHTML =
          (img ? '<div class="iu-post-img"><img loading="lazy" decoding="async" alt="' + esc(p.title) + '" src="' + esc(img) + '"></div>' : '') +
          '<div class="iu-post-body">' +
            (p.category ? '<p class="iu-post-cat">' + esc(p.category) + '</p>' : '') +
            '<h3 class="iu-post-title"><a href="' + esc(href) + '">' + esc(p.title) + '</a></h3>' +
            (p.excerpt ? '<p class="iu-post-ex">' + esc(p.excerpt) + '</p>' : '<p class="iu-post-ex"></p>') +
            '<p class="iu-post-foot">' + [p.author, p.post_date].filter(Boolean).map(esc).join(' · ') + '</p>' +
          '</div>';
        grid.appendChild(a);
      });
      reveal(grid.querySelectorAll('.reveal:not(.visible)'));
    }).catch(function (e) { console.warn('[IURS] blog kept static:', e.message); });
  }

  /* ---------------- publications.html ---------------- */
  function pubCard(row, i, icon) {
    var link = safeSrc(row.url);
    var art = document.createElement('article');
    art.className = 'pub-card reveal' + (i % 3 ? ' reveal-delay-' + (i % 3) : '');
    var label = row.type_label || ({
      peer_reviewed: 'Peer-reviewed Journal Article', conference: 'Conference Paper',
      working_paper: 'Working Paper', under_review: 'Under Review'
    }[row.category] || 'Research Output');
    var meta = [row.journal, row.publication_year].filter(Boolean).map(esc).join(' · ');
    art.innerHTML =
      '<div class="pub-thumb">' +
        '<span class="pub-type-badge">' + esc(label) + '</span>' +
        '<i class="fas fa-' + icon + '"></i>' +
        (link ? '<a aria-label="Open publication" class="pub-download" href="' + esc(link) +
          '" rel="noopener" target="_blank"><i class="fas fa-arrow-up-right-from-square"></i></a>' : '') +
      '</div>' +
      '<div class="pub-body">' +
        '<h3 class="pub-title">' + esc(row.title || '') + '</h3>' +
        (meta ? '<p class="pub-meta"><i class="fas fa-calendar"></i>' + meta + '</p>' : '') +
        '<p style="font-size:12px;color:#6a6a6a;margin:8px 0;line-height:1.55;">' + esc(row.authors || '') + '</p>' +
        (row.abstract ? '<p style="font-size:12.5px;color:#666;line-height:1.65;margin-bottom:12px;">' + esc(row.abstract) + '</p>' : '') +
        (row.doi ? '<p style="font-size:11.5px;color:#8a8a8a;margin:0 0 10px;">DOI: ' + esc(row.doi) + '</p>' : '') +
        (link ? '<div style="display:flex;gap:8px;flex-wrap:wrap;"><a class="btn-red-outline" href="' + esc(link) +
          '" rel="noopener" style="font-size:12px;padding:6px 10px;" target="_blank">Read publication</a></div>' : '') +
      '</div>';
    return art;
  }

  function bindPublications() {
    var peer = document.getElementById('pub-peer');
    if (!peer) return;

    getJSON('/api/public/publications').then(function (d) {
      var pr = (d && d.peerReviewed) || [], cf = (d && d.conference) || [];
      var wp = (d && d.workingPapers) || [], ur = (d && d.underReview) || [];
      var all = (d && d.publications) || [];
      if (!all.length) return; // keep the static content

      if (pr.length) {
        peer.innerHTML = '';
        pr.forEach(function (r, i) { peer.appendChild(pubCard(r, i, 'book-open')); });
      }
      var conf = document.getElementById('pub-conf');
      if (conf && cf.length) {
        conf.innerHTML = '';
        cf.forEach(function (r, i) { conf.appendChild(pubCard(r, i, 'file-lines')); });
      }
      // Working papers and manuscripts under review are only listed if the committee
      // has actually entered them; the headline counters stay editable either way.
      var prog = document.getElementById('pub-progress-list');
      var pipeline = wp.concat(ur);
      if (prog && pipeline.length) {
        prog.innerHTML = '';
        pipeline.forEach(function (r, i) { prog.appendChild(pubCard(r, i, 'flask')); });
        prog.hidden = false;
      }

      var years = all.map(function (r) { return +r.publication_year || 0; });
      var latest = years.length ? Math.max.apply(null, years) : 0;
      var sum = document.getElementById('pub-summary');
      if (sum) {
        var cards = sum.querySelectorAll('.pub-summary-card strong');
        var vals = [all.length, pr.length, cf.length, latest || ''];
        for (var i = 0; i < cards.length && i < vals.length; i++) {
          if (vals[i] !== '') cards[i].textContent = vals[i];
        }
      }
      reveal(document.querySelectorAll('.pub-card.reveal:not(.visible)'));

      // The "Research in Progress" figures are administrator-set counters.
      return getJSON('/api/public/stats').then(function (st) {
        var w = document.getElementById('pub-working'), r = document.getElementById('pub-review');
        if (w && st && st.working_papers && st.working_papers.value) w.textContent = st.working_papers.value;
        if (r && st && st.under_review && st.under_review.value) r.textContent = st.under_review.value;
      });
    }).catch(function (e) { console.warn('[IURS] publications kept static:', e.message); });
  }

  /* ---------------- join.html ---------------- */
  function bindJoin() {
    var form = document.getElementById('join-form');
    if (!form) return;
    var msg = document.getElementById('j-msg');
    var btn = document.getElementById('j-submit');
    var opened = Date.now();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      msg.className = 'iu-msg';
      msg.textContent = '';

      var data = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name) data[el.name] = el.value.trim();
      });

      var required = [['name', 'your full name'], ['department', 'your department'],
        ['email', 'your email address'], ['motivation', 'why you would like to join']];
      for (var i = 0; i < required.length; i++) {
        if (!data[required[i][0]]) {
          msg.className = 'iu-msg bad';
          msg.textContent = 'Please fill in ' + required[i][1] + '.';
          var f = form.elements[required[i][0]];
          if (f) f.focus();
          return;
        }
      }
      if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(data.email)) {
        msg.className = 'iu-msg bad';
        msg.textContent = 'That email address does not look right.';
        form.elements.email.focus();
        return;
      }
      // A real person takes longer than three seconds to fill this in.
      if (Date.now() - opened < 3000) {
        msg.className = 'iu-msg bad';
        msg.textContent = 'Please take a moment to check your answers, then submit again.';
        opened = 0;
        return;
      }

      btn.disabled = true;
      msg.textContent = 'Sending your application…';
      fetch('/api/public/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || 'We could not send your application. Please try again.');
          return d;
        });
      }).then(function (d) {
        form.hidden = true;
        var done = document.getElementById('join-done');
        var dm = document.getElementById('join-done-msg');
        if (dm && d.message) dm.textContent = d.message + ' They will review it and contact you by email.';
        if (done) { done.hidden = false; done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }).catch(function (e) {
        btn.disabled = false;
        msg.className = 'iu-msg bad';
        msg.textContent = e.message;
      });
    });
  }

  /* ---------------- floating assistant ---------------- */
  var CHAT_CSS = '.iu-chat-btn{position:fixed;right:18px;bottom:18px;z-index:9998;width:56px;height:56px;border-radius:50%;' +
    'border:0;background:#960b27;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.28);display:flex;' +
    'align-items:center;justify-content:center;transition:.2s}.iu-chat-btn:hover{background:#730017;transform:translateY(-2px)}' +
    '.iu-chat-btn:focus-visible{outline:3px solid #fdc72f;outline-offset:3px}' +
    '.iu-chat{position:fixed;right:18px;bottom:84px;z-index:9999;width:340px;max-width:calc(100vw - 36px);height:460px;' +
    'max-height:calc(100vh - 120px);background:#fff;border:1px solid #e7e1d4;border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.22);' +
    'display:none;flex-direction:column;overflow:hidden;font:14px Inter,system-ui,sans-serif}.iu-chat.open{display:flex}' +
    '.iu-chat-head{background:#051435;color:#fff;padding:13px 15px;display:flex;align-items:center;gap:10px;flex:none}' +
    '.iu-chat-head img{width:28px;height:28px;object-fit:contain;border-radius:6px;background:#fff}' +
    '.iu-chat-head b{font-size:14px;display:block}.iu-chat-head small{font-size:11px;color:#b9c4d6}' +
    '.iu-chat-head button{margin-left:auto;background:transparent;border:0;color:#b9c4d6;font-size:18px;cursor:pointer;line-height:1}' +
    '.iu-chat-log{flex:1;overflow-y:auto;padding:14px;background:#f7f4ee;display:flex;flex-direction:column;gap:10px}' +
    '.iu-chat-log p{margin:0;padding:10px 12px;border-radius:12px;font-size:13.5px;line-height:1.65;max-width:88%;white-space:pre-wrap;word-break:break-word}' +
    '.iu-chat-log .bot{background:#fff;border:1px solid #e7e1d4;align-self:flex-start;color:#2b2b2b}' +
    '.iu-chat-log .me{background:#960b27;color:#fff;align-self:flex-end}' +
    '.iu-chat-sug{display:flex;flex-wrap:wrap;gap:6px}.iu-chat-sug button{background:#fff;border:1px solid #e7e1d4;border-radius:999px;' +
    'padding:6px 11px;font:600 11.5px Inter,sans-serif;color:#960b27;cursor:pointer}.iu-chat-sug button:hover{border-color:#960b27}' +
    '.iu-chat-form{display:flex;gap:7px;padding:10px;border-top:1px solid #e7e1d4;background:#fff;flex:none}' +
    '.iu-chat-form input{flex:1;border:1px solid #e7e1d4;border-radius:9px;padding:10px 11px;font:inherit;font-size:13.5px;min-width:0}' +
    '.iu-chat-form input:focus{outline:2px solid #960b27;outline-offset:1px}' +
    '.iu-chat-form button{border:0;background:#960b27;color:#fff;border-radius:9px;padding:0 14px;cursor:pointer;font-size:14px}' +
    '.iu-chat-form button[disabled]{opacity:.55;cursor:not-allowed}' +
    '.iu-chat .iu-vh{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '@media(max-width:520px){.iu-chat{right:10px;left:10px;width:auto;bottom:78px;height:calc(100vh - 150px)}.iu-chat-btn{right:12px;bottom:12px}}';

  var CHAT_SUGGESTIONS = ['How do I join IURS?', 'Who is on the executive committee?',
    'What has IURS published?', 'Any upcoming events?', 'What training does IURS run?'];

  function bindChat() {
    // Public site only — never on the dashboard, login or setup pages.
    if (/\/(admin|login|setup|dashboard)\.html$/.test(location.pathname)) return;
    if (document.querySelector('.iu-chat-btn')) return;

    var style = document.createElement('style');
    style.textContent = CHAT_CSS;
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.className = 'iu-chat-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ask about IURS');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<i class="fas fa-comment-dots"></i>';

    var panel = document.createElement('section');
    panel.className = 'iu-chat';
    panel.setAttribute('aria-label', 'IURS assistant');
    panel.innerHTML =
      '<div class="iu-chat-head"><img alt="" src="assets/logo-iurs.webp">' +
        '<div><b>Ask IURS</b><small>Answers from this website only</small></div>' +
        '<button aria-label="Close" type="button">&times;</button></div>' +
      '<div class="iu-chat-log" id="iu-chat-log" aria-live="polite"></div>' +
      '<form class="iu-chat-form"><label class="iu-vh" for="iu-chat-input">Your question</label>' +
        '<input autocomplete="off" id="iu-chat-input" maxlength="500" placeholder="Ask about IURS…">' +
        '<button aria-label="Send" type="submit"><i class="fas fa-paper-plane"></i></button></form>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    var log = panel.querySelector('#iu-chat-log');
    var form = panel.querySelector('form');
    var input = panel.querySelector('input');
    var send = form.querySelector('button');

    function say(text, who) {
      var p = document.createElement('p');
      p.className = who;
      p.textContent = text;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return p;
    }

    function suggestions() {
      var wrap = document.createElement('div');
      wrap.className = 'iu-chat-sug';
      CHAT_SUGGESTIONS.forEach(function (q) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = q;
        b.onclick = function () { wrap.remove(); ask(q); };
        wrap.appendChild(b);
      });
      log.appendChild(wrap);
    }

    var busy = false;
    function ask(q) {
      if (busy || !q) return;
      busy = true;
      send.disabled = true;
      say(q, 'me');
      input.value = '';
      var thinking = say('…', 'bot');
      fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: q })
      }).then(function (r) {
        return r.json().catch(function () { return {}; });
      }).then(function (d) {
        thinking.textContent = d.reply || d.error ||
          'I could not reach the IURS records just now. Please email iuresearchsociety@gmail.com.';
      }).catch(function () {
        thinking.textContent = 'I could not reach the IURS records just now. Please email iuresearchsociety@gmail.com.';
      }).then(function () {
        busy = false;
        send.disabled = false;
        log.scrollTop = log.scrollHeight;
      });
    }

    var greeted = false;
    function toggle(open) {
      panel.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML = open ? '<i class="fas fa-xmark"></i>' : '<i class="fas fa-comment-dots"></i>';
      if (open && !greeted) {
        greeted = true;
        say('Assalamu alaikum. I can answer questions about IURS using the information on this ' +
            'website — publications, events, training, notices, the executive committee, alumni and ' +
            'how to join. If something is not on the site I will say so rather than guess.', 'bot');
        suggestions();
      }
      if (open) setTimeout(function () { input.focus(); }, 120);
    }

    btn.onclick = function () { toggle(!panel.classList.contains('open')); };
    panel.querySelector('.iu-chat-head button').onclick = function () { toggle(false); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) { toggle(false); btn.focus(); }
    });
    form.onsubmit = function (e) { e.preventDefault(); ask(input.value.trim()); };
  }

  function start() {
    bindGallery(); bindTraining(); bindCommittee(); bindAlumni();
    bindBlog(); bindPublications(); bindJoin(); bindChat();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
