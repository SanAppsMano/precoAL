// ===== Scanner Quagga2 =====
const quaggaConfig = {
  inputStream: {
    name: "Live",
    type: "LiveStream",
    target: document.querySelector('#interactive'),
    constraints: { facingMode: "environment", width: { min: 640 }, height: { min: 480 } }
  },
  decoder: { readers: ["ean_reader","ean_8_reader","upc_reader","code_128_reader"] },
  locate: true,
  frequency: 10,
  numOfWorkers: navigator.hardwareConcurrency || 4
};

let scanning = false;
const btnScan = document.getElementById('btn-scan');
const barcodeInput = document.getElementById('barcode');

btnScan.addEventListener('click', () => {
  if (!scanning) {
    Quagga.init(quaggaConfig, err => {
      if (err) { console.error(err); alert("Falha ao acessar a câmera."); return; }
      Quagga.start();
      scanning = true;
      btnScan.textContent = "Parar Scanner";
    });
    Quagga.onDetected(d => {
      if (d.codeResult?.code) {
        barcodeInput.value = d.codeResult.code;
        stopScanner();
      }
    });
  } else {
    stopScanner();
  }
});

function stopScanner() {
  Quagga.offDetected();
  Quagga.stop();
  scanning = false;
  btnScan.textContent = "Iniciar Scanner";
  document.querySelector('#interactive').innerHTML = "";
}

// ===== Histórico de buscas via localStorage =====
function loadHistory() {
  const raw = localStorage.getItem("searchHistory");
  return raw ? JSON.parse(raw) : [];
}
function saveHistory(arr) {
  localStorage.setItem("searchHistory", JSON.stringify(arr));
}
function addToHistory(entry) {
  const hist = loadHistory();
  const filtered = hist.filter(item => !(item.code === entry.code && item.city === entry.city));
  filtered.unshift(entry);
  saveHistory(filtered.slice(0, 10));
  renderHistory();
}
function renderHistory() {
  const listEl = document.getElementById("history-list");
  const hist = loadHistory();
  listEl.innerHTML = hist.map(item => {
    const date    = new Date(item.when).toLocaleString("pt-BR");
    const cityName= item.city.split(",")[1];
    const thumb   = item.thumbnail
      ? `<img src="${item.thumbnail}" class="history-thumb" alt="Thumb"/>`
      : "";
    return `<li data-code="${item.code}" data-city="${item.city}">
      ${thumb}${item.code} em ${cityName} (${date})
    </li>`;
  }).join("");
}

document.getElementById("history-list").addEventListener("click", e => {
  if (e.target.tagName === "LI" || e.target.closest("li")) {
    const li   = e.target.closest("li");
    const code = li.dataset.code;
    const city = li.dataset.city;
    barcodeInput.value = code;
    document.getElementById("city").value = city;
    document.getElementById("btn-search").click();
  }
});

document.getElementById("clear-history").addEventListener("click", () => {
  localStorage.removeItem("searchHistory");
  renderHistory();
});

// ===== Busca via Netlify Function =====
const FN_URL = `${window.location.origin}/.netlify/functions/search`;

document.getElementById('btn-search').addEventListener('click', async () => {
  const code = barcodeInput.value.trim();
  if (!code) { alert("Informe ou escaneie o código de barras!"); return; }

  const city = document.getElementById('city').value;
  const resDiv = document.getElementById('result');
  resDiv.innerHTML = `<p>Buscando...</p>`;

  try {
    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoDeBarras: code, city })
    });

    const text = await resp.text();
    if (!text.trim()) {
      resDiv.innerHTML = `<p class="error">Resposta vazia (HTTP ${resp.status})</p>`;
      return;
    }
    if (text.trim().startsWith("<")) {
      resDiv.innerHTML = `<p class="error">Recebeu HTML (HTTP ${resp.status}):<br>${text.slice(0,200)}…</p>`;
      return;
    }
    let data;
    try { data = JSON.parse(text); }
    catch {
      resDiv.innerHTML = `<p class="error">JSON inválido:<br>${text}</p>`;
      return;
    }
    if (!resp.ok) {
      resDiv.innerHTML = `<p class="error">Erro ${resp.status}: ${data.error||JSON.stringify(data)}</p>`;
      return;
    }
    if (!Array.isArray(data) || data.length === 0) {
      resDiv.innerHTML = `<p>Nenhum resultado encontrado.</p>`;
      return;
    }

    // renderização dos resultados
    const total    = data.length;
    const minEntry = data.reduce((a,b)=> b.valMinimoVendido < a.valMinimoVendido ? b : a, data[0]);
    const maxEntry = data.reduce((a,b)=> b.valMaximoVendido > a.valMaximoVendido ? b : a, data[0]);

    let html = `<div class="summary">${total} estabelecimento${total>1?'s':''} encontrado${total>1?'s':''}</div>`;
    for (const [label,e] of [["Menor Preço", minEntry], ["Maior Preço", maxEntry]]) {
      const price = label==="Menor Preço" ? e.valMinimoVendido : e.valMaximoVendido;
      const name  = e.nomFantasia||e.nomRazaoSocial||"—";
      const bairro= e.nomBairro||"—";
      const mapL  = `https://www.google.com/maps/search/?api=1&query=${e.numLatitude},${e.numLongitude}`;
      const dirL  = `https://www.google.com/maps/dir/?api=1&destination=${e.numLatitude},${e.numLongitude}`;
      const thumb = e.codGetin 
        ? `https://cdn-cosmos.bluesoft.com.br/products/${e.codGetin}` 
        : "";

      html += `
        <div class="card">
          <h2>${label}</h2>
          <p><strong>Preço:</strong> R$ ${price.toFixed(2)}</p>
          <p><strong>Estabelecimento:</strong> ${name}</p>
          <p><strong>Bairro:</strong> ${bairro}</p>
          <p>
            <a href="${mapL}" target="_blank">Ver no mapa</a>
            <a href="${dirL}" target="_blank">Como chegar</a>
          </p>
          ${thumb?`<img src="${thumb}" alt="Imagem do produto" />`:``}
        </div>`;
    }

    // adiciona miniatura do primeiro item ao histórico
    addToHistory({
      code,
      city,
      when: new Date().toISOString(),
      thumbnail: data[0].codGetin
        ? `https://cdn-cosmos.bluesoft.com.br/products/${data[0].codGetin}`
        : ""
    });

    resDiv.innerHTML = html;

  } catch (err) {
    console.error("Erro na busca:", err);
    resDiv.innerHTML = `<p class="error">Falha de rede: ${err.message}</p>`;
  }
});

// renderiza o histórico ao iniciar
renderHistory();
