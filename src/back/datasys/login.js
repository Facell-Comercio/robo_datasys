import { ipcMain } from "electron"
import { delay } from "../../utils/delay.js"

export const login = async (page, credentials) => {
    return new Promise(async (resolve, reject) => {
        try {
            await page.goto('https://tim.datasys.online', { waitUntil: 'domcontentloaded' }).catch(e => { })

            await page.evaluate(async (data) => {
                const credentials = data.credentials
                const delay = (ms) => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve()
                        }, ms)
                    })
                }
                const event = new Event('keyup', { bubbles: true });
                const eventChange = new Event('change', { bubbles: true });

                const loginInput = document.querySelector('#edLogin');
                loginInput.value = credentials.cpf;
                loginInput.dispatchEvent(event);
                loginInput.dispatchEvent(eventChange);
                await delay(300)

                const senhaInput = document.querySelector('#edSenha');
                senhaInput.value = credentials.senha;
                senhaInput.dispatchEvent(event);
                senhaInput.dispatchEvent(eventChange);
                await delay(150)

                const identificacaoInput = document.querySelector('#edIdentificacao');
                identificacaoInput.value = credentials.empresa;
                identificacaoInput.dispatchEvent(event);
                identificacaoInput.dispatchEvent(eventChange);

            }, { credentials })

            await delay(1000)
            await page.click('[name="btAcessar"]')

            ipcMain.emit('state', { login: true })
            resolve()

        } catch (error) {
            ipcMain.emit('state', { login: false })
            reject(error)
        }
    })
}