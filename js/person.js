/**
 * =============================================================================
 * person.js — แบบจำลองตัวละคร และการสุ่มสร้างตัวละครใหม่
 * =============================================================================
 * รับผิดชอบ:
 *   - โครงสร้างข้อมูลของคนหนึ่งคน (เพศ อายุ ส่วนสูง รูปร่าง รายได้ เครือญาติ)
 *   - การสุ่มค่ารูปร่างจาก "ค่าเฉลี่ย" ที่กำหนดไว้ใน data.js (BODY)
 *   - การถ่ายทอดรูปร่างจากพ่อแม่สู่ลูก (heredity + ความแปรผัน)
 *   - การวาดรูปหน้าประจำตัวเป็น SVG ที่สร้างจากรหัสตัวละคร (ไม่ต้องโหลดไฟล์ภาพ)
 *
 * ไม่ยุ่งกับ DOM และไม่รู้จักผังตระกูล — เป็นแค่ "โรงงานผลิตคน"
 * =============================================================================
 */
(function (root) {
  'use strict';

  const { BODY, NAMES, CONFIG, POWER } = root.GameData;

  let _seq = 0;
  function nextId() { return 'p' + (++_seq); }

  /* ---------------------------------------------------------------------
   * ตัวช่วยสุ่ม
   * ------------------------------------------------------------------- */

  /** สุ่มแบบแจกแจงปกติ (Box–Muller) แล้วบีบให้อยู่ในช่วง min–max */
  function randNormal(mean, sd, min, max) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return clamp(mean + n * sd, min, max);
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** แปลงข้อความเป็นตัวเลขคงที่ ใช้สุ่มหน้าตาให้คนคนเดิมได้หน้าเดิมทุกครั้ง */
  function hashOf(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* ---------------------------------------------------------------------
   * รูปร่าง
   * ------------------------------------------------------------------- */

  /** หาข้อมูลประเภทหุ่นจากรหัส */
  function buildById(id) {
    return BODY.builds.find((b) => b.id === id) || BODY.builds[1];
  }

  /** คำบรรยายประเภทหุ่น เช่น "แข็งแรงล่ำสัน" */
  function buildLabel(body) {
    return buildById(body.buildId).label;
  }

  /** สุ่มประเภทหุ่นตามสัดส่วนที่กำหนดใน BODY.builds */
  function pickBuild() {
    const r = Math.random();
    let acc = 0;
    for (const b of BODY.builds) {
      acc += b.chance;
      if (r <= acc) return b;
    }
    return BODY.builds[BODY.builds.length - 1];
  }

  /** ประกอบค่าร่างกายให้ครบ — น้ำหนักคำนวณจาก BMI กับส่วนสูงเสมอ */
  function finishBody(height, buildId, bmi) {
    const m = height / 100;
    return {
      height,
      buildId,
      bmi: Math.round(bmi * 10) / 10,
      weight: Math.round(bmi * m * m * 10) / 10,
    };
  }

  /** สุ่มร่างกายของคนใหม่ที่ไม่มีพ่อแม่ในเกม (คนนอกที่แต่งเข้ามา) */
  function rollBody(gender) {
    const spec = BODY[gender];
    const height = Math.round(
      randNormal(spec.height.mean, spec.height.sd, spec.height.min, spec.height.max));
    const build = pickBuild();
    const bmi = randNormal(build.bmi.mean, build.bmi.sd, BODY.bmiRange.min, BODY.bmiRange.max);
    return finishBody(height, build.id, bmi);
  }

  /**
   * สุ่มร่างกายของลูกโดยอิงพ่อแม่
   * ส่วนสูง : เทียบว่าพ่อแม่สูง/ต่ำกว่าค่าเฉลี่ยของเพศตนกี่ sd แล้วส่งต่อส่วนเบี่ยงเบน
   *           นั้นให้ลูกตามสัดส่วน heredity ที่เหลือปล่อยให้แปรผันเอง
   * ประเภทหุ่น : มีโอกาส buildHeredity ที่จะได้ตามพ่อหรือแม่ ไม่งั้นสุ่มใหม่
   */
  function inheritBody(gender, father, mother) {
    const spec = BODY[gender];
    const h = BODY.heredity;

    const dadZ = father ? (father.body.height - BODY.male.height.mean) / BODY.male.height.sd : 0;
    const momZ = mother ? (mother.body.height - BODY.female.height.mean) / BODY.female.height.sd : 0;
    const parentZ = (dadZ + momZ) / 2;
    const childZ = parentZ * h + randNormal(0, 1, -3, 3) * (1 - h);
    const height = Math.round(
      clamp(spec.height.mean + childZ * spec.height.sd, spec.height.min, spec.height.max));

    const parents = [father, mother].filter(Boolean);
    const build = (parents.length && Math.random() < BODY.buildHeredity)
      ? buildById(parents[Math.floor(Math.random() * parents.length)].body.buildId)
      : pickBuild();

    const bmi = randNormal(build.bmi.mean, build.bmi.sd, BODY.bmiRange.min, BODY.bmiRange.max);
    return finishBody(height, build.id, bmi);
  }

  /* ---------------------------------------------------------------------
   * พลังยุทธ์
   * powerBase คือศักยภาพติดตัวที่ไม่เปลี่ยน ส่วนค่าที่แสดงคิดจาก base
   * คูณตัวประกอบตามวัย จึงค่อยๆ สูงขึ้นในวัยหนุ่มสาว พีคช่วง 30 กว่า แล้วถดถอย
   * ------------------------------------------------------------------- */

  function rollPowerBase(buildId) {
    const bonus = POWER.buildBonus[buildId] || 0;
    return Math.round(
      clamp(randNormal(POWER.base.mean, POWER.base.sd, POWER.base.min, POWER.base.max) + bonus,
        POWER.base.min, POWER.base.max));
  }

  /** ศักยภาพของลูก อิงค่าเฉลี่ยของพ่อแม่ตามสัดส่วน heredity */
  function inheritPowerBase(father, mother, buildId) {
    const parents = [father, mother].filter(Boolean);
    if (!parents.length) return rollPowerBase(buildId);
    const avg = parents.reduce((s, p) => s + p.powerBase, 0) / parents.length;
    const h = POWER.heredity;
    const drift = randNormal(0, POWER.base.sd, -POWER.base.sd * 3, POWER.base.sd * 3);
    const bonus = POWER.buildBonus[buildId] || 0;
    return Math.round(
      clamp(avg * h + POWER.base.mean * (1 - h) + drift * (1 - h) + bonus,
        POWER.base.min, POWER.base.max));
  }

  /** ตัวประกอบตามวัยจากเส้นโค้งใน POWER.curve (ไล่ระดับเชิงเส้นในแต่ละช่วง) */
  function ageFactor(age) {
    let prev = 0;
    for (const seg of POWER.curve) {
      if (age < seg.until) {
        const t = (age - prev) / (seg.until - prev);
        return seg.from + (seg.to - seg.from) * t;
      }
      prev = seg.until;
    }
    return POWER.curve[POWER.curve.length - 1].to;
  }

  /** พลังยุทธ์ที่แสดงจริง ณ อายุปัจจุบัน */
  function powerFor(p) {
    if (!p.alive) return 0;
    return Math.round(p.powerBase * ageFactor(p.age));
  }

  /* ---------------------------------------------------------------------
   * รายได้ต่อเดือน — เด็กเป็นภาระ วัยทำงานหาได้ วัยชราหาได้น้อยลง
   * ------------------------------------------------------------------- */
  function incomeFor(person) {
    const a = person.age;
    const apt = person.aptitude; // 0–1 ความสามารถประจำตัว
    if (a < 15) return -(1.5 + apt * 4);
    if (a < CONFIG.elderAge) return 1 + apt * 9;
    return 0.5 + apt * 3.5;
  }

  /* ---------------------------------------------------------------------
   * สร้างตัวละคร
   * ------------------------------------------------------------------- */

  /**
   * สร้างคนหนึ่งคน
   * opts: { gender, age, name, isBlood, fatherId, motherId, body, origin }
   */
  function createPerson(opts) {
    const gender = opts.gender || (Math.random() < 0.5 ? 'male' : 'female');
    const p = {
      id: opts.id || nextId(),
      name: opts.name || pick(NAMES[gender]),
      gender,
      age: opts.age != null ? opts.age : 0,
      body: opts.body || rollBody(gender),
      aptitude: opts.aptitude != null ? opts.aptitude : Math.random(),
      isBlood: !!opts.isBlood,       // true = เกิดในตระกูล, false = แต่งเข้ามา
      origin: opts.origin || null,   // ที่มาของคนนอก
      // บางคนครองตนโสดตลอดชีวิต — ตัวคุมไม่ให้จำนวนคู่ทวีคูณทุกรุ่น
      willMarry: opts.willMarry != null ? opts.willMarry : Math.random() < CONFIG.marriageRate,
      fatherId: opts.fatherId || null,
      motherId: opts.motherId || null,
      spouseId: null,
      childIds: [],
      alive: true,
      deathAge: null,
      isFounder: !!opts.isFounder,   // ตัวละครที่ผู้เล่นเริ่มเกมด้วย (ป้ายอ้างอิงเฉยๆ)
    };
    p.powerBase = opts.powerBase != null ? opts.powerBase : rollPowerBase(p.body.buildId);
    p.income = incomeFor(p);
    p.power = powerFor(p);
    return p;
  }

  /** สุ่มคนนอกตระกูลเพื่อมาเป็นคู่ครอง — อายุไล่เลี่ยกับเจ้าตัว */
  function createOutsider(gender, aroundAge) {
    const spread = CONFIG.partnerAgeSpread;
    const age = Math.max(CONFIG.adultAge,
      Math.round(aroundAge + (Math.random() * 2 - 1) * spread));
    return createPerson({
      gender,
      age,
      isBlood: false,
      origin: pick(NAMES.outsiderClans),
      willMarry: true,   // มาเพื่อครองคู่อยู่แล้ว
    });
  }

  /** สร้างทารกจากพ่อแม่ — สืบทอดร่างกายและพลังยุทธ์ พร้อมสถานะสายเลือด */
  function createChild(father, mother) {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const body = inheritBody(gender, father, mother);
    return createPerson({
      gender,
      age: 0,
      isBlood: true,
      fatherId: father.id,
      motherId: mother.id,
      body,
      powerBase: inheritPowerBase(father, mother, body.buildId),
    });
  }

  /* ---------------------------------------------------------------------
   * รูปหน้าประจำตัว — SVG ที่สร้างจาก id ทำให้คนเดิมได้หน้าเดิมเสมอ
   * ------------------------------------------------------------------- */

  const SKIN_TONES = ['#f0d2b0', '#e8c39a', '#dcae82', '#cb9a6d', '#b8865a'];
  const ROBES_M = ['#3f5f8a', '#4a6d7c', '#37527a', '#5a6e8c', '#2f4a6b'];
  const ROBES_F = ['#a8455c', '#b5566a', '#96405a', '#c06a7a', '#8e3f55'];
  const HAIRS = ['#241a12', '#2f2118', '#1c1410', '#3a2a1c'];

  /**
   * คืนสตริง SVG รูปหน้าของตัวละคร
   * ผมขาว = อายุตั้งแต่ elderAge ขึ้นไป, ทรงผมและเครื่องประดับต่างกันตามเพศ
   */
  function avatarSVG(person) {
    const h = hashOf(person.id);
    const skin = SKIN_TONES[h % SKIN_TONES.length];
    const isElder = person.age >= CONFIG.elderAge;
    const hair = isElder ? '#d8d4cc' : HAIRS[(h >> 3) % HAIRS.length];
    const robe = person.gender === 'male'
      ? ROBES_M[(h >> 5) % ROBES_M.length]
      : ROBES_F[(h >> 5) % ROBES_F.length];
    const isChild = person.age < 15;
    const headY = isChild ? 30 : 28;
    const headR = isChild ? 15 : 14;

    // ทรงผม: ชาย = มวยผมบนศีรษะ, หญิง = มวยสองข้างพร้อมปิ่น
    const hairShape = person.gender === 'male'
      ? `<path d="M18 ${headY - 4} Q32 ${headY - 20} 46 ${headY - 4} Q40 ${headY - 12} 32 ${headY - 12} Q24 ${headY - 12} 18 ${headY - 4} Z" fill="${hair}"/>
         <ellipse cx="32" cy="${headY - 16}" rx="6" ry="5" fill="${hair}"/>
         <rect x="30" y="${headY - 21}" width="4" height="5" rx="1" fill="${isElder ? '#b9b3a8' : '#8a6a1f'}"/>`
      : `<path d="M17 ${headY + 2} Q32 ${headY - 20} 47 ${headY + 2} Q42 ${headY - 10} 32 ${headY - 10} Q22 ${headY - 10} 17 ${headY + 2} Z" fill="${hair}"/>
         <circle cx="19" cy="${headY - 6}" r="6" fill="${hair}"/>
         <circle cx="45" cy="${headY - 6}" r="6" fill="${hair}"/>
         <circle cx="32" cy="${headY - 14}" r="2.5" fill="#c9a227"/>`;

    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="รูป${person.name}">
      <rect width="64" height="64" fill="none"/>
      <path d="M10 64 Q10 46 32 44 Q54 46 54 64 Z" fill="${robe}"/>
      <path d="M32 44 L26 64 L38 64 Z" fill="${robe}" opacity=".55"/>
      <rect x="27" y="${headY + headR - 3}" width="10" height="8" rx="3" fill="${skin}"/>
      <circle cx="32" cy="${headY}" r="${headR}" fill="${skin}"/>
      ${hairShape}
      <circle cx="${32 - 5}" cy="${headY + 1}" r="1.6" fill="#3a2a20"/>
      <circle cx="${32 + 5}" cy="${headY + 1}" r="1.6" fill="#3a2a20"/>
      <path d="M29 ${headY + 7} Q32 ${headY + 9} 35 ${headY + 7}" stroke="#a35c52" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      ${isElder ? `<path d="M25 ${headY - 3} Q28 ${headY - 5} 30 ${headY - 3}" stroke="#cfc9bf" stroke-width="1.2" fill="none"/>
                   <path d="M34 ${headY - 3} Q36 ${headY - 5} 39 ${headY - 3}" stroke="#cfc9bf" stroke-width="1.2" fill="none"/>` : ''}
    </svg>`;
  }

  root.Person = {
    createPerson, createOutsider, createChild,
    rollBody, inheritBody, buildLabel, buildById,
    rollPowerBase, inheritPowerBase, powerFor,
    incomeFor, avatarSVG, randNormal, pick,
  };
})(typeof self !== 'undefined' ? self : this);
