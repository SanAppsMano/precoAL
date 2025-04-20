window.addEventListener('DOMContentLoaded', () => {
  const locRadios    = document.querySelectorAll('input[name="loc"]');
  const cityBlock    = document.getElementById('city-block');
  const citySel      = document.getElementById('city');
  const radiusBtns   = document.querySelectorAll('.radius-btn');
  const btnScan      = document.getElementById('btn-scan');
  const btnSearch    = document.getElementById('btn-search');
  const barcodeIn    = document.getElementById('barcode');
  const resultDiv    = document.getElementById('result');
  const ulHistory    = document.getElementById('history-list');
  const btnClearHist = document.getElementById('clear-history');
  const loadingDiv   = document.getElementById('loading');

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

  // Quagga2 Scanner setup
  let scanning = false;
  const quaggaConfig = {
    inputStream: { name: "Live", type: "LiveStream",
      target: document.querySelector('#interactive'),
      constraints: { facingMode: "environment" }
    },
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

  // History management
  let historyData = [];
  function loadHistory() {
    const raw = localStorage.getItem("searchHistory");
    historyData = raw ? JSON.parse(raw) : [];
  }
  function saveHistory() {
    localStorage.setItem("searchHistory", JSON.stringify(historyData));
  }
  function renderHistory() {
    ulHistory.innerHTML = historyData.map((it, i) =>
      `<li data-index=\"${i}\"><img src=\"${it.thumbnail||'https://via.placeholder.com/60'}\" alt=\"${it.productName}\"/></li>`
    ).join('');
  }
  function addToHistory(item) {
    historyData = historyData.filter(i => !(i.code===item.code && i.city===item.city));
    historyData.unshift(item);
    if (historyData.length > 20) historyData.pop();
    saveHistory(); renderHistory();
  }
  btnClearHist.addEventListener('click', () => { historyData = []; saveHistory(); renderHistory(); });
  ulHistory.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const item = historyData[li.dataset.index];
    barcodeIn.value = item.code;
    if (document.querySelector('input[name="loc"]:checked').value === 'city') {
      citySel.value = item.city;
    }
    btnSearch.click();
  });

  // Render result with establishment name
  function renderResult({ productName, thumbnail, minEntry, maxEntry, total }) {
    const raio = document.querySelector('.radius-btn.active').dataset.value;
    let html = `
      <div class=\"product-summary\">\
