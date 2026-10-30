// Página pública: el cliente elige día y horario y reserva.
// El link de cada comercio es: tusitio.vercel.app/?n=slug-del-negocio
const $ = (id) => document.getElementById(id);
let negocio = null;
let horaElegida = null;

function mostrar(texto, tipo) {
  $("msg").textContent = texto;
  $("msg").className = "msg " + tipo;
}

async function cargarNegocio() {
  const slug = new URLSearchParams(location.search).get("n");
  if (!slug) { $("nombre").textContent = "Falta el link del comercio"; $("form").classList.add("oculto"); return; }
  const { data, error } = await db.from("negocios").select("*").eq("slug", slug).single();
  if (error || !data) { $("nombre").textContent = "Comercio no encontrado"; $("form").classList.add("oculto"); return; }
  negocio = data;
  document.title = "Turnos · " + data.nombre;
  $("nombre").textContent = data.nombre;
  $("rubro").textContent = (data.rubro ? data.rubro + " · " : "") + "Reservá tu turno online";
  $("servicio").innerHTML = data.servicios.map((s) => `<option>${s}</option>`).join("");
  const hoy = new Date().toLocaleDateString("sv-SE");
  $("fecha").min = hoy;
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

async function cargarHoras() {
  horaElegida = null; validar();
  const fecha = $("fecha").value;
  if (!fecha) return;
  const dia = new Date(fecha + "T12:00").getDay();
  if (!negocio.dias.includes(dia)) { $("horas").innerHTML = '<p class="sub">Ese día no atiende</p>'; return; }
  const { data } = await db.rpc("horas_ocupadas", { p_negocio: negocio.id, p_fecha: fecha });
  const ocupadas = (data || []).map((h) => (typeof h === "string" ? h : h.horas_ocupadas).slice(0, 5));
  const ahora = new Date();
  $("horas").innerHTML = "";
  generarHorarios().forEach((h) => {
    const b = document.createElement("button");
    b.className = "hora"; b.textContent = h;
    const pasado = new Date(fecha + "T" + h) < ahora;
    b.disabled = ocupadas.includes(h) || pasado;
    b.onclick = () => {
      document.querySelectorAll(".hora").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel"); horaElegida = h; validar();
    };
    $("horas").appendChild(b);
  });
}

function validar() {
  $("reservar").disabled = !(horaElegida && $("cliente").value.trim() && $("tel").value.trim());
}

async function reservar() {
  $("reservar").disabled = true;
  const turno = {
    negocio_id: negocio.id, fecha: $("fecha").value, hora: horaElegida,
    servicio: $("servicio").value, cliente_nombre: $("cliente").value.trim(), cliente_tel: $("tel").value.trim(),
  };
  const { error } = await db.from("turnos").insert(turno);
  if (error) {
    mostrar(error.code === "23505" ? "Ese horario se acaba de ocupar. Elegí otro." : "No se pudo reservar. Probá de nuevo.", "err");
    cargarHoras(); return;
  }
  mostrar(`¡Listo! Tu turno es el ${turno.fecha.split("-").reverse().join("/")} a las ${turno.hora}.`, "ok");
  if (negocio.whatsapp) {
    const txt = encodeURIComponent(`Hola! Reservé un turno el ${turno.fecha} a las ${turno.hora} (${turno.servicio}). Soy ${turno.cliente_nombre}.`);
    $("msg").innerHTML += ` <a href="https://wa.me/${negocio.whatsapp}?text=${txt}" target="_blank">Avisar por WhatsApp</a>`;
  }
  cargarHoras();
}

$("fecha").addEventListener("change", cargarHoras);
$("cliente").addEventListener("input", validar);
$("tel").addEventListener("input", validar);
$("reservar").addEventListener("click", reservar);
cargarNegocio();
