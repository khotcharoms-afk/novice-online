// =============================================================
//  เปลี่ยนอาชีพ: หน้าต่างครูฝึกอาชีพ · ตัวติดตามเควส · บัฟที่กำลังทำงาน
//  (ใช้ตัวแปร room, gameData, INV, $ จาก game.js / items-ui.js)
// =============================================================
let myQuest = null, jobSel = null, jobAnim = null, jobFrame = 0;
const JOB_ORDER = ["guardian", "slayer", "hunter", "mage", "healer"];
// ชุดตัวอย่างที่แสดงในหน้าต่าง (ชุด Lv20 ของแต่ละอาชีพ)
const JOB_PREVIEW = {
  guardian: "shoes:plateboots,armor:plate,gloves:gauntlets,head:greathelm,weapon:saber,offhand:shield_knight",
  slayer: "shoes:ironboots,armor:chain,gloves:bracers,head:mailcoif,weapon:greatsword",
  hunter: "shoes:ranger_boots,armor:ranger_vest,gloves:ranger_gloves,head:ranger_cap,weapon:bow_hunter",
  mage: "shoes:mage_shoes,armor:mage_robe,gloves:mage_gloves,head:mage_hat,weapon:staff_oak",
  healer: "shoes:priest_shoes,armor:priest_robe,gloves:priest_gloves,head:priest_hood,weapon:book_light",
};
const jq = () => gameData && gameData.jobQuests;

function openJob() {
  closeShop(); closeSmith();
  const me = myPlayer();
  jobSel = myQuest ? myQuest.job : me && me.job !== "villager" ? me.job : jobSel || "guardian";
  $("jobPanel").hidden = false;
  renderJob();
  clearInterval(jobAnim);
  jobAnim = setInterval(() => { if ($("jobPanel").hidden) { clearInterval(jobAnim); return; } jobFrame = (jobFrame + 1) % 8; drawJobPreview(); }, 120);
}
function closeJob() { const p = $("jobPanel"); if (p) p.hidden = true; clearInterval(jobAnim); }

function drawJobPreview() {
  const cv = $("jobPreview"), me = myPlayer();
  if (!cv || !me) return;
  const row = [2, 3, 0, 1][Math.floor(Date.now() / 2400) % 4];
  drawLook(cv, me.look, jobSel, 1 + jobFrame, row, JOB_PREVIEW[jobSel]);
}

function renderJob() {
  const panel = $("jobPanel");
  if (!panel || panel.hidden || !gameData || !gameData.jobs) return;
  const me = myPlayer();
  if (!me) return;
  const J = gameData.jobs, Q = jq();
  const villager = me.job === "villager", lvOk = me.level >= gameData.jobChangeLevel;
  // แถบเลือกอาชีพ
  $("jobTabs").innerHTML = JOB_ORDER.map((j) => `<button type="button" class="job-tab${j === jobSel ? " sel" : ""}${myQuest && myQuest.job === j ? " active" : ""}" data-j="${j}" style="--jc:${J[j].color}">
      <b>${J[j].name}</b><small>${J[j].role}</small></button>`).join("");
  $("jobTabs").querySelectorAll("button").forEach((b) => (b.onclick = () => { jobSel = b.dataset.j; renderJob(); }));
  const j = J[jobSel], q = Q[jobSel];
  const wnames = (j.weapons || []).map((w) => gameData.weaponTypes[w].name).join(" / ");
  const armor = (j.armor || []).map((a) => gameData.armorName[a]).join(" / ");
  const sk = (gameData.jobSkills[jobSel] || []).map((k) => gameData.skills[k]).filter(Boolean)
    .map((s) => `<li><b>${s.name}</b> <span class="sp">SP ${s.sp}</span><br><small>${s.desc}</small></li>`).join("");
  const rec = Object.entries(j.rec).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k.toUpperCase()).join(" > ");
  // ส่วนเควส
  let quest = "";
  const mob = gameData.mobs[q.kill[0]], item = itemOf(q.item[0]), reward = itemOf(q.reward);
  if (!villager) {
    quest = me.job === jobSel ? `<div class="job-done">✔ คุณเป็น${j.name}แล้ว</div>` : `<div class="job-note">คุณเป็น${J[me.job].name}แล้ว (เปลี่ยนอาชีพได้ครั้งเดียว)</div>`;
  } else {
    const kills = myQuest && myQuest.job === jobSel ? myQuest.kills : 0;
    const have = countItem(q.item[0]);
    const active = myQuest && myQuest.job === jobSel;
    const row = (icon, txt, cur, need) => `<div class="qrow${cur >= need ? " ok" : ""}">${icon}<span>${txt}</span><b>${active || icon.includes("icons") ? `${Math.min(cur, need)}/${need}` : need}</b></div>`;
    quest = `<h4>บททดสอบ${j.name}</h4><p class="story">“${q.story}”</p>
      ${row(`<i class="qi">⚔</i>`, `ปราบ${mob.name} (Lv.${mob.level}) · ${q.where}`, kills, q.kill[1])}
      ${row(`<img src="${ICON(q.item[0])}" alt="">`, `นำ${item.name}มา`, have, q.item[1])}
      <div class="qrow reward"><img src="${ICON(q.reward)}" alt=""><span>รางวัล: ${reward.name} + คืนแต้มสเตตัสทั้งหมดให้ลงใหม่</span></div>`;
    let btns;
    if (!lvOk) btns = `<div class="need">ต้องเลเวล ${gameData.jobChangeLevel} ขึ้นไป (ตอนนี้ Lv.${me.level})</div>`;
    else if (!myQuest) btns = `<button type="button" class="btn-gold" id="jobStart">รับบททดสอบ${j.name}</button>`;
    else if (!active) btns = `<div class="job-note">กำลังทำบททดสอบ${J[myQuest.job].name}อยู่ — ยกเลิกก่อนถึงจะเปลี่ยนไปทำอันนี้ได้</div>`;
    else {
      const done = kills >= q.kill[1] && have >= q.item[1];
      btns = `<button type="button" class="btn-gold" id="jobFinish" ${done ? "" : "disabled"}>${done ? `ส่งบททดสอบ → เป็น${j.name}` : "ยังทำไม่ครบ"}</button>
        <button type="button" class="btn-ghost danger" id="jobCancel">ยกเลิกบททดสอบ</button>`;
    }
    quest += `<div class="job-acts">${btns}</div>`;
  }
  $("jobBody").innerHTML = `<div class="job-left"><canvas id="jobPreview" width="64" height="64"></canvas>
      <div class="job-name" style="color:${j.color}">${j.name}<small>${j.en}</small></div></div>
    <div class="job-info"><p>${j.desc}</p>
      <div class="job-tags"><span>อาวุธ: ${wnames}${j.shield ? " + โล่" : ""}</span><span>ชุด: ${armor}</span><span>ค่าแนะนำ: ${rec}</span></div>
      <h4>สกิล</h4><ul class="job-skills">${sk}</ul>${quest}</div>`;
  drawJobPreview();
  const go = (act, extra) => room.send("jobQuest", { act, ...extra });
  if ($("jobStart")) $("jobStart").onclick = () => go("start", { job: jobSel });
  if ($("jobFinish")) $("jobFinish").onclick = async () => {
    if (await askConfirm(`เปลี่ยนเป็น<b>${j.name}</b>?<br><small>เปลี่ยนอาชีพได้ครั้งเดียว · แต้มสเตตัสจะคืนให้ลงใหม่ทั้งหมด · อุปกรณ์ที่อาชีพใหม่ใส่ไม่ได้จะถูกถอดเข้ากระเป๋า</small>`, { okText: "เปลี่ยนอาชีพ" })) go("finish");
  };
  if ($("jobCancel")) $("jobCancel").onclick = async () => { if (await askConfirm("ยกเลิกบททดสอบนี้? (จำนวนที่ปราบไว้จะหายไป)", { okText: "ยกเลิก", danger: true })) go("cancel"); };
}
const countItem = (id) => (INV.inv || []).reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0);

