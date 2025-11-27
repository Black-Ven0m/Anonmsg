/* ======================
   Advanced chat + admin
   ====================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onValue, set, remove, update, get
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/* ---------- config (your config used) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyB0R_sX_3-iHTIdR-cV6XnBkK-dCi15ny0",
  authDomain: "project-ano.firebaseapp.com",
  databaseURL: "https://project-ano-default-rtdb.firebaseio.com/",
  projectId: "project-ano",
  storageBucket: "project-ano.firebasestorage.app",
  messagingSenderId: "871392286002",
  appId: "1:871392286002:web:614a92e162f4f8a42e332b",
  measurementId: "G-TECFSQTKB4"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------- DOM ---------- */
const viewLogin = document.getElementById("view-login");
const viewAdminLogin = document.getElementById("view-admin-login");
const viewChat = document.getElementById("view-chat");

const inpUser = document.getElementById("inp-username");
const inpPass = document.getElementById("inp-password");
const btnLogin = document.getElementById("btn-login");
const openAdmin = document.getElementById("open-admin");

const inpAdminUser = document.getElementById("inp-admin-user");
const inpAdminPass = document.getElementById("inp-admin-pass");
const btnAdminLogin = document.getElementById("btn-admin-login");
const adminBack = document.getElementById("admin-back");

const btnTheme = document.getElementById("btn-theme");
const btnOpenAdminPanel = document.getElementById("btn-open-admin-panel");
const btnLogout = document.getElementById("btn-logout");

const userListDiv = document.getElementById("user-list");
const pinnedListDiv = document.getElementById("pinned-list");
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
const btnSend = document.getElementById("btn-send");

const adminSidebar = document.getElementById("admin-sidebar");
const adminSlow = document.getElementById("admin-slow");
const adminMuteUser = document.getElementById("admin-mute-user");
const adminMuteSecs = document.getElementById("admin-mute-secs");
const adminMuteBtn = document.getElementById("admin-mute-btn");
const adminShadowUser = document.getElementById("admin-shadow-user");
const adminShadowBanBtn = document.getElementById("admin-shadow-ban");
const adminBanInput = document.getElementById("admin-ban-user");
const adminBanBtn = document.getElementById("admin-ban-btn");
const adminUnbanInput = document.getElementById("admin-unban-user");
const adminUnbanBtn = document.getElementById("admin-unban-btn");

const adminPinBtn = document.getElementById("admin-pin-btn");
const adminHighlightBtn = document.getElementById("admin-highlight-btn");
const adminEditBtn = document.getElementById("admin-edit-btn");
const adminDeleteBtn = document.getElementById("admin-delete-btn");
const adminBroadcast = document.getElementById("admin-broadcast");
const adminStealth = document.getElementById("admin-stealth-toggle");
const adminThemeGreen = document.getElementById("admin-theme-green");
const adminThemeRed = document.getElementById("admin-theme-red");
const adminThemeBlue = document.getElementById("admin-theme-blue");
const logsDiv = document.getElementById("activity-logs");

/* ---------- state ---------- */
let currentUser = null;
let isAdmin = false;
let selectedMessageId = null;
let userColors = {}; // persistent per session (we can persist to localStorage if desired)
let slowModeSec = 0;
let lastSentTimestamps = {}; // { username: timestamp }

/* ---------- helpers ---------- */
function logActivity(action, info) {
  const entry = { t: Date.now(), action, info };
  push(ref(db, "logs/"), entry);
  // show in admin logs if visible
  const el = document.createElement("div");
  el.textContent = `${new Date(entry.t).toLocaleTimeString()} — ${action} — ${JSON.stringify(info)}`;
  logsDiv.prepend(el);
}

function deviceHash() {
  // safe pseudo-hash: userAgent + random + time (no IP)
  let ua = navigator.userAgent || "ua";
  let rand = Math.random().toString(36).slice(2,10);
  return btoa(ua + "|" + rand + "|" + Date.now()).slice(0,22);
}
function persistUserColor(name) {
  const key = "zh_color_" + name;
  if (localStorage.getItem(key)) {
    userColors[name] = localStorage.getItem(key);
    return userColors[name];
  }
  const c = "#" + Math.floor(Math.random()*16777215).toString(16).padEnd(6,'0');
  userColors[name] = c;
  localStorage.setItem(key, c);
  return c;
}
function getUserColor(name){
  if (name === "ADMIN") return "#ff4444";
  return userColors[name] || persistUserColor(name);
}
function applyTheme(t){
  document.documentElement.classList.remove("theme-matrix","theme-red","theme-blue");
  if(t==="matrix") document.documentElement.classList.add("theme-matrix");
  if(t==="red") document.documentElement.classList.add("theme-red");
  if(t==="blue") document.documentElement.classList.add("theme-blue");
}

