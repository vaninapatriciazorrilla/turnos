// Página pública: el cliente elige día y horario y reserva.
// El link de cada comercio es: tusitio.netlify.app/?n=slug-del-negocio
const $ = (id) => document.getElementById(id);
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_VER = 14; // cuántos días hacia adelante se muestran
let negocio = null;
let fechaElegida = null;
let horaElegida = null;
let libresPorDia = {};

function mostrar(texto, tipo) {
  $("msg").textContent = texto;
  $("msg").className = "msg " + tipo;
}

// Color de acento del comercio (si no eligió, verde salvia)
function aplicarColor(hex) {
  const c = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#8FA58C";
  document.documentElement.style.setProperty("--acc", c);
}

async function cargarNegocio() {
  const slug = new URLSearchParams(location.search).get("n");
  if (!slug) { $("nombre").textContent = "Falta el link del comercio"; $("form").classList.add("oculto"); return; }
  const { data, error } = await db.from("negocios").select("*").eq("slug", slug).single();
  if (error || !data) { $("nombre").textContent = "Comercio no encontrado"; $("form").classList.add("oculto"); return; }
  negocio = data;
  aplicarColor(data.color);
  document.title = "Turnos · " + data.nombre;
  $("nombre").textContent = data.nombre;
  $("rubro").textContent = data.rubro || "Reservá tu turno online";
  $("servicio").innerHTML = data.servicios.map((s) => `<option>${esc(s)}</option>`).join("");
  cargarDias();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function generarHorarios() {
  const res = [];
  const [hi, mi] = negocio.hora_inicio.split(":").map(Number);
  const [hf, mf] = negocio.hora_fin.split(":").map(Number);
  for (let m = hi * 60 + mi; m + negocio.duracion_min <= hf * 60 + mf; m += negocio.duracion_min) {
    res.push(String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"));
  }
  return res;
}

async function horasLibres(fecha) {
  const { data } = await db.rpc("horas_ocupadas", { p_negocio: negocio.id, p_fecha: fecha });
  const ocupadas = (data || []).map((h) => (typeof h === "string" ? h : h.horas_ocupadas).slice(0, 5));
  const ahora = new Date();
  return generarHorarios().filter((h) => !ocupadas.includes(h) && new Date(fecha + "T" + h) > ahora);
}

// Fila de botones con los próximos días; los que no tienen lugar quedan apagados
async function cargarDias() {
  const fechas = [];
  for (let i = 0; i < DIAS_VER; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    if (negocio.dias.includes(d.getDay())) fechas.push(d);
  }
  const libres = await Promise.all(fechas.map((d) => horasLibres(d.toLocaleDateString("sv-SE"))));
  $("dias").innerHTML = "";
  libresPorDia = {};
  fechas.forEach((d, i) => {
    const f = d.toLocaleDateString("sv-SE");
    libresPorDia[f] = libres[i];
    const b = document.createElement("button");
    b.className = "dia";
    b.innerHTML = `<small>${DIAS[d.getDay()]}</small><b>${d.getDate()}</b>`;
    b.disabled = libres[i].length === 0;
    b.onclick = () => elegirDia(f, b);
    $("dias").appendChild(b);
  });
  const primero = document.querySelector(".dia:not(:disabled)");
  if (primero) primero.click();
  else $("horas").innerHTML = '<p class="msg err">No hay más turnos disponibles por ahora.</p>';
}

function elegirDia(fecha, boton) {
  document.querySelectorAll(".dia").forEach((x) => x.classList.remove("sel"));
  boton.classList.add("sel");
  fechaElegida = fecha; horaElegida = null; validar();
  pintarHoras(libresPorDia[fecha]);
}

// Cada hora libre es su propio botón, separadas en Mañana y Tarde
function pintarHoras(libres) {
  $("horas").innerHTML = "";
  const grupos = [["Mañana", libres.filter((h) => h < "13:00")], ["Tarde", libres.filter((h) => h >= "13:00")]];
  grupos.forEach(([titulo, horas]) => {
    if (!horas.length) return;
    const t = document.createElement("p"); t.className = "grupo"; t.textContent = titulo;
    const g = document.createElement("div"); g.className = "horas";
    horas.forEach((h) => {
      const b = document.createElement("button");
      b.className = "hora"; b.textContent = h;
      b.onclick = () => {
        document.querySelectorAll(".hora").forEach((x) => x.classList.remove("sel"));
        b.classList.add("sel"); horaElegida = h; validar();
      };
      g.appendChild(b);
    });
    $("horas").append(t, g);
  });
  if (libres.length && libres.length <= 3) {
    const u = document.createElement("span");
    u.className = "ultimos"; u.textContent = "¡Últimos turnos de este día!";
    $("horas").appendChild(u);
  }
}

function validar() {
  $("reservar").disabled = !(fechaElegida && horaElegida && $("cliente").value.trim() && $("tel").value.trim());
}

async function reservar() {
  $("reservar").disabled = true;
  const turno = {
    negocio_id: negocio.id, fecha: fechaElegida, hora: horaElegida,
    servicio: $("servicio").value, cliente_nombre: $("cliente").value.trim(), cliente_tel: $("tel").value.trim(),
  };
  const { error } = await db.from("turnos").insert(turno);
  if (error) {
    mostrar(error.code === "23505" ? "Ese horario se acaba de ocupar. Elegí otro." : "No se pudo reservar. Probá de nuevo.", "err");
    cargarDias(); return;
  }
  const fechaTxt = turno.fecha.split("-").reverse().join("/");
  mostrar(`¡Listo! Tu turno en ${negocio.nombre} quedó reservado para el ${fechaTxt} a las ${turno.hora}.`, "ok");
  // Link para que el cliente agende el turno en su Google Calendar (con su recordatorio)
  const ini = new Date(turno.fecha + "T" + turno.hora + ":00Z");
  const fin = new Date(ini.getTime() + negocio.duracion_min * 60000);
  const gcal = (d) => d.toISOString().slice(0, 19).replace(/[-:]/g, "");
  const cal = document.createElement("a");
  cal.href = "https://calendar.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(`Turno en ${negocio.nombre} (${turno.servicio})`)
    + "&dates=" + gcal(ini) + "/" + gcal(fin)
    + "&ctz=America/Argentina/Buenos_Aires";
  cal.target = "_blank";
  cal.textContent = "Agregar a mi calendario";
  cal.style.display = "block"; cal.style.marginTop = "8px";
  $("msg").appendChild(cal);
  if (negocio.whatsapp) {
    const txt = encodeURIComponent(`Hola ${negocio.nombre}! Soy ${turno.cliente_nombre}. Reservé un turno para el ${fechaTxt} a las ${turno.hora} (${turno.servicio}).`);
    const a = document.createElement("a");
    a.href = `https://wa.me/${waNum(negocio.whatsapp)}?text=${txt}`;
    a.target = "_blank";
    a.textContent = `Confirmarle a ${negocio.nombre} por WhatsApp (opcional)`;
    a.style.display = "block"; a.style.marginTop = "8px";
    $("msg").appendChild(a);
  }
  cargarDias();
}

$("cliente").addEventListener("input", validar);
$("tel").addEventListener("input", validar);
$("reservar").addEventListener("click", reservar);
cargarNegocio();
