const URL_SERVIDOR = 'http://127.0.0.1:5050';
const selector = document.getElementById('selector-voz');
const btnProbar = document.getElementById('probar');
const estado = document.getElementById('estado');

async function cargarVocesServidor() {
  try {
    const res = await fetch(`${URL_SERVIDOR}/voces`);
    const data = await res.json();

    selector.innerHTML = '';
    data.voces.forEach((v) => {
      const opcion = document.createElement('option');
      opcion.value = v.id;
      opcion.textContent = v.nombre;
      if (v.id === data.activa) {
        opcion.selected = true;
      }
      selector.appendChild(opcion);
    });

    estado.textContent = 'Atajo rápido en página: Alt + V';
  } catch (e) {
    estado.textContent = 'Servidor Python apagado (ejecuta servidor_voz.py)';
  }
}

async function seleccionarVoz(idVoz) {
  try {
    await fetch(`${URL_SERVIDOR}/cambiar_voz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voz: idVoz, anunciar: true })
    });
    chrome.storage.local.set({ vozPiperActiva: idVoz });
  } catch (e) {
    estado.textContent = 'No se pudo conectar con el servidor';
  }
}

selector.addEventListener('change', () => seleccionarVoz(selector.value));
btnProbar.addEventListener('click', () => seleccionarVoz(selector.value));

cargarVocesServidor();