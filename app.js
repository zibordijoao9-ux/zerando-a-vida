// ===== CONFIG (denominadores provisórios do MVP - ajustar depois com dados reais) =====
const FAUNA_TARGET = 50;
const FLORA_TARGET = 50;

// ===== DADOS (localStorage) =====
function loadData() {
  const raw = localStorage.getItem('zerando_vida_data');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!parsed.cities) parsed.cities = {};
    return parsed;
  }
  return { fauna: [], flora: [], states: [], cities: {} };
}
function saveData(data) {
  localStorage.setItem('zerando_vida_data', JSON.stringify(data));
}
let data = loadData();

// ===== NAVEGAÇÃO =====
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  if (name === 'home') renderHome();
  if (name === 'places') renderPlaces();
  if (name === 'collection') renderCollection();
}

// ===== TELA INICIAL =====
function totalCitiesCount() {
  return Object.values(data.cities).reduce((sum, arr) => sum + arr.length, 0);
}
function totalCitiesTarget() {
  return Object.values(BRAZIL_CITIES).reduce((sum, arr) => sum + arr.length, 0);
}

function renderHome() {
  const faunaPct = Math.min(100, Math.round((data.fauna.length / FAUNA_TARGET) * 100));
  const floraPct = Math.min(100, Math.round((data.flora.length / FLORA_TARGET) * 100));
  const statesPct = Math.round((data.states.length / BRAZIL_STATES.length) * 100);
  const overall = Math.round((faunaPct + floraPct + statesPct) / 3);

  document.getElementById('stat-fauna').textContent = faunaPct + '%';
  document.getElementById('stat-flora').textContent = floraPct + '%';
  document.getElementById('stat-lugares').textContent = statesPct + '%';
  document.getElementById('stat-cidades').textContent = totalCitiesCount();
  document.getElementById('progress-text').textContent = overall + '%';
  document.getElementById('progress-sub').textContent = overall + '%';

  const circumference = 478;
  const offset = circumference - (overall / 100) * circumference;
  document.getElementById('progress-ring').style.strokeDashoffset = offset;
}

// ===== TELA CAPTURAR =====
let currentCaptureTab = 'fauna';
document.querySelectorAll('#screen-capture .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#screen-capture .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCaptureTab = btn.dataset.tab;
  });
});

const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const photoPlaceholder = document.getElementById('photo-placeholder');
const identifyResult = document.getElementById('identify-result');
let currentPhotoData = null;
let currentIdentification = null;

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentPhotoData = e.target.result;
    photoPreview.src = currentPhotoData;
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
    identifySpeciesFromPhoto(currentPhotoData, file.type);
  };
  reader.readAsDataURL(file);
});

async function identifySpeciesFromPhoto(dataUrl, mediaType) {
  currentIdentification = null;
  identifyResult.innerHTML = '<span class="identify-loading">🔍 identificando...</span>';

  if (!IDENTIFY_FUNCTION_URL || IDENTIFY_FUNCTION_URL.includes('COLE_AQUI')) {
    identifyResult.innerHTML = '<span class="identify-error">identificação automática ainda não configurada — veja config.js</span>';
    return;
  }

  const base64 = dataUrl.split(',')[1];

  try {
    const res = await fetch(IDENTIFY_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mediaType: mediaType || 'image/jpeg', category: currentCaptureTab })
    });
    const json = await res.json();

    if (json.error || !json.common_name) {
      identifyResult.innerHTML = `<span class="identify-error">não conseguimos identificar essa foto. tente outra foto mais nítida, ou toque em "editar manualmente" abaixo.</span>
        <button type="button" id="btn-manual-edit" class="link-btn">editar manualmente</button>`;
      document.getElementById('btn-manual-edit').addEventListener('click', showManualInput);
      return;
    }

    currentIdentification = json;
    renderIdentification(json);
  } catch (err) {
    identifyResult.innerHTML = `<span class="identify-error">erro ao identificar. tente novamente.</span>
      <button type="button" id="btn-manual-edit" class="link-btn">editar manualmente</button>`;
    document.getElementById('btn-manual-edit').addEventListener('click', showManualInput);
  }
}

function renderIdentification(result) {
  const confidenceClass = result.confidence === 'alta' ? 'high' : result.confidence === 'média' ? 'medium' : 'low';
  identifyResult.innerHTML = `
    <div class="identify-card">
      <p class="identify-name">${result.common_name}</p>
      ${result.scientific_name ? `<p class="identify-scientific">${result.scientific_name}</p>` : ''}
      <span class="confidence-badge confidence-${confidenceClass}">confiança ${result.confidence}</span>
      ${result.notes ? `<p class="identify-notes">${result.notes}</p>` : ''}
      <button type="button" id="btn-manual-edit" class="link-btn">não é isso? editar manualmente</button>
    </div>`;
  document.getElementById('btn-manual-edit').addEventListener('click', showManualInput);
  document.getElementById('species-input').value = result.common_name;
}

function showManualInput() {
  identifyResult.innerHTML = `
    <input type="text" id="manual-species-input" placeholder="digite o nome do animal/planta" value="${currentIdentification ? currentIdentification.common_name : ''}">`;
  const input = document.getElementById('manual-species-input');
  input.addEventListener('input', () => {
    document.getElementById('species-input').value = input.value;
  });
  document.getElementById('species-input').value = input.value;
}