/* ---------- login flow ---------- */
openAdmin.onclick = ()=>{ viewLogin.classList.add("hidden"); viewAdminLogin.classList.remove("hidden"); };
adminBack.onclick = ()=>{ viewAdminLogin.classList.add("hidden"); viewLogin.classList.remove("hidden"); };

btnLogin.onclick = async ()=>{
  const u = inpUser.value.trim();
  const p = inpPass.value.trim();
  if(!u || !p){ alert("enter username & password"); return; }

  // check banned
  const b = await get(ref(db, "banned/" + u));
  if (b.exists()) { alert("You are banned"); return; }

  // register device hash
  const dhash = deviceHash();
  await set(ref(db, "devices/" + dhash), { user:u, t: Date.now() });

  currentUser = u;
  localStorage.setItem("zh_user", u);

  // update online users list node
  const onRef = ref(db, "online/" + u);
  set(onRef, { t: Date.now(), color: getUserColor(u) });
  logActivity("login", { user:u });

  viewLogin.classList.add("hidden");
  viewChat.classList.remove("hidden");
  document.getElementById("yourname").textContent = " — " + u;
  refreshOnlineList();
};

btnAdminLogin.onclick = ()=>{
  const u = inpAdminUser.value.trim();
  const p = inpAdminPass.value.trim();
  if(u==="zerohex" && p==="badatom2556") {
    isAdmin = true;
    currentUser = "ADMIN";
    viewAdminLogin.classList.add("hidden");
    viewChat.classList.remove("hidden");
    document.getElementById("btn-open-admin-panel").classList.remove("hidden");
    adminSidebar.classList.remove("hidden");
    document.getElementById("yourname").textContent = " — ADMIN";
    logActivity("admin-login", { by:"zerohex" });
    // admin theme persisted
  } else alert("wrong admin credentials");
};

/* ---------- theme button (normal users cycle local theme) ---------- */
btnTheme.onclick = ()=>{
  // normal users toggle matrix
  const classes = document.documentElement.classList;
  if(classes.contains("theme-matrix")) applyTheme("red");
  else if(classes.contains("theme-red")) applyTheme("blue");
  else applyTheme("matrix");
};

/* ---------- admin open panel ---------- */
btnOpenAdminPanel.onclick = ()=>{
  adminSidebar.classList.toggle("hidden");
};

/* ---------- slow mode / mute / shadow / ban ---------- */
adminSlow.onchange = ()=>{
  const val = parseInt(adminSlow.value || 0);
  slowModeSec = val>0?val:0;
  set(ref(db,"meta/slowMode"), { sec: slowModeSec });
  logActivity("slowMode", { sec: slowModeSec });
};

adminMuteBtn.onclick = async ()=>{
  if(!isAdmin) return alert("admin only");
  const user = adminMuteUser.value.trim();
  const secs = parseInt(adminMuteSecs.value || 0);
  if(!user || !secs) return alert("enter user & secs");
  const until = Date.now() + secs*1000;
  await set(ref(db,"muted/"+user), { until });
  logActivity("mute", { user, until });
  alert("muted "+user);
};

adminShadowBanBtn.onclick = async ()=>{
  if(!isAdmin) return;
  const user = adminShadowUser.value.trim();
  if(!user) return alert("enter username");
  await set(ref(db,"shadow/"+user), true);
  logActivity("shadow-ban", { user });
  alert("shadow banned " + user);
};

adminBanBtn.onclick = async ()=>{
  if(!isAdmin) return;
  const user = adminBanInput.value.trim();
  if(!user) return;
  await set(ref(db,"banned/"+user), true);
  logActivity("ban", { user });
  alert("banned " + user);
};

