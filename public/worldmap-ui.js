// =============================================================
//  หน้าต่างแผนที่โลก (กด M หรือปุ่ม 🗺 ที่มินิแมพ)
//  ข้อมูลจาก /api/world (WORLD) · แผนที่ปัจจุบัน = room.mapId
// =============================================================
let wmSel = null;
function lvClass(m) {
  if (m.type === "town") return "town";
  const me = room && room.state.players.get(room.sessionId), lv = me ? me.level : 1;
  if (lv > m.lv[1]) return "easy";
  if (lv >= m.lv[0] - 2) return "ok";
  return lv >= m.lv[0] - 8 ? "hard" : "hard";
}
function toggleWorld(force) {
  const p = $("worldPanel"), open = force ?? p.hidden;
  p.hidden = !open;
  if (open) { wmSel = wmSel || room.mapId; renderWorld(); }
}
function renderWorld() {
  if (!WORLD) return;
  $("wmSub").textContent = `${WORLD.name} · ${WORLD.maps.length} โซน`;
  const pins = $("wmPins");
  pins.innerHTML = "";
  for (const m of WORLD.maps) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wm-pin" + (m.id === wmSel ? " sel" : "");
    b.style.left = m.world.x + "%"; b.style.top = m.world.y + "%";
    b.innerHTML = `${m.id === room.mapId ? '<span class="here">คุณอยู่ที่นี่</span>' : ""}<i class="dot ${lvClass(m)}"></i>
      <span class="lbl">${m.name}<small>${m.lv ? `Lv.${m.lv[0]}–${m.lv[1]}` : "ปลอดภัย"}</small></span>`;
    b.onclick = () => { wmSel = m.id; renderWorld(); const info = $("wmInfo"); if (info) { info.scrollTop = 0; if (window.innerWidth <= 900 && window.innerHeight > 600) info.scrollIntoView({ behavior: "smooth", block: "start" }); } };
    pins.appendChild(b);
  }
  const m = WORLD.maps.find((x) => x.id === wmSel) || WORLD.maps[0];
  const byId = (id) => WORLD.maps.find((x) => x.id === id);
  const items = gameData ? gameData.items : {};
  const mobs = m.mobs.map((mb) => `<div class="row"><span>${mb.name}${mb.aggressive ? '<span class="agg">ดุ</span>' : ""}</span><span class="lv">Lv.${mb.level}</span></div>
    <div class="drops">${mb.drops.map((id) => `<img src="/assets/icons/${id}.png" alt="${(items[id] || {}).name || id}" title="${(items[id] || {}).name || id}">`).join("")}</div>`).join("");
  $("wmInfo").innerHTML = `<div class="kind">${m.type === "town" ? "เมือง · ปลอดภัย" : "พื้นที่ล่ามอนสเตอร์"}</div>
    <h3>${m.name}</h3>
    <div class="tags">${m.lv ? `<span class="tag">Lv.${m.lv[0]}–${m.lv[1]}</span>` : '<span class="tag">ปลอดภัย</span>'}${m.id === room.mapId ? '<span class="tag here">คุณอยู่ที่นี่</span>' : ""}</div>
    <div>${m.desc}</div>
    <div class="wm-acts">${m.type === "town" ? `<button type="button" class="btn-gold wm-go" id="wmTp">🏠 วาปกลับเมือง <small>(ฟรี)</small></button>`
      : `<button type="button" class="btn-gold wm-go" id="wmTp">💎 วาปไปคริสตัล <small>(${tpCost(m).toLocaleString()} gold)</small></button>`}
    ${m.id !== room.mapId ? `<button type="button" class="btn-ghost wm-go" id="wmGo">🧭 เดินไปเอง <small>(${routeTo(m.id).length - 1} แผนที่)</small></button>` : ""}</div>
    ${m.mobs.length ? `<h4>มอนสเตอร์และของดรอป</h4>${mobs}` : ""}
    ${m.services.length ? `<h4>บริการ</h4>${m.services.map((s) => `<div class="row">${s}</div>`).join("")}` : ""}

    <h4>เชื่อมต่อกับ</h4><div class="links">${m.exits.map((id) => { const x = byId(id); return `<button type="button" data-go="${id}">${x.name}<small>${x.lv ? `Lv.${x.lv[0]}–${x.lv[1]}` : "ปลอดภัย"}</small></button>`; }).join("")}</div>
    <p class="hint">เดินทาง: กดวาปไปคริสตัลของแผนที่ได้ทันที (ระหว่างต่อสู้วาปไม่ได้) หรือเดินไปที่วงเวทสีฟ้าที่ขอบแผนที่</p>`;
  const tp = $("wmTp");
  if (tp) tp.onclick = () => { room.send("teleport", { map: m.id }); toggleWorld(false); };
  const go = $("wmGo");
  if (go) go.onclick = () => { startTravel(m.id); toggleWorld(false); };
  $("wmInfo").querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { wmSel = b.dataset.go; renderWorld(); }));
}
const tpCost = (m) => (m.type === "town" ? 0 : Math.max(100, Math.round((Math.pow(m.lv ? m.lv[0] : 1, 1.55) * 22) / 50) * 50)); // ตรงกับ WorldRoom.teleportCost
function setupWorldUI() {
  $("worldBtn").onclick = () => toggleWorld();
  $("wmClose").onclick = () => toggleWorld(false);
  window.addEventListener("keydown", (e) => {
    if (isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") toggleWorld();
    if (e.key === "Escape") toggleWorld(false);
  });
}

// ---------- เดินทางอัตโนมัติข้ามแผนที่ ----------
// หาเส้นทาง (BFS) ตามทางเชื่อม แล้วเดินไปวงเวทของแผนที่ถัดไปทีละแผนที่ · คลิกเดินเอง/กด WASD/เปิด AUTO = ยกเลิก
let travelTarget = null;
function routeTo(target) {
  const prev = { [room.mapId]: null }, q = [room.mapId];
  while (q.length) {
    const id = q.shift();
    if (id === target) break;
    for (const nx of (WORLD.maps.find((m) => m.id === id) || { exits: [] }).exits) if (!(nx in prev)) { prev[nx] = id; q.push(nx); }
  }
  if (!(target in prev)) return [room.mapId];
  const path = [];
  for (let at = target; at; at = prev[at]) path.unshift(at);
  return path;
}
function startTravel(target) {
  travelTarget = target;
  if (room.state.players.get(room.sessionId).auto) room.send("auto", false);
  continueTravel();
}
function stopTravel() {
  if (!travelTarget) return;
  travelTarget = null;
  renderTravelBar();
}
function continueTravel() {
  if (!travelTarget || !gameData) return renderTravelBar();
  if (room.mapId === travelTarget) {
    toast(`ถึง ${WORLD.maps.find((m) => m.id === travelTarget).name} แล้ว`);
    travelTarget = null;
    return renderTravelBar();
  }
  const path = routeTo(travelTarget), next = path[1];
  const pt = next && (gameData.portals || []).find((p) => p.to === next);
  if (!pt) { toast("ไม่พบเส้นทาง"); travelTarget = null; return renderTravelBar(); }
  room.send("moveTo", { x: (pt.box.x0 + pt.box.x1) / 2, y: (pt.box.y0 + pt.box.y1) / 2 });
  renderTravelBar(path);
}
function renderTravelBar(path) {
  let b = $("travelBar");
  if (!travelTarget) { if (b) b.hidden = true; return; }
  if (!b) { b = document.createElement("button"); b.id = "travelBar"; b.type = "button"; document.body.appendChild(b); b.onclick = () => { stopTravel(); room.send("dir", { dx: 0, dy: 0 }); }; }
  const name = (id) => (WORLD.maps.find((m) => m.id === id) || {}).name || id;
  path = path || routeTo(travelTarget);
  b.hidden = false;
  b.innerHTML = `🧭 กำลังเดินทางไป <b>${name(travelTarget)}</b> · เหลือ ${path.length - 1} แผนที่ <span>✕ ยกเลิก</span>`;
}
// กันค้าง: ถ้าหยุดเดินระหว่างเดินทาง (เช่น ทางถูกบัง) ให้สั่งเดินต่อ
setInterval(() => {
  if (!travelTarget || !room || leavingForWarp) return;
  const me = room.state.players && room.state.players.get(room.sessionId);
  if (me && !me.moving && !me.dead) continueTravel();
}, 2500);
