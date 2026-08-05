/**
 * =============================================================================
 * events/flirt-male.js — ชายสายเลือด × คนแปลกหน้า (สุ่มตัวละครใหม่)
 * =============================================================================
 * อีเวนต์เชยชมกับคนแปลกหน้าที่ระบบสุ่มชื่อขึ้นใหม่ (ไม่เข้าผังตระกูล)
 * มีครบทั้ง: ตัวละครหลักไปชวนเอง / โดนคนแปลกหน้าชวน / เจอเดี่ยว / เจอเป็นกลุ่ม
 * แก้/เพิ่มเทมเพลตในไฟล์นี้ได้เลย — คู่มือวิธีเขียนอยู่หัวไฟล์ events/appearance.js
 *
 * หัวใจของหมวดนี้:
 *   when:    { gender: 'male', blood: true }   ตัวหลักคือชายสายเลือด
 *   partner: 'stranger'                        สุ่มหญิงแปลกหน้า → {stranger}
 *   group:   [2, 4]                            เจอเป็นกลุ่ม → {strangers} {count}
 *                                              (ไม่ใส่ = เจอเดี่ยว)
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.EventTemplates = (root.EventTemplates || []).concat([

    /* ---- โดนชวน (เดี่ยว) ---- */
    {
      id: 'flirtM-approached',
      when: { gender: 'male', blood: true, minCharm: 45, maxAge: 50 },
      partner: 'stranger',
      places: ['โรงน้ำชาเขตกลาง', 'งานเทศกาลโคมดาว', 'ตลาดแสงจันทร์'],
      title: 'หญิงงามทอดสะพานให้{name}',
      text: 'ที่{place} หญิงงามนาม{stranger}ส่งสายตาให้{name}ก่อนเอ่ยชวนดื่มชา ' +
            'ความ{tier}ของเขาคงเข้าตานางตั้งแต่แรกเห็น',
      options: [
        { label: 'รับคำชวนดื่มชา', value: 'accept', note: 'ชื่อเสียง +2', tone: 'accept',
          effect: { rep: 2, text: '{name}นั่งดื่มชากับ{stranger}จนหมดกา บทสนทนานั้นหอมกว่าชาเสียอีก' } },
        { label: 'ขอบคุณแล้วปฏิเสธ', value: 'skip', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}โค้งขอบคุณ{stranger}อย่างสุภาพแล้วขอตัวกลับ' } },
      ],
    },

    /* ---- ไปชวนเอง (เดี่ยว) ---- */
    {
      id: 'flirtM-initiate',
      when: { gender: 'male', blood: true, minCharm: 55, maxAge: 45 },
      partner: 'stranger',
      places: ['สวนลอยเขตตะวันออก', 'หอทัศนาเขตเหนือ'],
      title: '{name}รวบรวมความกล้าเข้าไปทัก',
      text: 'ที่{place} {name}เห็นหญิงสาวนาม{stranger}ยืนชมวิวอยู่ลำพัง ' +
            'ครั้งนี้เขาตัดสินใจเป็นฝ่ายเดินเข้าไปทักก่อน',
      options: [
        { label: 'เข้าไปชวนสนทนา', value: 'go', note: 'สำเร็จ: ชื่อเสียง +3 · เก้อ: ชื่อเสียง -1', tone: 'accept',
          effect: { chance: 0.7,
            success: { rep: 3, text: '{stranger}ยิ้มรับคำทัก ทั้งสองชมวิวที่{place}ด้วยกันจนตะวันลับ' },
            fail: { rep: -1, text: '{stranger}ขอตัวไปก่อนอย่างสุภาพ {name}ยืนแก้เก้ออยู่ครู่ใหญ่' } } },
        { label: 'เปลี่ยนใจเดินผ่านไป', value: 'skip', note: 'ไม่เสี่ยงเสียหน้า', tone: 'decline',
          effect: { text: '{name}เดินผ่าน{stranger}ไปเฉยๆ แล้วนึกเสียดายทั้งคืน' } },
      ],
    },

    /* ---- โดนกลุ่มสาวๆ รุมล้อม ---- */
    {
      id: 'flirtM-group',
      when: { gender: 'male', blood: true, minCharm: 65, maxAge: 45 },
      traitAffinity: ['wanderingBee', 'charmer'],
      partner: 'stranger',
      group: [2, 4],
      places: ['งานประดับดาวประจำปี', 'มหรสพประลองพลัง'],
      title: 'สาวๆ รุมล้อม{name}',
      text: 'หลัง{name}แสดงพลังยุทธ์ที่{place} มีหญิงสาวถึง {count} คน ' +
            '({strangers}) มารุมล้อมขอผ้าเช็ดหน้ากับลายเซ็นของเขา',
      options: [
        { label: 'ทักทายอย่างอ่อนโยนทุกคน', value: 'charm', note: 'ชื่อเสียง +4', tone: 'accept',
          effect: { rep: 4, text: '{name}รับมือวงล้อมอย่างสุภาพบุรุษ ชื่อของเขาถูกเล่าขานทั่ว{place}' } },
        { label: 'ขอตัวกลับเรือน', value: 'skip', note: 'ความสงบสำคัญกว่า', tone: 'decline',
          effect: { text: '{name}โค้งขอบคุณแล้วปลีกตัวออกจากวงล้อมที่{place}อย่างรวดเร็ว' } },
      ],
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
