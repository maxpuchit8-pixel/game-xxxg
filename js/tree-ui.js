/**
 * =============================================================================
 * tree-ui.js — ตัววาดผังตระกูล
 * =============================================================================
 * รับพิกัดจาก TreeLayout แล้ววางการ์ดแบบ absolute ตามนั้น พร้อมวาดเส้นเชื่อม
 * จากตัวเลขชุดเดียวกัน
 *
 * จุดสำคัญ: ที่นี่ "ไม่วัดอะไรจาก DOM เลย" ทุกพิกัดมาจากการคำนวณล้วน
 * การ์ดกับเส้นจึงตรงกันเสมอ ไม่ว่าจอกว้างแค่ไหน ย่อเท่าไร หรือฟอนต์โหลดตอนไหน
 * (เวอร์ชันก่อนใช้ flexbox แล้ววัดด้วย getBoundingClientRect ซึ่งพังบนจอแคบ
 *  เพราะ flex item ยุบตัวจนการ์ดเหลือ 74px จาก 134px แล้วเส้นลงผิดที่ทั้งหมด)
 * =============================================================================
 */
(function (root) {
  'use strict';

  const P = root.Person;
  const { CONFIG } = root.GameData;
  const TL = root.TreeLayout;

  function createTreeUI(lineage, opts = {}) {
    const host = document.getElementById('tree');
    const onSelect = opts.onSelect || function () {};
    const shouldIgnoreClick = opts.shouldIgnoreClick || function () { return false; };

    let lastSize = { width: 0, height: 0 };

    // ใช้ event delegation ครั้งเดียว การ์ดถูกวาดใหม่บ่อยมากจึงไม่ผูกทีละใบ
    host.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card || shouldIgnoreClick()) return;
      const p = lineage.get(card.dataset.id);
      if (p) onSelect(p);
    });

    /** ฟอร์แมตรายได้ให้อ่านง่าย เช่น +7.0 / -5.8 */
    function incomeLabel(v) {
      const n = Math.round(v * 10) / 10;
      return (n >= 0 ? '+' : '') + n.toFixed(1) + ' เครดิต/เดือน';
    }

    /** ข้อความค่าร่างกายและเสน่ห์ — เปิดเผยเมื่อโตเต็มวัยแล้วเท่านั้น */
    function bodyText(p) {
      if (p.age < CONFIG.adultAge) return 'ยังอยู่ในวัยเยาว์';
      const measure = P.measureLabel(p);
      return `${p.body.height} ซม. · ${p.body.weight} กก. · ${P.buildLabel(p.body)}` +
        (measure ? `<br>สัดส่วน ${measure}` : '') +
        `<br><span class="card-charm">เสน่ห์ ${p.charm} · ${P.charmTier(p.charm, p.gender)}</span>`;
    }

    /** การ์ดตัวละครหนึ่งใบ วางตามพิกัดที่คำนวณมา */
    function cardHTML(p, x, y) {
      const cls = [
        'card',
        p.gender === 'male' ? 'male' : 'female',
        p.alive ? '' : 'dead',
        p.isFounder ? 'founder' : '',
        p.isBlood ? '' : 'married-in',
      ].filter(Boolean).join(' ');

      const ageText = p.alive ? p.age : '†';
      const originText = !p.isBlood && p.origin ? `<div class="card-origin">${p.origin}</div>` : '';
      const incomeCls = p.income >= 0 ? 'pos' : 'neg';

      return `<div class="${cls}" data-id="${p.id}" role="button" tabindex="0"
        title="กดเพื่อดูข้อมูล${p.name}" style="left:${x}px;top:${y}px">
        <span class="age-badge">${ageText}</span>
        ${p.isFounder ? '<span class="you-badge">ผู้เริ่มต้น</span>' : ''}
        <div class="card-name">${p.name}</div>
        <div class="portrait">${P.avatarSVG(p)}</div>
        ${p.alive ? `<div class="card-power">พลังยุทธ์ <b>${p.power}</b></div>` : ''}
        <div class="card-body">${bodyText(p)}</div>
        ${originText}
        ${p.alive
          ? `<div class="card-income ${incomeCls}">${incomeLabel(p.income)}</div>`
          : `<div class="card-income dead-note">ถึงแก่กรรม อายุ ${p.deathAge}</div>`}
      </div>`;
    }

    function render() {
      const tree = lineage.buildTree();
      if (!tree.length) {
        host.innerHTML = '<p class="empty-note">ยังไม่มีใครในผังตระกูล</p>';
        return;
      }

      const L = TL.layout(tree);
      lastSize = { width: L.width, height: L.height };

      const path = L.links
        .map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`)
        .join(' ');

      // เส้นความสัมพันธ์ลับ — เส้นปะลากตรง อาจเฉียงข้ามรุ่นได้
      // อยู่ใน svg เดียวกันซึ่ง z-index ต่ำกว่าการ์ด เส้นจึงลอดใต้การ์ดเสมอ
      const secretPath = TL.secretLinks(lineage.activeSecrets(), L.posOf)
        .map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`)
        .join(' ');

      const knots = L.knots.map((k) =>
        `<span class="knot" style="left:${k.x}px;top:${k.y - 1}px"></span>`).join('');

      const cards = L.nodes.map((n) => cardHTML(n.person, n.x, n.y)).join('');

      host.style.width = L.width + 'px';
      host.style.height = L.height + 'px';
      host.innerHTML =
        `<svg class="tree-links" xmlns="http://www.w3.org/2000/svg" ` +
        `width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}">` +
        `<path class="link-line" vector-effect="non-scaling-stroke" d="${path}"></path>` +
        (secretPath
          ? `<path class="link-secret" vector-effect="non-scaling-stroke" d="${secretPath}"></path>`
          : '') +
        `</svg>` + knots + cards;
    }

    /** อัปเดตเฉพาะตัวเลขบนการ์ด โดยไม่วาดผังใหม่ทั้งหมด
     *  ตำแหน่งการ์ดไม่ขึ้นกับเนื้อหาแล้ว จึงไม่ต้องวาดเส้นใหม่ตามอีก */
    function refreshFigures() {
      lineage.all().forEach((p) => {
        const el = host.querySelector(`.card[data-id="${p.id}"]`);
        if (!el) return;

        const badge = el.querySelector('.age-badge');
        if (badge) badge.textContent = p.alive ? p.age : '†';

        const inc = el.querySelector('.card-income');
        if (inc && p.alive) {
          inc.textContent = incomeLabel(p.income);
          inc.className = 'card-income ' + (p.income >= 0 ? 'pos' : 'neg');
        }

        const pw = el.querySelector('.card-power b');
        if (pw && p.alive) pw.textContent = p.power;

        el.classList.toggle('dead', !p.alive);

        // ข้ามเกณฑ์วัย: ผมขาวและเปิดเผยค่าร่างกาย
        if (p.age === CONFIG.elderAge) {
          const port = el.querySelector('.portrait');
          if (port) port.innerHTML = P.avatarSVG(p);
        }
        if (p.age === CONFIG.adultAge) {
          const b = el.querySelector('.card-body');
          if (b) b.innerHTML = bodyText(p);
        }
      });
    }

    /** เน้นการ์ดของคนที่กำลังดูอยู่ */
    function highlight(id) {
      host.querySelectorAll('.card.focus').forEach((el) => el.classList.remove('focus'));
      const el = host.querySelector(`.card[data-id="${id}"]`);
      if (el) el.classList.add('focus');
      return el;
    }

    /** ขนาดจริงของผัง (ไม่นับการย่อ) — viewport ใช้คำนวณอัตราพอดีจอ */
    function size() { return lastSize; }

    return { render, refreshFigures, highlight, size, drawLinks: function () {} };
  }

  root.TreeUI = { create: createTreeUI };
})(typeof self !== 'undefined' ? self : this);
