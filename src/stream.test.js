import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStream} from './stream.js';

test('WHEP negotiates a receive-only feed and deletes its resource once on disconnect',async()=>{
 const requests=[];let pc;
 globalThis.RTCPeerConnection=class{
  constructor(){pc=this;this.iceGatheringState='complete';}
  addTransceiver(kind,config){assert.equal(kind,'video');assert.equal(config.direction,'recvonly');}
  async createOffer(){return {type:'offer',sdp:'offer-sdp'};}
  async setLocalDescription(d){this.localDescription=d;}
  async setRemoteDescription(d){assert.deepEqual(d,{type:'answer',sdp:'answer-sdp'});}
  close(){this.closed=true;}
 };
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,headers:new Headers({Location:'/sessions/abc'}),text:async()=> 'answer-sdp'};};
 const video={srcObject:null};const controller=new AbortController();
 const close=await openStream('https://gateway.example.com/alpha/whep',video,()=>{},()=>{},controller.signal);
 assert.equal(requests[0].options.body,'offer-sdp');assert.equal(requests[0].options.headers['Content-Type'],'application/sdp');
 controller.abort();close();assert.equal(pc.closed,true);assert.equal(video.srcObject,null);
 assert.equal(requests.filter(r=>r.options.method==='DELETE').length,1);
 assert.equal(requests[1].url,'https://gateway.example.com/sessions/abc');
});

test('gateway HTTP failure closes the peer connection and surfaces the error',async()=>{
 let closed=false;
 globalThis.RTCPeerConnection=class{
  constructor(){this.iceGatheringState='complete';}
  addTransceiver(){} async createOffer(){return {type:'offer',sdp:'offer'};}
  async setLocalDescription(d){this.localDescription=d;}close(){closed=true;}
 };
 globalThis.fetch=async()=>({ok:false,status:503});
 await assert.rejects(openStream('https://gateway.example.com/alpha/whep',{srcObject:null},()=>{},()=>{},new AbortController().signal),/HTTP 503/);
 assert.equal(closed,true);
});
