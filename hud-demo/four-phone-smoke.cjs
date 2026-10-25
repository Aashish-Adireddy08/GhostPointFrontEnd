// Four independent synthetic publishers: no physical iPhone capture is verified here.
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
      const assignments = await Promise.all([0,1,2,3].map(async () => {
        const response = await fetch('/broadcast/claim', {method:'POST'});
        if(!response.ok)throw Error('Slot assignment failed');return response.json();
      }));
      if(new Set(assignments.map(a=>a.stream)).size!==4)throw Error('Assignments collided');
      if((await fetch('/broadcast/claim',{method:'POST'})).status!==409)throw Error('Fifth phone must be rejected');
      window.assignments=assignments;
      for (const [index, name] of ['hud', 'hud2', 'hud3', 'hud4'].entries()) {
        const canvas = document.createElement('canvas');canvas.width = 390;canvas.height = 844;
        const ctx = canvas.getContext('2d');let counter = 0;
        const timer = setInterval(() => {
          ctx.fillStyle = ['#1538c7','#176c35','#902aa8','#bc4820'][index];ctx.fillRect(0, 0, 390, 844);
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
        const deadline=Date.now()+15000;
        while(Date.now()<deadline){
          const slots=await (await fetch('/broadcast/slots')).json();
          if(slots.streams.length===index+1 && document.querySelectorAll('video').length===index+1)break;
          await new Promise(resolve=>setTimeout(resolve,200));
        }
        if(document.querySelectorAll('video').length!==index+1)throw Error('Layout did not adapt to '+(index+1)+' phones');
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
    assert.equal(frames.length, 4);
    assert.equal(new Set(frames.map(f=>JSON.stringify(f.center))).size,4);
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
    await page.waitForFunction(time => {
      const videos=[...document.querySelectorAll('video')];
      return videos.length===3 && videos[0].currentTime>time+.5;
    }, before, {timeout:15000});
    await page.getByRole('button', {name: 'Disconnect', exact: true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.srcObject === null));
    await page.evaluate(async () => {
      for (const p of window.publishers.slice(1)) {const response = await fetch(p.resource, {method: 'DELETE'});
      if(response.status !== 200)throw Error('Publisher DELETE failed');
      p.pc.close();p.stream.getTracks().forEach(t => t.stop());clearInterval(p.timer);}
      for(const assignment of window.assignments) await fetch('/broadcast/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lease:assignment.lease})});
    });
    console.log(JSON.stringify({fourPhoneTransport: 'passed', ...metadata, frames, independentStop: 'passed', cleanup: 'passed'}));
  } finally {await browser.close();}
}
main().catch(error => {console.error(error.message);process.exitCode = 1;});
