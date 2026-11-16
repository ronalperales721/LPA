const URL_SERVIDOR = 'http://127.0.0.1:5050';

chrome.runtime.onMessage.addListener((mensaje, _sender, responder) => {
  if (mensaje.tipo === 'HABLAR_LOCAL') {
    fetch(`${URL_SERVIDOR}/hablar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: mensaje.texto })
    })
      .then((res) => responder({ ok: res.ok }))
      .catch(() => responder({ ok: false }));
    return true;
  }

  if (mensaje.tipo === 'DETENER_LOCAL') {
    fetch(`${URL_SERVIDOR}/detener`, { method: 'POST' }).catch(() => {});
  }

  if (mensaje.tipo === 'SIGUIENTE_VOZ') {
    fetch(`${URL_SERVIDOR}/siguiente_voz`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.activa) {
          chrome.storage.local.set({ vozPiperActiva: data.activa });
        }
        responder({ ok: true, data });
      })
      .catch(() => responder({ ok: false }));
    return true;
  }
});