/**
 * =============================================================================
 * trait/engine.js — เครื่องจัดการคุณลักษณะติดตัว (Trait / Passive)
 * =============================================================================
 * ตัวละครเริ่มเกมด้วย 0 trait เสมอ แล้วได้เพิ่มระหว่างทางสามทาง:
 *   1. พันธุกรรม — ถ้าพ่อแม่มี trait ที่สืบทอดได้ ลูกอาจ "เกิดมาพร้อม" trait
 *      ได้ทันที สูงสุด maxAtBirth ตัว
 *   2. สถานการณ์ — เช่นเห็นคู่ครองไปมีคนอื่น ความลับตัวเองแตก คู่ครองล่วงลับ
 *      (จุดปล่อยอยู่ใน main.js)
 *   3. พฤติกรรมสะสม — ทำเรื่องแบบเดิมซ้ำๆ จนติดเป็นนิสัย เช่นออกงานเป็นจุดสนใจ
 *      หลายครั้งจะกลายเป็น "ผู้ปรารถนาสายตา" (นับด้วย tally จาก tag ในอีเวนต์)
 *
 * trait เกี่ยวโยงกันได้:
 *   relates   = ยิ่งมีตัวที่เกี่ยวข้องอยู่แล้ว ยิ่งได้ตัวนี้ง่ายขึ้น
 *   conflicts = มีตัวนี้อยู่แล้วจะไม่มีวันได้ตัวนั้น (เช่นรักเดียวใจเดียว vs หลายใจ)
 *   requires  = ต้องมีตัวนั้นก่อนถึงจะได้ตัวนี้
 * ได้เพิ่มเรื่อยๆ ไม่มีเพดาน และเมื่อได้แล้วอยู่ติดตัวไปตลอดชีวิต
 *
 * ไม่แตะ DOM — ทดสอบใน Node ได้เหมือนโมดูลตรรกะตัวอื่น
 * คลังคุณลักษณะอยู่ในไฟล์ข้างๆ (traits-*.js) เพิ่ม/แก้ได้เอง
 * =============================================================================
 */
