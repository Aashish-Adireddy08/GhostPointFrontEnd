// Publish a browser camera track to the computer's MediaMTX WHIP endpoint.
export async function publishWebcam(signal, onState = () => {}) {
  let media, pc, resource, closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    pc?.close();
    media?.getTracks().forEach(track => track.stop());
    if (resource) fetch(resource, {method:'DELETE', keepalive:true}).catch(()=>{});
  };
  signal.addEventListener('abort', cleanup, {once:true});
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open this page on localhost in Chrome or Edge to use your webcam.');
    media = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
    if (signal.aborted) { media.getTracks().forEach(track=>track.stop()); throw new DOMException('Aborted','AbortError'); }
    pc = new RTCPeerConnection({iceServers:[]});
    media.getVideoTracks().forEach(track => pc.addTransceiver(track, {direction:'sendonly', streams:[media]}));
    pc.onconnectionstatechange = () => { if (!closed) onState(pc.connectionState); };
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((resolve,reject)=>{
      if(pc.iceGatheringState==='complete') return resolve();
      const finish=()=>{clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',changed);signal.removeEventListener('abort',abort);};
      const changed=()=>{if(pc.iceGatheringState==='complete'){finish();resolve();}};
      const abort=()=>{finish();reject(new DOMException('Aborted','AbortError'));};
      const timeout=setTimeout(()=>{finish();reject(new Error('Webcam network setup timed out.'));},10000);
      pc.addEventListener('icegatheringstatechange',changed);
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted) abort();
    });
    const url='http://127.0.0.1:8889/webcam/whip';
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/sdp'},body:pc.localDescription.sdp,signal});
    if(!response.ok) throw new Error(`Local media server returned HTTP ${response.status}. Stop other webcam publishers and try again.`);
    const location=response.headers.get('Location');
    if(location) resource=new URL(location,url).href;
    const answer=await response.text();
    if(signal.aborted) { if(resource) fetch(resource,{method:'DELETE'}).catch(()=>{}); throw new DOMException('Aborted','AbortError'); }
    await pc.setRemoteDescription({type:'answer',sdp:answer});
    media.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(!closed){onState('ended');cleanup();}},{once:true}));
    return cleanup;
  } catch(error) {
    cleanup();
    if(error.name==='NotAllowedError') throw new Error('Webcam permission was declined. Allow camera access in your browser, then try again.');
    if(error.name==='NotFoundError') throw new Error('No webcam was found. Connect a camera and try again.');
    if(error.name==='NotReadableError') throw new Error('The webcam is busy. Close other camera apps and try again.');
    if(error instanceof TypeError) throw new Error('Cannot reach the local media server. Start the local demo server, then try again.');
    throw error;
  }
}