document.getElementById('btn-save-capture').addEventListener('click', () => {
  const msg = document.getElementById('capture-msg');
  if (!currentPhotoData) { msg.textContent = 'tire ou escolha uma foto primeiro'; return; }
  const name = document.getElementById('species-input').value.trim();
  if (!name) { msg.textContent = 'aguarde a identificação ou edite manualmente o nome'; return; }

  const entry = {
    name,
    scientific: currentIdentification ? currentIdentification.scientific_name : null,
    notes: currentIdentification ? currentIdentification.notes : null,
    photo: currentPhotoData,
    date: new Date().toISOString()
  };

  const list = data[currentCaptureTab];
  const alreadyExists = list.some(e => e.name.toLowerCase() === name.toLowerCase());
  if (alreadyExists) {
    msg.textContent = 'você já tem esse na coleção!';
    return;
  }
  list.push(entry);
  saveData(data);

  msg.textContent = '✅ adicionado à coleção!';
  currentPhotoData = null;
  currentIdentification = null;
  photoPreview.hidden = true;
  photoPlaceholder.hidden = false;
  identifyResult.innerHTML = '<span id="identify-placeholder">aguardando foto...</span>';
  document.getElementById('species-input').value = '';
  photoInput.value = '';
});

// ===== TELA LUGARES =====
function renderPlaces() {
  const container = document.getElementById('states-list');
  container.innerHTML = '';
  BRAZIL_STATES.forEach(state => {
    const visitedState = data.states.includes(state);
    const cities = BRAZIL_CITIES[state] || [];
    const visitedCities = data.cities[state] || [];

    const block = document.createElement('div');
    block.className = 'state-block' + (visitedState ? ' visited' : '');

    const header = document.createElement('div');
    header.className = 'state-header';
    header.innerHTML = `<span>${state}</span><span class="badge">${visitedCities.length}/${cities.length} cidades</span>`;
    header.addEventListener('click', () => block.classList.toggle('open'));

    const cityList = document.createElement('div');
    cityList.className = 'city-list';
    cities.forEach(city => {
      const chip = document.createElement('span');
      chip.className = 'city-chip' + (visitedCities.includes(city) ? ' visited' : '');
      chip.textContent = city;
      cityList.appendChild(chip);
    });
    if (cities.length === 0) {
      cityList.innerHTML = '<span class="city-chip">nenhuma cidade cadastrada ainda</span>';
    }

    block.appendChild(header);
    block.appendChild(cityList);
    container.appendChild(block);
  });
}

document.getElementById('btn-checkin').addEventListener('click', () => {
  const msg = document.getElementById('places-msg');
  if (!navigator.geolocation) {
    msg.textContent = 'seu navegador não suporta geolocalização';
    return;
  }
  msg.textContent = 'localizando...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=5&addressdetails=1`, {
        headers: { 'Accept-Language': 'pt-BR' }
      });
      const json = await res.json();
      const addr = json.address || {};
      const state = addr.state || addr.region;
      const cityRaw = addr.city || addr.town || addr.municipality || addr.village || '';

      if (state && BRAZIL_STATES.includes(state)) {
        const isNewState = !data.states.includes(state);
        if (isNewState) data.states.push(state);

        const knownCities = BRAZIL_CITIES[state] || [];
        const matchedCity = knownCities.find(c => c.toLowerCase() === cityRaw.toLowerCase());

        if (!data.cities[state]) data.cities[state] = [];
        let cityMsg = '';
        if (matchedCity && !data.cities[state].includes(matchedCity)) {
          data.cities[state].push(matchedCity);
          cityMsg = ` e em ${matchedCity}`;
        } else if (!matchedCity && cityRaw) {
          cityMsg = ` (cidade "${cityRaw}" ainda não está na nossa base)`;
        }

        saveData(data);
        if (isNewState || (matchedCity && cityMsg)) {
          msg.textContent = `✅ check-in em ${state}${cityMsg}!`;
        } else {
          msg.textContent = `você já tinha explorado ${state}${cityMsg}`;
        }
        renderPlaces();
      } else {
        msg.textContent = 'não conseguimos identificar o estado. tente novamente.';
      }
    } catch (err) {
      msg.textContent = 'erro ao buscar localização. tente novamente.';
    }
  }, () => {
    msg.textContent = 'não foi possível acessar sua localização. permita o acesso ao GPS.';
  });
});

// ===== TELA COLEÇÃO =====
let currentColTab = 'fauna';
document.querySelectorAll('#screen-collection .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#screen-collection .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColTab = btn.dataset.coltab;
    renderCollection();
  });
});

function renderCollection() {
  const container = document.getElementById('collection-list');
  const list = data[currentColTab];
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<p class="empty-msg">nenhum item ainda — vá em "capturar" pra adicionar o primeiro!</p>';
    return;
  }
  list.slice().reverse().forEach(entry => {
    const div = document.createElement('div');
    div.className = 'collection-item';
    div.innerHTML = `<img src="${entry.photo}"><span class="stamp-ring">${currentColTab === 'fauna' ? '🐾' : '🌿'}</span><p>${entry.name}</p>`;
    container.appendChild(div);
  });
}

// ===== INIT =====
renderHome();

// ===== PWA: registrar service worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
