/**
 * =============================================================================
 * data.js — ข้อมูลตั้งต้นของเกม "สายใยตระกูล"
 * =============================================================================
 * รวมทุกอย่างที่เป็น "เนื้อหา" ของเกมไว้ที่เดียว:
 *   - CONFIG    ค่าปรับสมดุลเกม (ทองตั้งต้น, เป้าหมาย, ราคากิจกรรม ฯลฯ)
 *   - SEASONS   รายชื่อฤดูที่หมุนเวียน
 *   - CHARACTERS สมาชิกตระกูล + คนนอก
 *   - DEFAULT_SPOT สถานที่เริ่มต้นของแต่ละคน
 *   - BLOOD     คู่สายเลือดเดียวกัน (ใช้ล็อกไม่ให้เกิด romance)
 *
 * อยากปรับสมดุลเกม เพิ่มตัวละคร หรือเปลี่ยนความสัมพันธ์ — แก้ไฟล์นี้ไฟล์เดียวจบ
 * =============================================================================
 */
(function (root) {
  'use strict';

  const CONFIG = {
    startGold: 800,
    startReputation: 50,
    goalGold: 3000,        // เป้าหมายชัยชนะ: ทอง
    goalReputation: 100,   // เป้าหมายชัยชนะ: ชื่อเสียง
    marriageThreshold: 60, // เสน่หาถึงค่านี้ -> จัดงานมงคลสมรส
    marriageCost: 200,
    marriageReputation: 10,
    festivalCost: 150,
    prayCost: 100,
    prayReputation: 5,
    eventsPerDayMin: 2,
    eventsPerDayMax: 3,
    daysPerSeason: 10,
  };

  const SEASONS = ['ฤดูร้อน', 'ฤดูฝน', 'ฤดูหนาว'];

  const CHARACTERS = [
    { id: 'wirat',    name: 'คุณพระวิรัช',  age: 'adult', role: 'ผู้นำตระกูล' },
    { id: 'butsaba',  name: 'แม่หญิงบุษบา', age: 'adult', role: 'ภรรยาคุณพระ ดูแลเรือน' },
    { id: 'arun',     name: 'อรุณ',        age: 'adult', role: 'บุตรชายคนโต' },
    { id: 'duangkae', name: 'ดวงแข',       age: 'adult', role: 'บุตรสาวคนรอง' },
    { id: 'mek',      name: 'เมฆ',         age: 'child', role: 'หลานเล็กของตระกูล' },
    { id: 'wad',      name: 'วาด',         age: 'adult', role: 'ศิษย์เอกสำนักวิชา (คนนอกตระกูล)' },
    { id: 'khram',    name: 'คราม',        age: 'adult', role: 'พ่อค้าหนุ่มจากท่าเรือ (คนนอกตระกูล)' },
  ];

  const DEFAULT_SPOT = {
    wirat: 'market',
    butsaba: 'home',
    arun: 'academy',
    duangkae: 'garden',
    mek: 'home',
    wad: 'academy',
    khram: 'harbor',
  };

  // สายเลือดของตระกูลศรีวัฒนา — ห้าม romance ตลอดกาล
  const BLOOD = [
    ['wirat', 'arun'], ['wirat', 'duangkae'], ['wirat', 'mek'],
    ['butsaba', 'arun'], ['butsaba', 'duangkae'], ['butsaba', 'mek'],
    ['arun', 'duangkae'], ['arun', 'mek'], ['duangkae', 'mek'],
  ];

  root.GameData = { CONFIG, SEASONS, CHARACTERS, DEFAULT_SPOT, BLOOD };
})(typeof self !== 'undefined' ? self : this);
