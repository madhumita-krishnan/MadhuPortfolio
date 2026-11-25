/* Site check collector (Vercel function, no dependencies). Her 2026-11-25: "there should be like a back end where you can like store all
   this information and like have it sent back. And it doesn't matter if you're doing something … it should all just come through to
   you." A phone running m--k.me/check POSTs its report here; it is stored in the free Upstash Redis store connected to this Vercel
   project (env KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + _TOKEN) and read back later with tools/read-checks.mjs.
   Privacy: approximate city / region / country from Vercel's own headers; the visitor's IP address is never stored. */
const MAX = 65536, KEEP = 10000;

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST only'); }
  try {
    /* Vercel may hand the body over already parsed (req.body) or as a stream: take either, capped at 64 KB */
    let j = req.body;
    if (j === undefined || j === null) { let raw = ''; for await (const c of req) { raw += c; if (raw.length > MAX) { res.statusCode = 413; return res.end('too big'); } } j = raw; }
    if (typeof j === 'string') { if (j.length > MAX) { res.statusCode = 413; return res.end('too big'); } j = JSON.parse(j || '{}'); }
    if (JSON.stringify(j).length > MAX) { res.statusCode = 413; return res.end('too big'); }
    if (!j.check) { res.statusCode = 400; return res.end('not a check'); }
    const h = (k) => { const v = req.headers[k]; return v ? decodeURIComponent(String(v)) : null; };
    const line = {
      at: new Date().toISOString(),
      where: { city: h('x-vercel-ip-city'), region: h('x-vercel-ip-country-region'), country: h('x-vercel-ip-country') },
      check: String(j.check).slice(0, 40), stage: String(j.stage || '').slice(0, 40), run: String(j.run || '').slice(0, 40),
      who: String(j.who || '').slice(0, 40), self: !!j.self, ua: String(j.ua || req.headers['user-agent'] || '').slice(0, 400), report: j.report || null,
    };
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    /* EVERY report also goes to Vercel's own logs, whole (her 2026-11-25 yes to "the logs fallback"): with no store connected, or the
       store failing, the report is still kept (free plan: about an hour) and the phone is told it arrived. One line, prefixed. */
    const logLine = () => console.log('SITE-CHECK ' + JSON.stringify(line).slice(0, 60000));
    if (!url || !tok) { logLine(); res.statusCode = 204; return res.end(); }
    const call = (cmds) => fetch(url + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify(cmds) });
    /* flood guard: 30 reports a minute per connection. The key is a ONE-WAY hash of the address, kept 60 seconds, never stored */
    const ip = String(req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim();   // Vercel sets x-real-ip itself; a visitor can't forge it
    if (ip) {
      const key = 'rl:' + require('crypto').createHash('sha256').update(ip + new Date().toISOString().slice(0, 10)).digest('hex').slice(0, 24);
      const rl = await call([['INCR', key], ['EXPIRE', key, '60']]).then((x) => x.json()).catch(() => null);
      if (rl && rl[0] && rl[0].result > 30) { res.statusCode = 429; return res.end('slow down'); }
    }
    // the store unreachable or failing is not the phone's problem: the report is logged either way and the phone told it arrived
    await call([['LPUSH', 'site-checks', JSON.stringify(line)], ['LTRIM', 'site-checks', '0', String(KEEP - 1)]]).catch(() => null);
    logLine();
    res.statusCode = 204; return res.end();
  } catch (e) {
    res.statusCode = 400; return res.end('bad check: ' + (e && e.message));
  }
};
