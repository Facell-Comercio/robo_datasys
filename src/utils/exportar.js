import * as XLSX from 'xlsx';

function exportarParaXLSX(objeto, nomePlan) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(objeto);
    XLSX.utils.book_append_sheet(wb, ws, "Planilha1");

    // Salvar o arquivo
    const time = new Date().toTimeString()
    XLSX.writeFile(wb, nomePlan + '-'+ time +".xlsx");
}