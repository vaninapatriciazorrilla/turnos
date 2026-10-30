// Panel: el comercio entra con su email, crea su negocio y ve/cancela turnos.
const $ = (id) => document.getElementById(id);
let negocio = null;

// Evita que un texto escrito por un cliente se ejecute como código
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Colores que puede elegir cada comercio para su página
const COLORES = [["Salvia", "#8FA58C"], ["Rosa", "#C9A0A0"], ["Terracota", "#C47A5A"], ["Petróleo", "#4F7A86"], ["Dorado", "#B8975A"], ["Grafito", "#6B6B6B"]];

function pintarColores() {
  const actual = negocio.color || "#8FA58C";
  document.documentElement.style.setProperty("--acc", actual);
  $("colores").innerHTML = "";
  COLORES.forEach(([nombre, hex]) => {
    const b = document.createElement("button");
    b.className = "dia" + (hex.toLowerCase() === actual.toLowerCase() ? " sel" : "");
    b.style.cssText = "width:auto;padding:8px 12px;display:flex;align-items:center;gap:6px";
    b.innerHTML = `<span style="width:18px;height:18px;border-radius:50%;background:${hex};border:2px solid #fff"></span><small>${nombre}</small>`;
    b.onclick = async () => {
      const { error } = await db.from("negocios").update({ color: hex }).eq("id", negocio.id);
      if (error) { $("msgColor").textContent = "No se pudo guardar. Probá de nuevo."; $("msgColor").className = "msg err"; return; }
      negocio.color = hex;
      pintarColores();
      hacerQR(location.origin + "/?n=" + negocio.slug);
      $("msgColor").textContent = "¡Listo! Tu página ya usa el color " + nombre + ".";
      $("msgColor").className = "msg ok";
    };
    $("colores").appendChild(b);
  });
}

// Cartel con QR para imprimir: nombre del comercio + QR del link de reservas
function hacerQR(link) {
  const c = $("qr"), x = c.getContext("2d"), W = 1080, H = 1350;
  c.width = W; c.height = H;
  const acc = negocio.color || "#8FA58C";
  x.fillStyle = "#EDEAE6"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#FFFFFF"; x.beginPath(); x.roundRect(70, 70, W - 140, H - 140, 50); x.fill();
  x.textAlign = "center"; x.fillStyle = "#3A3A3A";
  x.font = "600 70px Montserrat, Arial, sans-serif"; x.fillText(negocio.nombre, W / 2, 230, W - 220);
  x.fillStyle = acc; x.font = "italic 54px Georgia, serif"; x.fillText("Reservá tu turno", W / 2, 320);
  const q = qrcode(0, "M"); q.addData(link); q.make();
  const n = q.getModuleCount(), lado = 640, t = lado / n, ox = (W - lado) / 2, oy = 400;
  x.fillStyle = "#3A3A3A";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(ox + k * t, oy + r * t, Math.ceil(t), Math.ceil(t));
  x.fillStyle = "#8A8580"; x.font = "500 40px Montserrat, Arial, sans-serif";
  x.fillText("Escaneá con la cámara del celular", W / 2, 1150);
  x.fillStyle = acc; x.fillRect(W / 2 - 60, 1190, 120, 6);
  $("bajarQR").onclick = () => {
    const a = document.createElement("a");
    a.download = "qr-" + negocio.slug + ".png"; a.href = c.toDataURL("image/png"); a.click();
  };
}

// Editar datos del negocio desde el panel
const NOM_DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
let diasEd = [];

function pintarDias() {
  $("eDias").innerHTML = "";
  [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
    const b = document.createElement("button");
    b.className = "dia" + (diasEd.includes(d) ? " sel" : "");
    b.innerHTML = `<small>${NOM_DIAS[d]}</small>`;
    b.onclick = () => { diasEd = diasEd.includes(d) ? diasEd.filter((x) => x !== d) : [...diasEd, d]; pintarDias(); };
    $("eDias").appendChild(b);
  });
}

function llenarEdicion() {
  $("eNombre").value = negocio.nombre; $("eRubro").value = negocio.rubro || "";
  $("eWhats").value = negocio.whatsapp || ""; $("eServ").value = negocio.servicios.join(", ");
  $("eIni").value = negocio.hora_inicio.slice(0, 5); $("eFin").value = negocio.hora_fin.slice(0, 5);
  $("eDur").value = negocio.duracion_min; diasEd = [...negocio.dias];
  pintarDias();
}

