// Datos de tu proyecto en Supabase (Project Settings > API)
const SUPABASE_URL = "https://hgaufqefiewsgumlphyw.supabase.co";
const SUPABASE_KEY = "sb_publishable_YLfyFweT4brJoqLe09xNCA_Sh5OVzWu";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Pasa cualquier celular argentino al formato de WhatsApp (549 + área + número)
function waNum(tel) {
  let d = String(tel ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (d.startsWith("549")) return d;
  if (d.startsWith("54")) d = d.slice(2);
  d = d.replace(/^0/, "");
  if (d.length === 12) {
    for (const i of [2, 3, 4]) {
      if (d.slice(i, i + 2) === "15") { d = d.slice(0, i) + d.slice(i + 2); break; }
    }
  }
  return "549" + d;
}
