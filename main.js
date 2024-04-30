import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { pupClose, pupInit } from './src/back/pup.js';
import { login } from './src/back/datasys/login.js';
import { baixarCaixas } from './src/back/datasys/baixar-caixas.js';
import XLSX from 'xlsx';
import { importarOrcamento } from './src/back/datasys/importar-orcamento.js';

const widthAdicional = 0;
function createWindow() {
    const win = new BrowserWindow({
        width: 800+widthAdicional,
        height: 600,
        icon: 'favicon.ico',
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    win.loadFile('src/front/index.html')
    win.removeMenu()
    // win.webContents.openDevTools()


    win.addListener('ready-to-show', () => {
        var browser
        var page

        // * Confirmação Caixas
        const initialState = {
            status: 'initial',
            login: false,
            rows: []
        }

        var state = {...initialState};

        async function resetState() {
            state = {...initialState}
        }

        ipcMain.on('init', async (e, data) => {
            try {
                const { credentials } = data
                if (!credentials) {
                    throw new Error('Credencial não fornecida!')
                }
                const { cpf, senha, empresa } = credentials
                if (!cpf) {
                    throw new Error('CPF não fornecido!')
                }
                if (!senha) {
                    throw new Error('SENHA não fornecida!')
                }
                if (!empresa) {
                    throw new Error('EMPRESA não fornecida!')
                }
                if(state.rows.length === 0){
                    throw new Error('Caixas não recebidos!')
                }

                const { page: newPage, browser: newBrowser } = await pupInit()
                page = newPage;
                browser = newBrowser;
                state.status = 'running'
                win.webContents.send('state', state)

                await login(page, credentials)
                state.login = true;

                await baixarCaixas({
                    win, page,
                    rows: state.rows
                })

                await pupClose({ browser, page })
                state.status = 'final'
                win.webContents.send('state', state)

            } catch (error) {
                win.webContents.send('error', { message: error.message })
                console.log(error)
            }
        })

        ipcMain.on('state', (data) => {
            state = { ...state, ...data }
            win.webContents.send('state', state)
        })

        ipcMain.on('resetar', async (e, data) => {
            if (browser !== undefined) {
                await browser.close()
            }
            browser = undefined
            page = undefined
            resetState()
            win.webContents.send('state', state)
        })

        ipcMain.on('finalizar', async (e, data) => {
            if (browser !== undefined) {
                await browser.close()
            }
            browser = undefined
            page = undefined
            state.status = 'final'

            win.webContents.send('state', state)
        })

        ipcMain.on('importar', () => {
            // Vamos primeiro resetar o state
            resetState()

            // Abrir uma caixa de diálogo para selecionar o local de salvamento do arquivo
            dialog.showOpenDialog({
                title: 'Selecionar arquivo XLSX',
                filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
                properties: ['openFile']
            }).then(result => {
                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    // Ler o arquivo XLSX
                    const workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true });
                    // Processar os dados do arquivo (você pode adaptar esta parte de acordo com suas necessidades)
                    const sheetName = workbook.SheetNames[0]; // Supondo que queremos ler a primeira planilha
                    const worksheet = workbook.Sheets[sheetName];
                    const data = XLSX.utils.sheet_to_json(worksheet);
                    // Enviar os dados para o processo de renderização
                    state.rows = data.filter(caixa => caixa.datasys !== '' && caixa.datasys != undefined);
                    state.status = 'prepared'
                    win.webContents.send('importar-sucesso');
                    win.webContents.send('state', state);

                }
            }).catch(err => {
                console.error(err);

            });
        })

        ipcMain.on('exportar', () => {
            // Abrir uma caixa de diálogo para selecionar o local de salvamento do arquivo
            dialog.showSaveDialog({
                title: 'Salvar arquivo XLSX',
                defaultPath: 'Caixas Lançados.xlsx', // Nome padrão do arquivo
                filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }]
            }).then(result => {
                if (!result.canceled) {
                    const filePath = result.filePath;
                    // Gerar o arquivo XLSX
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(state.rows);
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planilha 1');
                    // Salvar o arquivo no local escolhido
                    XLSX.writeFile(workbook, filePath);
                    // Indicar ao processo de renderização que o arquivo foi exportado com sucesso
                    win.webContents.send('exportar-sucesso');
                }
            }).catch(err => {
                console.error(err);
            });
        })


        // * Importação Orçamento
        const orca_initialState = {
            status: 'initial',
            ano: null,
            login: false,
            rows: []
        }
        
        var orca_state = {...orca_initialState};

        async function orca_resetState() {
            orca_state = {...orca_initialState}
        }

        ipcMain.on('orca-init', async (e, data) => {
            try {
                const { ano, credentials } = data
                if (!credentials) {
                    throw new Error('Credencial não fornecida!')
                }
                if(!ano){
                    throw new Error('Preencha o ano do Orçamento!')
                }
                const { cpf, senha, empresa } = credentials
                if (!cpf) {
                    throw new Error('CPF não fornecido!')
                }
                if (!senha) {
                    throw new Error('SENHA não fornecida!')
                }
                if (!empresa) {
                    throw new Error('EMPRESA não fornecida!')
                }
                if(orca_state.rows.length === 0){
                    throw new Error('Caixas não recebidos!')
                }

                const { page: newPage, browser: newBrowser } = await pupInit()
                page = newPage;
                browser = newBrowser;
                orca_state.status = 'running'
                orca_state.ano = ano
                win.webContents.send('orca-state', orca_state)

                await login(page, credentials)
                orca_state.login = true;

                await importarOrcamento({
                    win, 
                    page,
                    ano: orca_state.ano,
                    rows: orca_state.rows
                })

                // await pupClose({ browser, page })
                orca_state.status = 'final'
                win.webContents.send('orca-state', orca_state)

            } catch (error) {
                win.webContents.send('orca-error', { message: error.message })
                console.log(error)
            }
        })

        ipcMain.on('orca-state', (data) => {
            orca_state = { ...orca_state, ...data }
            win.webContents.send('orca-state', orca_state)
        })

        ipcMain.on('orca-resetar', async (e, data) => {
            if (browser !== undefined) {
                await browser.close()
            }
            browser = undefined
            page = undefined
            orca_resetState()
            win.webContents.send('orca-state', orca_state)
        })

        ipcMain.on('orca-finalizar', async (e, data) => {
            if (browser !== undefined) {
                await browser.close()
            }
            browser = undefined
            page = undefined
            orca_state.status = 'final'

            win.webContents.send('orca-state', orca_state)
        })

        ipcMain.on('orca-importar', () => {
            // Vamos primeiro resetar o state
            orca_resetState()

            // Abrir uma caixa de diálogo para selecionar o local de salvamento do arquivo
            dialog.showOpenDialog({
                title: 'Selecionar arquivo XLSX',
                filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
                properties: ['openFile']
            }).then(result => {
                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    // Ler o arquivo XLSX
                    const workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true});
                    // Processar os dados do arquivo (você pode adaptar esta parte de acordo com suas necessidades)
                    const sheetName = workbook.SheetNames[0]; // Supondo que queremos ler a primeira planilha
                    const worksheet = workbook.Sheets[sheetName];
                    const data = XLSX.utils.sheet_to_json(worksheet);
                    // Enviar os dados para o processo de renderização
                    orca_state.rows = data.filter(row => row['CODIGO'] !== '' && row['CODIGO'] != undefined);
                    orca_state.status = 'prepared'
                    win.webContents.send('orca-importar-sucesso');
                    win.webContents.send('orca-state', orca_state);

                }
            }).catch(err => {
                console.error(err);

            });
        })

        ipcMain.on('orca-exportar', () => {
            // Abrir uma caixa de diálogo para selecionar o local de salvamento do arquivo
            dialog.showSaveDialog({
                title: 'Salvar arquivo XLSX',
                defaultPath: 'Orçamento Importado.xlsx', // Nome padrão do arquivo
                filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }]
            }).then(result => {
                if (!result.canceled) {
                    const filePath = result.filePath;
                    // Gerar o arquivo XLSX
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(orca_state.rows);
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planilha 1');
                    // Salvar o arquivo no local escolhido
                    XLSX.writeFile(workbook, filePath);
                    // Indicar ao processo de renderização que o arquivo foi exportado com sucesso
                    win.webContents.send('orca-exportar-sucesso');
                }
            }).catch(err => {
                console.error(err);
            });
        })

    })



}

app.whenReady().then(() => {
    createWindow()
})