async function guardarEdicion() {
  const m = $("msgEd");
  const cambios = {
    nombre: $("eNombre").value.trim(), rubro: $("eRubro").value.trim(), whatsapp: waNum($("eWhats").value),
    servicios: $("eServ").value.split(",").map((s) => s.trim()).filter(Boolean),
    hora_inicio: $("eIni").value, hora_fin: $("eFin").value, duracion_min: Number($("eDur").value) || 30,
    dias: diasEd.sort(),
  };
  if (!cambios.nombre) { m.textContent = "Poné el nombre del comercio."; m.className = "msg err"; return; }
  if (!cambios.dias.length) { m.textContent = "Elegí al menos un día."; m.className = "msg err"; return; }
  if (cambios.hora_fin <= cambios.hora_inicio) { m.textContent = "La hora de cierre tiene que ser después de la de apertura."; m.className = "msg err"; return; }
  if (!cambios.servicios.length) cambios.servicios = ["Turno general"];
  const { error } = await db.from("negocios").update(cambios).eq("id", negocio.id);
  if (error) { m.textContent = "No se pudo guardar. Probá de nuevo."; m.className = "msg err"; return; }
  Object.assign(negocio, cambios);
  const link = location.origin + "/?n=" + negocio.slug;
  $("miLink").textContent = negocio.nombre + " · " + link;
  hacerQR(link);
  m.textContent = "¡Listo! Tus clientes ya ven los cambios."; m.className = "msg ok";
}

// Logo: se sube a Supabase Storage en la carpeta del dueño
let usuario = null;

function pintarLogo() {
  $("logoPrev").classList.toggle("oculto", !negocio.logo);
  if (negocio.logo) $("logoPrev").src = negocio.logo;
}

async function subirLogo() {
  const f = $("logoArch").files[0], m = $("msgLogo");
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { m.textContent = "La imagen pesa mucho (máx. 2 MB)."; m.className = "msg err"; return; }
  m.textContent = "Subiendo…"; m.className = "msg ok";
  const ruta = usuario.id + "/logo-" + Date.now() + "." + (f.name.split(".").pop() || "png");
  const { error } = await db.storage.from("logos").upload(ruta, f, { upsert: true });
  if (error) { m.textContent = "No se pudo subir. Probá de nuevo."; m.className = "msg err"; return; }
  const url = db.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
  const { error: e2 } = await db.from("negocios").update({ logo: url }).eq("id", negocio.id);
  if (e2) { m.textContent = "No se pudo guardar. Probá de nuevo."; m.className = "msg err"; return; }
  negocio.logo = url; pintarLogo();
  m.textContent = "¡Listo! Tu logo ya aparece en tu página."; m.className = "msg ok";
}

// Días cerrados: el cliente no los ve para reservar
function pintarBloqueos() {
  const hoy = new Date().toLocaleDateString("sv-SE");
  const lista = (negocio.bloqueos || []).filter((f) => f >= hoy).sort();
  $("bloqLista").innerHTML = lista.length ? "" : '<p class="sub">No tenés días cerrados.</p>';
  lista.forEach((f) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.innerHTML = `${f.split("-").reverse().join("/")} <button title="Abrir de nuevo">✕</button>`;
    c.querySelector("button").onclick = () => guardarBloqueos(lista.filter((x) => x !== f));
    $("bloqLista").appendChild(c);
  });
}

async function guardarBloqueos(lista) {
  const { error } = await db.from("negocios").update({ bloqueos: lista }).eq("id", negocio.id);
  if (error) { alert("No se pudo guardar. Probá de nuevo."); return; }
  negocio.bloqueos = lista; pintarBloqueos();
}

function bloquear() {
  const f = $("bloqFecha").value;
  if (!f || (negocio.bloqueos || []).includes(f)) return;
  guardarBloqueos([...(negocio.bloqueos || []), f]);
}

function ver(seccion) {
  ["login", "crear", "panel"].forEach((s) => $(s).classList.toggle("oculto", s !== seccion));
}

function slugify(t) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function entrar() {
  const email = $("email").value.trim();
  if (!email) return;
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  $("msgLogin").textContent = error ? "No se pudo enviar. Revisá el email." : "Te mandamos un link. Abrilo desde este celular.";
  $("msgLogin").className = "msg " + (error ? "err" : "ok");
}

async function iniciar() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return ver("login");
  usuario = user;
  const { data } = await db.from("negocios").select("*").eq("owner", user.id).maybeSingle();
  if (!data) return ver("crear");
  negocio = data;
  const link = location.origin + "/?n=" + negocio.slug;
  $("miLink").textContent = negocio.nombre + " · " + link;
  $("copiar").onclick = () => { navigator.clipboard.writeText(link); $("copiar").textContent = "¡Copiado!"; };
  const invitacion = `¡Ya podés reservar tu turno en ${negocio.nombre} online! 👉 ${link}`;
  $("compartirWA").onclick = () => window.open("https://wa.me/?text=" + encodeURIComponent(invitacion), "_blank");
  $("compartir").onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: negocio.nombre, text: invitacion, url: link }); } catch (e) {} }
    else { navigator.clipboard.writeText(link); $("compartir").textContent = "Link copiado: pegalo en tu bio"; }
  };
  resumenHoy();
  $("filtro").value = new Date().toLocaleDateString("sv-SE");
  ver("panel");
  pintarColores();
  hacerQR(link);
  llenarEdicion();
  pintarLogo();
  pintarBloqueos();
  cargarTurnos();
}