function onQuest(q) { myQuest = q; renderQuestTrack(); renderJob(); }
function renderQuestTrack() {
  const el = $("questTrack");
  if (!el || !gameData || !gameData.jobQuests) return;
  if (!myQuest) { el.hidden = true; return; }
  const Q = gameData.jobQuests[myQuest.job], J = gameData.jobs[myQuest.job];
  const have = countItem(Q.item[0]);
  const ok = (a, b) => (a >= b ? " class=\"ok\"" : "");
  el.hidden = false;
  el.innerHTML = `<b style="color:${J.color}">บททดสอบ${J.name}</b>
    <div${ok(myQuest.kills, Q.kill[1])}>${gameData.mobs[Q.kill[0]].name} ${Math.min(myQuest.kills, Q.kill[1])}/${Q.kill[1]}</div>
    <div${ok(have, Q.item[1])}>${itemOf(Q.item[0]).name} ${Math.min(have, Q.item[1])}/${Q.item[1]}</div>
    ${myQuest.kills >= Q.kill[1] && have >= Q.item[1] ? `<div class="ok">✔ กลับไปหาปู่ธาราจารย์ที่เมือง</div>` : ""}`;
}
function onJobChanged(d) {
  myQuest = null;
  renderQuestTrack();
  const J = gameData.jobs[d.job];
  setTimeout(() => {
    buildSkillBar(); renderJob(); renderStats && renderStats();
    toast(`ยินดีด้วย! คุณเป็น${J.name}แล้ว${d.reward ? ` · ได้รับ ${itemOf(d.reward).name} (ดูในกระเป๋า)` : ""} · ลงแต้มสเตตัสใหม่ได้เลย`);
    if (d.stripped && d.stripped.length) addChat("system", `ถอดอุปกรณ์ที่${J.name}ใส่ไม่ได้เข้ากระเป๋า: ${d.stripped.join(", ")}`);
  }, 300);
}

// ---------- บัฟที่กำลังทำงาน ----------
const myBuffs = {};
function onBuff({ key, ms }) {
  myBuffs[key] = performance.now() + ms;
  renderBuffs();
}
function renderBuffs() {
  const el = $("buffBar");
  if (!el) return;
  const t = performance.now(), B = (gameData && gameData.buffs) || {};
  const live = Object.entries(myBuffs).filter(([, u]) => u > t);
  el.innerHTML = live.map(([k, u]) => `<span class="buff">${(B[k] && B[k].name) || k} <b>${Math.ceil((u - t) / 1000)}</b></span>`).join("");
  el.hidden = !live.length;
}
setInterval(renderBuffs, 500);

(() => {
  const c = $("jobClose");
  if (c) c.onclick = closeJob;
})();
