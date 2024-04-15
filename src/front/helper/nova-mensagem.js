export const novaMensagem = function (tipo, msg){
    const tipos = {
      info: {bg: 'bg-secondary', label: 'Info'},
      success: {bg: 'bg-success', label: 'Sucesso'},
      error: {bg: 'bg-danger', label: 'Ops'}
    }
    return new Date().toLocaleTimeString('pt-br', {hour: '2-digit', minute:'2-digit'}) + ` <span class="badge ${tipos[tipo]['bg']}">${tipos[tipo]['label']}</span> ${msg}`
  }