async function guardar() {
  const nombre = $("nNombre").value.trim();
  if (!nombre) return;
  const nuevo = {
    nombre, slug: slugify(nombre) + "-" + Math.random().toString(36).slice(2, 6),
    rubro: $("nRubro").value.trim(), whatsapp: waNum($("nWhats").value),
    servicios: $("nServ").value.split(",").map((s) => s.trim()).filter(Boolean),
    hora_inicio: $("nIni").value, hora_fin: $("nFin").value, duracion_min: Number($("nDur").value) || 30,
  };
  if (!nuevo.servicios.length) nuevo.servicios = ["Turno general"];
  const { error } = await db.from("negocios").insert(nuevo);
  if (error) { $("msgCrear").textContent = "No se pudo crear. Probá de nuevo."; $("msgCrear").className = "msg err"; return; }
  iniciar();
}

// Resumen arriba: cuántos turnos hay hoy y cuál es el próximo
async function resumenHoy() {
  const hoy = new Date().toLocaleDateString("sv-SE");
  const ahora = new Date().toTimeString().slice(0, 5);
  const { data } = await db.from("turnos").select("hora,cliente_nombre,servicio")
    .eq("negocio_id", negocio.id).eq("fecha", hoy).order("hora");
  const lista = data || [];
  const prox = lista.find((t) => t.hora.slice(0, 5) >= ahora);
  let html = `<p class="titulo" style="font-size:2rem">Hoy</p><p><strong>${lista.length ? "Tenés " + lista.length + (lista.length === 1 ? " turno" : " turnos") : "No tenés turnos hoy"}</strong></p>`;
  if (prox) html += `<p class="sub">Próximo: ${prox.hora.slice(0, 5)} · ${esc(prox.cliente_nombre)} (${esc(prox.servicio)})</p>`;
  $("hoy").innerHTML = html;
}

async function cargarTurnos() {
  const { data } = await db.from("turnos").select("*")
    .eq("negocio_id", negocio.id).eq("fecha", $("filtro").value).order("hora");
  if (!data || !data.length) { $("lista").innerHTML = '<p class="sub" style="margin-top:12px">No hay turnos este día.</p>'; return; }
  $("lista").innerHTML = "";
  data.forEach((t) => {
    const fila = document.createElement("div");
    fila.className = "turno";
    fila.innerHTML = `<div><strong>${t.hora.slice(0, 5)}</strong> · ${esc(t.cliente_nombre)}<br><span class="sub">${esc(t.servicio)} · <a href="https://wa.me/${waNum(t.cliente_tel)}" target="_blank">${esc(t.cliente_tel)}</a></span></div>`;
    const acciones = document.createElement("div");
    acciones.style.cssText = "display:flex;flex-direction:column;gap:6px";
    const fechaTxt = t.fecha.split("-").reverse().join("/");
    const txt = encodeURIComponent(`Hola ${t.cliente_nombre}! Te confirmo tu turno en ${negocio.nombre} el ${fechaTxt} a las ${t.hora.slice(0, 5)} (${t.servicio}). ¡Te esperamos!`);
    const ok = document.createElement("a");
    ok.href = `https://wa.me/${waNum(t.cliente_tel)}?text=${txt}`;
    ok.target = "_blank";
    ok.textContent = "Confirmar";
    ok.style.cssText = "padding:8px 12px;border-radius:10px;background:#22c55e;color:#052e16;font-weight:700;font-size:.85rem;text-align:center;text-decoration:none";
    const b = document.createElement("button");
    b.textContent = "Cancelar";
    b.onclick = async () => { if (confirm("¿Cancelar este turno?")) { await db.from("turnos").delete().eq("id", t.id); cargarTurnos(); resumenHoy(); } };
    acciones.appendChild(ok);
    acciones.appendChild(b);
    fila.appendChild(acciones);
    $("lista").appendChild(fila);
  });
}

$("entrar").addEventListener("click", entrar);
$("guardar").addEventListener("click", guardar);
$("filtro").addEventListener("change", cargarTurnos);
$("guardarEd").addEventListener("click", guardarEdicion);
$("logoArch").addEventListener("change", subirLogo);
$("bloquear").addEventListener("click", bloquear);
$("salir").addEventListener("click", async () => { await db.auth.signOut(); ver("login"); });
db.auth.onAuthStateChange(() => iniciar());
iniciar();
