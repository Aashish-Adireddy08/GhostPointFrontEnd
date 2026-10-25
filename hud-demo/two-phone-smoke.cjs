// Two independent synthetic publishers: no physical iPhone capture is verified here.
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const origin = execFileSync('ssh', ['-i', process.env.HUD_SSH_IDENTITY, '-o', 'BatchMode=yes',
    'aashish@64.177.50.116', 'cat /home/aashish/.local/share/ghostpoint-frontend/releases/hud-20261025/runtime/https-url'], {encoding: 'utf8'}).trim();
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH});
  try {
    const page = await browser.newPage();
    await page.goto(origin + '/?hud=1');
    await page.getByRole('heading', {name: 'Eyes on the ground.'}).waitFor();
    const metadata = await (await page.request.get(origin + '/version.json')).json();
    await page.evaluate(async () => {
      window.publishers = [];
      for (const [index, name] of ['hud', 'hud2'].entries()) {
        const canvas = document.createElement('canvas');canvas.width = 390;canvas.height = 844;
        const ctx = canvas.getContext('2d');let counter = 0;
        const timer = setInterval(() => {
          ctx.fillStyle = index === 0 ? '#1538c7' : '#176c35';ctx.fillRect(0, 0, 390, 844);
          ctx.fillStyle = '#f0cc11';ctx.fillRect(0, 0, 390, 70);ctx.fillRect(0, 774, 390, 70);
          ctx.fillStyle = 'white';ctx.font = '22px sans-serif';
          ctx.fillText('SYNTHETIC PHONE ' + (index + 1), 15, 300);ctx.fillText(String(counter++), 20, 400);
        }, 50);
        const stream = canvas.captureStream(20);const pc = new RTCPeerConnection();
        pc.addTransceiver(stream.getVideoTracks()[0], {direction: 'sendonly', streams: [stream]});
        await pc.setLocalDescription(await pc.createOffer());
        await new Promise((resolve, reject) => {
          if(pc.iceGatheringState === 'complete') return resolve();
          const deadline = setTimeout(() => reject(Error('Publisher ICE timeout')), 15000);
          pc.onicegatheringstatechange = () => {if(pc.iceGatheringState === 'complete'){clearTimeout(deadline);resolve();}};
        });
        const response = await fetch('/media/' + name + '/whip', {method: 'POST', headers: {'Content-Type': 'application/sdp'}, body: pc.localDescription.sdp});
        if(response.status !== 201) throw Error(name + ' WHIP HTTP ' + response.status);
        const resource = new URL(response.headers.get('Location'), location.origin).href;
        await pc.setRemoteDescription({type: 'answer', sdp: await response.text()});
        window.publishers.push({pc, stream, timer, resource});
      }
    });
    await page.waitForFunction(() => window.publishers.every(p => p.pc.connectionState === 'connected'), null, {timeout: 30000});
    await page.getByRole('button', {name: 'Watch phone broadcasts', exact: true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.videoHeight > 0 && v.currentTime > 1), null, {timeout: 30000});
    const frames = await page.evaluate(() => [...document.querySelectorAll('video')].map(video => {
      const canvas = document.createElement('canvas');canvas.width = video.videoWidth;canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');ctx.drawImage(video, 0, 0);
      const pixel = y => Array.from(ctx.getImageData(10, y, 1, 1).data).slice(0, 3);
      return {width: video.videoWidth, height: video.videoHeight, top: pixel(10), center: pixel(Math.floor(video.videoHeight * .6)), bottom: pixel(video.videoHeight - 10)};
    }));
    assert.equal(frames.length, 2);
    for(const frame of frames){assert(frame.top[0] > 150);assert(frame.bottom[0] > 150);assert(frame.height / frame.width > 2);}
    assert(frames[0].center[2] > frames[0].center[0] + 80, 'Phone 1 must show blue publisher');
    assert(frames[1].center[1] > frames[1].center[0] + 40, 'Phone 2 must show green publisher');
    if(process.env.HUD_SCREENSHOT) await page.screenshot({path: process.env.HUD_SCREENSHOT, fullPage: true});
    // Stopping phone 1 must leave phone 2 receiving fresh frames.
    const before = await page.evaluate(() => document.querySelectorAll('video')[1].currentTime);
    await page.evaluate(async () => {
      const p = window.publishers[0];const response = await fetch(p.resource, {method: 'DELETE'});
      if(response.status !== 200)throw Error('Phone 1 DELETE failed');
      p.pc.close();p.stream.getTracks().forEach(t => t.stop());clearInterval(p.timer);
    });
    await page.waitForFunction(time => document.querySelectorAll('video')[1].currentTime > time + .5, before, {timeout: 15000});
    await page.getByRole('button', {name: 'Disconnect', exact: true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.srcObject === null));
    await page.evaluate(async () => {
      const p = window.publishers[1];const response = await fetch(p.resource, {method: 'DELETE'});
      if(response.status !== 200)throw Error('Phone 2 DELETE failed');
      p.pc.close();p.stream.getTracks().forEach(t => t.stop());clearInterval(p.timer);
    });
    console.log(JSON.stringify({twoPhoneTransport: 'passed', ...metadata, frames, independentStop: 'passed', cleanup: 'passed'}));
  } finally {await browser.close();}
}
main().catch(error => {console.error(error.message);process.exitCode = 1;});
