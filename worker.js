var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var ADMIN_PASS = "changeme123";
function generateCode(length = 8) {
  const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) code += chars[arr[i] % chars.length];
  return code;
}
__name(generateCode, "generateCode");
function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
__name(htmlResponse, "htmlResponse");
function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? match[1] : null;
}
__name(getCookie, "getCookie");
function isAdminAuthed(request) {
  return getCookie(request, "mx_admin") === "authed";
}
__name(isAdminAuthed, "isAdminAuthed");
async function getSession(request, DB) {
  const token = getCookie(request, "mx_session");
  if (!token) return null;
  const row = await DB.prepare(
    "SELECT u.id, u.email, u.name, u.status FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?"
  ).bind(token).first();
  return row || null;
}
__name(getSession, "getSession");
function crownSvg(color) {
  return '<svg width="24" height="24" viewBox="0 0 100 80" fill="' + color + '" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;"><path d="M10 55 L10 30 L28 48 L50 10 L72 48 L90 30 L90 55 Z"/><rect x="10" y="60" width="80" height="14" rx="5"/></svg>';
}
__name(crownSvg, "crownSvg");
function crownIcon(limit) {
  if (limit === -1) return crownSvg("#e8a33d");
  if (limit === 0) return crownSvg("#c1443c");
  return crownSvg("#4a8c8c");
}
__name(crownIcon, "crownIcon");
function limitLabel(limit, used) {
  if (limit === -1) return "Unlimited";
  if (limit === 0) return "No access";
  return (used || 0).toFixed(1) + " / " + limit + " MB";
}
__name(limitLabel, "limitLabel");
function adminHTML(users) {
  let rows = "";
  if (!users || users.length === 0) {
    rows = '<tr><td colspan="8" style="text-align:center;color:#9a9186;">No users yet</td></tr>';
  } else {
    for (const u of users) {
      const approveBtn = u.status === "pending" ? '<button onclick="approve(' + u.id + ')">Approve</button>' : "";
      rows += "<tr><td>" + u.id + "</td><td>" + u.name + "</td><td>" + u.email + "</td><td>" + new Date(u.created_at).toLocaleDateString() + '</td><td><span class="status ' + u.status + '">' + u.status + "</span></td><td>" + (u.access_code || "\u2014") + '</td><td style="text-align:center;" id="crown_' + u.id + '">' + crownIcon(u.storage_limit_mb) + '<br><small style="color:#9a9186;">' + limitLabel(u.storage_limit_mb, u.storage_used_mb) + '</small></td><td><select id="sel_' + u.id + '" onchange="setLimit(' + u.id + ', this.value)" style="background:#1a1816;color:#f2ede4;border:1px solid #3a352f;border-radius:4px;padding:4px;font-family:monospace;font-size:12px;margin-right:4px;"><option value="0"' + (u.storage_limit_mb === 0 ? " selected" : "") + '>Red (No access)</option><option value="custom"' + (u.storage_limit_mb > 0 ? " selected" : "") + '>Green (Custom MB)</option><option value="-1"' + (u.storage_limit_mb === -1 ? " selected" : "") + '>Gold (Unlimited)</option></select><br style="margin:4px 0">' + approveBtn + '<button onclick="del(' + u.id + ')" class="del">Delete</button></td><td id="customcol_' + u.id + '" style="' + (u.storage_limit_mb > 0 ? "" : "display:none;") + '"><input type="number" id="custom_' + u.id + '" value="' + (u.storage_limit_mb > 0 ? u.storage_limit_mb : "") + '" min="1" placeholder="MB" style="width:70px;background:#1a1816;color:#f2ede4;border:1px solid #3a352f;border-radius:4px;padding:4px;font-family:monospace;font-size:12px;"><button onclick="saveCustom(' + u.id + ')" style="padding:4px 8px;">\u2713</button></td></tr>';
    }
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mixtape Admin</title><style>body{font-family:monospace;background:#1a1816;color:#f2ede4;padding:20px;overflow-x:auto;}h1{color:#e8a33d;}table{width:100%;border-collapse:collapse;margin-top:20px;min-width:700px;}th,td{padding:10px;border:1px solid #3a352f;text-align:left;font-size:13px;vertical-align:middle;}th{background:#221f1c;color:#9a9186;}.pending{color:#e8a33d;}.approved{color:#4a8c8c;}button{background:#4a8c8c;border:none;color:#1a1816;padding:5px 10px;cursor:pointer;border-radius:4px;font-family:monospace;margin-right:4px;margin-top:4px;}.del{background:#c1443c;color:#f2ede4;}.logout{float:right;background:#3a352f;color:#9a9186;}</style></head><body><h1>Mixtape Admin <button class="logout" onclick="location.href='/admin/logout'">Logout</button></h1><table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Signed up</th><th>Status</th><th>Code</th><th>Storage</th><th>Limit</th><th>Custom MB</th></tr></thead><tbody>` + rows + '</tbody></table><script>async function approve(id){const r=await fetch("/admin/approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const d=await r.json();if(d.code){alert("Approved!\\nCode: "+d.code);location.reload();}else alert("Error: "+(d.error||"Unknown"));}async function del(id){if(!confirm("Delete this user?"))return;const r=await fetch("/admin/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const d=await r.json();if(d.ok)location.reload();else alert("Error: "+(d.error||"Unknown"));}async function setLimit(id,value){const customCol=document.getElementById("customcol_"+id);if(value==="custom"){if(customCol)customCol.style.display="";return;}if(customCol)customCol.style.display="none";const limit=parseInt(value);const r=await fetch("/admin/setlimit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,limit})});const d=await r.json();if(d.ok)location.reload();else alert("Error: "+(d.error||"Unknown"));}async function saveCustom(id){const val=document.getElementById("custom_"+id).value;const limit=parseInt(val);if(!limit||limit<1){alert("Enter a valid MB amount");return;}const r=await fetch("/admin/setlimit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,limit})});const d=await r.json();if(d.ok)location.reload();else alert("Error: "+(d.error||"Unknown"));}${'<'}/script></body></html>`;
}
__name(adminHTML, "adminHTML");
var ADMIN_LOGIN_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admin Login</title><style>body{font-family:monospace;background:#1a1816;color:#f2ede4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}.card{background:#221f1c;border:1px solid #3a352f;border-radius:12px;padding:28px;width:300px;}h2{color:#e8a33d;margin:0 0 20px;}input{display:block;width:100%;background:#1a1816;border:1px solid #3a352f;border-radius:6px;padding:10px;color:#f2ede4;font-family:monospace;margin-bottom:12px;box-sizing:border-box;}button{width:100%;padding:10px;background:#e8a33d;border:none;border-radius:6px;color:#1a1816;font-family:monospace;font-weight:700;cursor:pointer;}.err{color:#c1443c;font-size:12px;margin-top:8px;}</style></head><body><div class="card"><h2>Admin</h2><form method="POST" action="/admin/login"><input type="password" name="pass" placeholder="Password" autofocus><button type="submit">Enter</button><div class="err"></div></form></div></body></html>';
var AUTH_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Mixtape</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
  :root{--bg:#1a1816;--panel:#221f1c;--amber:#e8a33d;--teal:#4a8c8c;--cream:#f2ede4;--red:#c1443c;--line:#3a352f;--muted:#9a9186;}
  *{box-sizing:border-box;}
  body{background:var(--bg);color:var(--cream);font-family:'Space Grotesk',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px 24px;width:100%;max-width:360px;}
  h1{font-size:24px;margin:0 0 4px;}
  .sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);letter-spacing:1px;margin-bottom:24px;}
  .tabs{display:flex;gap:8px;margin-bottom:20px;}
  .tab{flex:1;padding:9px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;}
  .tab.active{background:var(--amber);border-color:var(--amber);color:var(--bg);font-weight:700;}
  input{display:block;width:100%;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:var(--cream);font-family:'JetBrains Mono',monospace;font-size:13px;margin-bottom:10px;}
  .btn{display:block;width:100%;padding:12px;border-radius:8px;border:none;background:var(--amber);color:var(--bg);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;}
  .msg{font-family:'JetBrains Mono',monospace;font-size:12px;margin-top:12px;text-align:center;min-height:18px;}
  .err{color:var(--red);}.ok{color:var(--teal);}
  .form{display:none;}.form.active{display:block;}
</style>
</head>
<body>
<div class="card">
  <h1>Mixtape</h1>
  <div class="sub">PRIVATE ACCESS</div>
  <div class="tabs">
    <button class="tab active" onclick="show('login')">Login</button>
    <button class="tab" onclick="show('signup')">Sign up</button>
  </div>
  <div class="form active" id="loginForm">
    <input type="email" id="loginEmail" placeholder="Email">
    <input type="text" id="loginCode" placeholder="Access code" style="text-transform:uppercase" maxlength="8">
    <button class="btn" onclick="doLogin()">Enter</button>
    <div class="msg" id="loginMsg"></div>
  </div>
  <div class="form" id="signupForm">
    <input type="text" id="signupName" placeholder="Your name">
    <input type="email" id="signupEmail" placeholder="Email">
    <button class="btn" onclick="doSignup()">Request access</button>
    <div class="msg" id="signupMsg"></div>
  </div>
</div>
<script>
  function show(tab){
    document.getElementById('loginForm').classList.toggle('active',tab==='login');
    document.getElementById('signupForm').classList.toggle('active',tab==='signup');
    document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',(i===0)===(tab==='login')));
  }
  async function doLogin(){
    const email=document.getElementById('loginEmail').value.trim();
    const code=document.getElementById('loginCode').value.trim().toUpperCase();
    const msg=document.getElementById('loginMsg');
    if(!email||!code){msg.textContent='Fill in both fields.';msg.className='msg err';return;}
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,code})});
    const d=await r.json();
    if(d.ok){location.reload();}
    else{msg.textContent=d.error||'Invalid credentials.';msg.className='msg err';}
  }
  async function doSignup(){
    const name=document.getElementById('signupName').value.trim();
    const email=document.getElementById('signupEmail').value.trim();
    const msg=document.getElementById('signupMsg');
    if(!name||!email){msg.textContent='Fill in both fields.';msg.className='msg err';return;}
    const r=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email})});
    const d=await r.json();
    if(d.ok){msg.textContent='Request sent! Wait for your access code.';msg.className='msg ok';}
    else{msg.textContent=d.error||'Something went wrong.';msg.className='msg err';}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Enter'){document.getElementById('loginForm').classList.contains('active')?doLogin():doSignup();}});
