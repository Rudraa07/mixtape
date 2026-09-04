// Mixtape Auth Worker
// D1 binding: DB (mixtape-auth)
// Admin password: set ADMIN_PASS as a Worker secret via Cloudflare dashboard

const ADMIN_PASS = 'changeme123'; // override with a Worker secret in production

function isAdminAuthed(request, env) {
  const cookie = getCookie(request, 'mx_admin');
  return cookie === 'authed';
}

function generateCode(length = 8) {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) code += chars[arr[i] % chars.length];
  return code;
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

async function getSession(request, DB) {
  const token = getCookie(request, 'mx_session');
  if (!token) return null;
  const row = await DB.prepare(
    'SELECT u.id, u.email, u.name, u.status FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
  ).bind(token).first();
  return row || null;
}

// ---- Admin HTML ----
function crownSvg(color, title) {
  return `<svg title="${title}" width="28" height="28" viewBox="0 0 100 80" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;cursor:pointer;display:inline-block;">
    <path d="M10 55 L10 30 L28 48 L50 10 L72 48 L90 30 L90 55 Z"/>
    <rect x="10" y="60" width="80" height="14" rx="5"/>
  </svg>`;
}

function crownIcon(limit) {
  if (limit === -1) return crownSvg('#e8a33d', 'Unlimited');
  if (limit === 0)  return crownSvg('#c1443c', 'No access');
  return crownSvg('#4a8c8c', 'Custom limit');
}

function limitLabel(limit, used) {
  if (limit === -1) return 'Unlimited';
  if (limit === 0)  return 'No access';
  return `${(used||0).toFixed(1)} / ${limit} MB`;
}

