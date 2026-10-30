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
      $("msgColor").textContent = "¡Listo! Tu página ya usa el color " + nombre + ".";
      $("msgColor").className = "msg ok";
    };
    $("colores").appendChild(b);
  });
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
  const { data } = await db.from("negocios").select("*").eq("owner", user.id).maybeSingle();
  if (!data) return ver("crear");
  negocio = data;
  const link = location.origin + "/?n=" + negocio.slug;
  $("miLink").textContent = negocio.nombre + " · " + link;
  $("copiar").onclick = () => { navigator.clipboard.writeText(link); $("copiar").textContent = "¡Copiado!"; };
  $("filtro").value = new Date().toLocaleDateString("sv-SE");
  ver("panel");
  pintarColores();
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
    b.onclick = async () => { if (confirm("¿Cancelar este turno?")) { await db.from("turnos").delete().eq("id", t.id); cargarTurnos(); } };
    acciones.appendChild(ok);
    acciones.appendChild(b);
    fila.appendChild(acciones);
    $("lista").appendChild(fila);
  });
}

$("entrar").addEventListener("click", entrar);
$("guardar").addEventListener("click", guardar);
$("filtro").addEventListener("change", cargarTurnos);
$("salir").addEventListener("click", async () => { await db.auth.signOut(); ver("login"); });
db.auth.onAuthStateChange(() => iniciar());
iniciar();
