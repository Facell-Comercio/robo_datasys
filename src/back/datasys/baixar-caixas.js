import { ipcMain, dialog } from "electron";
import { delay } from "../../utils/delay.js"
import { format } from "date-fns";

const cincoMinutos = 1000 * 60 * 5

export const baixarCaixas = ({
    win, page, rows
}) => {
    return new Promise(async (resolve, reject) => {
        try {
            await page.setDefaultNavigationTimeout(cincoMinutos);
            await page.goto('https://tim.datasys.online/Geral/NovosModulos.aspx', { waitUntil: 'domcontentloaded' })
            const btnModuloFinanceiro = await page.waitForSelector('#lkFinanceiro', { timeout: cincoMinutos })
            await btnModuloFinanceiro.click()
            await page.waitForNavigation()

            for (const caixa of rows) {
                caixa.status = 'Erro'
                caixa.message = ''
                caixa.processado = 1

                await delay(1000)
                try {
                    await navegarParaListaCaixas({ page, caixa })
                } catch (messageErro) {
                    caixa.message = 'Não consegui realizar a navegação: ' + messageErro
                    continue
                }

                await delay(1000)

                // Aguardar a resolução da divergência
                if (caixa.manual === 'SIM') {
                    await new Promise(async (resolve, reject) => {
                        const { response } = await dialog.showMessageBox(win, {
                            type: 'question',
                            buttons: ['Confirmar'],
                            title: 'CAIXA MANUAL',
                            message: `Por favor, finalize a confirmação desse caixa e só depois clique aqui para Confirmar para que eu continue os próximos.`
                        });
                        resolve(response)
                    })
                    caixa.status = 'Atenção'
                    caixa.message = 'Ajustado manualmente'

                    // Pulamos para o próximo caixa
                    continue
                }

                // Verificamos se o caixa está Pendente Depósito ou Caixa
                const statusNaTabela = await page.evaluate(() => {
                    const td = document.querySelector("#ctl00_body_divLista2 .dataTables_wrapper table tbody tr:first-child td:nth-child(3)")
                    return td ? td.textContent?.trim() : null;
                })
                if (statusNaTabela !== 'Pendente de confirmação de depósito' && statusNaTabela !== 'Pendente de confirmação de caixa') {
                    caixa.message = 'Não consegui identificar se estava "Pendente de confirmação de depósito" ou se era "Pendente de confirmação Caixa"'
                    continue
                }
                if (statusNaTabela === 'Pendente de confirmação de depósito') {
                    try {
                        // Realizar o depósito
                        await realizarDeposito({ page, caixa })
                    } catch (error) {
                        caixa.message = 'Não consegui realizar o depósito: ' + error.message
                        continue
                    }
                    await delay(500)
                    try {
                        await navegarParaListaCaixas({ page, caixa })
                    } catch (messageErro) {
                        caixa.message = 'Não consegui navegar para a lista de caixas: ' + messageErro
                        continue
                    }
                    await delay(200)
                    try {
                        // Realizar a confirmação de caixa
                        await confirmarCaixa({ page, caixa })
                    } catch (error) {
                        caixa.message = 'Não consegui confirmar o caixa: ' + error.message
                        continue
                    }
                }

                if (statusNaTabela === 'Pendente de confirmação de caixa') {
                    try {
                        // Realizar a confirmação de caixa
                        await confirmarCaixa({ page, caixa })
                    } catch (error) {
                        caixa.message = 'Não consegui confirmar o caixa no Datasys'
                        continue
                    }
                }

                caixa.status = 'OK'
                ipcMain.emit('state', { rows })
            }
            resolve()
        } catch (error) {
            reject(error)
            console.log(error)
        }
    })
}

