const { chromium } = require('playwright');
const https = require('https');

const SB = 'mfpnlrfipurarjnpkjjf.supabase.co';
const SK = 'sb_publishable_GIY7xq7siIu7xhhO_VBx1Q_B4jvxetO';

const SEARCHES = [
  'uk live stream',
  'uk live now',
  'live streaming in uk',
  'uk fashion live',
  'uk cooking live',
  'uk chat live',
  'uk lifestyle live',
  'uk makeup live',
  'uk shopping live',
  'uk music live'
];

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
      resp.on('end', () => { try { res(JSON.parse(d).length > 0); } catch(e) { res(false); } });
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

async function scrape() {
  console.log('\n=== TikTok Live Scraper', new Date().toISOString(), '===');
  let saved = 0, skipped = 0;
  const seenThisRun = new Set();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-GB',
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation']
  });

  for (const search of SEARCHES) {
    try {
      console.log('\nSearching:', search);
      const page = await context.newPage();
      await page.goto('https://www.tiktok.com/search/live?q=' + encodeURIComponent(search), { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Extract usernames from page
      const usernames = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/@"]');
        const users = new Set();
        links.forEach(l => {
          const match = l.href.match(/\/@([^/?]+)/);
          if (match) users.add(match[1]);
        });
        return Array.from(users);
      });

      console.log('Found:', usernames.length, 'creators');

      for (const username of usernames) {
        if (seenThisRun.has(username)) continue;
        seenThisRun.add(username);

        const exists = await checkExists(username);
        if (exists) { skipped++; continue; }

        const status = await save({
          username,
          nickname: username,
          followers: 0,
          viewers: 0,
          likes: 0,
          niche: 'UK Live',
          last_seen: new Date().toISOString()
        });

        if (status === 200 || status === 201) {
          saved++;
          console.log('✅ SAVED:', username);
        }
      }

      await page.close();
      await new Promise(r => setTimeout(r, 2000));

    } catch(e) {
      console.log('Error for', search, ':', e.message);
    }
  }

  await browser.close();
  console.log('\n--- Saved:', saved, '| Skipped:', skipped);
}

scrape();
setInterval(scrape, 60 * 60 * 1000);
console.log('TikTok scraper running every 60 minutes');
