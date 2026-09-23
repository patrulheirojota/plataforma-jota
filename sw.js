const CACHE = 'patrulheiros-v2'
const ESSENCIAIS = [
  '/cronograma.html',
  '/questoes.html',
  '/edital.html',
  '/index.html',
  '/style.css',
  '/config.js',
  '/manifest.json'
]

self.addEventListener('install', function(e){
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ESSENCIAIS.map(function(u){
        return c.add(u).catch(function(){ return null })
      }))
    })
  )
})

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){ return k !== CACHE })
        .map(function(k){ return caches.delete(k) }))
    }).then(function(){ return self.clients.claim() })
  )
})

self.addEventListener('fetch', function(e){
  const url = e.request.url
  // Nunca cacheia chamadas ao Supabase: os dados precisam ser sempre atuais
  if (e.request.method !== 'GET' || url.indexOf('supabase') >= 0) return

  e.respondWith(
    fetch(e.request).then(function(res){
      if (res && res.status === 200 && res.type === 'basic') {
        const copia = res.clone()
        caches.open(CACHE).then(function(c){ c.put(e.request, copia) })
      }
      return res
    }).catch(function(){
      return caches.match(e.request).then(function(r){
        return r || caches.match('/cronograma.html')
      })
    })
  )
})
