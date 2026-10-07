// =============================================================
//  หน้าต่างลากได้: จับที่หัวหน้าต่างแล้วลาก · จำตำแหน่งไว้ · ดับเบิลคลิกหัวหน้าต่าง = กลับตำแหน่งเดิม
//  (จอเล็กกว่า 760px ใช้ตำแหน่งตายตัว ไม่ให้ลาก)
// =============================================================
(() => {
  const PANELS = ["statPanel", "invPanel", "shopPanel", "smithPanel", "autoPanel", "worldPanel", "jobPanel", "skillPanel", "spiritPanel", "bossPanel", "storagePanel", "tradePanel"];
  const wide = () => window.innerWidth >= 760;
  const key = (id) => "pn_win_" + id;
  const load = (id) => { try { return JSON.parse(localStorage.getItem(key(id)) || "null"); } catch { return null; } };
  const save = (id, pos) => { try { localStorage.setItem(key(id), JSON.stringify(pos)); } catch {} };
  const forget = (id) => { try { localStorage.removeItem(key(id)); } catch {} };

  function place(el, x, y) {
    const w = el.offsetWidth || 300, h = el.offsetHeight || 200;
    // ให้หัวหน้าต่างอยู่ในจอเสมอ (ลากกลับมาได้)
    x = Math.max(-w + 80, Math.min(window.innerWidth - 80, x));
    y = Math.max(0, Math.min(window.innerHeight - 40, y));
    el.style.left = x + "px"; el.style.top = y + "px";
    el.classList.add("dragged");
  }
  function reset(el) {
    el.classList.remove("dragged");
    el.style.left = el.style.top = "";
  }
  function toFront(el) {
    PANELS.forEach((id) => { const p = document.getElementById(id); if (p) p.classList.toggle("on-top", p === el); });
  }

  function setup(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const head = el.querySelector(".ap-head, .shop-head");
    if (!head) return;
    head.classList.add("drag-handle");
    head.title = "ลากเพื่อย้ายหน้าต่าง · ดับเบิลคลิกเพื่อกลับที่เดิม";
    const saved = load(id);
    if (saved && wide()) requestAnimationFrame(() => place(el, saved.x, saved.y));
    el.addEventListener("pointerdown", () => toFront(el));
    head.addEventListener("pointerdown", (e) => {
      if (!wide() || e.button !== 0 || e.target.closest("button, input, select, a")) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      place(el, r.left, r.top);
      head.setPointerCapture(e.pointerId);
      const move = (ev) => place(el, ev.clientX - dx, ev.clientY - dy);
      const up = () => {
        head.removeEventListener("pointermove", move);
        head.removeEventListener("pointerup", up);
        head.removeEventListener("pointercancel", up);
        save(id, { x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
      };
      head.addEventListener("pointermove", move);
      head.addEventListener("pointerup", up);
      head.addEventListener("pointercancel", up);
      e.preventDefault();
    });
    head.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) { reset(el); forget(id); } });
  }

  PANELS.forEach(setup);
  // เปลี่ยนขนาดจอ: จอเล็ก → กลับตำแหน่งตายตัว · จอใหญ่ → ดึงหน้าต่างที่หลุดจอกลับมา
  window.addEventListener("resize", () => PANELS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains("dragged")) return;
    if (!wide()) reset(el); else place(el, parseFloat(el.style.left), parseFloat(el.style.top));
  }));
})();
