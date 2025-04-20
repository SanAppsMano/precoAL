// ===== Scanner Quagga2 =====
const quaggaConfig = {
  inputStream: {
    name: "Live", type: "LiveStream",
    target: document.querySelector('#interactive'),
    constraints: { facingMode: "environment", width:{min:640}, height:{min:480} }
  },
  decoder: { readers:["ean_reader","ean_8_reader","upc_reader","code_128_reader"] },
  locate: true, frequency: 10,
  numOfWorkers: navigator.hardwareConcurrency||4
};

let scanning = false;
const btnScan = document.getElementById('btn-scan');
const barcodeInput = document.getElementById('barcode');
const resultDiv = document.getElementById('result');

// Scanner
btnScan.addEventListener('click', () => {
  if (!scanning) {
    Quagga.init(quaggaConfig, err => {
      if (err) { alert("Falha ao acessar a câmera."); return; }
      Quagga.start(); scanning = true; btnScan.textContent = "Parar Scanner";
    });
    Quagga.onDetected(d => {
      if (d.codeResult?.code) {
        barcodeInput.value = d.codeResult.code;
        Quagga.offDetected(); Quagga.stop();
        scanning = false; btnScan.textContent = "Iniciar Scanner";
        document.querySelector('#interactive').innerHTML = "";
      }
    });
  } else {
    Quagga.offDetected(); Quagga.stop();
    scanning = false; btnScan.textContent = "Iniciar Scanner";
    document.querySelector('#interactive').innerHTML = "";
  }
});

// ===== Histórico =====
let historyData = [];
function loadHistory() {
  const raw = localStorage.getItem("searchHistory");
  historyData = raw ? JSON.parse(raw) : [];
}
function saveHistory() {
  localStorage.setItem("searchHistory", JSON.stringify(historyData));
}
function addToHistory(item) {
  historyData = historyData.filter(i => i.code!==item.code||i.city!==item.city);
  historyData.unshift(item);
  if (historyData.length>20) historyData.pop();
  saveHistory(); renderHistory();
}
function renderHistory() {
  const ul = document.getElementById("history-list");
  ul.innerHTML = historyData.map((item,i) => {
    const thumb = item.thumbnail || "https://via.placeholder.com/60";
    return `<li data-index="${i}"><img src="${thumb}" alt="${item.productName}"></li>`;
  }).join("");
}
document.getElementById("clear-history").onclick = () => {
  historyData=[]; saveHistory(); renderHistory();
};

// Modal
const modal = document.getElementById("history-modal");
const closeBtn = document.querySelector(".modal-close");
closeBtn.onclick = () => modal.style.display = "none";
window.onclick = e => { if(e.target===modal) modal.style.display="none"; };

document.getElementById("history-list").addEventListener("click", e => {
  const li = e.target.closest("li");
  if (!li) return;
  const item = historyData[li.dataset.index];
  openModal(item);
});

function openModal(item) {
  document.getElementById("modal-img").src = item.thumbnail;
  document.getElementById("modal-name").textContent = item.productName;

  const cardsDiv = document.getElementById("modal-cards");
  cardsDiv.innerHTML = "";
  for (const [label, entry] of [["Menor Preço", item.minEntry], ["Maior Preço", item.maxEntry]]) {
    const price = label==="Menor Preço" ? entry.valMinimoVendido : entry.valMaximoVendido;
    const name  = entry.nomFantasia||entry.nomRazaoSocial||"—";
    const when  = entry.dthEmissaoUltimaVenda
      ? new Date(entry.dthEmissaoUltimaVenda).toLocaleString()
      : "—";
    cardsDiv.innerHTML += `
      <div class="card">
        <h2>${label}</h2>
        <p><strong>Produto:</strong> ${item.productName}</p>
        <p><strong>Preço:</strong> R$ ${price.toFixed(2)}</p>
        <p><strong>Estabelecimento:</strong> ${name}</p>
        <p><strong>Data/Hora:</strong> ${when}</p>
      </div>`;
  }

  modal.style.display = "flex";
}

// ===== Busca via Function =====
const FN_URL = `${window.location.origin}/.netlify/functions/search`;

document.getElementById('btn-search').addEventListener('click', async () => {
  const code = barcodeInput.value.trim();
  if (!code) { alert("Informe ou escaneie o código!"); return; }
  const city = document.getElementById('city').value;
  resultDiv.innerHTML = "<p>Buscando…</p>";

  try {
    const resp = await fetch(FN_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({codigoDeBarras:code, city})
    });
    const text = await resp.text();
    if (!text.trim() || text.trim().startsWith("<")) {
      resultDiv.innerHTML = `<p class="error">Erro ${resp.status}</p>`;
      return;
    }
    const data = JSON.parse(text);
    if (!resp.ok || !Array.isArray(data) || !data.length) {
      resultDiv.innerHTML = `<p class="error">Nenhum resultado</p>`;
      return;
    }

    // Processa resultados
    const minEntry = data.reduce((a,b)=> b.valMinimoVendido<a.valMinimoVendido?b:a, data[0]);
    const maxEntry = data.reduce((a,b)=> b.valMaximoVendido>a.valMaximoVendido?b:a, data[0]);
    const productName = data[0].dscProduto||"—";
    const thumbnail   = data[0].codGetin
      ? `https://cdn-cosmos.bluesoft.com.br/products/${data[0].codGetin}`
      : "https://via.placeholder.com/60";

    // Render no result
    let html = `<div class="summary">${data.length} estabelecimento${data.length>1?'s':''}</div>`;
    for (const [label,e] of [["Menor Preço", minEntry], ["Maior Preço", maxEntry]]) {
      const price = label==="Menor Preço"
        ? e.valMinimoVendido
        : e.valMaximoVendido;
      const name  = e.nomFantasia||e.nomRazaoSocial||"—";
      const bairro= e.nomBairro||"—";
      const mapL  = `https://www.google.com/maps/search/?api=1&query=${e.numLatitude},${e.numLongitude}`;
      const dirL  = `https://www.google.com/maps/dir/?api=1&destination=${e.numLatitude},${e.numLongitude}`;
      html += `
        <div class="card">
          <h2>${productName}</h2>
          <p><strong>${label}:</strong> R$ ${price.toFixed(2)}</p>
          <p><strong>Estabelecimento:</strong> ${name}</p>
          <p><strong>Bairro:</strong> ${bairro}</p>
          <p>
            <a href="${mapL}" target="_blank">Ver no mapa</a>
            <a href="${dirL}" target="_blank">Como chegar</a>
          </p>
          <img src="${thumbnail}" alt="Imagem do produto"/>
        </div>`;
    }
    resultDiv.innerHTML = html;

    // Atualiza histórico
    loadHistory();
    addToHistory({ code, city, when: new Date().toISOString(),
      productName, thumbnail, minEntry, maxEntry });
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<p class="error">Erro na busca</p>`;
  }
});

// Inicialização
loadHistory();
renderHistory();
