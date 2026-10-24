// WHEP playback: the gateway receives RTP/UDP and exposes SDP over HTTPS.
export async function openStream(url, video, onState, onStats, signal, iceServers = []) {
  const pc = new RTCPeerConnection({ iceServers });
  let resource, timer, previous, closed=false;
  const cleanup = () => { if(closed)return; closed=true; clearInterval(timer); pc.close(); video.srcObject = null; if(resource) fetch(resource,{method:'DELETE',keepalive:true}).catch(()=>{}); };
  signal.addEventListener('abort', cleanup, {once:true});
  try {
    pc.addTransceiver('video', { direction:'recvonly' });
    pc.ontrack = ({track,streams}) => { video.srcObject=streams[0] || new MediaStream([track]); video.play().catch(()=>{}); };
    pc.onconnectionstatechange = () => onState(pc.connectionState);
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((resolve,reject) => {
      if(pc.iceGatheringState==='complete') return resolve();
      const timeout=setTimeout(()=>{finish();reject(new Error('ICE gathering timed out'));},10000);
      const abort=()=>{finish();reject(new DOMException('Aborted','AbortError'));};
      const changed=()=>{if(pc.iceGatheringState==='complete'){finish();resolve();}};
      const finish=()=>{clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',changed);signal.removeEventListener('abort',abort);};
      pc.addEventListener('icegatheringstatechange',changed);signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted) abort();
    });
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/sdp'},body:pc.localDescription.sdp,signal});
    if(!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`);
    const location=response.headers.get('Location'); if(location) resource=new URL(location,url).href;
    const answer=await response.text();
    if(signal.aborted) throw new DOMException('Aborted','AbortError');
    await pc.setRemoteDescription({type:'answer',sdp:answer});
    timer=setInterval(async()=>{try{ const report=await pc.getStats(); report.forEach(s=>{if(s.type==='inbound-rtp'&&s.kind==='video'){const bitrate=previous?(s.bytesReceived-previous.bytes)*8/(s.timestamp-previous.time)/1000:null;previous={bytes:s.bytesReceived,time:s.timestamp};onStats({fps:s.framesPerSecond??0,bitrate:bitrate?.toFixed(2),jitter:Math.round((s.jitter??0)*1000),lost:s.packetsLost??0});}});}catch{}},1000);
    return cleanup;
  } catch(error){cleanup();throw error;}
}
