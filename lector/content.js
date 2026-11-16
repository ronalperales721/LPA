(() => {
  const estiloFoco = document.createElement('style');
  estiloFoco.textContent = `
    *:focus {
      outline: 3px solid #ff9800 !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(estiloFoco);

  let temporizadorLectura = null;

  function hablarRespaldoNavegador(texto) {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(texto);
    msg.lang = 'es-419';
    msg.rate = 1.1;
    window.speechSynthesis.speak(msg);
  }

  function hablar(texto) {
    if (!texto) return;
    clearTimeout(temporizadorLectura);

    temporizadorLectura = setTimeout(() => {
      try {
        chrome.runtime.sendMessage({ tipo: 'HABLAR_LOCAL', texto }, (respuesta) => {
          if (chrome.runtime.lastError || !respuesta?.ok) {
            hablarRespaldoNavegador(texto);
          }
        });
      } catch (e) {
        hablarRespaldoNavegador(texto);
      }
    }, 45);
  }

  function procesarImagen(img) {
    if (
      img.getAttribute('aria-hidden') === 'true' ||
      img.closest('a, button, [role="button"], [role="link"]') ||
      img.hasAttribute('tabindex')
    ) {
      return;
    }
    img.setAttribute('tabindex', '0');
    if (!img.hasAttribute('role')) img.setAttribute('role', 'img');
  }

  document.querySelectorAll('img').forEach(procesarImagen);

  const observador = new MutationObserver((mutaciones) => {
    for (const mutacion of mutaciones) {
      for (const nodo of mutacion.addedNodes) {
        if (nodo.nodeType !== Node.ELEMENT_NODE) continue;
        if (nodo.tagName === 'IMG') {
          procesarImagen(nodo);
        } else if (nodo.querySelectorAll) {
          nodo.querySelectorAll('img').forEach(procesarImagen);
        }
      }
    }
  });
  observador.observe(document.body, { childList: true, subtree: true });

  function obtenerNombreAccesible(el) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const textos = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText?.trim())
        .filter(Boolean);
      if (textos.length) return textos.join(' ');
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    if (el.id) {
      const labelAsociado = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelAsociado?.innerText?.trim()) return labelAsociado.innerText.trim();
    }
    const labelPadre = el.closest('label');
    if (labelPadre?.innerText?.trim()) return labelPadre.innerText.trim();

    if (el.alt && el.alt.trim()) return el.alt.trim();
    if (el.placeholder && el.placeholder.trim()) return el.placeholder.trim();
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type) && el.value) {
      return el.value.trim();
    }

    const textoInterno = el.innerText?.replace(/\s+/g, ' ').trim();
    if (textoInterno) return textoInterno;

    const imgInterna = el.querySelector('img[alt]');
    if (imgInterna?.alt?.trim()) return imgInterna.alt.trim();

    if (el.title && el.title.trim()) return el.title.trim();

    return '';
  }

  function describirElemento(el) {
    if (!el || el === document.body || el === document.documentElement) return '';

    const tag = el.tagName;
    const role = el.getAttribute('role');
    const nombre = obtenerNombreAccesible(el);

    if (tag === 'A' || role === 'link') return `Enlace, ${nombre || 'sin texto descriptivo'}`;
    if (
      tag === 'BUTTON' ||
      role === 'button' ||
      (tag === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type))
    ) {
      return `Botón, ${nombre || 'sin etiqueta'}`;
    }
    if (tag === 'IMG' || role === 'img') return `Imagen, ${nombre || 'sin descripción alternativa'}`;

    if (tag === 'INPUT') {
      const tipo = el.type || 'text';
      if (tipo === 'checkbox') {
        return `Casilla ${el.checked ? 'marcada' : 'no marcada'}, ${nombre || 'sin etiqueta'}`;
      }
      if (tipo === 'radio') {
        return `Opción ${el.checked ? 'seleccionado' : 'no seleccionado'}, ${nombre || 'sin etiqueta'}`;
      }
      if (tipo === 'password') return `Campo de contraseña, ${nombre || 'sin etiqueta'}`;
      if (tipo === 'search') return `Buscador, ${nombre || 'sin etiqueta'}`;
      return `Campo de texto, ${nombre || 'sin etiqueta'}`;
    }

    if (tag === 'SELECT') {
      const opcionActual = el.options[el.selectedIndex]?.text || '';
      return `Lista desplegable, ${nombre || 'sin etiqueta'}. Seleccionado, ${opcionActual}`;
    }
    if (tag === 'TEXTAREA') return `Área de texto, ${nombre || 'sin etiqueta'}`;
    if (/^H[1-6]$/.test(tag)) return `Encabezado, ${nombre}`;

    return nombre ? `Elemento, ${nombre}` : '';
  }

  document.addEventListener('focusin', (evento) => {
    const descripcion = describirElemento(evento.target);
    if (descripcion) hablar(descripcion);
  });

  document.addEventListener('keydown', (evento) => {
    const activo = document.activeElement;

    if (evento.key === 'Escape') {
      clearTimeout(temporizadorLectura);
      window.speechSynthesis.cancel();
      try {
        chrome.runtime.sendMessage({ tipo: 'DETENER_LOCAL' });
      } catch (e) {}
      return;
    }

    // Alt + R: Repetir elemento actual
    if (evento.altKey && evento.key.toLowerCase() === 'r' && activo) {
      evento.preventDefault();
      hablar(describirElemento(activo));
      return;
    }

    // Alt + V: Cambiar a la siguiente voz neuronal en Piper
    if (evento.altKey && evento.key.toLowerCase() === 'v') {
      evento.preventDefault();
      clearTimeout(temporizadorLectura);
      try {
        chrome.runtime.sendMessage({ tipo: 'SIGUIENTE_VOZ' });
      } catch (e) {}
      return;
    }

    if (evento.key === 'Enter' && activo) {
      const esNativoInteractivo = ['A', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(activo.tagName);
      const esInputBoton =
        activo.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(activo.type);

      if (!esNativoInteractivo && !esInputBoton && activo.hasAttribute('tabindex')) {
        evento.preventDefault();
        activo.click();
      }
    }
  });
})();