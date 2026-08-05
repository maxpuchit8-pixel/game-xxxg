/**
 * =============================================================================
 * events/secret-inlaw-female.js — หญิงสายเลือด × ชายแต่งเข้า (เขยของตระกูล)
 * =============================================================================
 * อีเวนต์ที่อาจก่อ "ความสัมพันธ์ลับ" ระหว่างหญิงในตระกูลกับเขยที่แต่งเข้ามา
 * แก้/เพิ่มเทมเพลตในไฟล์นี้ได้เลย — คู่มือวิธีเขียนอยู่หัวไฟล์ events/appearance.js
 *
 * หัวใจของหมวดนี้:
 *   when:        { gender: 'female', blood: true }   ตัวหลักคือหญิงสายเลือด
 *   partner:     'inlaw'                             ระบบสุ่มเขย (ชายแต่งเข้า
 *                ที่ไม่ใช่สามีตัวเองและยังไม่มีสัมพันธ์ลับต่อกัน) มาเป็น {partner}
 *   partnerWhen: {...}                               เงื่อนไขฝั่งเขย (ใส่หรือไม่ก็ได้)
 *   effect:      { secretWithPartner: true }         ให้เกิดสัมพันธ์ลับกับเขยคนนั้น
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.EventTemplates = (root.EventTemplates || []).concat([

    /* ---- ฝึกยุทธ์สองต่อสองยามดึก ---- */
    {
      id: 'inlawF-training',
      when: { gender: 'female', blood: true, minCharm: 50, maxAge: 45 },
      traitAffinity: ['freeHeart', 'ardent', 'radiantOne'],
      partner: 'inlaw',
      partnerWhen: { minCharm: 45 },
      places: ['หอฝึกประจำตระกูล', 'ลานยุทธ์หลังเรือนใหญ่'],
      title: 'ฝึกยุทธ์สองต่อสองของ{name}กับ{partner}',
      text: '{name}ฝึกพลังยุทธ์กับ{partner}เขยของตระกูลที่{place}จนดึกดื่น ' +
            'ทุกกระบวนท่าที่ประสานกันทำให้ใจเต้นแรงเกินกว่าเรื่องยุทธ์',
      options: [
        { label: 'รักษาระยะศิษย์พี่น้อง', value: 'refuse', note: 'ชื่อเสียง +2', tone: 'decline',
          effect: { rep: 2, text: '{name}วางกระบี่แล้วขอตัวกลับเรือนก่อน ใจยังนิ่งพอ' } },
        { label: 'ปล่อยใจตามแรงยุทธ์', value: 'fall', note: 'เกิดความสัมพันธ์ลับกับ{partner}',
          effect: { secretWithPartner: true, rep: -2,
            text: 'หลังคืนนั้นที่{place} สายตาของ{name}กับ{partner}ก็ไม่เหมือนเดิมอีกต่อไป' } },
      ],
    },

    /* ---- เขยมาปรึกษาทุกข์ใจ ---- */
    {
      id: 'inlawF-comfort',
      when: { gender: 'female', blood: true, minCharm: 60 },
      partner: 'inlaw',
      places: ['สวนหลังเรือนใหญ่', 'ระเบียงชมดาวของตระกูล'],
      title: '{partner}มาปรับทุกข์กับ{name}',
      text: 'ยามค่ำที่{place} {partner}เขยของตระกูลมาปรับทุกข์เรื่องชีวิตคู่กับ{name} ' +
            'ความ{tier}ของนางทำให้เขาอยากอยู่ต่ออีกสักครู่',
      options: [
        { label: 'ปลอบใจแบบพี่น้อง', value: 'refuse', note: 'จบเรื่องอย่างงดงาม', tone: 'decline',
          effect: { rep: 1, text: '{name}ตบไหล่ปลอบ{partner}แล้วส่งกลับเรือนไปหาคู่ของตน' } },
        { label: 'อยู่เป็นเพื่อนจนดาวลับฟ้า', value: 'fall', note: 'เสี่ยงเกิดความสัมพันธ์ลับ',
          effect: { chance: 0.6,
            success: { secretWithPartner: true, rep: -1,
              text: 'ดาวลับฟ้าไปนานแล้ว แต่{name}กับ{partner}ยังนั่งอยู่ที่{place}' },
            fail: { text: 'คุยกันถึงเที่ยงคืนก็แยกย้าย — โชคดีที่ใจทั้งสองยังมั่นคง' } } },
      ],
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