${'<'}/script>
</body>
</html>`;
var worker_default = {
  async fetch(request, env) {
    const DB = env.DB;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (path === "/admin" || path === "/admin/") {
      if (!isAdminAuthed(request)) return Response.redirect(url.origin + "/admin/login", 302);
      const { results } = await DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
      return htmlResponse(adminHTML(results || []));
    }
    if (path === "/admin/login") {
      if (method === "GET") return htmlResponse(ADMIN_LOGIN_HTML);
      if (method === "POST") {
        const form = await request.formData();
        const pass = form.get("pass");
        const correct = env.ADMIN_PASS || ADMIN_PASS;
        if (pass !== correct) return htmlResponse(ADMIN_LOGIN_HTML.replace('<div class="err"></div>', '<div class="err">Wrong password</div>'), 401);
        return new Response("", {
          status: 302,
          headers: { "Location": "/admin", "Set-Cookie": "mx_admin=authed; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400" }
        });
      }
    }
    if (path === "/admin/logout") {
      return new Response("", {
        status: 302,
        headers: { "Location": "/admin/login", "Set-Cookie": "mx_admin=; Path=/; Max-Age=0" }
      });
    }
    if (path === "/admin/approve" && method === "POST") {
      if (!isAdminAuthed(request)) return jsonResponse({ error: "Unauthorized" }, 401);
      const { id } = await request.json();
      const code = generateCode(8);
      await DB.prepare("UPDATE users SET status = ?, access_code = ? WHERE id = ?").bind("approved", code, id).run();
      return jsonResponse({ ok: true, code });
    }
    if (path === "/admin/setlimit" && method === "POST") {
      if (!isAdminAuthed(request)) return jsonResponse({ error: "Unauthorized" }, 401);
      const { id, limit } = await request.json();
      await DB.prepare("UPDATE users SET storage_limit_mb = ? WHERE id = ?").bind(limit, id).run();
      return jsonResponse({ ok: true });
    }
    if (path === "/admin/delete" && method === "POST") {
      if (!isAdminAuthed(request)) return jsonResponse({ error: "Unauthorized" }, 401);
      const { id } = await request.json();
      await DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
      await DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return jsonResponse({ ok: true });
    }
    if (path === "/api/me") {
      const session2 = await getSession(request, DB);
      if (!session2) return jsonResponse({ error: "Unauthorized" }, 401);
      return jsonResponse({ ok: true, name: session2.name, email: session2.email });
    }
    if (path === "/api/signup" && method === "POST") {
      const { name, email } = await request.json();
      if (!name || !email) return jsonResponse({ error: "Name and email required" }, 400);
      const existing = await DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
      if (existing) return jsonResponse({ error: "Email already registered" }, 409);
      await DB.prepare("INSERT INTO users (name, email, status, storage_limit_mb, created_at) VALUES (?, ?, ?, ?, ?)").bind(name, email, "pending", 0, Date.now()).run();
      return jsonResponse({ ok: true });
    }
    if (path === "/api/login" && method === "POST") {
      const { email, code } = await request.json();
      if (!email || !code) return jsonResponse({ error: "Email and code required" }, 400);
      const user = await DB.prepare("SELECT * FROM users WHERE email = ? AND access_code = ? AND status = ?").bind(email, code.toUpperCase(), "approved").first();
      if (!user) return jsonResponse({ error: "Invalid email or code" }, 401);
      const token = generateToken();
      await DB.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").bind(token, user.id, Date.now()).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": "mx_session=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" }
      });
    }
    if (path === "/api/logout" && method === "POST") {
      const token = getCookie(request, "mx_session");
      if (token) await DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Set-Cookie": "mx_session=; Path=/; Max-Age=0" }
      });
    }
    if (path === "/api/upload" && method === "POST") {
      const session2 = await getSession(request, DB);
      if (!session2) return jsonResponse({ error: "Unauthorized" }, 401);
      const user = await DB.prepare("SELECT * FROM users WHERE id = ?").bind(session2.id).first();
      if (!user) return jsonResponse({ error: "User not found" }, 404);
      const contentLength = parseInt(request.headers.get("Content-Length") || "0");
      const fileSizeMb = contentLength / (1024 * 1024);
      if (user.storage_limit_mb === 0) return jsonResponse({ error: "No storage access — ask admin to set your storage limit" }, 403);
      if (user.storage_limit_mb !== -1 && user.storage_used_mb + fileSizeMb > user.storage_limit_mb) {
        return jsonResponse({ error: "Storage limit exceeded (" + user.storage_limit_mb + " MB)" }, 413);
      }
      const fileName = request.headers.get("X-File-Name") || "unknown";
      const key = session2.email + "/" + Date.now() + "_" + fileName;
      const body = await request.arrayBuffer();
      await env.AUDIO_BUCKET.put(key, body, {
        httpMetadata: { contentType: request.headers.get("Content-Type") || "audio/mpeg" }
      });
      const newUsed = (user.storage_used_mb || 0) + fileSizeMb;
      await DB.prepare("UPDATE users SET storage_used_mb = ? WHERE id = ?").bind(newUsed, session2.id).run();
      return jsonResponse({ ok: true, key });
    }
    if (path === "/api/files" && method === "GET") {
      const session2 = await getSession(request, DB);
      if (!session2) return jsonResponse({ error: "Unauthorized" }, 401);
      const prefix = session2.email + "/";
      const listed = await env.AUDIO_BUCKET.list({ prefix });
      const files = listed.objects.map((o) => ({
        key: o.key,
        name: o.key.replace(prefix, "").replace(/^\d+_/, ""),
        size: o.size,
        uploaded: o.uploaded
      }));
      return jsonResponse({ ok: true, files });
    }
    if (path.startsWith("/api/file/") && method === "GET") {
      const session2 = await getSession(request, DB);
      if (!session2) return jsonResponse({ error: "Unauthorized" }, 401);
      const key = decodeURIComponent(path.replace("/api/file/", ""));
      if (!key.startsWith(session2.email + "/")) return jsonResponse({ error: "Forbidden" }, 403);
      const obj = await env.AUDIO_BUCKET.get(key);
      if (!obj) return jsonResponse({ error: "Not found" }, 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "audio/mpeg",
          "Cache-Control": "private, max-age=3600"
        }
      });
    }
    if (path.startsWith("/api/file/") && method === "DELETE") {
      const session2 = await getSession(request, DB);
      if (!session2) return jsonResponse({ error: "Unauthorized" }, 401);
      const key = decodeURIComponent(path.replace("/api/file/", ""));
      if (!key.startsWith(session2.email + "/")) return jsonResponse({ error: "Forbidden" }, 403);
      const obj = await env.AUDIO_BUCKET.head(key);
      const fileSizeMb = obj ? obj.size / (1024 * 1024) : 0;
      await env.AUDIO_BUCKET.delete(key);
      const user = await DB.prepare("SELECT storage_used_mb FROM users WHERE id = ?").bind(session2.id).first();
      const newUsed = Math.max(0, (user.storage_used_mb || 0) - fileSizeMb);
      await DB.prepare("UPDATE users SET storage_used_mb = ? WHERE id = ?").bind(newUsed, session2.id).run();
      return jsonResponse({ ok: true });
    }
    const session = await getSession(request, DB);
    if (!session) {
      const accept = request.headers.get("Accept") || "";
      if (accept.includes("text/html")) return htmlResponse(AUTH_HTML);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  worker_default as default
};
