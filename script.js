// ============================================
// TOGGLE MÓDULOS
// ============================================
function toggleModulo(tipo) {
  const modulos = ['imagen', 'audio', 'postura'];
  const cards = {
    imagen: document.getElementById('card-imagen'),
    audio: document.getElementById('card-audio'),
    postura: document.getElementById('card-postura'),
  };
  modulos.forEach(m => {
    const modulo = document.getElementById('modulo-' + m);
    if (m === tipo) {
      const estaVisible = modulo.classList.contains('visible');
      modulo.classList.toggle('visible', !estaVisible);
      cards[m].classList.toggle('activo', !estaVisible);
      if (!estaVisible) modulo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      modulo.classList.remove('visible');
      cards[m].classList.remove('activo');
    }
  });
}

// ============================================
// SELECTOR DE CÁMARA — COMPARTIDO
// ============================================
async function obtenerCamaras() {
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  return dispositivos.filter(d => d.kind === 'videoinput');
}

async function llenarSelectCamaras(selectId) {
  try {
    // Primero pedimos permiso para que el navegador muestre los nombres reales
    await navigator.mediaDevices.getUserMedia({ video: true });

    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const camaras = dispositivos.filter(d => d.kind === 'videoinput');

    const select = document.getElementById(selectId);
    select.innerHTML = '';

    camaras.forEach((cam, i) => {
      const option = document.createElement('option');
      option.value = cam.deviceId;
      option.textContent = cam.label || `Cámara ${i + 1}`;
      select.appendChild(option);
    });
  } catch (e) {
    alert('No se pudo acceder a las cámaras. Verifica los permisos del navegador: ' + e.message);
  }
}

async function mostrarSelectorImagen() {
  await llenarSelectCamaras('select-camara-imagen');
  document.getElementById('selector-camara-imagen').style.display = 'flex';
  document.getElementById('btn-seleccionar-imagen').style.display = 'none';
}

async function mostrarSelectorPostura() {
  await llenarSelectCamaras('select-camara-postura');
  document.getElementById('selector-camara-postura').style.display = 'flex';
  document.getElementById('btn-seleccionar-postura').style.display = 'none';
}

// ============================================
// MÓDULO IMÁGENES — WEBCAM CON SELECTOR
// ============================================
const URL_IMAGEN = './modelos/imagen/';
let modeloImagen = null;
let webcamImagen = null;
let animImagen = null;

async function iniciarWebcamImagen() {
  const deviceId = document.getElementById('select-camara-imagen').value;
  try {
    const modelURL = URL_IMAGEN + 'model.json';
    const metadataURL = URL_IMAGEN + 'metadata.json';
    modeloImagen = await tmImage.load(modelURL, metadataURL);

    webcamImagen = new tmImage.Webcam(400, 400, true);
    await webcamImagen.setup({ deviceId: { exact: deviceId } });
    await webcamImagen.play();

    document.getElementById('webcam-imagen').srcObject = webcamImagen.webcam.srcObject;
    document.getElementById('camara-overlay-imagen').style.display = 'none';

    loopImagen();
  } catch (e) {
    alert('Error al iniciar la cámara: ' + e.message);
    console.error(e);
  }
}

async function loopImagen() {
  if (!modeloImagen || !webcamImagen) return;
  webcamImagen.update();
  const predicciones = await modeloImagen.predict(webcamImagen.canvas);
  const mejor = predicciones.reduce((a, b) => a.probability > b.probability ? a : b);
  const confianza = Math.round(mejor.probability * 100);

  document.getElementById('resultado-clase').textContent = mejor.className;
  document.getElementById('barra-confianza').style.width = confianza + '%';
  document.getElementById('texto-confianza').textContent = `Confianza: ${confianza}%`;

  animImagen = requestAnimationFrame(loopImagen);
}

// ============================================
// MÓDULO AUDIO
// ============================================
const URL_AUDIO = "./model_audio/";
let recognizerAudio = null;

async function cargarModeloAudio() {
  if (recognizerAudio) return;
  try {
    recognizerAudio = speechCommands.create(
      'BROWSER_FFT',
      undefined,
      URL_AUDIO + 'model.json',
      URL_AUDIO + 'metadata.json'
    );
    await recognizerAudio.ensureModelLoaded();
  } catch (e) {
    console.error('Error cargando modelo de audio:', e);
    alert('Error al cargar modelo: ' + e.message);
  }
}

function cargarAudio(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;
  const audioEl = document.getElementById('audio-element');
  audioEl.src = URL.createObjectURL(archivo);
  document.getElementById('audio-player').classList.add('visible');
  document.getElementById('resultado-audio').classList.remove('visible');
  document.getElementById('resultado-audio-clase').textContent = '—';
  document.getElementById('barra-audio').style.width = '0%';
  document.getElementById('texto-audio-confianza').textContent = 'Confianza: —';
}