function navegarParaListaCaixas({
    page, caixa
}) {
    return new Promise(async (resolve, reject) => {
        let tentativas = 5;
        let erro = null;

        while (tentativas > 0) {
            try {
                await page.goto('https://newadm-tim.datasys.online/View/Financeiro/ControleCaixa/ConfirmacaoCaixa.aspx', { waitUntil: 'domcontentloaded' })

                await delay(500)

                // Exibir 100 filiais
                await page.select('.dataTables_length select', '100');

                await delay(300)
                // Procurar a filial
                await page.$$eval('.dataTables_wrapper table tbody tr', (rows, filial) => {
                    for (const row of rows) {
                        const columns = row.querySelectorAll('td');
                        const nome = columns[1].innerText.trim(); // Segunda coluna
                        const button = columns[0].querySelector('a.btn'); // Primeira coluna
                        if (nome === filial) {
                            button.click(); // Clique no botão
                            break
                        }
                    }
                }, caixa.filial)

                await page.waitForSelector("#ctl00_body_divLista2 .dataTables_wrapper table tbody tr:first-child td:nth-child(2)", { timeout: cincoMinutos })
                // Validar se a Data Caixa bate com a Data que consta no Objeto
                const dataNaTabela = await page.evaluate(() => {
                    const td = document.querySelector("#ctl00_body_divLista2 .dataTables_wrapper table tbody tr:first-child td:nth-child(2)")
                    return td ? td.textContent?.trim() : null;
                })

                const data_caixa = format(caixa.data_caixa, 'dd/MM/yyyy')
                if (dataNaTabela !== data_caixa) {
                    // Datas não bateram...
                    erro = `A Data ${data_caixa} na planilha, não bateu com a Data Caixa ${dataNaTabela} no Datasys.`
                    break
                }

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

function realizarDeposito({ page, caixa }) {
    return new Promise(async (resolve, reject) => {
        try {
            const btnAbrir = await page.waitForSelector('table tbody tr:first-child a', { visible: true, timeout: cincoMinutos });
            btnAbrir.click()
            await delay(300)
            // Selecionar a conta
            const id_conta = caixa.id_conta?.toString()
            if (!id_conta) {
                throw new Error('id_conta não informado!')
            }
            await page.waitForSelector('.select2.select2-offscreen', { timeout: cincoMinutos })
            await page.select('.select2.select2-offscreen', id_conta)

            const valor_deposito = parseFloat(caixa.deposito).toFixed(2).replace('.', ',')
            if (!valor_deposito) {
                throw new Error('Valor depósito não informado ou não é número!')
            }
            if (!caixa.data_deposito) {
                throw new Error('data_deposito não informada!')
            }
            if (!caixa.documento) {
                throw new Error('documento não informado!')
            }
            const documento = `${caixa.documento}`
            const data_deposito = format(caixa.data_deposito, 'dd/MM/yyyy')

            for (const caractere of valor_deposito) {
                await page.type('#ctl00_body_wucConfirmacaoDeposito_edValorDepositado', caractere, { delay: 100 })
            }
            for (const caractere of documento) {
                await page.type('#ctl00_body_wucConfirmacaoDeposito_edComprovanteDeposito', caractere, { delay: 100 })
            }
            for (const caractere of data_deposito) {
                await page.type('#ctl00_body_wucConfirmacaoDeposito_edDataDeposito', caractere, { delay: 100 })
            }

            await page.click('#ctl00_body_wucConfirmacaoDeposito_lkIncluirDeposito')
            await delay(1500)
            // Aguardar o depósito ser adicionado à lista
            await page.waitForSelector('.inProgress', { hidden: true, timeout: cincoMinutos })
            // Clicar em Confirmar
            await page.click('#ctl00_body_wucConfirmacaoDeposito_lkSalvar')
            await delay(1000)

            if(valor_deposito === '0,00'){
                const btnConfirmar = await page.waitForSelector('#ctl00_body_wucConfirmacaoDeposito_lkConfirmarDepositoZerado', { visible: true, timeout: 1000 })
                if(btnConfirmar){
                    await btnConfirmar.click()
                }
            }
            await delay(300);

            await page.waitForSelector('.inProgress', { hidden: true, timeout: cincoMinutos })

            // await page.waitForSelector('.modal-content', { visible: true , timeout: cincoMinutos});


            await delay(100)
            resolve()
        } catch (error) {
            reject(error)
        }
    })
}

function confirmarCaixa({
    page, caixa
}) {
    return new Promise(async (resolve, reject) => {
        try {
            const btnAbrir = await page.waitForSelector('a[data-original-title="Abrir"]', { visible: true, timeout: cincoMinutos })
            await btnAbrir.click()
            await delay(200)
            await page.waitForSelector('.inProgress', { hidden: true, timeout: cincoMinutos })

            const btnConfirmar = await page.waitForSelector('#ctl00_body_lkSalvar', { visible: true, timeout: cincoMinutos })
            await btnConfirmar.click()
            await delay(2000)
            await page.waitForSelector('.inProgress', { hidden: true, timeout: cincoMinutos })
            await delay(300)
            // await page.waitForSelector('.modal-content', { visible: true , timeout: cincoMinutos});

            resolve()
        } catch (error) {
            reject(error)
        }
    })
}