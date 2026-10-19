import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Geolocation} from '@capacitor/geolocation';
import {handleApi} from '../worker/api.mjs';

window.ForestNative={
  isNative:Capacitor.isNativePlatform(),
  async api(name,params,signal){
    if(signal?.aborted)throw new DOMException('Отменено','AbortError');
    const request=new Request('https://forest-app.local/api/'+name+'?'+new URLSearchParams(params));
    const response=await handleApi(request);
    const data=await response.json();
    if(signal?.aborted)throw new DOMException('Отменено','AbortError');
    if(!response.ok)throw Error(data.error||'Источник недоступен.');
    return data;
  },
  async saveFile(content,name){
    const path=name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const result=await Filesystem.writeFile({path,data:content,directory:Directory.Cache,encoding:Encoding.UTF8});
    await Share.share({title:'Лесной дозор · '+name,files:[result.uri],dialogTitle:'Сохранить или отправить файл'});
  },
  async locate(){
    await Geolocation.requestPermissions();
    return Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  }
};
