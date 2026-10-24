import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishWebcam} from './publish.js';

function setup(getUserMedia) {
  Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia}},configurable:true});
  let peer;
  globalThis.RTCPeerConnection=class {
    constructor(){peer=this;this.iceGatheringState='complete';}
    addTransceiver(track,options){assert.equal(options.direction,'sendonly');assert.equal(track.kind,'video');}
    async createOffer(){return {type:'offer',sdp:'webcam-offer'};}
    async setLocalDescription(d){this.localDescription=d;}
    async setRemoteDescription(d){assert.deepEqual(d,{type:'answer',sdp:'gateway-answer'});}
    close(){this.closed=true;}
  };
  return ()=>peer;
}

test('webcam publishes through WHIP without requesting audio and stops on abort',async()=>{
  let stopped=0;const requests=[];
  const track={kind:'video',stop:()=>stopped++,addEventListener(){}};
  const getPeer=setup(async options=>{assert.equal(options.audio,false);return {getTracks:()=>[track],getVideoTracks:()=>[track]};});
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,headers:new Headers({Location:'/webcam/whip/session-1'}),text:async()=> 'gateway-answer'};};
  const controller=new AbortController();
  const close=await publishWebcam(controller.signal);
  assert.equal(requests[0].url,'http://127.0.0.1:8889/webcam/whip');
  assert.equal(requests[0].options.body,'webcam-offer');
  controller.abort();close();
  assert.equal(stopped,1);assert.equal(getPeer().closed,true);
  assert.equal(requests.filter(r=>r.options.method==='DELETE').length,1);
});

test('permission refusal produces an actionable camera error',async()=>{
  setup(async()=>{throw new DOMException('Denied','NotAllowedError');});
  await assert.rejects(publishWebcam(new AbortController().signal),/permission was declined/);
});

test('stopping while permission is pending releases the camera after it arrives',async()=>{
  let resolveCamera,stopped=0;
  const getPeer=setup(()=>new Promise(resolve=>{resolveCamera=resolve;}));
  const controller=new AbortController();const pending=publishWebcam(controller.signal);
  controller.abort();
  const track={stop:()=>stopped++};resolveCamera({getTracks:()=>[track]});
  await assert.rejects(pending,{name:'AbortError'});
  assert.equal(stopped,1);assert.equal(getPeer(),undefined);
});
