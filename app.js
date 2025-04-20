window.addEventListener('DOMContentLoaded', () => {

  const locRadios = document.querySelectorAll('input[name="loc"]');
  const cityBlock = document.getElementById('city-block');
  const citySel = document.getElementById('city');
  const radiusBtns = document.querySelectorAll('.radius-btn');
  const btnScan = document.getElementById('btn-scan');
  const btnSearch = document.getElementById('btn-search');
  const barcodeIn = document.getElementById('barcode');
  const resultDiv = document.getElementById('result');
  const ulHistory = document.getElementById('history-list');
  const btnClearHist = document.getElementById('clear-history');
  const loadingDiv = document.getElementById('loading');

  // Toggle city selector vs GPS
  locRadios.forEach(r => r.addEventListener('change', () => {
    cityBlock.style.display = r.value === 'city' ? 'block' : 'none';
  }));

  // Radius buttons
  radiusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      radiusBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Scanner setup
  let scanning = false;
  const quaggaConfig = {
    inputStream: { name: "Live", type: "LiveStream", target: document.querySelector('#interactive'), constraints: { facingMode: "environment" } },
    decoder: { readers: ["ean_reader"] },
    locate: true
  };

  btnScan.addEventListener('click', () => {
    if (!scanning) {
      Quagga.init(quaggaConfig, err => {
        if (err) { alert("Não foi possível acessar a câmera."); return; }
        Quagga.start(); scanning = true; btnScan.textContent = "Parar Scanner";
      });
      Quagga.onDetected(d => {
        if (d.codeResult?.code) {
          barcodeIn.value = d.codeResult.code;
          Quagga.stop(); scanning = false; btnScan.textContent = "Iniciar Scanner";
        }
      });
    } else {
      Quagga.stop(); scanning = false; btnScan.textContent = "Iniciar Scanner";
    }
  });

  // History management (cached)
  let historyData = [];
  function loadHistory() { const raw = localStorage.getItem("searchHistory"); historyData = raw ? JSON.parse(raw) : []; }
  function saveHistory() { localStorage.setItem("searchHistory", JSON.stringify(historyData)); }
  function renderHistory() { ulHistory.innerHTML = historyData.map((it,i) => `<li data-index="${i}"><img src="${it.thumbnail||'https://via.placeholder.com/60'}" alt="${it.productName}"/></li>`).join(''); }
  function addToHistory(item) { historyData = historyData.filter(i => !(i.code===item.code && i.city===item.city)); historyData.unshift(item); if (historyData.length>20) historyData.pop(); saveHistory(); renderHistory(); }

  btnClearHist.addEventListener('click', () => { historyData = []; saveHistory(); renderHistory(); });
  ulHistory.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const item = historyData[li.dataset.index];
    renderResult(item);
    btnSearch.textContent = 'Atualizar Preço';
    btnSearch.classList.add('update-state');
  });

  // Render result with establishment name
  function renderResult({ productName, thumbnail, minEntry, maxEntry, total, code, city }) {
    const raio = document.querySelector('.radius-btn.active').dataset.value;
    let html = `<div class="product-summary"><img src="${thumbnail}" alt="${productName}"><h2>${productName}</h2></div><div class="summary">${total} estabelecimento${total>1?'s':''}</div>`;
    [["Menor Preço",minEntry],["Maior Preço",maxEntry]].forEach(([label,e]) => {
      const price = label==="Menor Preço" ? e.valMinimoVendido : e.valMaximoVendido;
      const name = e.nomFantasia||e.nomRazaoSocial||"—";
      const bairro = e.nomBairro||"—";
      const municipio = e.nomMunicipio||"—";
      const when = e.dthEmissaoUltimaVenda ? new Date(e.dthEmissaoUltimaVenda).toLocaleString() : "—";
      const mapL = `https://www.google.com/maps/search/?api=1&query=${e.numLatitude},${e.numLongitude}`;
      const dirL = `https://www.google.com/maps/dir/?api=1&destination=${e.numLatitude},${e.numLongitude}`;
      html += `<div class="card"><h2>${label}</h2><p><strong>Estabelecimento:</strong> ${name}</p><p><strong>Preço:</strong> R$ ${price.toFixed(2)}</p><p><strong>Raio:</strong> ${raio} km</p><p><strong>Bairro/Município:</strong> ${bairro} / ${municipio}</p><p><strong>Quando:</strong> ${when}</p><p><a href="${mapL}" target="_blank">Ver no mapa</a> | <a href="${dirL}" target="_blank">Como chegar</a></p></div>`;
    });
    resultDiv.innerHTML = html;
    barcodeIn.value = code;
  }

  // Main search with descriptive no-result
  const FN_URL = `${window.location.origin}/.netlify/functions/search`;

  btnSearch.addEventListener('click', () => {
    btnSearch.textContent = 'Pesquisar Preço';
    btnSearch.classList.remove('update-state');
    const code = barcodeIn.value.trim(); if(!code){ alert("Informe ou escaneie o código!"); return; }
    const raio = parseInt(document.querySelector('.radius-btn.active').dataset.value, 10);
    loadingDiv.classList.add('show');
    if (document.querySelector('input[name="loc"]:checked').value === 'gps') {
      navigator.geolocation.getCurrentPosition(
        pos => runSearch(code, pos.coords.latitude, pos.coords.longitude, raio),
        () => { alert("Não foi possível obter sua localização."); loadingDiv.classList.remove('show'); }
      );
    } else {
      const [lat, lng] = citySel.value.split(',').map(Number);
      runSearch(code, lat, lng, raio);
    }
  });

  async function runSearch(code, latitude, longitude, raio) {
    // marca início da consulta
    const startTime = Date.now();
    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoDeBarras: code, dias: 3, latitude, longitude, raio })
      });

      const text = await resp.text();
      // calcula tempo decorrido em ms
      const elapsed = Date.now() - startTime;

      if (!text.trim() || text.trim().startsWith("<")) {
        resultDiv.innerHTML = `<p class="error">Erro ${resp.status}</p>`;
        return;
      }

      const data = JSON.parse(text);
      console.log("API retornou:", data);

      if (!resp.ok || data.length === 0) {
        // mensagem padrão de timeout, exibindo o tempo gasto
        resultDiv.innerHTML = `
          <p class="error">
            Tempo de consulta excedeu o tempo limite (<strong>${elapsed} ms</strong>).<br>
            Tente novamente mais tarde.
          </p>`;
        return;
      }

      const minE = data.reduce((a, b) => b.valMinimoVendido < a.valMinimoVendido ? b : a, data[0]);
      const maxE = data.reduce((a, b) => b.valMaximoVendido > a.valMaximoVendido ? b : a, data[0]);
      const item = {
        code,
        city: citySel.value,
        productName: data[0].dscProduto || "—",
        thumbnail: data[0].codGetin ? `https://cdn-cosmos.bluesoft.com.br/products/${data[0].codGetin}` : "https://via.placeholder.com/100",
        minEntry: minE,
        maxEntry: maxE,
        total: data.length
      };

      renderResult(item);
      loadHistory(); addToHistory(item);

    } catch (err) {
      console.error(err);
      resultDiv.innerHTML = `<p class="error">Falha de rede: ${err.message}</p>`;
    } finally {
      loadingDiv.classList.remove('show');
    }
  }

  // Initialize history
  loadHistory(); renderHistory();

});