async function analizarAudio() {
  await cargarModeloAudio();
  if (!recognizerAudio) {
    alert('No se pudo cargar el modelo de audio.');
    return;
  }

  const audioEl = document.getElementById('audio-element');
  if (!audioEl.src || audioEl.src === window.location.href) {
    alert('Primero selecciona un archivo de audio.');
    return;
  }

  try {
    // Escucha por micrófono durante 2 segundos mientras el audio se reproduce
    audioEl.currentTime = 0;
    audioEl.play();

    await recognizerAudio.listen(result => {
      const scores = Array.from(result.scores);
      const clases = recognizerAudio.wordLabels();
      let maxIdx = 0;
      scores.forEach((s, i) => { if (s > scores[maxIdx]) maxIdx = i; });
      const confianza = Math.round(scores[maxIdx] * 100);

      document.getElementById('resultado-audio-clase').textContent = clases[maxIdx];
      document.getElementById('barra-audio').style.width = confianza + '%';
      document.getElementById('texto-audio-confianza').textContent = `Confianza: ${confianza}%`;
      document.getElementById('resultado-audio').classList.add('visible');

      recognizerAudio.stopListening();
      audioEl.pause();
    }, {
      includeSpectrogram: false,
      probabilityThreshold: 0.5,
      overlapFactor: 0.5
    });

  } catch (e) {
    alert('Error al analizar audio: ' + e.message);
  }
}

const MIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;
const STOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`;

let escuchandoMicrofono = false;

async function analizarMicrofono() {
  await cargarModeloAudio();
  if (!recognizerAudio) {
    alert('No se pudo cargar el modelo de audio.');
    return;
  }

  const btn = document.getElementById('btn-microfono');

  // Si ya está escuchando, detener
  if (escuchandoMicrofono) {
    recognizerAudio.stopListening();
    escuchandoMicrofono = false;
    btn.innerHTML = `${MIC_SVG} Usar Micrófono`;
    btn.classList.remove('activo');
    return;
  }

  // Iniciar escucha
  try {
    escuchandoMicrofono = true;
    btn.innerHTML = `${STOP_SVG} Detener Micrófono`;
    btn.classList.add('activo');

    await recognizerAudio.listen(result => {
      const scores = Array.from(result.scores);
      const clases = recognizerAudio.wordLabels();
      let maxIdx = 0;
      scores.forEach((s, i) => { if (s > scores[maxIdx]) maxIdx = i; });
      const confianza = Math.round(scores[maxIdx] * 100);

      if (confianza >= 70) {
        document.getElementById('resultado-audio-clase').textContent = clases[maxIdx];
        document.getElementById('barra-audio').style.width = confianza + '%';
        document.getElementById('texto-audio-confianza').textContent = `Confianza: ${confianza}%`;
        document.getElementById('resultado-audio').classList.add('visible');
      }

    }, {
      includeSpectrogram: false,
      probabilityThreshold: 0.5,
      overlapFactor: 0.5
    });

  } catch (e) {
    escuchandoMicrofono = false;
    btn.innerHTML = `${MIC_SVG} Usar Micrófono`;
    btn.classList.remove('activo');
    alert('Error con el micrófono: ' + e.message);
  }
}

// ============================================
// MÓDULO POSTURA — WEBCAM CON SELECTOR
// ============================================
const URL_POSTURA = "./model_postura/";

let modeloPostura = null;
let webcamPostura = null;
let animPostura = null;

async function iniciarCamara() {
  const deviceId = document.getElementById('select-camara-postura').value;
  try {
    modeloPostura = await tmPose.load(URL_POSTURA + 'model.json', URL_POSTURA + 'metadata.json');

    webcamPostura = new tmPose.Webcam(400, 400, true);
    await webcamPostura.setup({ deviceId: { exact: deviceId } });
    await webcamPostura.play();

    document.getElementById('webcam').srcObject = webcamPostura.webcam.srcObject;
    document.getElementById('camara-overlay').style.display = 'none';

    loopPostura();
  } catch (e) {
    alert('Error al iniciar la cámara: ' + e.message);
    console.error(e);
  }
}

async function loopPostura() {
  if (!modeloPostura || !webcamPostura) return;
  webcamPostura.update();
  await predecirPostura();
  animPostura = requestAnimationFrame(loopPostura);
}

async function predecirPostura() {
  const canvas = document.getElementById('canvas-postura');
  const ctx = canvas.getContext('2d');
  const { pose, posenetOutput } = await modeloPostura.estimatePose(webcamPostura.canvas);
  const predicciones = await modeloPostura.predict(posenetOutput);

  canvas.width = webcamPostura.canvas.width;
  canvas.height = webcamPostura.canvas.height;
  ctx.drawImage(webcamPostura.canvas, 0, 0);

  if (pose) {
    tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
    tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
  }

  const lista = document.getElementById('postura-lista');
  lista.innerHTML = '';
  predicciones.forEach(p => {
    const pct = Math.round(p.probability * 100);
    lista.innerHTML += `
      <div class="postura-item">
        <div class="postura-nombre">${p.className}<span>${pct}%</span></div>
        <div class="postura-barra-wrap">
          <div class="postura-barra-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  });
}
