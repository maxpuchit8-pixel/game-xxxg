/**
 * =============================================================================
 * tree-ui.js — ตัววาดผังตระกูล
 * =============================================================================
 * แปลงโครงต้นไม้จาก lineage.buildTree() เป็น HTML แบบ พ่อ—แม่ ลงมาเป็นลูก
 *
 * โครง HTML ที่ใช้ (เส้นเชื่อมวาดด้วย CSS ::before/::after ทั้งหมด ไม่ใช้ canvas)
 *   ul.tree > li.unit > div.couple ( .card + .knot + .card )
 *                     > ul.children > li.unit > ...
 *
 * สีกรอบการ์ด: ชาย = คราม (น้ำเงิน) / หญิง = ชาด (แดง) ตามที่กำหนดใน CSS
 * =============================================================================
 */
(function (root) {
  'use strict';

  const P = root.Person;
  const { CONFIG } = root.GameData;

  /**
   * คำนวณเส้นเชื่อมจากคู่พ่อแม่หนึ่งชุดลงไปหาลูกทุกคน — ฟังก์ชันบริสุทธิ์
   * แยกออกมาจากส่วนที่วัด DOM เพื่อให้ทดสอบเรขาคณิตได้โดยไม่ต้องมีเบราว์เซอร์
   *
   * parent : { x, bottom }        จุดกึ่งกลางขอบล่างของกล่องคู่พ่อแม่
   * kids   : [{ x, top }, ...]    จุดกึ่งกลางขอบบนของกล่องลูกแต่ละคน
   * คืน    : [{ x1, y1, x2, y2 }] ชุดเส้นตรงที่ต่อกันสนิท
   *
   * รูปแบบเส้น: ตั้งลงจากพ่อแม่ถึงระดับกลาง -> นอนพาดเป็นเส้นเดียว
   * -> ตั้งลงหาลูกแต่ละคน
   *
   * เส้นนอนต้องคลุม "ตำแหน่งพ่อแม่ด้วย" ไม่ใช่แค่ช่วงของลูก
   * เพราะลูกคนเดียวที่แต่งงานแล้วจะมีกล่องคู่กว้างขึ้นจนจุดกึ่งกลางเยื้อง
   * ออกไปจากพ่อแม่ ถ้าคลุมแค่ช่วงลูก เส้นตั้งสองท่อนจะอยู่คนละแกนและลอยห่างกัน
   */
  function linkSegments(parent, kids) {
    if (!kids || !kids.length) return [];
    const topOfKids = Math.min.apply(null, kids.map((k) => k.top));
    const midY = (parent.bottom + topOfKids) / 2;
    const segs = [{ x1: parent.x, y1: parent.bottom, x2: parent.x, y2: midY }];

    const xs = kids.map((k) => k.x).concat([parent.x]);
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    // ทุกอย่างอยู่แกนเดียวกันแล้ว (ลูกคนเดียวตรงกลางพอดี) ไม่ต้องมีเส้นนอน
    if (maxX - minX > 0.5) {
      segs.push({ x1: minX, y1: midY, x2: maxX, y2: midY });
    }
    kids.forEach((k) => segs.push({ x1: k.x, y1: midY, x2: k.x, y2: k.top }));
    return segs;
  }

  function createTreeUI(lineage, opts = {}) {
    const host = document.getElementById('tree');
    const onSelect = opts.onSelect || function () {};
    const shouldIgnoreClick = opts.shouldIgnoreClick || function () { return false; };

    /* วาดเส้นใหม่ทุกครั้งที่ขนาดของผังเปลี่ยน ไม่ว่าจะด้วยสาเหตุใด
     * ครอบคลุมกรณีที่คาดเดายาก เช่น ฟอนต์ไทยโหลดเสร็จช้ากว่าที่วาดเส้นรอบแรก
     * แล้วความสูงการ์ดขยับ ซึ่งจะทำให้เส้นที่วัดไว้ค้างอยู่ตำแหน่งเดิม
     * ResizeObserver ดูขนาดที่ยังไม่ถูก transform จึงไม่ยิงตอนซูม */
    if (typeof ResizeObserver === 'function') {
      let pending = false;
      new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; drawLinks(); });
      }).observe(host);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => drawLinks());
    }

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
      return (n >= 0 ? '+' : '') + n.toFixed(1) + ' ตำลึง/เดือน';
    }

    /** การ์ดตัวละครหนึ่งใบ */
    function cardHTML(p) {
      if (!p) return '';
      const cls = [
        'card',
        p.gender === 'male' ? 'male' : 'female',
        p.alive ? '' : 'dead',
        p.isFounder ? 'founder' : '',
        p.isBlood ? '' : 'married-in',
      ].filter(Boolean).join(' ');

      const ageText = p.alive ? p.age : '†';
      // ค่าร่างกายเปิดเผยเมื่อโตเต็มวัยแล้วเท่านั้น ก่อนหน้านั้นยังไม่นิ่ง
      const bodyText = p.age >= CONFIG.adultAge
        ? `${p.body.height} ซม. · ${p.body.weight} กก.<br>${P.buildLabel(p.body)}`
        : 'ยังอยู่ในวัยเยาว์';
      const originText = !p.isBlood && p.origin ? `<div class="card-origin">${p.origin}</div>` : '';
      const incomeCls = p.income >= 0 ? 'pos' : 'neg';

      return `<div class="${cls}" data-id="${p.id}" title="กดเพื่อดูข้อมูล${p.name}" role="button" tabindex="0">
        <span class="age-badge">${ageText}</span>
        ${p.isFounder ? '<span class="you-badge">ผู้เริ่มต้น</span>' : ''}
        <div class="card-name">${p.name}</div>
        <div class="portrait">${P.avatarSVG(p)}</div>
        ${p.alive ? `<div class="card-power">พลังยุทธ์ <b>${p.power}</b></div>` : ''}
        <div class="card-body">${bodyText}</div>
        ${originText}
        ${p.alive
          ? `<div class="card-income ${incomeCls}">${incomeLabel(p.income)}</div>`
          : `<div class="card-income dead-note">ถึงแก่กรรม อายุ ${p.deathAge}</div>`}
      </div>`;
    }

    /** หน่วยครอบครัวหนึ่งชุด (คู่สมรส + ลูกที่แตกลงไป) */
    function unitHTML(unit) {
      const couple = unit.spouse
        ? `<div class="couple paired">${cardHTML(unit.person)}<span class="knot"></span>${cardHTML(unit.spouse)}</div>`
        : `<div class="couple">${cardHTML(unit.person)}</div>`;

      const kids = unit.children.length
        ? `<ul class="children">${unit.children.map((c) => unitHTML(c)).join('')}</ul>`
        : '';

      return `<li class="unit">${couple}${kids}</li>`;
    }

    /* ---------------------------------------------------------------------
     * เส้นเชื่อม — วาดด้วย SVG จากตำแหน่งการ์ดจริง
     *
     * วาดหลังเรนเดอร์เสร็จ โดยวัดด้วย getBoundingClientRect แล้วหารด้วยอัตราซูม
     * เพื่อให้ได้พิกัดในระบบพิกัดของผังเอง (ก่อนถูก transform) เส้นจึงย่อ/ขยาย
     * ไปพร้อมการ์ดโดยไม่ต้องวาดใหม่ตอนซูม
     *
     * เส้นนอนของพี่น้องเป็น path เดียวยาวตลอด ไม่ได้ประกอบจากชิ้นย่อย
     * จึงไม่มีรอยต่อให้ขาดเมื่อผังถูกย่อเป็นทศนิยม
     * ------------------------------------------------------------------- */

    /** หาลูกโดยตรงที่มีคลาสตามชื่อ (เลี่ยง :scope เพื่อความเข้ากันได้) */
    function childByClass(el, cls) {
      for (const c of el.children) if (c.classList.contains(cls)) return c;
      return null;
    }

    function drawLinks() {
      const svg = host.querySelector('.tree-links');
      const treeEl = host.querySelector('.tree');
      if (!svg || !treeEl || !host.offsetWidth) return;

      const hostRect = host.getBoundingClientRect();
      // อัตราซูมปัจจุบัน ใช้ถอด transform ออกจากค่าที่วัดได้
      const scale = hostRect.width / host.offsetWidth || 1;
      const localX = (clientX) => (clientX - hostRect.left) / scale;
      const localY = (clientY) => (clientY - hostRect.top) / scale;

      /** จุดกึ่งกลางบน/ล่างของกล่องคู่สมรสหนึ่งชุด */
      function anchors(coupleEl) {
        const r = coupleEl.getBoundingClientRect();
        return {
          x: localX(r.left + r.width / 2),
          top: localY(r.top),
          bottom: localY(r.bottom),
        };
      }

      const segments = [];
      host.querySelectorAll('li.unit').forEach((unit) => {
        const kidsUl = childByClass(unit, 'children');
        const coupleEl = childByClass(unit, 'couple');
        if (!kidsUl || !coupleEl) return;

        const kidCouples = [];
        for (const kid of kidsUl.children) {
          const c = childByClass(kid, 'couple');
          if (c) kidCouples.push(anchors(c));
        }
        if (!kidCouples.length) return;

        linkSegments(anchors(coupleEl), kidCouples).forEach((s) => {
          segments.push(`M${s.x1} ${s.y1}L${s.x2} ${s.y2}`);
        });
      });

      const w = host.offsetWidth, h = host.offsetHeight;
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      // ใส่ vector-effect เป็น attribute ด้วย ไม่ใช่แค่ใน CSS
      // เพราะเบราว์เซอร์รุ่นเก่าบางตัวรองรับเฉพาะรูปแบบ attribute
      svg.innerHTML =
        `<path vector-effect="non-scaling-stroke" d="${segments.join(' ')}"></path>`;
    }

    function render() {
      const tree = lineage.buildTree();
      if (!tree.length) {
        host.innerHTML = '<p class="empty-note">ยังไม่มีใครในผังตระกูล</p>';
        return;
      }
      host.innerHTML =
        '<svg class="tree-links" xmlns="http://www.w3.org/2000/svg"></svg>' +
        `<ul class="tree">${tree.map(unitHTML).join('')}</ul>`;
      // รอให้เบราว์เซอร์จัด layout เสร็จก่อนวัดตำแหน่งการ์ด
      requestAnimationFrame(drawLinks);
    }

    /**
     * อัปเดตเฉพาะตัวเลขบนการ์ด (อายุ/รายได้) โดยไม่วาดผังใหม่ทั้งหมด
     * ถ้ามีใครโตครบวัยพอดี ข้อความบนการ์ดจะเปลี่ยนจากบรรทัดเดียวเป็นสองบรรทัด
     * ความสูงการ์ดเปลี่ยน เส้นเชื่อมจึงต้องวาดใหม่ ไม่งั้นจะค้างอยู่ตำแหน่งเดิม
     */
    function refreshFigures() {
      let layoutChanged = false;
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
        el.classList.toggle('dead', !p.alive);
        // ผมขาวเมื่อเข้าวัยชรา — วาดรูปใหม่เฉพาะตอนข้ามเกณฑ์
        if (p.age === CONFIG.elderAge) {
          const port = el.querySelector('.portrait');
          if (port) port.innerHTML = P.avatarSVG(p);
        }
        const pw = el.querySelector('.card-power b');
        if (pw && p.alive) pw.textContent = p.power;
        // เปิดเผยค่าร่างกายในเดือนที่โตเต็มวัยพอดี
        if (p.age === CONFIG.adultAge) {
          const bodyEl = el.querySelector('.card-body');
          if (bodyEl) {
            bodyEl.innerHTML = `${p.body.height} ซม. · ${p.body.weight} กก.<br>${P.buildLabel(p.body)}`;
            layoutChanged = true;
          }
        }
      });
      if (layoutChanged) requestAnimationFrame(drawLinks);
    }

    /**
     * เน้นการ์ดของคนที่กำลังดูอยู่
     * ไม่ใช้ scrollIntoView เพราะผังถูกเลื่อนด้วย CSS transform ไม่ใช่ scroll
     * การเรียก scrollIntoView จะไปดันทั้งหน้าเว็บแทนที่จะเลื่อนผัง
     */
    function highlight(id) {
      host.querySelectorAll('.card.focus').forEach((el) => el.classList.remove('focus'));
      const el = host.querySelector(`.card[data-id="${id}"]`);
      if (el) el.classList.add('focus');
      return el;
    }

    return { render, refreshFigures, highlight, drawLinks };
  }

  root.TreeUI = { create: createTreeUI, linkSegments };
})(typeof self !== 'undefined' ? self : this);