adminUnbanBtn.onclick = async ()=>{
  if(!isAdmin) return;
  const user = adminUnbanInput.value.trim();
  if(!user) return;
  await remove(ref(db,"banned/"+user));
  logActivity("unban", { user });
  alert("unbanned " + user);
};

/* ---------- pin / highlight / edit / delete selection ---------- */
/* selectedMessageId is set on click of message */
adminPinBtn.onclick = async ()=>{
  if(!isAdmin) return alert("admin only");
  if(!selectedMessageId) return alert("select a message first (click message)");
  // set pinned node and also mark message
  await set(ref(db,"pinned/"+selectedMessageId), { id:selectedMessageId, t:Date.now() });
  await update(ref(db,"messages/"+selectedMessageId), { pinned:true });
  logActivity("pin", { id:selectedMessageId });
  alert("pinned");
};
adminHighlightBtn.onclick = async ()=>{
  if(!isAdmin) return alert("admin only");
  if(!selectedMessageId) return alert("select a message first");
  await update(ref(db,"messages/"+selectedMessageId), { highlight:true });
  logActivity("highlight", { id:selectedMessageId });
  alert("highlighted");
};
adminEditBtn.onclick = async ()=>{
  if(!isAdmin) return alert("admin only");
  if(!selectedMessageId) return alert("select a message first");
  const newText = prompt("Edit message text:");
  if(newText==null) return;
  await update(ref(db,"messages/"+selectedMessageId), { text:newText, edited:true });
  logActivity("edit", { id:selectedMessageId, newText });
  alert("edited");
};
adminDeleteBtn.onclick = async ()=>{
  if(!isAdmin) return alert("admin only");
  if(!selectedMessageId) return alert("select a message first");
  if(!confirm("Delete selected message?")) return;
  await remove(ref(db,"messages/"+selectedMessageId));
  await remove(ref(db,"pinned/"+selectedMessageId));
  logActivity("delete", { id:selectedMessageId });
  selectedMessageId = null;
  alert("deleted");
};

/* ---------- broadcast & stealth & theme ---------- */
adminBroadcast.onclick = async ()=>{
  if(!isAdmin) return;
  const t = prompt("Broadcast text:");
  if(!t) return;
  await push(ref(db,"messages/"), { user:"ADMIN", text:"📢 "+t, time:Date.now(), adminAnn:true });
  logActivity("broadcast", { text:t });
  alert("broadcast sent");
};
adminStealth.onclick = async ()=>{
  if(!isAdmin) return;
  const cur = (await get(ref(db,"admin/stealth"))).val();
  const next = !cur;
  await set(ref(db,"admin/stealth"), next);
  logActivity("stealth", { on:next });
  alert("stealth: "+next);
};
adminThemeGreen.onclick = ()=>{ if(!isAdmin) return; applyTheme("matrix"); set(ref(db,"admin/theme"), "matrix"); };
adminThemeRed.onclick = ()=>{ if(!isAdmin) return; applyTheme("red"); set(ref(db,"admin/theme"), "red"); };
adminThemeBlue.onclick = ()=>{ if(!isAdmin) return; applyTheme("blue"); set(ref(db,"admin/theme"), "blue"); };

/* ---------- message send with slow/mute/shadow logic ---------- */
btnSend.onclick = async ()=>{
  if(!currentUser) { alert("login first"); return; }

  // check slow mode from db
  const metaSnap = await get(ref(db,"meta/slowMode"));
  const slowSec = metaSnap.exists()? (metaSnap.val().sec || 0) : slowModeSec;
  const last = lastSentTimestamps[currentUser] || 0;
  const now = Date.now();
  if(!isAdmin && slowSec>0 && (now - last) < slowSec*1000) {
    return alert("Slow mode: wait " + Math.ceil((slowSec*1000 - (now-last))/1000) + "s");
  }

  // check mute
  const mSnap = await get(ref(db,"muted/"+currentUser));
  if(mSnap.exists()){
    const v = mSnap.val();
    if(v.until && Date.now() < v.until){
      return alert("You are muted until " + new Date(v.until).toLocaleString());
    } else {
      // expired -> remove
      await remove(ref(db,"muted/"+currentUser));
    }
  }

  // push message, but if user is shadow-banned mark shadow:true
  const shadowSnap = await get(ref(db,"shadow/"+currentUser));
  const isShadow = shadowSnap.exists();
  const stealth = (await get(ref(db,"admin/stealth"))).val();

  const payload = {
    user: isAdmin && stealth ? "Anonymous" : currentUser,
    realUser: currentUser,
    text: msgInput.value.trim(),
    time: Date.now(),
    shadow: !!isShadow,
    admin: isAdmin || false
  };
  if(!payload.text) return;
  const p = await push(ref(db,"messages/"), payload);

  // update lastSent
  lastSentTimestamps[currentUser] = Date.now();
  await set(ref(db,"lastSent/"+currentUser), { t: Date.now() });

  // log
  logActivity("send", { id:p.key, user:currentUser, shadow:payload.shadow });
  msgInput.value = "";
};

