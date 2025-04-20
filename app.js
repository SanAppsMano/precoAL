window.addEventListener('DOMContentLoaded', () => {
  // referências
  const btnSearch       = document.getElementById('btn-search');
  const barcodeIn       = document.getElementById('barcode');
  const clearBarcodeBtn = document.getElementById('clear-barcode');
  // ... outras refs e lógica de scanner, histórico, etc. ...

  // mostrar/esconder o botão de limpar
  barcodeIn.addEventListener('input', () => {
    clearBarcodeBtn.style.display = barcodeIn.value ? 'block' : 'none';
  });

  // ação de limpar
  clearBarcodeBtn.addEventListener('click', () => {
    barcodeIn.value = '';
    clearBarcodeBtn.style.display = 'none';
    barcodeIn.focus();
  });

  // busca ao clicar em “Pesquisar Preço”
  btnSearch.addEventListener('click', async () => {
    /* ... seu código de fetch e renderResult(...) ... */
  });

  // inicialização do histórico
  /* loadHistory(); renderHistory(); */

  // caso queira já deixar o botão visível se houver valor pré‑carregado:
  if (barcodeIn.value) clearBarcodeBtn.style.display = 'block';
});
