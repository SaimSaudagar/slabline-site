// Sends the visitor their copy after they fill in a form on the landing page (Vercel serverless function).
// The email body is built here from fixed templates; the browser only sends names, numbers and answer keys,
// so this endpoint can't be used to send arbitrary messages.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   required, from resend.com (never commit it)
//   MAIL_FROM        e.g. "Saim from Slabline <saim@glintvex.com>" (domain must be verified in Resend)
//   REPLY_TO         where visitor replies go, e.g. gptsaim@gmail.com
//   ALLOWED_ORIGINS  comma-separated, e.g. https://slabline.glintvex.com
//   CALENDLY_URL     booking link shown in the emails

const LEAKS = {
  speed:   { h: "Your price arrives after the other guys'", f: 'Price from satellite at your desk and send the estimate the same afternoon.' },
  measure: { h: 'You drive out before you can price', f: "Measure from aerial imagery for the first price; visit once they're serious." },
  look:    { h: "Your quote doesn't look like a $10k company", f: 'Send an estimate page with your logo, line items, terms and an Approve button.' },
  options: { h: 'One price, one shot', f: 'Show 2–3 options (finish, thickness, sealer) so they pick, not haggle.' },
  follow:  { h: 'Quotes go quiet and stay quiet', f: 'A 3-touch follow-up (day 2, day 5, day 10) that goes out under your name automatically.' },
  deposit: { h: 'Approved jobs can still walk', f: 'Collect the deposit online the moment they approve.' },
};

const hits = new Map(); // simple per-instance rate limit: 5 sends per IP per 10 minutes
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

const clean = (v, n = 80) => String(v == null ? '' : v).replace(/[\r\n<>]/g, ' ').trim().slice(0, n);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

function scorecard(d, cal) {
  const score = Math.round(num(d.score, 0, 100));
  const grade = score >= 80 ? 'Fast lane' : score >= 55 ? 'Leaking a few jobs' : 'Leaking jobs every month';
  const quotes = Math.round(num(d.quotes, 0, 500)), close = Math.round(num(d.close, 0, 100));
  const lost = num(d.lost, 0, 500), jobs = num(d.jobs, 0, 500), monthly = num(d.monthly, 0, 10000000);
  const leaks = (Array.isArray(d.leaks) ? d.leaks : []).filter((k) => LEAKS[k]).slice(0, 3);
  const first = esc(clean(d.name, 40).split(/\s+/)[0] || 'there');
  const fixes = leaks.length
    ? leaks.map((k, i) => `<tr><td style="padding:10px 0;border-top:1px solid #e5e7eb"><b>${i + 1}. ${esc(LEAKS[k].h)}</b><br><span style="color:#4b5563">Fix: ${esc(LEAKS[k].f)}</span></td></tr>`).join('')
    : '<tr><td style="padding:10px 0">You are already quoting fast. Nice work.</td></tr>';
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#12141a;line-height:1.5">
  <p>Hi ${first},</p>
  <p>Thanks for taking the Quote Speed Scorecard. Here's your report.</p>
  <div style="background:#f5f6f8;border-radius:14px;padding:20px;margin:18px 0">
    <div style="font-size:44px;font-weight:800;color:#ff5b1f;line-height:1">${score}<span style="font-size:16px;color:#868d98">/100</span></div>
    <div style="font-weight:700;margin-top:6px">${grade}</div>
  </div>
  <p style="margin:0 0 6px"><b>Your numbers</b></p>
  <table style="width:100%;border-collapse:collapse;font-size:15px">
    <tr><td>Quotes that don't close each month</td><td style="text-align:right"><b>${Math.round(lost)}</b></td></tr>
    <tr><td>Jobs you might win back each month</td><td style="text-align:right"><b>${jobs > 0 && jobs < 1 ? jobs.toFixed(1) : Math.round(jobs)}</b></td></tr>
    <tr><td>Rough value per month</td><td style="text-align:right"><b>${money(monthly)}</b></td></tr>
  </table>
  <p style="font-size:13px;color:#868d98">Estimate from your answers: ${quotes} quotes × ${100 - close}% that don't close today. A faster price could win back up to 10% of those and steady follow-up up to another 10%. Not a promise.</p>
  <p style="margin:22px 0 0"><b>Your top fixes</b></p>
  <table style="width:100%;border-collapse:collapse;font-size:15px">${fixes}</table>
  <p style="margin-top:24px">Want these fixed under your own logo? On a 20-minute call I'll show you the system set up with your company name.</p>
  <p><a href="${esc(cal)}" style="display:inline-block;background:#ff5b1f;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px">Book a 20-minute call</a></p>
  <p>Saim<br><span style="color:#868d98">Slabline · quoting systems for concrete contractors<br><a href="https://slabline.glintvex.com" style="color:#868d98">slabline.glintvex.com</a></span></p>
</div>`;
  return { subject: `Your Quote Speed Score: ${score}/100`, html };
}

function sample(d, cal) {
  const first = esc(clean(d.name, 40).split(/\s+/)[0] || 'there');
  const company = esc(clean(d.company, 80) || 'your company');
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#12141a;line-height:1.55">
  <p>Hi ${first},</p>
  <p>Thanks for requesting a sample quote for <b>${company}</b>. I'm building it now: a real driveway estimate under your company name, the same page your homeowners would see. You'll get it from me within 24 hours.</p>
  <p>To make it look exactly like yours, just reply to this email with:</p>
  <ul><li>your logo (any format is fine)</li><li>one recent quote, if you have one handy</li></ul>
  <p>Rather walk through it live? <a href="${esc(cal)}" style="color:#ff5b1f;font-weight:700">Book 20 minutes here</a>.</p>
  <p>Saim<br><span style="color:#868d98">Slabline · quoting systems for concrete contractors<br><a href="https://slabline.glintvex.com" style="color:#868d98">slabline.glintvex.com</a></span></p>
</div>`;
  return { subject: `Your sample quote for ${clean(d.company, 60) || 'your company'} is on the way`, html };
}

module.exports = async (req, res) => {
  const origins = (process.env.ALLOWED_ORIGINS || 'https://slabline.glintvex.com').split(',').map((s) => s.trim());
  const origin = req.headers.origin || '';
  if (origins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!origins.includes(origin)) return res.status(403).json({ ok: false, error: 'origin not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'too many requests' });

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};
  const to = clean(d.email, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return res.status(400).json({ ok: false, error: 'invalid email' });
  if (d.fax_line) return res.status(200).json({ ok: true }); // bot trap

  const cal = process.env.CALENDLY_URL || 'https://calendly.com/glintvex/concrete';
  const mail = d.type === 'scorecard' ? scorecard(d, cal) : d.type === 'sample' ? sample(d, cal) : null;
  if (!mail) return res.status(400).json({ ok: false, error: 'unknown type' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'email is not configured' });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Saim from Slabline <saim@glintvex.com>',
      to: [to],
      reply_to: process.env.REPLY_TO || undefined,
      subject: mail.subject,
      html: mail.html,
    }),
  });
  if (!r.ok) { const t = await r.text(); console.error('resend error', r.status, t.slice(0, 300)); return res.status(502).json({ ok: false, error: 'send failed' }); }
  return res.status(200).json({ ok: true });
};
