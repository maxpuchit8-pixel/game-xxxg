/**
 * =============================================================================
 * scenario-engine.js
 * โมดูลตัวสร้างสถานการณ์แบบสุ่ม (Procedural Scenario Generator)
 * สำหรับใช้กับเกมจำลองตระกูล "สายใยตระกูล" หรือเกมแนวจำลองชีวิต/ครอบครัวอื่นๆ
 * =============================================================================
 *
 * แนวคิดหลัก
 * ----------
 * แทนที่จะมีลิสต์สถานการณ์ตายตัว (fixed list) โมดูลนี้ "ประกอบ" สถานการณ์ขึ้นใหม่
 * ทุกครั้งจากชิ้นส่วนย่อย (word banks) ตามกฎที่กำหนด ทำให้ได้ข้อความที่หลากหลาย
 * และรองรับการเพิ่มคลังคำเองในภายหลังโดยไม่ต้องแก้โค้ดหลัก
 *
 * ส่วนประกอบ
 * ----------
 * 1. Locations สถานที่ (บ้าน, ตลาด, สำนักวิชา, ไร่นา ฯลฯ)
 * 2. Activities กิจกรรมที่ทำได้ในแต่ละสถานที่ (เรียน, สอน, ทำงาน, ค้าขาย ฯลฯ)
 * 3. Word banks คลังคำแยกตามหมวด (opening / complication / resolution)
 * 4. Templates รูปแบบประโยคที่นำชิ้นส่วนมาประกอบกัน
 * 5. ScenarioEngine ตัวเครื่องยนต์หลัก มีฟังก์ชันสุ่ม/ประกอบ/ตรวจกฎ
 *
 * วิธีใช้แบบเร็ว
 * --------------
 * const engine = new ScenarioEngine();
 * engine.assignLocation('a', 'market');
 * engine.assignLocation('b', 'market'); // ไปที่เดียวกัน -> มีโอกาสถูกจับคู่เจอกัน
 * const event = engine.generateEvent(characters);
 * console.log(event.text, event.tags, event.deltas);
 * =============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ScenarioEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * RNG แบบ seed ได้ (mulberry32) — ถ้าไม่ตั้ง seed จะสุ่มปกติทุกครั้งที่รันใหม่
   * เหตุผลที่ทำให้ seed ได้: เผื่ออยาก "รีเพลย์" เหตุการณ์ชุดเดิมเพื่อดีบัก
   * ------------------------------------------------------------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function pickWeighted(rng, arr) {
    // arr: [{item, weight}]
    const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
    let r = rng() * total;
    for (const x of arr) {
      r -= (x.weight || 1);
      if (r <= 0) return x.item;
    }
    return arr[arr.length - 1].item;
  }
  function randInt(rng, min, max) {
    return Math.floor(min + rng() * (max - min + 1));
  }
  function hasTag(entry, tag) {
    return entry.tags && entry.tags.indexOf(tag) !== -1;
  }

  /* ---------------------------------------------------------------------
   * คลังคำตั้งต้น (Default Word Banks)
   * เพิ่ม/แก้ได้ผ่าน engine.addWordBank(category, entries) และ
   * engine.addLocation(...) / engine.addActivity(...) ภายหลัง
   * ------------------------------------------------------------------- */

  const DEFAULT_LOCATIONS = [
    { id: 'home', name: 'บ้านเรือนตระกูล', tags: ['domestic'] },
    { id: 'market', name: 'ตลาดกลางเมือง', tags: ['trade', 'public'] },
    { id: 'academy', name: 'สำนักวิชา', tags: ['study', 'teach'] },
    { id: 'field', name: 'ไร่นา', tags: ['work', 'outdoor'] },
    { id: 'shrine', name: 'ศาลบรรพบุรุษ', tags: ['ritual'] },
    { id: 'harbor', name: 'ท่าเรือ', tags: ['trade', 'travel'] },
    { id: 'festival', name: 'งานเทศกาลประจำปี', tags: ['public', 'social'] },
    { id: 'garden', name: 'สวนหลังบ้าน', tags: ['domestic', 'quiet'] },
  ];

  const DEFAULT_ACTIVITIES = [
    { id: 'study', name: 'ศึกษาตำรา', locationTags: ['study'], tags: ['neutral', 'growth'] },
    { id: 'teach', name: 'สอนวิชา', locationTags: ['teach'], tags: ['neutral', 'growth'] },
    { id: 'trade', name: 'ค้าขาย', locationTags: ['trade'], tags: ['neutral', 'economy'] },
    { id: 'farm', name: 'ทำไร่ไถนา', locationTags: ['work'], tags: ['neutral', 'economy'] },
    { id: 'pray', name: 'สักการะบรรพบุรุษ', locationTags: ['ritual'], tags: ['positive', 'ritual'] },
    { id: 'stroll', name: 'เดินเล่น', locationTags: ['quiet', 'domestic'], tags: ['neutral', 'romance'] },
    { id: 'celebrate', name: 'ร่วมงานเทศกาล', locationTags: ['social'], tags: ['positive', 'social'] },
  ];

  // opening: ประโยคเปิดเหตุการณ์ (ใครทำอะไรที่ไหน)
  const WORDBANK_OPENING = [
    { text: '{p1}และ{p2}พบกันโดยบังเอิญที่{location}', tags: ['neutral', 'duo'] },
    { text: '{p1}ชวน{p2}ไป{activity}ที่{location}ด้วยกัน', tags: ['neutral', 'duo', 'romance'] },
    { text: '{p1}เดินทางไป{activity}ที่{location}เพียงลำพัง', tags: ['neutral', 'solo'] },
    { text: '{p1}และ{p2}ได้รับมอบหมายให้{activity}ร่วมกันที่{location}', tags: ['neutral', 'duo'] },
    { text: '{p1}แอบเฝ้ามอง{p2}อยู่ห่างๆ ขณะ{p2}{activity}ที่{location}', tags: ['romance', 'duo'] },
  ];

  // complication: เหตุการณ์แทรก (อาจเว้นว่างได้)
  const WORDBANK_COMPLICATION = [
    { text: 'จู่ๆ ฝนก็ตกลงมาอย่างไม่ทันตั้งตัว', tags: ['neutral'] },
    { text: 'มีข่าวลือเรื่องพ่อค้าเร่โกงราคาแพร่ไปทั่ว', tags: ['negative', 'economy'] },
    { text: 'บังเอิญเจอของเก่าเก็บที่ทำให้นึกถึงอดีต', tags: ['positive'] },
    { text: 'เกิดปากเสียงกันเรื่องเรื่องเล็กน้อยจนบานปลาย', tags: ['negative'] },
    { text: 'มีใครบางคนแอบเห็นเหตุการณ์ทั้งหมดโดยไม่ได้ตั้งใจ', tags: ['romance', 'neutral'] },
    { text: null, tags: ['neutral', 'romance', 'positive', 'negative'] }, // ไม่มี complication
  ];

  // resolution: บทสรุป/ผลลัพธ์
  const WORDBANK_RESOLUTION = [
    { text: 'ทั้งสองจึงสนิทสนมกันมากขึ้นกว่าเดิม', tone: 'positive', tags: ['duo'] },
    { text: 'บรรยากาศระหว่างกันจึงเริ่มตึงเครียดขึ้นเล็กน้อย', tone: 'negative', tags: ['duo'] },
    { text: 'ทั้งสองเลือกที่จะไม่พูดถึงเรื่องนี้อีก', tone: 'neutral', tags: ['duo'] },
    { text: 'เขากลับมาด้วยความรู้สึกที่เปลี่ยนไปจากเดิม', tone: 'neutral', tags: ['solo'] },
    { text: 'ตระกูลได้รับประโยชน์จากเหตุการณ์ครั้งนี้ไม่น้อย', tone: 'positive', tags: ['economy'] },
    { text: 'เรื่องนี้ทำให้ชื่อเสียงของตระกูลสั่นคลอนไปบ้าง', tone: 'negative', tags: ['economy'] },
  ];

  /* ---------------------------------------------------------------------
   * ScenarioEngine
   * ------------------------------------------------------------------- */
  class ScenarioEngine {
    constructor(opts = {}) {
      this.rng = typeof opts.seed === 'number' ? mulberry32(opts.seed) : Math.random;
      this.locations = [...DEFAULT_LOCATIONS];
      this.activities = [...DEFAULT_ACTIVITIES];
      this.wordbanks = {
        opening: [...WORDBANK_OPENING],
        complication: [...WORDBANK_COMPLICATION],
        resolution: [...WORDBANK_RESOLUTION],
      };

      // ตำแหน่งปัจจุบันของตัวละคร: { charId: { locationId, companions: [charId...] } }
      this._locationOf = new Map();

      // กราฟความเป็นญาติสายเลือด (ห้าม romance ตลอดกาล ปรับผ่าน public API ไม่ได้)
      this._bloodRelations = new Set();
    }

    /* ------------------- การจัดการคลังคำ / สถานที่ / กิจกรรม ------------------- */

    addLocation(loc) {
      this.locations.push(loc);
      return this;
    }

    addActivity(act) {
      this.activities.push(act);
      return this;
    }

    addWordBank(category, entries) {
      if (!this.wordbanks[category]) this.wordbanks[category] = [];
      this.wordbanks[category].push(...entries);
      return this;
    }

    /* ------------------- ระบบตำแหน่ง/สถานที่ ------------------- */

    assignLocation(charId, locationId, companionIds = []) {
      this._locationOf.set(charId, { locationId, companions: [...companionIds] });
      companionIds.forEach((cid) => {
        const existing = this._locationOf.get(cid) || { locationId, companions: [] };
        existing.locationId = locationId;
        if (!existing.companions.includes(charId)) existing.companions.push(charId);
        this._locationOf.set(cid, existing);
      });
      return this;
    }

    getLocationOf(charId) {
      return this._locationOf.get(charId) || null;
    }

    getPartyGroups() {
      const groups = new Map(); // locationId -> Set(charId)
      this._locationOf.forEach((v, charId) => {
        if (!groups.has(v.locationId)) groups.set(v.locationId, new Set());
        groups.get(v.locationId).add(charId);
      });
      return groups;
    }

    /* ------------------- ความสัมพันธ์สายเลือด (ล็อกไม่ให้ romance) ------------------- */

    setBloodRelation(idA, idB) {
      this._bloodRelations.add(this._pairKey(idA, idB));
      return this;
    }

    _pairKey(a, b) {
      return [a, b].sort().join('::');
    }

    isRomanceEligible(charA, charB) {
      if (!charA || !charB) return false;
      if (charA.age !== 'adult' || charB.age !== 'adult') return false;
      if (this._bloodRelations.has(this._pairKey(charA.id, charB.id))) return false;
      return true;
    }

    /* ------------------- ตัวสุ่ม/ประกอบสถานการณ์หลัก ------------------- */

    generateEvent(characters, opts = {}) {
      const mode = opts.mode || 'auto';
      const preferShared = opts.preferSharedLocation !== false;

      const { chosen, resolvedMode } = this._choosePeople(characters, mode, preferShared, opts.forceTag);
      if (!chosen.length) return null;

      const p1 = chosen[0];
      const p2 = chosen[1] || null;
      const isDuo = !!p2;
      const romanceOk = isDuo && this.isRomanceEligible(p1, p2);

      const locInfo = this.getLocationOf(p1.id);
      const location = locInfo
        ? this.locations.find((l) => l.id === locInfo.locationId)
        : pick(this.rng, this.locations);

      const availableActivities = this.activities.filter((a) =>
        a.locationTags.some((t) => location.tags.includes(t))
      );
      const activity = availableActivities.length
        ? pick(this.rng, availableActivities)
        : pick(this.rng, this.activities);

      const allowedTags = ['neutral', 'positive', 'negative', isDuo ? 'duo' : 'solo'];
      if (romanceOk) allowedTags.push('romance');

      const openingPool = this.wordbanks.opening.filter((e) =>
        e.tags.some((t) => allowedTags.includes(t)) &&
        (isDuo ? e.tags.includes('duo') || !e.tags.includes('solo') : e.tags.includes('solo') || !e.tags.includes('duo'))
      );
      const opening = pick(this.rng, openingPool.length ? openingPool : this.wordbanks.opening);

      const complicationPool = this.wordbanks.complication.filter((e) =>
        e.tags.some((t) => allowedTags.includes(t))
      );
      const complication = pick(this.rng, complicationPool.length ? complicationPool : this.wordbanks.complication);

      const resolutionPool = this.wordbanks.resolution.filter((e) =>
        e.tags.some((t) => (isDuo ? t === 'duo' : t === 'solo') || activity.tags.includes(t))
      );
      const resolution = pick(this.rng, resolutionPool.length ? resolutionPool : this.wordbanks.resolution);

      const text = this._fillTemplate(opening.text, {
        p1: p1.name,
        p2: p2 ? p2.name : '',
        location: location.name,
        activity: activity.name,
      }) + (complication.text ? ' ' + complication.text + '' : '') + ' ' + resolution.text;

      const tone = resolution.tone || 'neutral';
      const deltas = this._computeDeltas(tone, romanceOk && opening.tags.includes('romance'));

      return {
        id: 'evt_' + Math.floor(this.rng() * 1e9),
        mode: resolvedMode,
        participants: isDuo ? [p1.id, p2.id] : [p1.id],
        locationId: location.id,
        activityId: activity.id,
        text: text.trim(),
        tags: allowedTags,
        tone,
        deltas, // { bond, chemistry, gold } — chemistry จะเป็น 0 ถ้าไม่ใช่คู่ romance-eligible
      };
    }

    _choosePeople(characters, mode, preferShared, forceTag) {
      let resolvedMode = mode;
      if (mode === 'auto') resolvedMode = this.rng() < 0.65 ? 'duo' : 'solo';

      if (resolvedMode === 'solo' || characters.length < 2) {
        return { chosen: [pick(this.rng, characters)], resolvedMode: 'solo' };
      }

      if (forceTag === 'romance') {
        const eligiblePairs = [];
        for (let i = 0; i < characters.length; i++) {
          for (let j = i + 1; j < characters.length; j++) {
            if (this.isRomanceEligible(characters[i], characters[j])) {
              eligiblePairs.push([characters[i], characters[j]]);
            }
          }
        }
        if (eligiblePairs.length) {
          return { chosen: pick(this.rng, eligiblePairs), resolvedMode: 'duo' };
        }
        return { chosen: [pick(this.rng, characters)], resolvedMode: 'solo' };
      }

      if (preferShared) {
        const groups = this.getPartyGroups();
        const sharedPairs = [];
        groups.forEach((set) => {
          const ids = Array.from(set);
          if (ids.length >= 2) {
            for (let i = 0; i < ids.length; i++) {
              for (let j = i + 1; j < ids.length; j++) {
                const a = characters.find((c) => c.id === ids[i]);
                const b = characters.find((c) => c.id === ids[j]);
                if (a && b) sharedPairs.push([a, b]);
              }
            }
          }
        });
        if (sharedPairs.length && this.rng() < 0.7) {
          return { chosen: pick(this.rng, sharedPairs), resolvedMode: 'duo' };
        }
      }

      const a = pick(this.rng, characters);
      let b;
      do { b = pick(this.rng, characters); } while (b.id === a.id && characters.length > 1);
      return { chosen: [a, b], resolvedMode: 'duo' };
    }

    _fillTemplate(str, vars) {
      return str.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? vars[key] : ''));
    }

    _computeDeltas(tone, isRomance) {
      const sign = tone === 'positive' ? 1 : tone === 'negative' ? -1 : 0;
      const bond = sign * randInt(this.rng, 1, 8) + (sign === 0 ? randInt(this.rng, -2, 2) : 0);
      const chemistry = isRomance ? Math.max(0, sign * randInt(this.rng, 2, 9) + randInt(this.rng, 0, 3)) : 0;
      const gold = sign * randInt(this.rng, 10, 200);
      return { bond, chemistry, gold };
    }
  }

  return ScenarioEngine;
}));