function adminHTML(users) {
  let rows = '';
  if (!users || users.length === 0) {
    rows = '<tr><td colspan="9" style="text-align:center;color:#9a9186;">No users yet</td></tr>';
  } else {
    for (const u of users) {
      const crown = crownIcon(u.storage_limit_mb);
      const label = limitLabel(u.storage_limit_mb, u.storage_used_mb);
      const statusSpan = '<span class="status ' + u.status + '">' + u.status + '</span>';
      const code = u.access_code || '—';
      const date = new Date(u.created_at).toLocaleDateString();
      let customInput = '';
      if (u.storage_limit_mb > 0) {
        customInput = '<div style="margin-top:4px;"><input type="number" id="custom_' + u.id + '" value="' + u.storage_limit_mb + '" min="1" style="width:55px;background:#1a1816;color:#f2ede4;border:1px solid #3a352f;border-radius:4px;padding:3px;font-family:monospace;font-size:11px;"><button onclick="saveCustom(' + u.id + ')" style="padding:3px 7px;font-size:11px;">✓</button></div>';
      }
      let approveBtn = '';
      if (u.status === 'pending') {
        approveBtn = '<button onclick="approve(' + u.id + ')">Approve</button>';
      }
      rows += '<tr>' +
        '<td>' + u.id + '</td>' +
        '<td>' + u.name + '</td>' +
        '<td>' + u.email + '</td>' +
        '<td>' + date + '</td>' +
        '<td>' + statusSpan + '</td>' +
        '<td>' + code + '</td>' +
        '<td style="text-align:center;">' +
          '<div onclick="cycleCrown(' + u.id + ', ' + u.storage_limit_mb + ')" style="cursor:pointer;display:inline-block;">' + crown + '</div>' +
          '<div style="font-size:11px;color:#9a9186;margin-top:2px;">' + label + '</div>' +
          customInput +
        '</td>' +
        '<td>' + approveBtn + '<button onclick="del(' + u.id + ')" class="del">Delete</button></td>' +
        '</tr>';
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mixtape Admin</title>
<style>
  body { font-family: monospace; background: #1a1816; color: #f2ede4; padding: 20px; overflow-x:auto; }
  h1 { color: #e8a33d; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; min-width:700px; }
  th, td { padding: 10px; border: 1px solid #3a352f; text-align: left; font-size: 13px; vertical-align:middle; }
  th { background: #221f1c; color: #9a9186; }
  .pending { color: #e8a33d; }
  .approved { color: #4a8c8c; }
  button { background: #4a8c8c; border: none; color: #1a1816; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-family: monospace; margin-right: 4px; }
  .del { background: #c1443c; color: #f2ede4; }
  .logout { float: right; background: #3a352f; color: #9a9186; }
</style>
</head>
<body>
<h1>Mixtape Admin <button class="logout" onclick="location.href='/admin/logout'">Logout</button></h1>
<table>
  <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Signed up</th><th>Status</th><th>Code</th><th>Storage</th><th>Actions</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<script>
  async function approve(id) {
    const r = await fetch('/admin/approve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
    const d = await r.json();
    if (d.code) { alert('Approved!\nCode: ' + d.code); location.reload(); }
    else alert('Error: ' + (d.error || 'Unknown'));
  }
  async function del(id) {
    if (!confirm('Delete this user?')) return;
    const r = await fetch('/admin/delete', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert('Error: ' + (d.error || 'Unknown'));
  }
  async function cycleCrown(id, current) {
    current = parseInt(current);
    let next;
    if (current === 0) next = 1;
    else if (current > 0) next = -1;
    else next = 0;
    if (next === 1) {
      const mb = prompt('Enter storage limit in MB:');
      if (!mb || isNaN(parseInt(mb)) || parseInt(mb) < 1) return;
      next = parseInt(mb);
    }
    const r = await fetch('/admin/setlimit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, limit: next }) });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert('Error: ' + (d.error || 'Unknown'));
  }
  async function saveCustom(id) {
    const val = document.getElementById('custom_' + id).value;
    const limit = parseInt(val);
    if (!limit || limit < 1) { alert('Enter a valid MB amount'); return; }
    const r = await fetch('/admin/setlimit', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, limit }) });
    const d = await r.json();
    if (d.ok) location.reload();
    else alert('Error: ' + (d.error || 'Unknown'));
  }
</script>
</body>
</html>`;
}

const ADMIN_LOGIN_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Admin Login</title>
<style>
  body { font-family: monospace; background: #1a1816; color: #f2ede4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #221f1c; border: 1px solid #3a352f; border-radius: 12px; padding: 28px; width: 300px; }
  h2 { color: #e8a33d; margin: 0 0 20px; }
  input { display: block; width: 100%; background: #1a1816; border: 1px solid #3a352f; border-radius: 6px; padding: 10px; color: #f2ede4; font-family: monospace; margin-bottom: 12px; }
  button { width: 100%; padding: 10px; background: #e8a33d; border: none; border-radius: 6px; color: #1a1816; font-family: monospace; font-weight: 700; cursor: pointer; }
  .err { color: #c1443c; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
<div class="card">
  <h2>Admin</h2>
  <form method="POST" action="/admin/login">
    <input type="password" name="pass" placeholder="Password" autofocus>
    <button type="submit">Enter</button>
    <div class="err" id="e"></div>
  </form>
</div>
</body>
</html>`;

// ---- Main handler ----
export default {
  async fetch(request, env) {
    const DB = env.DB;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ---- Admin routes ----
    if (path === '/admin' || path === '/admin/') {
      if (!isAdminAuthed(request, env)) return Response.redirect(url.origin + '/admin/login', 302);
      const { results } = await DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
      return htmlResponse(adminHTML(results || []));
    }

    if (path === '/admin/login') {
      if (method === 'GET') return htmlResponse(ADMIN_LOGIN_HTML);
      if (method === 'POST') {
        const form = await request.formData();
        const pass = form.get('pass');
        const correct = env.ADMIN_PASS || ADMIN_PASS;
        if (pass !== correct) return htmlResponse(ADMIN_LOGIN_HTML.replace('id="e">', 'id="e">Wrong password'), 401);
        return new Response('', {
          status: 302,
          headers: {
            'Location': '/admin',
            'Set-Cookie': 'mx_admin=authed; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400'
          }
        });
      }
    }

    if (path === '/admin/logout') {
      return new Response('', {
        status: 302,
        headers: { 'Location': '/admin/login', 'Set-Cookie': 'mx_admin=; Path=/; Max-Age=0' }
      });
    }

    if (path === '/admin/approve' && method === 'POST') {
      if (!isAdminAuthed(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
      const { id } = await request.json();
      const code = generateCode(8);
      await DB.prepare('UPDATE users SET status = ?, access_code = ? WHERE id = ?').bind('approved', code, id).run();
      return jsonResponse({ ok: true, code });
    }

    if (path === '/admin/setlimit' && method === 'POST') {
      if (!isAdminAuthed(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
      const { id, limit } = await request.json();
      await DB.prepare('UPDATE users SET storage_limit_mb = ? WHERE id = ?').bind(limit, id).run();
      return jsonResponse({ ok: true });
    }

    if (path === '/admin/delete' && method === 'POST') {
      if (!isAdminAuthed(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
      const { id } = await request.json();
      await DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
      await DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
      return jsonResponse({ ok: true });
    }

    // ---- API routes ----
    if (path === '/api/me') {
      const session = await getSession(request, DB);
      if (!session) return jsonResponse({ error: 'Unauthorized' }, 401);
      return jsonResponse({ ok: true, name: session.name, email: session.email });
    }

    if (path === '/api/signup' && method === 'POST') {
      const { name, email } = await request.json();
      if (!name || !email) return jsonResponse({ error: 'Name and email required' }, 400);
      const existing = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) return jsonResponse({ error: 'Email already registered' }, 409);
      await DB.prepare('INSERT INTO users (name, email, status, created_at) VALUES (?, ?, ?, ?)').bind(name, email, 'pending', Date.now()).run();
      return jsonResponse({ ok: true });
    }

    if (path === '/api/login' && method === 'POST') {
      const { email, code } = await request.json();
      if (!email || !code) return jsonResponse({ error: 'Email and code required' }, 400);
      const user = await DB.prepare('SELECT * FROM users WHERE email = ? AND access_code = ? AND status = ?').bind(email, code.toUpperCase(), 'approved').first();
      if (!user) return jsonResponse({ error: 'Invalid email or code' }, 401);
      const token = generateToken();
      await DB.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').bind(token, user.id, Date.now()).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `mx_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`
        }
      });
    }

    if (path === '/api/logout' && method === 'POST') {
      const token = getCookie(request, 'mx_session');
      if (token) await DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'mx_session=; Path=/; Max-Age=0' }
      });
    }

    // ---- Auth gate for all other routes ----
    const session = await getSession(request, DB);
    if (!session) {
      // Serve auth page for HTML requests, 401 for everything else
      const accept = request.headers.get('Accept') || '';
      if (accept.includes('text/html')) return htmlResponse(AUTH_HTML);
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // ---- Serve static assets ----
    return env.ASSETS.fetch(request);
  }
};
