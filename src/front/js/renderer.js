const XLSX = require('xlsx')
const { ipcRenderer } = require("electron")

// import XLSX from "xlsx";

const cpfLocal = localStorage.getItem('cpf')
const senhaLocal = localStorage.getItem('senha')
const empresaLocal = localStorage.getItem('empresa')

const inpCpf = document.querySelector('#cpf')
const inpSenha = document.querySelector('#senha')
const inpEmpresa = document.querySelector('#empresa')

const infoQtdeCaixas = document.querySelector('#infoQtdeCaixas')

const btnImportar = document.querySelector('#btnImportar')
const btnResetar = document.querySelector('#btnResetar')
const btnIniciar = document.querySelector('#btnIniciar')
const btnFinalizar = document.querySelector('#btnFinalizar')
const btnExportar = document.querySelector('#btnExportar')

const progress = document.querySelector('.progress-bar')
const historico = document.querySelector('#historico')

function addMessageHistorico(type, message) {
    var bgColor = ''
    if(type === 'error'){
        bgColor = 'bg-danger'
    }
    const div = document.createElement('div')
    div.textContent = message
    div.classList.add('p-1', 'text-white', 'border-bottom', bgColor)
    historico.appendChild(div)
}

inpCpf.value = cpfLocal;
inpSenha.value = senhaLocal;
inpEmpresa.value = empresaLocal;

btnImportar?.addEventListener('click', () => {
    ipcRenderer.send('importar')
})

ipcRenderer.on('importar-sucesso', () => {
    btnImportar.classList.add('d-none')
    btnResetar.classList.remove('d-none')
    btnIniciar.classList.remove('d-none')
})

btnResetar.addEventListener('click', () => {
    ipcRenderer.send('resetar')
})

btnIniciar?.addEventListener('click', () => {
    localStorage.setItem('cpf', inpCpf.value)
    localStorage.setItem('senha', inpSenha.value)
    localStorage.setItem('empresa', inpEmpresa.value)

    ipcRenderer.send('init', {
        credentials: {
            cpf: inpCpf.value,
            senha: inpSenha.value,
            empresa: inpEmpresa.value,
        }
    })
})

ipcRenderer.on('error', (e, error) => {
    console.log(error)
    addMessageHistorico('error', error.message)
})

btnFinalizar.addEventListener('click', () => {
    ipcRenderer.send('finalizar')
})

ipcRenderer.on('state', (e, state) => {

    console.log('STATE_RECEBIDO', state)
    switch (state.status) {
        case 'initial':
            btnImportar.classList.remove('d-none')
            btnResetar.classList.add('d-none')
            btnIniciar.classList.add('d-none')
            btnFinalizar.classList.add('d-none')
            btnExportar.classList.add('d-none')
            break;
        case 'prepared':
            btnImportar.classList.add('d-none')
            btnResetar.classList.remove('d-none')
            btnIniciar.classList.remove('d-none')
            btnFinalizar.classList.add('d-none')
            btnExportar.classList.add('d-none')
            break;
        case 'running':
            btnImportar.classList.add('d-none')
            btnResetar.classList.add('d-none')
            btnIniciar.classList.add('d-none')
            btnFinalizar.classList.remove('d-none')
            btnExportar.classList.remove('d-none')
            break;
        case 'final':
            btnImportar.classList.add('d-none')
            btnResetar.classList.remove('d-none')
            btnIniciar.classList.add('d-none')
            btnFinalizar.classList.add('d-none')
            btnExportar.classList.remove('d-none')
            break;
        default:
            break;
    }

    const total = state?.rows?.length || 0
    const progresso = state?.rows?.reduce((contador, obj) => {
        if (obj.processado) {
            return contador + 1;
        } else {
            return contador
        }
    }, 0) || 0

    infoQtdeCaixas.textContent = total + ' Caixas'

    const percent = (progresso / total) * 100

    progress.style.width = percent.toFixed(2) + '%'
    progress.textContent = percent.toFixed(2) + '%'
})

btnExportar.addEventListener('click', () => {
    ipcRenderer.send('exportar')
})

ipcRenderer.on('exportar-sucesso', () => {
    btnExportar.textContent = 'Sucesso!'
    setTimeout(() => {
        btnExportar.textContent = 'Exportar Resultado'
    }, 4000)
})