(function (root) {
  'use strict';

  /* ค่าปรับสมดุลของระบบ trait — แก้ที่เดียวจบ */
  const TC = {
    maxAtBirth: 2,         // เกิดมาพร้อม trait ได้มากสุดกี่ตัว
    relateBoost: 0.5,      // trait ที่เกี่ยวข้อง 1 ตัว เพิ่มโอกาสอีกกี่เท่าของฐาน
    tallyChanceStep: 0.34, // ครบเกณฑ์แล้ว โอกาสติดนิสัยไต่ขึ้นครั้งละเท่านี้
  };

  function defs() { return root.TraitDefs || []; }
  function byId(id) { return defs().find((t) => t.id === id) || null; }

  function has(p, id) { return !!(p && p.traits && p.traits.indexOf(id) >= 0); }

  /** trait ของคนคนหนึ่งในรูปข้อมูลเต็ม (ข้ามตัวที่ถูกลบจากคลังไปแล้ว) */
  function listOf(p) {
    return ((p && p.traits) || []).map(byId).filter(Boolean);
  }

  /** เข้าเงื่อนไขจะได้ trait นี้ไหม — ยังไม่มี ไม่ชนตัวขัดแย้ง เพศ/วัยผ่าน */
  function canGain(p, def) {
    if (!p || !def || p.alive === false || has(p, def.id)) return false;
    if (def.gender && p.gender !== def.gender) return false;
    if (def.minAge != null && p.age < def.minAge) return false;
    // ขัดแย้งกันเป็นสองทางเสมอ — ประกาศไว้ฝั่งใดฝั่งหนึ่งก็พอ ไม่งั้นลำดับการได้
    // trait จะมีผล (เคยได้ "เปิดใจให้คู่ตน" ก่อนแล้วยังได้ "รักเดียวใจเดียว" ตามมา)
    if ((def.conflicts || []).some((id) => has(p, id))) return false;
    if (listOf(p).some((d) => (d.conflicts || []).indexOf(def.id) >= 0)) return false;
    if ((def.requires || []).some((id) => !has(p, id))) return false;
    return true;
  }

  /** ตัวคูณโอกาสจาก trait ที่เกี่ยวข้องซึ่งเจ้าตัวมีอยู่แล้ว */
  function relateMul(p, def) {
    const n = (def.relates || []).filter((id) => has(p, id)).length;
    return 1 + n * TC.relateBoost;
  }

  /**
   * มอบ trait ทันที คืน def เมื่อได้จริง / null เมื่อไม่เข้าเงื่อนไข
   * ผู้เรียก (main.js) เป็นคนบันทึกจดหมายเหตุเอง โมดูลนี้จึงไม่แตะ UI
   */
  function give(p, id) {
    const def = byId(id);
    if (!canGain(p, def)) return null;
    if (!p.traits) p.traits = [];
    p.traits.push(def.id);
    return def;
  }

  /** สุ่มมอบตามโอกาสฐาน คูณแรงเสริมจาก trait ที่เกี่ยวข้อง */
  function roll(p, id, chance) {
    const def = byId(id);
    if (!canGain(p, def)) return null;
    return Math.random() < chance * relateMul(p, def) ? give(p, id) : null;
  }

  /**
   * นับพฤติกรรมสะสม — เรียกทุกครั้งที่เจ้าตัวทำเรื่องแนวนั้นอีกหน
   * ครบ need ครั้งแล้วเริ่มมีโอกาสติดนิสัย และโอกาสไต่ขึ้นทุกครั้งถัดไป
   */
  function tally(p, key, id, need) {
    if (!p.traitTally) p.traitTally = {};
    const n = (p.traitTally[key] = (p.traitTally[key] || 0) + 1);
    const threshold = need || 3;
    if (n < threshold) return null;
    return roll(p, id, (n - threshold + 1) * TC.tallyChanceStep);
  }

  /** ผลรวมค่าปรับแบบบวกจากทุก trait เช่น sum(p, 'charm') */
  function sum(p, key) {
    return listOf(p).reduce((s, d) => s + ((d.effects && d.effects[key]) || 0), 0);
  }

  /** ผลคูณสะสมจากทุก trait เช่น mul(p, 'fertility') — ไม่มี trait = 1 */
  function mul(p, key) {
    return listOf(p).reduce((s, d) => {
      const v = d.effects && d.effects[key];
      return s * (v != null ? v : 1);
    }, 1);
  }

  /**
   * trait แต่กำเนิดของทารก — สุ่มจาก trait ของพ่อแม่ที่สืบทอดได้
   * โอกาสของแต่ละตัวคือ def.heritable (0–1) รวมแล้วไม่เกิน maxAtBirth ตัว
   * ต้องส่ง gender เพื่อกรองตัวที่จำกัดเพศออกตั้งแต่แรก
   */
  function inherit(father, mother, gender) {
    const pool = [];
    [father, mother].filter(Boolean).forEach((par) => {
      listOf(par).forEach((d) => {
        if (!d.heritable) return;
        if (d.gender && d.gender !== gender) return;
        if (pool.indexOf(d) < 0) pool.push(d);
      });
    });
    // สลับลำดับก่อน ไม่งั้นตัวที่อยู่ต้นคลังจะได้เปรียบเสมอเมื่อชนเพดาน
    pool.sort(() => Math.random() - 0.5);

    const out = [];
    pool.forEach((d) => {
      if (out.length >= TC.maxAtBirth) return;
      if ((d.conflicts || []).some((id) => out.indexOf(id) >= 0)) return;
      if ((d.requires || []).some((id) => out.indexOf(id) < 0)) return;
      if (Math.random() < d.heritable) out.push(d.id);
    });
    return out;
  }

  root.Traits = {
    config: TC, defs, byId, has, listOf, canGain,
    give, roll, tally, sum, mul, inherit,
  };
})(typeof self !== 'undefined' ? self : this);
