// =============================================================
//  หน้าต่างสกิล (ปุ่ม K): แท็บชาวบ้าน / อาชีพ · แถว I II III · กด + อัปทีละขั้น
//  (ใช้ตัวแปร room, gameData, $ จาก game.js)
// =============================================================
let mySkillData = { skills: {}, points: 0 }, skillTab = "villager";
const skLv = (k) => (mySkillData.skills || {})[k] || 0;
const ROMAN = ["I", "II", "III", "IV", "V"];
const skIcon = (s, cls = "sk-ic") => `<span class="${cls}" style="--sc:${s.color || "#445"}"><img src="/assets/icons/${s.icon}.png" alt=""></span>`;

let skillsLoaded = false;
function onSkills(d) {
  const prev = mySkillData.skills || {}, had = skillsLoaded;
  mySkillData = d || { skills: {}, points: 0 };
  skillsLoaded = true;
  // เพิ่งเรียนสกิลใหม่ (ใช้งานได้) → ใส่ลงช่องว่างในแถบสกิลให้เลย
  if (had && gameData && typeof skBar === "function" && myPlayer()) {
    const b = skBar(); let ch = false;
    for (const [k, L] of Object.entries(mySkillData.skills || {})) {
      const s = gameData.skills[k];
      if (s && !s.passive && L > 0 && !(prev[k] > 0) && !b.includes(k)) { const at = b.indexOf(null); if (at >= 0) { b[at] = k; ch = true; } }
    }
    if (ch) storeSet(skBarKey(), JSON.stringify(b));
  }
  if (gameData && typeof room !== "undefined" && room && myPlayer()) sendAutoCfg(); // ให้ AUTO รู้สกิลในแถบล่าสุด
  renderSkills();
  if (gameData) buildSkillBar();
  const b = $("skillBadge");
  if (b) { b.hidden = !(d && d.points > 0); b.textContent = d ? d.points : 0; }
}
function toggleSkills(force) {
  const p = $("skillPanel");
  const show = force ?? p.hidden;
  p.hidden = !show;
  document.body.classList.toggle("sk-edit", show); // เปิดหน้าต่างสกิล → โชว์ช่องว่างในแถบให้ลากมาวาง
  if (show) {
    const me = myPlayer();
    skillTab = me && me.job !== "villager" ? me.job : "villager";
    renderSkills();
  }
}
function renderSkills() {
  const panel = $("skillPanel");
  if (!panel || panel.hidden || !gameData || !gameData.skillTree) return;
  const me = myPlayer();
  if (!me) return;
  const J = gameData.jobs, S = gameData.skills;
  $("skPoints").textContent = mySkillData.points || 0;
  const base = J[me.job] && J[me.job].base;
  const tabs = ["villager", ...(base ? [base] : []), ...(me.job !== "villager" ? [me.job] : [])];
  if (!tabs.includes(skillTab)) skillTab = tabs[tabs.length - 1];
  $("skTabs").innerHTML = tabs.map((j) => `<button type="button" class="sk-tab${j === skillTab ? " sel" : ""}" data-j="${j}" style="--jc:${J[j].color}">
    <b>${J[j].en}</b><small>${J[j].name}</small></button>`).join("") +
    (me.job === "villager" ? `<span class="sk-lockjob">เปลี่ยนอาชีพที่ Lv.${gameData.jobChangeLevel} เพื่อเปิดสกิลอาชีพ</span>` : !base ? `<span class="sk-lockjob">อาชีพขั้น 2 เปิดที่ Lv.${gameData.job2Level || 50}</span>` : "");
  $("skTabs").querySelectorAll("button").forEach((b) => (b.onclick = () => { skillTab = b.dataset.j; renderSkills(); }));
  const rows = gameData.skillTree[skillTab] || [];
  $("skBody").innerHTML = rows.map((row, ri) => `<div class="sk-row"><div class="sk-tier">${ROMAN[ri]}</div><div class="sk-cells">` +
    row.map((k) => {
      const s = S[k], L = skLv(k), maxed = L >= s.max;
      const reqOk = !s.req || skLv(s.req[0]) >= s.req[1];
      const can = !maxed && reqOk && mySkillData.points > 0;
      const sub = s.req ? `↳ ${S[s.req[0]].name} ${s.req[1]}` : s.passive ? "ติดตัว" : `SP ${s.sps[Math.max(0, L - 1)]}`;
      return `<div class="sk-cell${L ? "" : " off"}${reqOk ? "" : " locked"}" data-k="${k}" tabindex="0">${skIcon(s)}
        <div class="sk-txt"><b>${s.name}</b><small class="${reqOk ? "" : "bad"}">${sub}</small></div>
        <em class="sk-lv">${L}/${s.max}</em>
        <button type="button" class="sk-up" data-k="${k}" ${can ? "" : "disabled"} aria-label="อัป ${s.name}">+</button></div>`;
    }).join("") + `</div></div>`).join("");
  $("skBody").querySelectorAll(".sk-up").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); room.send("learnSkill", { skill: b.dataset.k }); }));
  $("skBody").querySelectorAll(".sk-cell").forEach((c) => {
    const show = () => skillInfo(c.dataset.k);
    c.onclick = show; c.onfocus = show; c.onpointerenter = show;
    const s = S[c.dataset.k];
    if (!s.passive && skLv(c.dataset.k) > 0) { // ลากไปวางในแถบสกิลได้
      c.draggable = true;
      c.addEventListener("dragstart", (e) => { dragData = { from: "skill", key: c.dataset.k }; e.dataTransfer.setData("text/plain", c.dataset.k); });
      c.addEventListener("dragend", () => (dragData = null));
    }
    if (typeof skBar === "function" && skBar().includes(c.dataset.k)) c.classList.add("on-bar");
  });
  skillInfo(panel._sel && rows.flat().includes(panel._sel) ? panel._sel : rows[0] && rows[0][0]);
}
// คำอธิบายสกิลที่เลือก (เลเวลปัจจุบัน → ถัดไป)
function skillInfo(k) {
  const s = gameData.skills[k], box = $("skInfo");
  if (!s || !box) return;
  $("skillPanel")._sel = k;
  const L = skLv(k);
  const cur = L ? `<div class="sk-now"><b>Lv.${L}</b> ${s.descs[L - 1]}</div>` : `<div class="sk-now off">ยังไม่ได้เรียน</div>`;
  const next = L < s.max ? `<div class="sk-next"><b>Lv.${L + 1}</b> ${s.descs[L]}${s.sps.length ? ` · SP ${s.sps[L]}` : ""}</div>` : `<div class="sk-next max">เลเวลสูงสุดแล้ว</div>`;
  const req = s.req ? `<div class="${skLv(s.req[0]) >= s.req[1] ? "ok" : "bad"}">ต้องมี ${gameData.skills[s.req[0]].name} Lv.${s.req[1]}</div>` : "";
  const kind = s.passive ? "สกิลติดตัว (ทำงานเองตลอด)" : `${s.target === "self" ? "ใช้กับตัวเอง" : s.target === "ally" ? "ฮีลเพื่อน/ตัวเอง" : "ใช้กับมอน"} · คูลดาวน์ ${s.cooldown / 1000} วิ`;
  const onBar = typeof skBar === "function" && skBar().includes(k);
  const barBtn = !s.passive && L > 0 ? `<button type="button" class="${onBar ? "btn-ghost" : "btn-gold"} sk-bar-btn" id="skBarBtn">${onBar ? "➖ เอาออกจากแถบสกิล" : "➕ ใส่แถบสกิล"}</button><small class="sk-bar-hint">${onBar ? "อยู่ในแถบ = AUTO ใช้สกิลนี้" : "ไม่อยู่ในแถบ = AUTO ไม่ใช้"} · ลากสกิลไปวางที่แถบ 1–9 ได้</small>` : "";
  box.innerHTML = `<div class="sk-head">${skIcon(s, "sk-ic big")}<div><h4>${s.name}</h4><small>${kind}</small></div></div>${req}${cur}${next}${barBtn}`;
  if ($("skBarBtn")) $("skBarBtn").onclick = () => { if (onBar) skBarRemove(k); else skBarPut(k); $("skillPanel")._sel = k; };
}
(() => {
  $("skillBtn").onclick = () => toggleSkills();
  $("skClose").onclick = () => toggleSkills(false);
  setInterval(() => { const p = $("skillPanel"); if (p) document.body.classList.toggle("sk-edit", !p.hidden); }, 400);
  window.addEventListener("keydown", (e) => { if (!isTyping() && (e.key === "k" || e.key === "K")) toggleSkills(); });
})();
