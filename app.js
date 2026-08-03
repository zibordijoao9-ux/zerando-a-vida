// ===== CONFIG (denominadores provisórios do MVP - ajustar depois com dados reais) =====
const FAUNA_TARGET = 50;
const FLORA_TARGET = 50;

// ===== DADOS (localStorage) =====
function loadData() {
  const raw = localStorage.getItem('zerando_vida_data');
  if (raw) return JSON.parse(raw);
  return { fauna: [], flora: [], states: [] };
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
function renderHome() {
  const faunaPct = Math.min(100, Math.round((data.fauna.length / FAUNA_TARGET) * 100));
  const floraPct = Math.min(100, Math.round((data.flora.length / FLORA_TARGET) * 100));
  const statesPct = Math.round((data.states.length / BRAZIL_STATES.length) * 100);
  const overall = Math.round((faunaPct + floraPct + statesPct) / 3);

  document.getElementById('stat-fauna').textContent = faunaPct + '%';
  document.getElementById('stat-flora').textContent = floraPct + '%';
  document.getElementById('stat-lugares').textContent = statesPct + '% do Brasil explorado';
  document.getElementById('progress-text').textContent = overall + '%';
  document.getElementById('progress-sub').textContent = overall + '%';

  const circumference = 452;
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
let currentPhotoData = null;

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentPhotoData = e.target.result;
    photoPreview.src = currentPhotoData;
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
  };
  reader.readAsDataURL(file);
});

const speciesInput = document.getElementById('species-input');
const suggestionsBox = document.getElementById('species-suggestions');
let selectedSpecies = null;
let searchTimeout = null;

speciesInput.addEventListener('input', () => {
  selectedSpecies = null;
  clearTimeout(searchTimeout);
  const q = speciesInput.value.trim();
  if (q.length < 3) { suggestionsBox.innerHTML = ''; return; }
  searchTimeout = setTimeout(() => searchSpecies(q), 400);
});

async function searchSpecies(query) {
  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&locale=pt-BR&per_page=5`);
    const json = await res.json();
    suggestionsBox.innerHTML = '';
    (json.results || []).forEach(taxon => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      const commonName = taxon.preferred_common_name || taxon.name;
      div.innerHTML = `<span>${commonName}</span><span style="color:#888780;font-style:italic">${taxon.name}</span>`;
      div.addEventListener('click', () => {
        selectedSpecies = { common: commonName, scientific: taxon.name, id: taxon.id };
        speciesInput.value = commonName;
        suggestionsBox.innerHTML = '';
      });
      suggestionsBox.appendChild(div);
    });
    if (!json.results || json.results.length === 0) {
      suggestionsBox.innerHTML = '<div class="suggestion-item">nenhum resultado encontrado — pode salvar mesmo assim com o nome digitado</div>';
    }
  } catch (err) {
    suggestionsBox.innerHTML = '<div class="suggestion-item">busca indisponível agora — pode salvar mesmo assim</div>';
  }
}

document.getElementById('btn-save-capture').addEventListener('click', () => {
  const msg = document.getElementById('capture-msg');
  if (!currentPhotoData) { msg.textContent = 'tire ou escolha uma foto primeiro'; return; }
  const name = selectedSpecies ? selectedSpecies.common : speciesInput.value.trim();
  if (!name) { msg.textContent = 'digite o nome do animal ou planta'; return; }

  const entry = {
    name,
    scientific: selectedSpecies ? selectedSpecies.scientific : null,
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
  photoPreview.hidden = true;
  photoPlaceholder.hidden = false;
  speciesInput.value = '';
  selectedSpecies = null;
  photoInput.value = '';
});

// ===== TELA LUGARES =====
function renderPlaces() {
  const container = document.getElementById('states-list');
  container.innerHTML = '';
  BRAZIL_STATES.forEach(state => {
    const chip = document.createElement('div');
    chip.className = 'state-chip' + (data.states.includes(state) ? ' visited' : '');
    chip.textContent = state;
    container.appendChild(chip);
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
      const state = json.address && (json.address.state || json.address.region);
      if (state && BRAZIL_STATES.includes(state)) {
        if (!data.states.includes(state)) {
          data.states.push(state);
          saveData(data);
          msg.textContent = `✅ check-in em ${state}!`;
        } else {
          msg.textContent = `você já tinha explorado ${state}`;
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
    div.innerHTML = `<img src="${entry.photo}"><p>${entry.name}</p>`;
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
