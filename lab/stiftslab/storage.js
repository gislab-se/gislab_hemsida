let opening;
function database() {
  return opening??=new Promise((resolve,reject)=>{
    const req=indexedDB.open('stiftslab-2026',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('scenarios',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function transact(mode,action) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('scenarios',mode), req=action(tx.objectStore('scenarios'));
    let result; req.onsuccess=()=>result=req.result;
    tx.oncomplete=()=>resolve(result); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  });
}
export const put=record=>transact('readwrite',s=>s.put(record));
export const get=id=>transact('readonly',s=>s.get(id));
export const all=()=>transact('readonly',s=>s.getAll());
export const remove=id=>transact('readwrite',s=>s.delete(id));
