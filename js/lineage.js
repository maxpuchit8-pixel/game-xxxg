/**
 * =============================================================================
 * lineage.js — ผังตระกูลและเหตุการณ์ในชีวิต
 * =============================================================================
 * เก็บทะเบียนคนทั้งหมดและความสัมพันธ์ระหว่างกัน พร้อมกลไกชีวิต:
 *   - แต่งงาน (marry)
 *   - ให้กำเนิดบุตร (birth)
 *   - เสียชีวิต (die)
 *   - แปลงทะเบียนแบนๆ ให้เป็นโครงต้นไม้สำหรับวาดผังตระกูล (buildTree)
 *
 * ไม่ยุ่งกับ DOM — ฝั่ง UI เรียก buildTree() ไปวาดเอง
 * =============================================================================
 */
(function (root) {
  'use strict';

  const { CONFIG } = root.GameData;
  const P = root.Person;

  function createLineage() {
    const people = new Map();   // id -> person

    /* ความสัมพันธ์ลับ — เฉพาะชายกับหญิง (คนเลือกคู่อยู่ใน rollSecrets ของ main)
     * ไม่จำกัดว่าต้องโสดหรือคนละรุ่น เก็บเป็นคู่ที่เรียงคีย์แล้ว กันบันทึกซ้ำ
     * สองทิศทาง ผลของมันต่อเกมยังไม่ได้ออกแบบ มีแค่การมีอยู่และการแสดงผล */
    const secrets = new Map();  // "idA::idB" -> { aId, bId, sinceMonth }

    function add(person) {
      people.set(person.id, person);
      return person;
    }
    function get(id) { return people.get(id) || null; }
    function all() { return Array.from(people.values()); }
    function living() { return all().filter((p) => p.alive); }

    function spouseOf(p) { return p.spouseId ? get(p.spouseId) : null; }
    function childrenOf(p) { return p.childIds.map(get).filter(Boolean); }
    function fatherOf(p) { return p.fatherId ? get(p.fatherId) : null; }
    function motherOf(p) { return p.motherId ? get(p.motherId) : null; }

    /* ------------------- เหตุการณ์ชีวิต ------------------- */

    function marry(a, b) {
      a.spouseId = b.id;
      b.spouseId = a.id;
      return { a, b };
    }

    /** ให้กำเนิดบุตร — คืน person ของทารก หรือ null ถ้าเงื่อนไขไม่ผ่าน */
    function birth(father, mother) {
      if (!father || !mother) return null;
      if (mother.childIds.length >= CONFIG.maxChildren) return null;
      const baby = P.createChild(father, mother);
      add(baby);
      father.childIds.push(baby.id);
      mother.childIds.push(baby.id);
      P.applyMotherhood(mother);   // หน้าอกและสะโพกของมารดาขยายหลังคลอด
      return baby;
    }

    function die(p) {
      p.alive = false;
      p.deathAge = p.age;
      p.income = 0;
      return p;
    }

    /* ------------------- ความสัมพันธ์ลับ ------------------- */

    function secretKey(a, b) { return [a, b].sort().join('::'); }

    function hasSecret(aId, bId) { return secrets.has(secretKey(aId, bId)); }

    function addSecret(aId, bId, month) {
      const k = secretKey(aId, bId);
      if (secrets.has(k)) return null;
      const rec = { aId, bId, sinceMonth: month };
      secrets.set(k, rec);
      return rec;
    }

    /** คู่ลับทั้งหมดที่ทั้งสองฝ่ายยังมีชีวิตอยู่ (คนตายแล้วไม่ต้องลากเส้น) */
    function activeSecrets() {
      const out = [];
      secrets.forEach((r) => {
        const a = get(r.aId), b = get(r.bId);
        if (a && b && a.alive && b.alive) out.push(r);
      });
      return out;
    }

    /** คู่ลับของคนคนหนึ่ง คืนเป็นรายการ person */
    function secretsOf(id) {
      return activeSecrets()
        .filter((r) => r.aId === id || r.bId === id)
        .map((r) => get(r.aId === id ? r.bId : r.aId))
        .filter(Boolean);
    }

    /* ------------------- คำนวณรุ่น ------------------- */

    /** รุ่นที่เท่าไรของสายเลือด (ต้นตระกูล = 1) */
    function generationOf(p) {
      let gen = 1, cur = p, guard = 0;
      while (guard++ < 50) {
        const parent = fatherOf(cur) || motherOf(cur);
        if (!parent) break;
        // เดินขึ้นทางสายเลือดเท่านั้น
        const bloodParent = (fatherOf(cur) && fatherOf(cur).isBlood) ? fatherOf(cur)
                          : (motherOf(cur) && motherOf(cur).isBlood) ? motherOf(cur)
                          : parent;
        cur = bloodParent;
        gen++;
      }
      return gen;
    }

    function maxGeneration() {
      return all().filter((p) => p.isBlood)
        .reduce((m, p) => Math.max(m, generationOf(p)), 1);
    }

    /* ------------------- โครงต้นไม้สำหรับวาดผัง ------------------- */

    /**
     * คืนโครงสร้างซ้อนชั้น: [{ person, spouse, children: [...] }]
     * วาดจากคนสายเลือดเท่านั้น คู่สมรสที่แต่งเข้ามาจะถูกแสดงคู่กับเจ้าตัว
     * ไม่แตกกิ่งของตัวเอง จึงไม่เกิดการวาดซ้ำ
     */
    function buildTree() {
      const roots = all().filter((p) =>
        p.isBlood && !fatherOf(p) && !motherOf(p)
      );
      const seen = new Set();

      function unitOf(p) {
        if (seen.has(p.id)) return null;
        seen.add(p.id);
        const sp = spouseOf(p);
        if (sp) seen.add(sp.id);
        return {
          person: p,
          spouse: sp,
          children: childrenOf(p)
            .sort((x, y) => y.age - x.age)
            .map(unitOf)
            .filter(Boolean),
        };
      }

      return roots.map(unitOf).filter(Boolean);
    }

    /* ------------------- สรุปตัวเลข ------------------- */

    /** รายได้รวมต่อเดือนของสมาชิกที่ยังมีชีวิต */
    function monthlyIncome() {
      return living().reduce((s, p) => s + p.income, 0);
    }

    function stats() {
      const live = living();
      return {
        total: all().length,
        living: live.length,
        blood: live.filter((p) => p.isBlood).length,
        generations: maxGeneration(),
        income: monthlyIncome(),
        power: live.reduce((s, p) => s + (p.power || 0), 0),
      };
    }

    return {
      people, add, get, all, living,
      spouseOf, childrenOf, fatherOf, motherOf,
      marry, birth, die,
      hasSecret, addSecret, activeSecrets, secretsOf,
      generationOf, maxGeneration, buildTree,
      monthlyIncome, stats,
    };
  }

  root.Lineage = { create: createLineage };
})(typeof self !== 'undefined' ? self : this);
