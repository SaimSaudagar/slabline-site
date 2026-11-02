// Lead capture via FormSubmit (free, no account). Same approach as glintvex.com.
(function(){
  const cfg = window.SLABLINE_CONFIG || {};
  const clean = v => String(v == null ? "" : v).trim();

  window.normalizeUrl = function(v){
    v = clean(v); if(!v) return "";
    if(/^@/.test(v)) return v;                     // social handle
    return /^https?:\/\//i.test(v) ? v : "https://" + v;
  };

  // opts.autoresponse: plain-text email FormSubmit sends to the address in the "email" field
  window.sendLead = function(fields, subject, opts){
    opts = opts || {};
    if(!cfg.leadInbox) return Promise.reject(new Error("No lead inbox configured"));
    const body = new FormData();
    Object.keys(fields).forEach(k => { const v = clean(fields[k]); if(v) body.append(k, v); });
    body.append("_subject", subject);
    if(fields.email) body.append("_replyto", clean(fields.email));
    body.append("_template", "table");
    body.append("_captcha", "false");
    if(opts.autoresponse && fields.email) body.append("_autoresponse", String(opts.autoresponse).slice(0, 4000));
    body.append("Page", location.pathname.split("/").pop() || "index.html");
    return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(cfg.leadInbox), {
      method: "POST", headers: { Accept: "application/json" }, body
    }).then(r => r.json().catch(() => ({}))).then(j => {
      if(j && (j.success === true || j.success === "true")) return j;
      throw new Error((j && j.message) || "Send failed");
    });
  };

  // Shared field set: required + optional
  window.LEAD_FIELDS_HTML = function(prefix){
    const p = prefix || "f";
    return `
    <div class="fgrid">
      <label class="fld"><span>Your name <i>*</i></span><input name="name" id="${p}-name" autocomplete="name" required></label>
      <label class="fld"><span>Company name <i>*</i></span><input name="company" autocomplete="organization" required></label>
      <label class="fld"><span>Email <i>*</i></span><input name="email" type="email" autocomplete="email" required></label>
      <label class="fld"><span>Mobile <i>*</i></span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required pattern="[0-9+()\\-\\s.]{7,}"></label>
      <label class="fld wide"><span>Website <i>*</i> <em>(or Google Business link)</em></span><input name="website" autocomplete="url" inputmode="url" required placeholder="yourcompany.com"></label>
    </div>
    <details class="more"><summary>Add Instagram / Facebook <em>(optional)</em></summary>
      <div class="fgrid">
        <label class="fld"><span>Instagram</span><input name="instagram" placeholder="@yourcompany"></label>
        <label class="fld"><span>Facebook page</span><input name="facebook" placeholder="facebook.com/yourcompany"></label>
      </div>
    </details>
    <input type="text" name="fax_line" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">`;
  };

  window.readLead = function(form){
    const d = Object.fromEntries(new FormData(form).entries());
    if(d.fax_line) return null;   // bot trap (not named _honey: browsers autofill that and FormSubmit drops it)
    delete d.fax_line;
    d.website = normalizeUrl(d.website);
    if(d.facebook) d.facebook = normalizeUrl(d.facebook);
    return d;
  };
})();
