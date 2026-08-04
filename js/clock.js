/**
 * =============================================================================
 * clock.js — นาฬิกาเกม เดินเองพร้อมปุ่มเร่งความเร็ว
 * =============================================================================
 * หนึ่ง tick = หนึ่งเดือนในเกม ความเร็วปรับได้เป็นตัวคูณ (1x 2x 4x 8x 16x)
 * ยิ่งตัวคูณสูง ช่วงเวลาจริงระหว่าง tick ยิ่งสั้น
 *
 * ใช้ setTimeout แบบตั้งใหม่ทุกรอบแทน setInterval เพื่อให้เปลี่ยนความเร็ว
 * กลางคันแล้วมีผลทันที และไม่มี tick ค้างสะสมตอนสลับแท็บ
 * =============================================================================
 */
(function (root) {
  'use strict';

  const { CONFIG } = root.GameData;

  function createClock(onTick) {
    let speedIndex = 0;
    let running = false;
    let timer = null;

    function intervalMs() {
      return CONFIG.baseTickMs / CONFIG.speeds[speedIndex];
    }

    function schedule() {
      clearTimeout(timer);
      if (!running) return;
      timer = setTimeout(() => {
        onTick();
        schedule();
      }, intervalMs());
    }

    return {
      start() { running = true; schedule(); return this; },
      pause() { running = false; clearTimeout(timer); return this; },
      toggle() { return running ? this.pause() : this.start(); },
      isRunning() { return running; },

      /** เลื่อนไปความเร็วถัดไป วนกลับมาที่ 1x เมื่อสุดทาง */
      cycleSpeed() {
        speedIndex = (speedIndex + 1) % CONFIG.speeds.length;
        if (running) schedule();
        return this.speed();
      },
      setSpeedIndex(i) {
        speedIndex = Math.max(0, Math.min(CONFIG.speeds.length - 1, i));
        if (running) schedule();
        return this.speed();
      },
      speed() { return CONFIG.speeds[speedIndex]; },
      speedIndex() { return speedIndex; },
    };
  }

  root.GameClock = { create: createClock };
})(typeof self !== 'undefined' ? self : this);
