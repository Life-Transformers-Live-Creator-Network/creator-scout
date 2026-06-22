const https = require('https');
const KEY = 'a8f6379e56msha064e6f09f16af8p1bab70jsn1a617fdef4e9';
const HOST = 'tiktok-api23.p.rapidapi.com';
const SB = 'mfpnlrfipurarjnpkjjf.supabase.co';
const SK = 'sb_publishable_GIY7xq7siIu7xhhO_VBx1Q_B4jvxetO';
const NICHES = ['Fortnite','Minecraft','Roblox','Just Chatting','Music','Beauty','Fitness','Cooking','Daily Life','Talk Show'];

function get(n) {
  return new Promise((res, rej) => {
    const path = '/api/live/stream?related_live_tag=' + encodeURIComponent(n) + '&load_more=true';
    const opts = {
      hostname: HOST,
      path: path,
      method: 'GET',
      headers: {
        'x-rapidapi-key': KEY,
        'x-rapidapi-host': HOST
      }
    };
    const r = https.request(opts, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        try { res(JSON.parse(d)); } catch(e) { rej(e); }
      });
    });
    r.on('error', rej);
    r.end();
  });
}

function save(c) {
  return new Promise((res, rej) => {
    const body = JSON.stringify(c);
    const opts = {
      hostname: SB,
      path: '/rest/v1/creators',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SK,
        'Authorization': 'Bearer ' + SK,
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const r = https.request(opts, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        console.log('save status:', resp.statusCode, d);
        res(resp.statusCode);
      });
    });
    r.on('error', rej);
    r.write(body);
    r.end();
  });
}

async function run() {
  console.log('Scanning', new Date().toISOString());
  let saved = 0;
  for (const n of NICHES) {
    try {
      const json = await get(n);
      const streams = json.data || [];
      console.log(n + ': ' + streams.length + ' streams');
      for (const s of streams) {
        const room = s.data;
        if (!room || !room.owner) continue;
        const o = room.owner;
        const username = o.display_id || o.unique_id;
        if (!username) continue;
        const creator = {
          username: username,
          nickname: o.nickname || username,
          followers: o.follow_info ? o.follow_info.follower_count : 0,
          viewers: room.user_count || 0,
          likes: room.like_count || 0,
          niche: n,
          last_seen: new Date().toISOString()
        };
        const status = await save(creator);
        if (status === 200 || status === 201) saved++;
      }
    } catch(e) {
      console.log('Error for ' + n + ':', e.message);
    }
  }
  console.log('Done. Saved', saved);
}

run();
