'use strict';
const {app,BrowserWindow,protocol,shell,session}=require('electron');
const fs=require('node:fs');
const path=require('node:path');

protocol.registerSchemesAsPrivileged([{scheme:'forest',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);

let appWorker;
async function loadWorker(){
  const code=fs.readFileSync(path.join(__dirname,'worker.js'),'utf8');
  return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
}
function isExternal(url){try{return ['https:','http:'].includes(new URL(url).protocol);}catch{return false;}}
async function createWindow(){
  const win=new BrowserWindow({width:1320,height:900,minWidth:720,minHeight:600,show:!process.argv.includes('--smoke-test'),title:'Лесной дозор',backgroundColor:'#f3f6f5',icon:path.join(__dirname,'icon.ico'),webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{if(isExternal(url))shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('forest://app/')){event.preventDefault();if(isExternal(url))shell.openExternal(url);}});
  await win.loadURL('forest://app/');
  return win;
}
app.whenReady().then(async()=>{
  appWorker=await loadWorker();
  protocol.handle('forest',request=>appWorker.fetch(request));
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(permission==='geolocation'&&contents.getURL().startsWith('forest://app/')));
  const win=await createWindow();
  if(process.argv.includes('--smoke-test')){
    const result=await win.webContents.executeJavaScript('({title:document.title,map:!!document.querySelector("#map"),core:typeof ForestCore!=="undefined",native:!!window.ForestNative,ui:typeof document.querySelector("#mobile-menu")?.onclick==="function",logo:document.querySelector(".brand img")?.naturalWidth>0,scrollY:Math.round(window.scrollY)})');
    if(!result.map||!result.core||result.native||!result.ui||!result.logo||result.scrollY!==0)throw Error('Desktop shell did not load at the top: '+JSON.stringify(result));
    if(process.env.FOREST_WATCH_SMOKE_SCREENSHOT){win.showInactive();await new Promise(resolve=>setTimeout(resolve,500));const image=await win.webContents.capturePage();fs.writeFileSync(process.env.FOREST_WATCH_SMOKE_SCREENSHOT,image.toPNG());}
    if(process.env.FOREST_WATCH_SMOKE_RESULT)fs.writeFileSync(process.env.FOREST_WATCH_SMOKE_RESULT,JSON.stringify({ok:true,result}));
    console.log('Desktop smoke test passed: '+JSON.stringify(result));
    app.quit();return;
  }
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{console.error(error);if(process.env.FOREST_WATCH_SMOKE_RESULT)fs.writeFileSync(process.env.FOREST_WATCH_SMOKE_RESULT,JSON.stringify({ok:false,error:String(error.stack||error)}));app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