/* ---------- render messages with filters ---------- */
onValue(ref(db,"messages/"), async snap=>{
  messagesDiv.innerHTML = "";
  if(!snap.exists()) return;

  // get admin stealth value
  const stealthSnap = await get(ref(db,"admin/stealth"));
  const stealth = stealthSnap.exists()? stealthSnap.val() : false;

  snap.forEach(child=>{
    const id = child.key; const m = child.val();
    // if shadow and current user not admin -> skip
    if(m.shadow && !isAdmin) return;
    // create element
    const el = document.createElement("div");
    el.className = "msg";
    if(m.adminAnn) el.classList.add("admin");
    if(m.highlight) el.classList.add("highlight");
    if(m.pinned) el.classList.add("pinned");
    el.id = "msg-"+id;

    // user color
    const color = getUserColor(m.user || m.realUser || "Unknown");
    const userHtml = `<span style="color:${color};font-weight:bold">${m.user}</span>`;
    const timeStr = new Date(m.time || Date.now()).toLocaleTimeString();

    el.innerHTML = `<div class="meta">${userHtml} <small>${timeStr}${m.edited?" • edited":""}</small></div>
                    <div class="body">${m.text}</div>`;

    // click to select (admin)
    el.onclick = ()=> {
      // toggle select
      document.querySelectorAll(".msg").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
      selectedMessageId = id;
    };

    // admin quick controls overlay (visible to admin)
    if(isAdmin){
      const ctrl = document.createElement("div");
      ctrl.style.position="absolute"; ctrl.style.right="8px"; ctrl.style.top="8px";
      ctrl.innerHTML = `<small style="opacity:0.7">ID:${id}</small>`;
      el.appendChild(ctrl);
    }

    messagesDiv.appendChild(el);
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

/* ---------- active online list ---------- */
async function refreshOnlineList(){
  userListDiv.innerHTML = "";
  const snap = await get(ref(db,"online/"));
  if(!snap.exists()) return;
  const all = snap.val();
  Object.keys(all).forEach(u=>{
    const d = all[u];
    const div = document.createElement("div");
    div.textContent = u;
    div.style.color = getUserColor(u);
    userListDiv.appendChild(div);
  });
}

/* update online node periodically */
setInterval(async ()=>{
  if(currentUser){
    await set(ref(db,"online/"+currentUser), { t: Date.now(), color: getUserColor(currentUser) });
  }
  refreshOnlineList();
}, 15000);

/* listen to logs for admin */
onChildAdded(ref(db,"logs/"), snap=>{
  if(!isAdmin) return;
  const v = snap.val();
  const el = document.createElement("div");
  el.textContent = `${new Date(v.t).toLocaleTimeString()} • ${v.action} • ${JSON.stringify(v.info)}`;
  logsDiv.prepend(el);
});

/* pinned list render */
onValue(ref(db,"pinned/"), snap=>{
  pinnedListDiv.innerHTML = "";
  if(!snap.exists()) return;
  snap.forEach(c=>{
    const v = c.val();
    const el = document.createElement("div");
    el.textContent = `Pinned: ${v.id}`;
    pinnedListDiv.appendChild(el);
  });
});

/* cleanup online on unload (best effort) */
window.addEventListener("beforeunload", ()=>{
  if(currentUser) { remove(ref(db,"online/"+currentUser)); logActivity("logout",{user:currentUser}); }
});

/* apply admin theme stored on load */
get(ref(db,"admin/theme")).then(s=>{
  if(s.exists()) applyTheme(s.val());
});
