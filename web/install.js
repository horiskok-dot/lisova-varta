'use strict';
(() => {
  const button=document.querySelector('#install-app');
  const dialog=document.querySelector('#install-dialog');
  const instructions=document.querySelector('#install-instructions');
  if(!button||!dialog||location.protocol==='forest:'||window.ForestNative?.isNative)return;
  const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let installPrompt=null;
  function update(){button.hidden=installed();}
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
    update();
  });
  window.addEventListener('appinstalled',()=>{installPrompt=null;update();});
  button.addEventListener('click',async()=>{
    if(installPrompt){
      const prompt=installPrompt;installPrompt=null;
      await prompt.prompt();
      await prompt.userChoice;
      update();
      return;
    }
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const android=/Android/.test(navigator.userAgent);
    instructions.textContent=ios?'В Safari нажмите «Поделиться» и выберите «На экран Домой».':android?'В Chrome откройте меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран».':'В Chrome или Edge откройте меню ⋮ и выберите «Установить приложение». Если пункт недоступен, используйте актуальную версию браузера.';
    dialog.showModal();
  });
  document.querySelector('#close-install').addEventListener('click',()=>dialog.close());
  update();
})();
