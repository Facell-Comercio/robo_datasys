import { ipcMain, dialog } from "electron";
import { delay } from "../../utils/delay.js"
import { format } from "date-fns";

const cincoMinutos = 1000 * 60 * 5

export const importarOrcamento = ({
    win, page, rows, ano
}) => {
    return new Promise(async (resolve, reject) => {
        try {
            await page.setDefaultNavigationTimeout(cincoMinutos);
            await page.goto('https://tim.datasys.online/Geral/NovosModulos.aspx', { waitUntil: 'domcontentloaded' })
            const btnModuloFinanceiro = await page.waitForSelector('#lkFinanceiro', { timeout: cincoMinutos })
            await btnModuloFinanceiro.click()
            await page.waitForNavigation()

            await navegarParaOrcamentos({ page, ano })

            await delay(1000)

            for (const row of rows) {
                row.status = 'Erro'
                row.message = ''
                row.processado = 1
                try {
                    await preencherCampo({ page, row })
                } catch (error) {
                    row.message = `Erro ao preencher valor do código (${row['CODIGO']}): ${error.message}`
                    continue;
                }

                row.status = 'OK'
                ipcMain.emit('orca-state', { rows })
            }

            await page.click('#ctl00_body_lkSalvar')
            await delay(500)
            await page.waitForSelector('.inProgress2', { hidden: true, timeout: cincoMinutos })
            await delay(1000)

            resolve()
        } catch (error) {
            reject(error)
            console.log(error)
        }
    })
}

function navegarParaOrcamentos({
    page, ano
}) {
    return new Promise(async (resolve, reject) => {
        let tentativas = 5;
        let erro = null;

        while (tentativas > 0) {
            try {
                await page.goto('https://newadm-tim.datasys.online/View/Financeiro/OrcamentoAnual/CadastroOrcamento.aspx', { waitUntil: 'domcontentloaded' })

                await delay(500)

                // Exibir 100 filiais
                await page.type('#ctl00_body_edAno', ano)
                await page.click('#ctl00_body_lkPesquisar')

                await delay(400)
                await page.waitForSelector('.inProgress2', { hidden: true, timeout: cincoMinutos })

                await page.waitForFunction(() => {
                    const h3s = Array.from(document.querySelectorAll('h3'));
                    const h3 = h3s.find(h3 => h3.textContent.includes("Dados para Cadastro de Valor Orçamentário"));
                    return !!h3;
                });

                resolve();
                return;
            } catch (error) {
                tentativas--;
                erro = error.message;
            }
        }

        reject(erro)
    })
}

const meses = {
    "JANEIRO": 2,
    "FEVEREIRO": 3,
    "MARÇO": 4,
    "ABRIL": 5,
    "MAIO": 6,
    "JUNHO": 7,
    "JULHO": 8,
    "AGOSTO": 9,
    "SETEMBRO": 10,
    "OUTUBRO": 11,
    "NOVEMBRO": 12,
    "DEZEMBRO": 13
}

function preencherCampo({
    page, row
}) {
    return new Promise(async (resolve, reject) => {
        try {

            const codigo = row['CODIGO'];
            if (!codigo) {
                throw new Error(`Código inválido: ${codigo}.`)
            }
            const linhas = await page.$$('table tr');
            // await page.evaluate(() => {
            //     // Selecione todos os inputs na tabela
            //     const inputs = document.querySelectorAll('table tbody tr td input');

            //     // Itere sobre todos os inputs
            //     inputs.forEach(input => {
            //       // Remova o evento onchange, se existir
            //       input.removeAttribute('onchange');
            //       input.removeAttribute('onkeypress');
            //     });
            //   });

            let preenchido = false
            let count = 0;
            for (const linha of linhas) {
                const primeiraCelula = await linha.$('td:first-child');
                if (primeiraCelula) {
                    const textoPrimeiraCelula = await primeiraCelula.evaluate(e => e.textContent)

                    if (textoPrimeiraCelula?.trim()?.includes(codigo.trim())) {
                        // Iterar sobre as chaves (meses) do objeto
                        for (const [mes, valor] of Object.entries(row)) {
                            // Verificar se o mês está presente na tabela HTML
                            if (meses[mes.toUpperCase()]) {
                                // Encontrar o índice do mês na tabela HTML
                                const mesIndex = meses[mes.toUpperCase()];
                                // Encontrar o input correspondente ao mês na linha
                                const mesInput = await linha.$(`td:nth-child(${mesIndex}) input`);
                                if (mesInput) {
                                    await page.evaluate((input, valor) => {
                                        input.value = valor.toFixed(2).replace('.', ',');
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                    }, mesInput, valor);

                                    await delay(500); // Espera um curto período para permitir que o evento 'change' seja tratado
                                    await page.waitForSelector('.inProgress2', { hidden: true, timeout: cincoMinutos })
                                    await delay(1500)
                                    preenchido = true;
                                }
                            }
                        }
                        break; // Parar de iterar se a linha foi encontrada
                    }
                }
            }
            if (!preenchido) {
                console.log('Qtde pulada: ', ++count);

                row.status = 'Erro'
                row.message = 'Código não localizado! Ou robô passou direto sem preencher!'
            }

            await delay(300)
            resolve()
        } catch (error) {
            reject(error)
        }
    })
}