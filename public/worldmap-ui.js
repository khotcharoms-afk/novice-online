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
    b.onclick = () => { wmSel = m.id; renderWorld(); };
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
    ${m.mobs.length ? `<h4>มอนสเตอร์และของดรอป</h4>${mobs}` : ""}
    ${m.services.length ? `<h4>บริการ</h4>${m.services.map((s) => `<div class="row">${s}</div>`).join("")}` : ""}
    <h4>เชื่อมต่อกับ</h4><div class="links">${m.exits.map((id) => { const x = byId(id); return `<button type="button" data-go="${id}">${x.name}<small>${x.lv ? `Lv.${x.lv[0]}–${x.lv[1]}` : "ปลอดภัย"}</small></button>`; }).join("")}</div>
    <p class="hint">เดินทาง: เดินไปที่วงเวทสีฟ้าที่ขอบแผนที่ (ดูจุดสีฟ้าบนมินิแมพ)</p>`;
  $("wmInfo").querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { wmSel = b.dataset.go; renderWorld(); }));
}
function setupWorldUI() {
  $("worldBtn").onclick = () => toggleWorld();
  $("wmClose").onclick = () => toggleWorld(false);
  window.addEventListener("keydown", (e) => {
    if (isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" || e.key === "M") toggleWorld();
    if (e.key === "Escape") toggleWorld(false);
  });
}
