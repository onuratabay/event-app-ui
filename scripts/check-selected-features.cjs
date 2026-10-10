const assert = require('node:assert/strict')
module.exports = async ({storage,mount,act,text}) => {
 const api=require('../src/api/client'),original=global.fetch
 const response=(status,body)=>({ok:status<400,status,json:async()=>body,text:async()=>JSON.stringify(body)})
 await api.logout();storage.set('event-app:access-token','expired');storage.set('event-app:refresh-token','expired-refresh')
 let expired=0;const stop=api.onSessionExpired(()=>{expired++})
 global.fetch=async()=>response(401,{message:'Unauthorized'})
 const results=await Promise.allSettled([api.getEvent('one'),api.getEvent('two')])
 assert(results.every(r=>r.status==='rejected'));assert.equal(expired,1,'Concurrent 401s expire once');assert.equal(await api.hasSession(),false)
 storage.set('event-app:access-token','still-valid');global.fetch=async()=>{throw new TypeError('offline')}
 await assert.rejects(api.getEvent('one'));assert.equal(await api.hasSession(),true,'Offline is not logout')
 global.fetch=async()=>response(400,{message:'Eski şifre hatalı'})
 await assert.rejects(api.changePassword('bad','New!12345'));assert.equal(await api.hasSession(),true)
 stop();await api.logout();global.fetch=original
 for(const [screen,props] of [['Reports',{}],['Legal',{}],['Account',{mode:'password'}],['Account',{mode:'delete'}],['PublicProfile',{userId:'someone'}]]) {
   const tree=await mount(screen,props);assert(tree.toJSON());await act(async()=>tree.unmount())
 }
 const {resolveApiUrl}=require('../src/api/config')
 assert.throws(()=>resolveApiUrl(undefined,undefined,'ios',true))
 assert.throws(()=>resolveApiUrl('http://localhost:3000',undefined,'ios',true))
 assert.equal(resolveApiUrl('https://api.example.test/',undefined,'ios',true),'https://api.example.test')
 console.log('PASS: concurrent session expiry, offline session preservation, password rejection, new feature screens and production URL guard.')
}
