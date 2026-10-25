import React, {useEffect, useState} from 'react';
import './waypoint.css';

const label = stream => `Phone ${['hud','hud2','hud3','hud4'].indexOf(stream)+1}`;
export default function WaypointPanel() {
  const [room,setRoom]=useState({phones:[],holder:null,point:null});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();let timer;
    const poll=async()=>{try{const response=await fetch('/waypoint',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('Waypoint service unavailable');const state=await response.json();if(!controller.signal.aborted)setRoom(state);}catch(e){if(!controller.signal.aborted)setError(e.message);}finally{if(!controller.signal.aborted)timer=setTimeout(poll,1000);}};
    void poll();return()=>{controller.abort();clearTimeout(timer);};
  },[]);
  async function command(action,payload){
    setBusy(true);setError('');
    try{const response=await fetch('/waypoint/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const state=await response.json();if(!response.ok)throw Error(state.error);setRoom(state);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="waypoint-panel" aria-label="Waypoint controls">
    <h2><span className="waypoint-diamond">◆</span> Shared waypoint <span className="count">1 max</span></h2>
    <label htmlFor="waypoint-owner">Phone allowed to place</label>
    <select id="waypoint-owner" value={room.holder||''} disabled={busy} onChange={e=>command('grant',{stream:e.target.value||null})}>
      <option value="">Nobody</option>
      {room.phones.map(phone=><option key={phone.stream} value={phone.stream}>{label(phone.stream)}</option>)}
    </select>
    <p>{room.holder?`${label(room.holder)} can tap Place waypoint in the app, then tap a surface. New placement replaces the previous point.`:'Choose one updated phone to enable waypoint placement.'}</p>
    <div className={'waypoint-state '+(room.point?'set':'')}><span>◆</span><div><strong>{room.point?'WAYPOINT ACTIVE':'NO WAYPOINT'}</strong><small>{room.point?`Set by ${label(room.point.stream)}`:'One shared point for the team'}</small></div></div>
    <button className="button full" disabled={busy||!room.point} onClick={()=>command('clear',{})}>Clear waypoint</button>
    {!room.phones.length&&<p>Phones appear after installing the waypoint update and connecting.</p>}
    {error&&<p role="alert" className="error">{error}</p>}
  </section>;
}
