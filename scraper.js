const https = require('https');
const KEY = 'a8f6379e56msha064e6f09f16af8p1bab70jsn1a617fdef4e9';
const HOST = 'tiktok-api23.p.rapidapi.com';
const SB = 'mfpnlrfipurarjnpkjjf.supabase.co';
const SK = 'sb_publishable_GIY7xq7siIu7xhhO_VBx1Q_B4jvxetO';

const NICHES = [
  'Fortnite','Minecraft','Roblox','Just Chatting','Music','Beauty','Fitness',
  'Cooking','Daily Life','Talk Show','Gaming','Dance','Comedy','Fashion',
  'Sports','Travel','Art','Animals','Food','DIY','Education','News',
  'Crypto','Cars','Makeup','Hair','Nails','Singing','Guitar','Piano',
  'Football','Basketball','Boxing','MMA','Yoga','Meditation','Reading',
  'Drawing','Photography','Vlog','Chatting','ASMR','Karaoke','Podcast'
];

function get(niche) {
  return new Promise((res, rej) => {
    const path = '/api/live/stream?related_live_tag=' + encodeURIComponent(niche) + '&load_more=true';
    const opts = {
      hostname: HOST, path, method: 'GET',
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    };
    const r = https.request(opts, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { res(JSON.parse(d)); } catch(e) { rej(e); } });
    });
    r.on('error', rej);
    r.end();
  });
}

function checkExists(username) {
  return new Promise((res, rej) => {
    const opts = {
      hostname: SB,
      path: '/rest/v1/creators?username=eq.' + username + '&select=username',
      method: 'GET',
      headers: { 'apikey': SK, 'Authorization': 'Bearer ' + SK }
    };
    const r = https.request(opts, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        try {
          const rows = JSON.parse(d);
          res(rows.length > 0);
        } catch(e) { res(false); }
      });
    });
    r.on('error', () => res(false));
    r.end();
  });
}

function save(creator) {
  return new Promise((res, rej) => {
    const body = JSON.stringify(creator);
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
      resp.on('end', () => res(resp.statusCode));
    });
    r.on('error', rej);
    r.write(body);
    r.end();
  });
}

async function run() {
  console.log('Scanning', new Date().toISOString());
  let saved = 0;
  let skippedExisting = 0;
  let skippedFollowers = 0;

  for (const niche of NICHES) {
    try {
      const json = await get(niche);
      const streams = json.data || [];
      console.log(niche + ': ' + streams.length + ' streams');

      for (const s of streams) {
        const room = s.data;
        if (!room || !room.owner) continue;
        const o = room.owner;
        const username = o.display_id || o.unique_id;
        if (!username) continue;

        const followers = o.follow_info ? o.follow_info.follower_count : 0;
        if (followers > 250000) { skippedFollowers++; continue; }

        const exists = await checkExists(username);
        if (exists) { skippedExisting++; continue; }

        const creator = {
          username,
          nickname: o.nickname || username,
          followers,
          viewers: room.user_count || 0,
          likes: room.like_count || 0,
          niche,
          last_seen: new Date().toISOString()
        };

        const status = await save(creator);
        if (status === 200 || status === 201) {
          saved++;
          console.log('✅ Saved:', username, '(' + followers + ' followers)');
        }
      }
    } catch(e) {
      console.log('Error for ' + niche + ':', e.message);
    }
  }

  console.log('---');
  console.log('Done. Saved:', saved);
  console.log('Skipped (already in DB):', skippedExisting);
  console.log('Skipped (too many followers):', skippedFollowers);
}

run();
