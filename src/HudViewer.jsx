import React, {useEffect, useRef, useState} from 'react';
import {openStream} from './stream';
import {appVersion, buildCommit} from './version';
import './hud-viewer.css';

// Separate entry mode: existing demo settings and camera publishing are untouched.
export default function HudViewer() {
  const video = useRef(null);
  const [watching, setWatching] = useState(false);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!watching) return;
    const controller = new AbortController();
    let retry;
    setState('connecting'); setError('');
    const url = new URL('/media/hud/whep', window.location.origin).href;
    const connect = () => openStream(url, video.current, value => {
        if (!controller.signal.aborted) setState(value);
      }, () => {}, controller.signal).catch(error => {
        if (controller.signal.aborted) return;
        if (error.message === 'Gateway returned HTTP 404') {
          setState('Waiting for iPhone broadcast');
          retry = setTimeout(connect, 1000);
        } else { setState('failed'); setError(error.message); }
      });
    void connect();
    return () => {controller.abort();clearTimeout(retry);};
  }, [watching]);
  return <main className="hud-viewer">
    <h1>Ghostpoint · iPhone HUD</h1>
    <p>Rendered iPhone screen · video only</p>
    <p aria-label="Application version">v{appVersion} · {buildCommit}</p>
    <video ref={video} autoPlay playsInline muted aria-label="Complete iPhone HUD broadcast" />
    <button className="button primary" onClick={() => {setWatching(!watching);setState('idle');}}>
      {watching ? 'Stop viewing' : 'Watch broadcast'}
    </button>
    <p role="status">{state}</p>
    {error && <p role="alert">{error} Start Broadcast on the iPhone, then stop and retry viewing.</p>}
  </main>;
}
