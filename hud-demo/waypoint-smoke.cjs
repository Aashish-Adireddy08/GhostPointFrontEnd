// Real dashboard + HTTP permission flow, using synthetic coordinates, not native AR.
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main(){
  const origin=execFileSync('ssh',['-i',process.env.HUD_SSH_IDENTITY,'-o','BatchMode=yes','aashish@64.177.50.116',
    'cat /home/aashish/.local/share/ghostpoint-frontend/releases/hud-20261025/runtime/https-url'],{encoding:'utf8'}).trim();
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const context=await browser.newContext();const api=context.request;const sessions=[];
  const post=(path,data)=>api.post(origin+path,{data});
  let changed=false;
  try{
    const before=await (await api.get(origin+'/waypoint')).json();
    if(before.holder||before.point)throw Error('A real waypoint is in use; leaving it unchanged.');
    for(let i=0;i<2;i++){
      const response=await post('/broadcast/claim',{});assert.equal(response.status(),200);
      sessions.push(await response.json());
    }
    const [a,b]=sessions;
    const page=await context.newPage();await page.goto(origin+'/?hud=1');
    await page.getByRole('region',{name:'Waypoint controls'}).waitFor();
    await page.waitForFunction(stream=>[...document.querySelector('#waypoint-owner').options].some(o=>o.value===stream),a.stream);
    await page.getByLabel('Phone allowed to place').selectOption(a.stream);changed=true;
    await page.waitForFunction(()=>document.querySelector('.waypoint-panel').textContent.includes('can tap Place waypoint'));
    const reference={peer:'SMOKE-TEST-NOT-A-PHYSICAL-POINT',epoch:123,position:[1,0,-2]};
    assert.equal((await post('/waypoint/set',{device:b.lease,reference})).status(),403);
    const first=await post('/waypoint/set',{device:a.lease,reference,name:'Loading bay',placement:'feature'});assert.equal(first.status(),200);
    const firstID=(await first.json()).point.id;
    await page.getByText('WAYPOINT ACTIVE',{exact:true}).waitFor();
    await page.getByText('Loading bay',{exact:true}).waitFor();
    await page.getByLabel('Rename waypoint').fill('Exit A');
    await page.getByRole('button',{name:'Save name',exact:true}).click();
    await page.getByText('Exit A',{exact:true}).waitFor();
    assert.equal((await post('/waypoint/clear',{device:b.lease})).status(),403);
    const second=await post('/waypoint/set',{device:a.lease,reference:{...reference,position:[2,0,-3]},name:'Exit A',placement:'distance'});
    assert.equal(second.status(),200);assert.notEqual((await second.json()).point.id,firstID);
    if(process.env.HUD_SCREENSHOT)await page.screenshot({path:process.env.HUD_SCREENSHOT,fullPage:true});
    await page.getByLabel('Phone allowed to place').selectOption(b.stream);
    await page.waitForFunction(stream=>document.querySelector('#waypoint-owner').value===stream,b.stream);
    // Wait for the mutation response, not only the select's temporary value.
    await page.waitForFunction(()=>!document.querySelector('#waypoint-owner').disabled);
    assert.equal((await post('/waypoint/set',{device:a.lease,reference})).status(),403);
    assert.equal((await post('/waypoint/set',{device:b.lease,reference})).status(),200);
    assert.equal((await post('/waypoint/clear',{device:b.lease})).status(),200);
    await page.getByText('NO WAYPOINT',{exact:true}).waitFor();
    assert.equal((await post('/waypoint/set',{device:b.lease,reference,name:'Exit B'})).status(),200);
    await page.getByText('Exit B',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Clear waypoint',exact:true}).click();
    await page.getByText('NO WAYPOINT',{exact:true}).waitFor();
    await page.getByLabel('Phone allowed to place').selectOption('');
    await page.waitForFunction(()=>!document.querySelector('#waypoint-owner').disabled);
    assert.equal((await post('/waypoint/set',{device:b.lease,reference})).status(),403);
    console.log(JSON.stringify({waypointDashboard:'passed',namingAndRename:'passed',phoneClearPermission:'passed',permissionEnforcement:'passed',singlePointReplacement:'passed',transferRevokeClear:'passed',nativeAR:'not tested'}));
  }finally{
    if(changed){await post('/waypoint/clear',{});await post('/waypoint/grant',{stream:null});}
    for(const session of sessions)await post('/broadcast/release',{lease:session.lease});
    await context.close();await browser.close();
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
