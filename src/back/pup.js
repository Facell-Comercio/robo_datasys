import { connect } from 'puppeteer-real-browser'

export const pupInit = async function () {
    return new Promise(async (resolve, reject) => {
        try {
            const { page, browser } = await connect({
                headless: 'auto',
                args: [
                    '--start-maximized',
                ],
            })
            await page.setViewport({ width: 1200, height: 600 })
            resolve({page, browser})
        } catch (error) {
            console.log('ERRO_PUP_INIT', error)
            reject(error)
        }
    })
}

export const pupClose = async ({browser, page})=>{
    return new Promise(async (resolve, reject)=>{
        try {
            if(page){
                await page.close()
            }
            if(browser){
                await browser.close()
            }
            resolve()
        } catch (error) {
            reject(error)
        }
    })
}