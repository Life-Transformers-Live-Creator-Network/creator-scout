const https = require('https');
const KEY = 'a8f6379e56msha064e6f09f16af8p1bab70jsn1a617fdef4e9';
const HOST = 'tiktok-api23.p.rapidapi.com';
const SB = 'mfpnlrfipurarjnpkjjf.supabase.co';
const SK = 'sb_publishable_GIY7xq7siIu7xhhO_VBx1Q_B4jvxetO';

// Broad TikTok live categories
const KEYWORDS = [
  'live','gaming','chat','music','dance','fitness','beauty',
  'cooking','travel','comedy','fashion','sport','art','education'
];

function get(keyword) {
  return new Promise((res, rej) => {
    const path = '/api/live/stream?related_live_tag=' + encodeURIComponent(keyword) + '&load_more=true';
    const r = https.request({
      hostname: HOST, path, method: 'GET',
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res({}); } });
    });
    r.on('error', () => res({}));
    r.end();
  });
}

function checkExists(username) {
  return new Promise((res) => {
    const r = https.request({
      hostname: SB,
      path: '/rest/v1/creators?username=eq.' + encodeURIComponent(username) + '&select=username',
      method: 'GET',
      headers: { 'apikey': SK, 'Authorization': 'Bearer ' + SK }
    }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        try { res(JSON.parse(d).length > 0); } catch(e) { res(false); }
      });
    });
    r.on('error', () => res(false));
    r.end();
  });
}

function save(creator) {
  return new Promise((res) => {
    const body = JSON.stringify(creator);
    const r = https.request({
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
    }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => res(resp.statusCode));
    });
    r.on('error', () => res(0));
    r.write(body);
    r.end();
  });
}

async function run() {
  console.log('Scanning', new Date().toISOString());
  let saved = 0, skippedDB = 0, skippedFollowers = 0;
  const seenThisRun = new Set();

  for (const keyword of KEYWORDS) {
    try {
      const json = await get(keyword);
      const streams = json.data || [];
      console.log(keyword + ': ' + streams.length + ' streams');

      for (const s of streams) {
        const room = s.data;
        if (!room || !room.owner) continue;
        const o = room.owner;
        const username = o.display_id || o.unique_id;
        if (!username) continue;

        // Skip if already seen in this run
        if (seenThisRun.has(username)) continue;
        seenThisRun.add(username);

        // Skip if over 250k followers
        const followers = o.follow_info ? o.follow_info.follower_count : 0;
        if (followers > 250000) {
          skippedFollowers++;
          console.log('SKIP (followers ' + followers + '):', username);
          continue;
        }

        // Skip if already in database
        const exists = await checkExists(username);
        if (exists) {
          skippedDB++;
          continue;
        }

        // Save new creator
        const status = await save({
          username,
          nickname: o.nickname || username,
          followers,
          viewers: room.user_count || 0,
          likes: room.like_count || 0,
          niche: keyword,
          last_seen: new Date().toISOString()
        });

        if (status === 200 || status === 201) {
          saved++;
          console.log('SAVED:', username, followers + ' followers');
        }
      }
    } catch(e) {
      console.log('Error for ' + keyword + ':', e.message);
    }
  }

  console.log('---');
  console.log('Saved:', saved);
  console.log('Skipped (in DB already):', skippedDB);
  console.log('Skipped (over 250k):', skippedFollowers);
}

run();
