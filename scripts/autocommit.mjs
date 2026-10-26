#!/usr/bin/env node
// Meowork auto-commit: memantau perubahan file → git add -A → commit → push (jika remote ada).
// Jalankan: npm run watch   (biarkan terminal terbuka)
import { watch as fsWatch } from "fs";
import { execSync, execFileSync, spawn } from "child_process";
import path from "path";

const ROOT = process.cwd();
const DEBOUNCE_MS = 3000;               // tunggu 3 detik setelah perubahan terakhir
const IGNORE = ["node_modules", ".next", ".git", "workspace", ".env", "out",
  // tambahkan nama folder yang TIDAK mau ikut disinkron ke repo GitHub:
  "mellow_notes", // ← proyek Flutter lain; hapus baris ini jika mau ikut di-sync
];

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString("id-ID")}] ${msg}`);
}
function run(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e) { return null; }
}
function hasChanges() {
  const st = run("git status --porcelain");
  return st ? st : null;
}
function sync(reason) {
  const st = hasChanges();
  if (!st) return false;
  const nFiles = st.split("\n").filter(Boolean).length;
  const now = new Date().toLocaleString("id-ID", { hour12: false });
  const first = st.split("\n")[0].trim().split(/\s+/).slice(1).join(" ").slice(0, 60) || "update";
  const msg = `auto: ${reason} — ${nFiles} file (${now})\n\n${first}`;
  log(`📸 ${nFiles} file berubah → commit...`);
  run("git add -A");
  try { execFileSync("git", ["commit", "-m", msg], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] }); } catch { /* nothing to commit race */ }
  const remote = run("git remote");
  if (remote) {
    log("🚀 push ke GitHub...");
    const push = spawn("git", ["push"], { cwd: ROOT, stdio: "inherit", shell: true });
    push.on("exit", (c) => log(c === 0 ? "✅ tersinkron dengan GitHub" : "⚠️ push gagal (cek internet/login) — commit tetap aman di lokal, akan ke-push pada perubahan berikutnya"));
  } else {
    log("ℹ️ remote belum dipasang — commit disimpan lokal. Lihat README langkah GitHub.");
  }
  return true;
}

// cek dulu status awal
identity:
{
  const name = run("git config user.name");
  if (!name) log("⚠️ set dulu identitas: git config --global user.name \"Nama\" && git config --global user.email \"email\"");
}
if (hasChanges()) sync("perubahan lama belum di-commit");

// watcher dengan debounce
let timer = null;
fsWatch(ROOT, { recursive: true }, (_ev, file) => {
  const f = String(file ?? "");
  if (IGNORE.some(p => f.startsWith(p))) return;
  clearTimeout(timer);
  timer = setTimeout(() => sync("file berubah"), DEBOUNCE_MS);
});

log(`🐱 Meowork auto-commit AKTIF — memantau: ${path.basename(ROOT)}`);
log("   biarkan terminal ini terbuka. Ctrl+C untuk berhenti.");
setInterval(() => {}, 1 << 30); // keep alive
