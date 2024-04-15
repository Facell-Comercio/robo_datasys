export const delay = async (ms = 1000) =>{
    return new Promise(resolve => {
        setTimeout(() => {
            resolve()
        }, ms)
    })
}