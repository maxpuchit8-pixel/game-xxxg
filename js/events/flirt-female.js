/**
 * =============================================================================
 * events/flirt-female.js — หญิงสายเลือด × คนแปลกหน้า (สุ่มตัวละครใหม่)
 * =============================================================================
 * อีเวนต์เชยชมกับคนแปลกหน้าที่ระบบสุ่มชื่อขึ้นใหม่ (ไม่เข้าผังตระกูล)
 * มีครบทั้ง: ตัวละครหลักไปชวนเอง / โดนคนแปลกหน้าชวน / เจอเดี่ยว / เจอเป็นกลุ่ม
 * แก้/เพิ่มเทมเพลตในไฟล์นี้ได้เลย — คู่มือวิธีเขียนอยู่หัวไฟล์ events/appearance.js
 *
 * หัวใจของหมวดนี้:
 *   when:    { gender: 'female', blood: true }   ตัวหลักคือหญิงสายเลือด
 *   partner: 'stranger'                          สุ่มชายแปลกหน้า → {stranger}
 *   group:   [2, 4]                              เจอเป็นกลุ่ม → {strangers} {count}
 *                                                (ไม่ใส่ = เจอเดี่ยว)
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.EventTemplates = (root.EventTemplates || []).concat([

    /* ---- โดนชวน (เดี่ยว) ---- */
    {
      id: 'flirtF-approached',
      when: { gender: 'female', blood: true, minCharm: 45, maxAge: 45 },
      partner: 'stranger',
      places: ['ตลาดแสงจันทร์', 'สวนลอยเขตตะวันออก', 'งานเทศกาลโคมดาว'],
      title: 'ชายแปลกหน้าทอดสะพานให้{name}',
      text: 'ขณะ{name}เดินเล่นที่{place} ชายแปลกหน้านาม{stranger}เข้ามาทักทาย ' +
            'ชวนชมโคมและเอ่ยชมความ{tier}ของนางอย่างไม่ปิดบัง',
      options: [
        { label: 'รับคำชวนเดินชมด้วยกัน', value: 'accept', note: 'ชื่อเสียง +2 ค่ำคืนที่รื่นรมย์', tone: 'accept',
          effect: { rep: 2, text: '{name}เดินชม{place}กับ{stranger}จนโคมดับ เรื่องเล่าสนุกๆ ติดตัวกลับเรือน' } },
        { label: 'ขอบคุณแล้วปฏิเสธ', value: 'skip', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}ยิ้มขอบคุณ{stranger}แล้วเดินจากไปอย่างสง่างาม' } },
      ],
    },

    /* ---- ไปชวนเอง (เดี่ยว) ---- */
    {
      id: 'flirtF-initiate',
      when: { gender: 'female', blood: true, minCharm: 55, maxAge: 40 },
      partner: 'stranger',
      places: ['หอสมุดกลางนคร', 'ลานฝึกยุทธ์เปิดของเขต'],
      title: '{name}เห็นชายหนุ่มถูกใจ',
      text: 'ที่{place} {name}สะดุดตาชายหนุ่มนาม{stranger}เข้าอย่างจัง ' +
            'ครั้งนี้นางอยากเป็นฝ่ายเอ่ยทักก่อนเอง',
      options: [
        { label: 'เดินเข้าไปทักก่อน', value: 'go', note: 'สำเร็จ: ชื่อเสียง +3 · เก้อ: ชื่อเสียง -1', tone: 'accept',
          effect: { chance: 0.7,
            success: { rep: 3, text: '{stranger}รับคำทักของ{name}อย่างยินดี ทั้งคู่คุยกันออกรสจนลืมเวลา' },
            fail: { rep: -1, text: '{stranger}ขอตัวไปอย่างเคอะเขิน {name}ยิ้มแก้เก้อแล้วเดินจากไป' } } },
        { label: 'ได้แต่มองอยู่ห่างๆ', value: 'skip', note: 'เก็บไว้ในความทรงจำ', tone: 'decline',
          effect: { text: '{name}ได้แต่มอง{stranger}อยู่ไกลๆ แล้วเก็บภาพนั้นไว้ในใจ' } },
      ],
    },

    /* ---- โดนรุมจีบเป็นกลุ่ม ---- */
    {
      id: 'flirtF-group',
      when: { gender: 'female', blood: true, minCharm: 65, maxAge: 42 },
      traitAffinity: ['limelight', 'radiantOne', 'circleQueen'],
      partner: 'stranger',
      group: [2, 4],
      places: ['งานเลี้ยงสภานคร', 'มหรสพประลองพลัง'],
      title: 'หนุ่มๆ รุมล้อม{name}',
      text: 'ความ{tier}ของ{name}ทำให้ที่{place} มีชายหนุ่มถึง {count} คน ' +
            '({strangers}) มารุมล้อมขอทำความรู้จักพร้อมกัน',
      options: [
        { label: 'รับมืออย่างมีชั้นเชิง', value: 'charm', note: 'ชื่อเสียง +4', tone: 'accept',
          effect: { rep: 4, text: '{name}สนทนากับทุกคนอย่างเสมอภาค ไม่มีใครได้ใจนางไปแม้แต่คนเดียว แต่ทุกคนกลับไปเล่าขานถึงนาง' } },
        { label: 'ขอตัวออกจากวง', value: 'skip', note: 'ความสงบสำคัญกว่า', tone: 'decline',
          effect: { text: '{name}ยกมือขอตัวจากวงล้อมที่{place} ปล่อยให้หนุ่มๆ มองตามอย่างเสียดาย' } },
      ],
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
