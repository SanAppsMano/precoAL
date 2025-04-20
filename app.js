window.addEventListener('DOMContentLoaded', () => {
  // REFERÊNCIAS
  const btnScan    = document.getElementById('btn-scan');
  const btnSearch  = document.getElementById('btn-search');
  const barcodeIn  = document.getElementById('barcode');
  const citySel    = document.getElementById('city');
  const resultDiv  = document.getElementById('result');

  // SCANNER (mantido simples)
  let scanning = false;
  const quaggaConfig = {
    inputStream: { name:"Live", type:"LiveStream",
      target: document.querySelector('#interactive'),
      constraints:{ facingMode:"environment" }
    },
    decoder:{ readers:["ean_reader"] },
    locate:true
  };
  btnScan.addEventListener('click', () => {
    if (!scanning) {
      Quagga.init(quaggaConfig, err=>{
        if(err){ alert("Erro câmera"); return; }
        Quagga.start(); scanning=true; btnScan.textContent="Parar Scanner";
      });
      Quagga.onDetected(d => {
        if(d.codeResult?.code){
          barcodeIn.value = d.codeResult.code;
          Quagga.stop(); scanning=false; btnScan.textContent="Iniciar Scanner";
        }
      });
    } else {
      Quagga.stop(); scanning=false; btnScan.textContent="Iniciar Scanner";
    }
  });

  // EVENTO DE BUSCA
  btnSearch.addEventListener('click', async () => {
    const code = barcodeIn.value.trim();
    if (!code) {
      alert("Informe ou escaneie o código!");
      return;
    }
    const city = citySel.value;
    resultDiv.innerHTML = `<p>Buscando...</p>`;

    try {
      const resp = await fetch(`${window.location.origin}/.netlify/functions/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoDeBarras: code, city })
      });

      const text = await resp.text();
      if (!text.trim() || text.trim().startsWith("<")) {
        resultDiv.innerHTML = `<p class="error">Erro ${resp.status}</p>`;
        return;
      }
      const data = JSON.parse(text);
      if (!resp.ok || !Array.isArray(data) || data.length === 0) {
        resultDiv.innerHTML = `<p class="error">Nenhum resultado encontrado.</p>`;
        return;
      }

      // Calcula mínimo e máximo
      const minE = data.reduce((a,b)=>b.valMinimoVendido<a.valMinimoVendido?b:a, data[0]);
      const maxE = data.reduce((a,b)=>b.valMaximoVendido>a.valMaximoVendido?b:a, data[0]);
      const productName = data[0].dscProduto || "—";
      const thumbnail   = data[0].codGetin
        ? `https://cdn-cosmos.bluesoft.com.br/products/${data[0].codGetin}`
        : "https://via.placeholder.com/100";
      const total = data.length;

      // Monta HTML estático
      let html = `
        <div class="product-summary">
          <img src="${thumbnail}" alt="${productName}">
          <h2>${productName}</h2>
        </div>
        <div class="summary">${total} estabelecimento${total>1?'s':''}</div>
      `;
      [ ["Menor Preço", minE], ["Maior Preço", maxE] ].forEach(([label,e])=>{
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

      // Histórico simplificado
      // ... (se já tiver seu código de histórico, chame loadHistory()/addToHistory())
    } catch (err) {
      console.error(err);
      resultDiv.innerHTML = `<p class="error">Falha de rede: ${err.message}</p>`;
    }
  });
});
