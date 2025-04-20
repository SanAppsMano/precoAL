// ===== Scanner Quagga2 =====
const quaggaConfig = {
  inputStream: {
    name: "Live", type: "LiveStream",
    target: document.querySelector('#interactive'),
    constraints:{ facingMode:"environment", width:{min:640}, height:{min:480} }
  },
  decoder:{ readers:["ean_reader"] },
  locate:true, frequency:10,
  numOfWorkers:navigator.hardwareConcurrency||4
};

let scanning = false;
const btnScan = document.getElementById('btn-scan');
const barcodeInput = document.getElementById('barcode');
const resultDiv = document.getElementById('result');

// Inicia/para scanner
btnScan.addEventListener('click', () => {
  if (!scanning) {
    Quagga.init(quaggaConfig, err => {
      if (err) { alert("Falha ao acessar a câmera."); return; }
      Quagga.start(); scanning = true; btnScan.textContent="Parar Scanner";
    });
    Quagga.onDetected(d => {
      if (d.codeResult?.code) {
        barcodeInput.value = d.codeResult.code;
        Quagga.stop(); scanning=false; btnScan.textContent="Iniciar Scanner";
        document.querySelector('#interactive').innerHTML = "";
      }
    });
  } else {
    Quagga.stop(); scanning=false; btnScan.textContent="Iniciar Scanner";
    document.querySelector('#interactive').innerHTML = "";
  }
});

// ===== Histórico via localStorage =====
let historyData = [];
function loadHistory(){
  const raw = localStorage.getItem("searchHistory");
  historyData = raw?JSON.parse(raw):[];
}
function saveHistory(){
  localStorage.setItem("searchHistory", JSON.stringify(historyData));
}
function addToHistory(item){
  historyData = historyData.filter(i=> i.code!==item.code || i.city!==item.city);
  historyData.unshift(item);
  if(historyData.length>20) historyData.pop();
  saveHistory(); renderHistory();
}
function renderHistory(){
  const ul = document.getElementById("history-list");
  ul.innerHTML = historyData.map((it,i)=>
    `<li data-index="${i}"><img src="${it.thumbnail||'https://via.placeholder.com/60'}"></li>`
  ).join("");
}
document.getElementById("clear-history").onclick = () => {
  historyData=[]; saveHistory(); renderHistory();
};
document.getElementById("history-list").addEventListener('click', e=>{
  const li = e.target.closest("li");
  if(!li) return;
  const item = historyData[li.dataset.index];
  renderResult(item);
});

// ===== Render do resultado estático =====
function renderResult({ productName, thumbnail, minEntry, maxEntry, total }) {
  let html = `
    <div class="product-summary">
      <img src="${thumbnail}" alt="${productName}">
      <h2>${productName}</h2>
    </div>
    <div class="summary">${total} estabelecimento${total>1?'s':''} encontrado${total>1?'s':''}</div>
  `;

  [ ["Menor Preço", minEntry], ["Maior Preço", maxEntry] ].forEach(([label,e])=>{
    const price  = label==="Menor Preço" ? e.valMinimoVendido : e.valMaximoVendido;
    const name   = e.nomFantasia||e.nomRazaoSocial||"—";
    const bairro = e.nomBairro||"—";
    const when   = e.dthEmissaoUltimaVenda
      ? new Date(e.dthEmissaoUltimaVenda).toLocaleString()
      : "—";
    const mapL   = `https://www.google.com/maps/search/?api=1&query=${e.numLatitude},${e.numLongitude}`;
    const dirL   = `https://www.google.com/maps/dir/?api=1&destination=${e.numLatitude},${e.numLongitude}`;

    html += `
      <div class="card">
        <h2>${label}</h2>
        <p><strong>Preço:</strong> R$ ${price.toFixed(2)}</p>
        <p><strong>Estabelecimento:</strong> ${name}</p>
        <p><strong>Bairro:</strong> ${bairro}</p>
        <p><strong>Quando:</strong> ${when}</p>
        <p>
          <a href="${mapL}" target="_blank">Ver no mapa</a> |
          <a href="${dirL}" target="_blank">Como chegar</a>
        </p>
      </div>`;
  });

  resultDiv.innerHTML = html;
  resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// ===== Busca via Netlify Function =====
const FN_URL = `${window.location.origin}/.netlify/functions/search`;
document.getElementById('btn-search').addEventListener('click', async ()=>{
  const code = barcodeInput.value.trim();
  if(!code){ alert("Informe ou escaneie o código!"); return; }
  const city = document.getElementById('city').value;

  try {
    const resp = await fetch(FN_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ codigoDeBarras:code, city })
    });
    const text = await resp.text();
    if(!text.trim()||text.trim().startsWith("<")){
      alert("Erro na busca"); return;
    }
    const data = JSON.parse(text);
    if(!resp.ok||!Array.isArray(data)||!data.length){
      alert("Nenhum resultado"); return;
    }

    const minEntry    = data.reduce((a,b)=> b.valMinimoVendido<a.valMinimoVendido?b:a, data[0]);
    const maxEntry    = data.reduce((a,b)=> b.valMaximoVendido>a.valMaximoVendido?b:a, data[0]);
    const productName = data[0].dscProduto||"–";
    const thumbnail   = data[0].codGetin
      ? `https://cdn-cosmos.bluesoft.com.br/products/${data[0].codGetin}`
      : "https://via.placeholder.com/100";
    const total       = data.length;

    const item = { code, city, productName, thumbnail, minEntry, maxEntry, total };

    renderResult(item);
    loadHistory();
    addToHistory(item);

  } catch(err) {
    console.error(err);
    alert("Erro na busca");
  }
});

// inicialização
loadHistory();
renderHistory();
