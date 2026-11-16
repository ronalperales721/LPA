import os
import glob
import wave
import threading
import winsound
from flask import Flask, request, jsonify
from piper import PiperVoice

app = Flask(__name__)

NOMBRES_AMIGABLES = {
    "es_AR-daniela-high.onnx": "Daniela (Argentina)",
    "es_MX-claude-high.onnx": "Claude (México)",
    "es_MX-ald-medium.onnx": "Ald (México)",
    "es_ES-davefx-medium.onnx": "Davefx (España)",
    "es_ES-mls_10246-low.onnx": "María (España)",
}

ARCHIVOS_TEMP = ["turno_a.wav", "turno_b.wav"]
indice_archivo = 0
lock = threading.Lock()
modelos_cargados = {}

voces_disponibles = sorted(glob.glob("*.onnx"))
if not voces_disponibles:
    raise FileNotFoundError("No se encontró ningún modelo .onnx en la carpeta motor-voz.")

voz_activa = "es_AR-daniela-high.onnx" if "es_AR-daniela-high.onnx" in voces_disponibles else voces_disponibles[0]


def nombre_limpio(archivo):
    if archivo in NOMBRES_AMIGABLES:
        return NOMBRES_AMIGABLES[archivo]
    return archivo.replace(".onnx", "").replace("_", " ").replace("-", " ").title()


def obtener_modelo(archivo):
    if archivo not in modelos_cargados:
        print(f"Cargando modelo {archivo} en memoria...")
        modelos_cargados[archivo] = PiperVoice.load(archivo)
    return modelos_cargados[archivo]


# Precargar la voz inicial
obtener_modelo(voz_activa)
print(f"Voces detectadas ({len(voces_disponibles)}): {[nombre_limpio(v) for v in voces_disponibles]}")


def detener_audio():
    winsound.PlaySound(None, 0)


def sintetizar_y_reproducir(texto):
    global indice_archivo
    detener_audio()
    archivo_salida = ARCHIVOS_TEMP[indice_archivo]
    indice_archivo = (indice_archivo + 1) % 2

    modelo = obtener_modelo(voz_activa)
    with wave.open(archivo_salida, "wb") as wav_file:
        if hasattr(modelo, "synthesize_wav"):
            modelo.synthesize_wav(texto, wav_file)
        else:
            modelo.synthesize(texto, wav_file)

    winsound.PlaySound(archivo_salida, winsound.SND_FILENAME | winsound.SND_ASYNC)


@app.route("/voces", methods=["GET"])
def listar_voces():
    lista = [{"id": v, "nombre": nombre_limpio(v)} for v in voces_disponibles]
    return jsonify({"voces": lista, "activa": voz_activa})


@app.route("/cambiar_voz", methods=["POST"])
def cambiar_voz():
    global voz_activa
    datos = request.get_json(silent=True) or {}
    nueva_voz = datos.get("voz", "")

    if nueva_voz not in voces_disponibles:
        return jsonify({"ok": False, "error": "Voz no encontrada"}), 404

    with lock:
        voz_activa = nueva_voz
        if datos.get("anunciar", True):
            sintetizar_y_reproducir(f"Voz cambiada a {nombre_limpio(voz_activa)}")

    return jsonify({"ok": True, "activa": voz_activa, "nombre": nombre_limpio(voz_activa)})


@app.route("/siguiente_voz", methods=["POST"])
def siguiente_voz():
    global voz_activa
    with lock:
        idx = voces_disponibles.index(voz_activa)
        voz_activa = voces_disponibles[(idx + 1) % len(voces_disponibles)]
        sintetizar_y_reproducir(f"Voz cambiada a {nombre_limpio(voz_activa)}")

    return jsonify({"ok": True, "activa": voz_activa, "nombre": nombre_limpio(voz_activa)})


@app.route("/hablar", methods=["POST"])
def hablar():
    datos = request.get_json(silent=True) or {}
    texto = datos.get("texto", "").strip()
    if not texto:
        return jsonify({"ok": False}), 400

    with lock:
        try:
            sintetizar_y_reproducir(texto)
        except Exception as error:
            print(f"Error al sintetizar: {error}")
            return jsonify({"ok": False}), 500

    return jsonify({"ok": True})


@app.route("/detener", methods=["POST"])
def detener():
    with lock:
        detener_audio()
    return jsonify({"ok": True})


if __name__ == "__main__":
    print("Servidor activo en http://127.0.0.1:5050")
    app.run(host="127.0.0.1", port=5050, threaded=True)