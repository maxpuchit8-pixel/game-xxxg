/**
 * =============================================================================
 * profile-ui.js — หน้าโปรไฟล์เต็มจอของตัวละครหนึ่งคน
 * =============================================================================
 * เกมเก็บข้อมูลของแต่ละคนไว้เยอะมาก (สัดส่วนที่เปลี่ยนไปตามวัย หลอดความต้องการ
 * คุณลักษณะที่ได้มาระหว่างทาง ความทรงจำ ความสัมพันธ์ลับ) แต่แผ่นข้อมูลเดิม
 * แสดงได้แค่ค่าปัจจุบัน หน้านี้จึงเปิดดู "ทั้งชีวิต" ของคนคนหนึ่งได้
 *
 * กราฟวาดเป็น SVG จากตัวเลขล้วน ไม่พึ่งไลบรารีใดๆ
 * เปิดจากปุ่มในแผ่นข้อมูล และกดกลับมาหน้าผังได้ตลอด
 * =============================================================================
 */
(function (root) {
  'use strict';

  const { CONFIG, DESIRE } = root.GameData;
  const P = root.Person;

  /** เส้นกราฟหนึ่งชุดจากตัวเลข คืนสตริง path ของ SVG */
  function linePath(values, x0, y0, w, h, lo, hi) {
    if (!values.length) return '';
    const span = Math.max(1, hi - lo);
    const step = values.length > 1 ? w / (values.length - 1) : 0;
    return values.map((v, i) => {
      const x = x0 + i * step;
      const y = y0 + h - ((Math.max(lo, Math.min(hi, v)) - lo) / span) * h;
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  /**
   * กราฟหนึ่งใบ
   * series: [{ key, label, color }] อ่านค่าจาก history แต่ละแถว
   */
  function chart(history, series, lo, hi, unit) {
    const W = 460, H = 130, PAD = 26;
    const w = W - PAD * 2, h = H - PAD - 14;
    if (history.length < 2) {
      return '<p class="detail-note">ยังไม่มีประวัติมากพอจะวาดกราฟ (ต้องผ่านไปอย่างน้อยสองปี)</p>';
    }
    const ages = history.map((r) => r.age);
    const lines = series.map((s) => {
      const vals = history.map((r) => (r[s.key] == null ? lo : r[s.key]));
      return `<path d="${linePath(vals, PAD, 8, w, h, lo, hi)}" fill="none" ` +
        `stroke="${s.color}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const legend = series.map((s) =>
      `<span class="chart-key"><i style="background:${s.color}"></i>${s.label}</span>`).join('');
    return `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟประวัติ">
        <line x1="${PAD}" y1="${8 + h}" x2="${W - PAD}" y2="${8 + h}" class="chart-axis"/>
        <line x1="${PAD}" y1="8" x2="${PAD}" y2="${8 + h}" class="chart-axis"/>
        <text x="4" y="14" class="chart-tick">${hi}${unit || ''}</text>
        <text x="4" y="${12 + h}" class="chart-tick">${lo}${unit || ''}</text>
        <text x="${PAD}" y="${H - 2}" class="chart-tick">${ages[0]} ปี</text>
        <text x="${W - PAD - 24}" y="${H - 2}" class="chart-tick">${ages[ages.length - 1]} ปี</text>
        ${lines}
      </svg>
      <div class="chart-legend">${legend}</div>`;
  }

  function createProfileUI(ctx) {
    const lineage = ctx.lineage;
    const relations = ctx.relations;
    const T = root.Traits;
    const fmt = ctx.fmtMonth || ((m) => 'เดือนที่ ' + m);
    let host = document.getElementById('profile');
    if (!host) {
      host = document.createElement('div');
      host.id = 'profile';
      host.className = 'profile-overlay';
      document.body.appendChild(host);
    }

    function nameChip(p) {
      if (!p) return '<span class="kin-none">—</span>';
      return `<button class="kin" data-goto="${p.id}">` +
        `<i class="kin-dot ${p.gender}"></i>${p.name}` +
        `<span class="kin-age">${p.alive ? p.age + ' ปี' : 'ล่วงลับ'}</span></button>`;
    }

    function show(p) {
      const hist = p.history || [];
      const traits = T ? T.listOf(p) : [];
      const kids = p.childIds.map(lineage.get).filter(Boolean);
      const lovers = lineage.secretsOf(p.id);
      const hiddenKids = lineage.all().filter((k) => k.trueFatherId === p.id);
      const mem = (p.memories || []).slice().reverse();

      // ใครระแวงเขา และเขาระแวงใคร — ความจริงที่ผู้เล่นเห็นอยู่ฝ่ายเดียว
      const watchers = lineage.living()
        .map((x) => ({ x, lv: relations ? relations.suspicionOf(x.id, p.id) : 0 }))
        .filter((r) => r.lv >= 15).sort((a, b) => b.lv - a.lv);

      const bonds = lineage.living()
        .filter((x) => x.id !== p.id)
        .map((x) => ({
          x,
          close: relations ? relations.value(p.id, x.id, 'closeness') : 0,
          passion: relations ? relations.value(p.id, x.id, 'passion') : 0,
          grudge: relations ? relations.value(p.id, x.id, 'grudge') : 0,
        }))
        .filter((b) => b.close + b.passion + b.grudge >= 12)
        .sort((a, b) => (b.close + b.passion + b.grudge) - (a.close + a.passion + a.grudge))
        .slice(0, 8);

      const m = p.body.measure || {};
      host.innerHTML = `
        <div class="profile-page ${p.gender}">
          <button class="profile-close" aria-label="กลับไปหน้าผัง">✕ กลับสู่ผังตระกูล</button>

          <header class="profile-head">
            <div class="profile-portrait ${p.gender}">${P.avatarSVG(p)}</div>
            <div>
              <h2 class="profile-name display">${p.name}</h2>
              <div class="detail-tags">
                <span class="chip ${p.gender}">${p.gender === 'male' ? 'บุรุษ' : 'สตรี'}</span>
                <span class="chip">${p.alive ? 'อายุ ' + p.age + ' ปี' : 'ถึงแก่กรรม อายุ ' + p.deathAge}</span>
                <span class="chip">${p.isBlood ? 'สายเลือดตระกูล' : 'แต่งเข้าตระกูล'}</span>
                ${p.secretChild ? '<span class="chip secret">บุตรลับ</span>' : ''}
                ${p.pregnancy ? `<span class="chip pregnant">ตั้งครรภ์ ${p.pregnancy.month}/${CONFIG.pregnancyTerm} เดือน</span>` : ''}
              </div>
              ${p.origin ? `<div class="detail-origin">${p.origin}</div>` : ''}
            </div>
          </header>

          <div class="profile-grid">
            <section>
              <h4>ตัวเลขวันนี้</h4>
              <div class="detail-row"><span>เสน่ห์</span><b>${p.charm} · ${P.charmTier(p.charm, p.gender)}</b></div>
              <div class="detail-row"><span>พลังยุทธ์</span><b>${p.alive ? p.power : '—'}</b></div>
              <div class="detail-row"><span>สัดส่วน</span><b>${P.measureLabel(p) || '—'} นิ้ว</b></div>
              <div class="detail-row"><span>ส่วนสูง / น้ำหนัก</span><b>${p.body.height} ซม. · ${p.body.weight} กก.</b></div>
              <div class="detail-row"><span>ไฟประจำตัว</span><b>×${(p.libido || 1).toFixed(2)}</b></div>
              <div class="detail-row"><span>ความต้องการ</span><b>${Math.round(p.desire || 0)} · ${P.desireTier(Math.round(p.desire || 0))}</b></div>
            </section>

            <section>
              <h4>คุณลักษณะติดตัว (${traits.length})</h4>
              ${traits.length
                ? `<div class="trait-list">${traits.map((t) =>
                    `<span class="trait-chip" title="${t.desc}">${t.label}</span>`).join('')}</div>` +
                  traits.map((t) => `<p class="detail-note trait-desc"><b>${t.label}</b> — ${t.desc}</p>`).join('')
                : '<p class="detail-note">ยังไม่มีคุณลักษณะใด — ชีวิตยังไม่ได้ขัดเกลาผู้นี้พอ</p>'}
            </section>
          </div>

          <section class="profile-chart">
            <h4>สัดส่วนตลอดชีวิต (ซม.)</h4>
            ${chart(hist, [
              { key: 'chest', label: 'อก', color: 'var(--female)' },
              { key: 'waist', label: 'เอว', color: 'var(--gold)' },
              { key: 'hips', label: 'สะโพก', color: 'var(--jade)' },
            ], 50, 130, '')}
            ${m.cupFull != null
              ? `<p class="detail-note">คัพปัจจุบัน ${P.cupLetter(m)} · ศักยภาพเต็มที่ ${
                  root.GameData.MEASURE.cup.letters[m.cupFull]}</p>` : ''}
          </section>

          <section class="profile-chart">
            <h4>เสน่ห์ พลังยุทธ์ และความต้องการ ตลอดชีวิต</h4>
            ${chart(hist, [
              { key: 'charm', label: 'เสน่ห์', color: 'var(--female)' },
              { key: 'desire', label: 'ความต้องการ', color: 'var(--gold)' },
              { key: 'power', label: 'พลังยุทธ์', color: 'var(--male)' },
            ], 0, 150, '')}
          </section>

          <div class="profile-grid">
            <section>
              <h4>ผู้คนรอบตัว</h4>
              <div class="detail-row"><span>คู่ครอง</span><div class="kin-list">${
                p.spouseId ? nameChip(lineage.get(p.spouseId)) : '<span class="kin-none">ไม่มี</span>'}</div></div>
              <div class="detail-row kids"><span>บุตร (${kids.length})</span>
                <div class="kin-list">${kids.length ? kids.map(nameChip).join('') : '<span class="kin-none">ยังไม่มี</span>'}</div></div>
              ${lovers.length ? `<div class="detail-row kids"><span>แอบคบกับ (${lovers.length})</span>
                <div class="kin-list">${lovers.map(nameChip).join('')}</div></div>` : ''}
              ${hiddenKids.length ? `<div class="detail-row kids"><span>บุตรลับที่ไม่รู้ตัวว่ามี</span>
                <div class="kin-list">${hiddenKids.map(nameChip).join('')}</div></div>` : ''}
              ${watchers.length ? `<div class="detail-row kids"><span>คนที่กำลังระแวงผู้นี้</span>
                <div class="kin-list">${watchers.map((r) =>
                  `<span class="watch-chip">${r.x.name} ${Math.round(r.lv)}%</span>`).join('')}</div></div>` : ''}
            </section>

            <section>
              <h4>สายสัมพันธ์ที่เข้มข้นที่สุด</h4>
              ${bonds.length ? bonds.map((b) => `
                <div class="bond-row">
                  <span class="bond-name">${b.x.name}</span>
                  <span class="bond-bars">
                    <i class="bond close" style="width:${b.close}%" title="ความสนิท ${Math.round(b.close)}"></i>
                    <i class="bond passion" style="width:${b.passion}%" title="ความปรารถนา ${Math.round(b.passion)}"></i>
                    <i class="bond grudge" style="width:${b.grudge}%" title="ความแค้น ${Math.round(b.grudge)}"></i>
                  </span>
                </div>`).join('') +
                '<p class="detail-note">แถบเรียงจากบน: ความสนิท · ความปรารถนา · ความแค้น</p>'
                : '<p class="detail-note">ยังไม่มีสายสัมพันธ์ใดเข้มข้นพอจะบันทึก</p>'}
            </section>
          </div>

          <section class="profile-memories">
            <h4>ความทรงจำ (${mem.length})</h4>
            ${mem.length
              ? mem.map((x) => `<div class="memory-row ${x.weight >= 3 ? 'heavy' : ''}">
                   <span class="memory-when">${fmt(x.month)}</span>
                   <span class="memory-text">${x.text}</span>
                 </div>`).join('')
              : '<p class="detail-note">ยังไม่มีเรื่องใดหนักพอให้จดจำ</p>'}
          </section>
        </div>`;

      host.classList.add('show');
      host.scrollTop = 0;
      host.querySelector('.profile-close').addEventListener('click', hide);
      host.querySelectorAll('.kin[data-goto]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const other = lineage.get(btn.dataset.goto);
          if (other) show(other);
        });
      });
    }

    function hide() {
      host.classList.remove('show');
      host.innerHTML = '';
    }

    function isOpen() { return host.classList.contains('show'); }

    return { show, hide, isOpen };
  }

  root.ProfileUI = { create: createProfileUI };
})(typeof self !== 'undefined' ? self : this);
