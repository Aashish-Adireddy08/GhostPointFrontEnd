// Synthetic browser -> WHIP -> Vultr -> real viewer test. This does NOT verify iPhone capture.
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const identity = process.env.HUD_SSH_IDENTITY;
  if (!identity) throw new Error('Set HUD_SSH_IDENTITY to the working SSH private key path.');
  const remote = 'cat /home/aashish/.local/share/ghostpoint-frontend/releases/hud-20261025/runtime/https-url';
  const output = execFileSync('ssh', ['-i', identity, '-o', 'BatchMode=yes', 'aashish@64.177.50.116', remote], {encoding: 'utf8'});
  const origin = output.trim();
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH});
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin + '/?hud=1');
    await page.getByRole('heading', {name: 'Eyes on the ground.'}).waitFor();
    const metadata = await (await page.request.get(origin + '/version.json')).json();
    console.log(JSON.stringify({version: metadata.version, commit: metadata.commit, login: 'not required'}));
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 844;
      const ctx = canvas.getContext('2d');
      let frame = 0;
      window.testDraw = setInterval(() => {
        ctx.fillStyle = '#1538c7'; ctx.fillRect(0, 0, 390, 844);
        ctx.fillStyle = '#f0cc11'; ctx.fillRect(0, 0, 390, 70); ctx.fillRect(0, 774, 390, 70);
        ctx.fillStyle = 'white'; ctx.font = '24px sans-serif';
        ctx.fillText('SYNTHETIC transport test', 10, 300); ctx.fillText(String(frame++), 50, 450);
      }, 50);
      const stream = canvas.captureStream(20);
      const pc = new RTCPeerConnection();
      pc.addTransceiver(stream.getVideoTracks()[0], {direction: 'sendonly', streams: [stream]});
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise((resolve, reject) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const timeout = setTimeout(() => reject(new Error('ICE timeout')), 15000);
        pc.onicegatheringstatechange = () => {if (pc.iceGatheringState === 'complete') {clearTimeout(timeout); resolve();}};
      });
      const response = await fetch('/media/hud/whip', {method: 'POST', headers: {'Content-Type': 'application/sdp'}, body: pc.localDescription.sdp});
      if (response.status !== 201) throw new Error('WHIP HTTP ' + response.status);
      const resource = new URL(response.headers.get('Location'), location.origin).href;
      await pc.setRemoteDescription({type: 'answer', sdp: await response.text()});
      window.testPublisher = {pc, stream, resource};
    });
    await page.waitForFunction(() => window.testPublisher.pc.connectionState === 'connected', null, {timeout: 30000})
      .catch(async error => {throw new Error('Publisher media failed: ' + await page.evaluate(() => window.testPublisher.pc.connectionState) + '; ' + error.message);});
    await page.getByRole('button', {name: 'Watch phone broadcasts', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('video').videoWidth > 0 && document.querySelector('video').currentTime > 1, null, {timeout: 30000})
      .catch(async error => {throw new Error('Dashboard media failed: ' + await page.locator('.feed').first().textContent() + '; ' + error.message);});
    const result = await page.evaluate(async () => {
      const video = document.querySelector('video');
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0);
      const pixel = y => Array.from(ctx.getImageData(10, y, 1, 1).data).slice(0, 3);
      const stats = await window.testPublisher.pc.getStats();
      let protocol;
      stats.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) {
        const pair = stats.get(s.selectedCandidatePairId); protocol = stats.get(pair.remoteCandidateId).protocol;
      }});
      return {width: video.videoWidth, height: video.videoHeight, top: pixel(10), bottom: pixel(video.videoHeight - 10), protocol};
    });
    if (result.top[0] < 150 || result.bottom[0] < 150 || result.height / result.width < 2) throw new Error('Portrait frame edges missing.');
    console.log(JSON.stringify({syntheticTransport: 'passed', ...result}));
    if (process.env.HUD_SCREENSHOT) await page.screenshot({path: process.env.HUD_SCREENSHOT, fullPage: true});
    await page.getByRole('button', {name: 'Disconnect', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('video').srcObject === null);
    await page.evaluate(async () => {
      const p = window.testPublisher;
      const response = await fetch(p.resource, {method: 'DELETE'});
      if (response.status !== 200) throw new Error('WHIP DELETE HTTP ' + response.status);
      p.pc.close(); p.stream.getTracks().forEach(t => t.stop()); clearInterval(window.testDraw);
    });
    console.log('Viewer stop and publisher resource DELETE passed. No iPhone was tested.');
  } finally {
    await context?.close(); await browser.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
