// Banco FALSO usado so nos testes automaticos (nao e usado no site)
(function(){
const D=n=>new Date(Date.now()+n*864e5).toISOString(), Y=n=>D(n).slice(0,10)
const qs=[],rs=[]
const temas=[['Leg. Penal','Tortura',0.3],['Leg. Penal','Drogas',0.9],['Leg. Penal','Abuso de autoridade',0.65],['Portugues','Crase',0.4],['Portugues','Concordancia',0.85],['Const.','Direitos fundamentais',0.7],['Const.','Seguranca publica',0.5]]
let n=1
temas.forEach(([d,a,p],ti)=>{for(let i=0;i<8;i++){const id='q'+(n++);qs.push({id,disciplina:d,assunto:a,tipo:'multipla',enunciado:'Questao '+id+' sobre '+a+'. '+'Texto '.repeat(30),alternativas:['alt A','alt B','alt C','alt D'],gabarito:'A',ativo:true,origem:'prova'})
 if(i<7){const ok=((i*37+ti*11)%100)/100<p;rs.push({aluno_id:'al1',questao_id:id,resposta:ok?'A':'B',correta:ok,respondido_em:D(-(i*3+1))})
  rs.push({aluno_id:'al2',questao_id:id,resposta:ok&&i%2?'A':'C',correta:ok&&i%2,respondido_em:D(-2)})}}})
// questao com gabarito suspeito: quase todos marcam C
for(let k=0;k<9;k++)rs.push({aluno_id:'x'+k,questao_id:'q2',resposta:'C',correta:false,respondido_em:D(-1)})
const sess=[]
sess.push({id:'shoje',aluno_id:'al1',concurso_id:'c1',data:Y(0),ordem:1,disciplina:'Leg. Penal',topico:'Lei de tortura',tipo:'teoria',concluida:false,tempo_minutos:50});
for(let i=0;i<40;i++){sess.push({id:'s'+i,aluno_id:'al1',concurso_id:'c1',data:Y(-45+i),ordem:1,disciplina:i%2?'Portugues':'Leg. Penal',topico:i%2?'Interpretacao de texto':'Lei de tortura',tipo:'teoria',concluida:i%3!==0,tempo_minutos:50,questoes_feitas:i%2?10:6,questoes_certas:i%2?7:2,caderno_erros_lido:i%4===0})}
window.SEED={
 admins:[{user_id:'adm'}],
 alunos:[
  {id:'al1',nome:'Joao Teste',email:'j@t',concurso_id:'c1',ultimo_acesso:D(0),criado_em:D(-45),data_expiracao:Y(10),meta_questoes_dia:30},
  {id:'al2',nome:'Maria PMAL',email:'m@t',concurso_id:'c2',ultimo_acesso:D(-6),criado_em:D(-60),data_expiracao:Y(90)},
  {id:'al3',nome:'Pedro PMSE',email:'p@t',concurso_id:'c1',ultimo_acesso:D(-4),criado_em:D(-10),data_expiracao:Y(-3)}],
 aluno_concursos:[{aluno_id:'al1',concurso_id:'c1'},{aluno_id:'al2',concurso_id:'c2'},{aluno_id:'al2',concurso_id:'c1'}],
 concursos:[{id:'c1',nome:'PMSE'},{id:'c2',nome:'PMAL'}],
 questoes:qs.map((q,i)=>i===0?Object.assign(q,{explicacao_url:'https://youtu.be/dQw4w9WgXcQ',comentario:'Comentario de teste'}):q), questao_respostas:rs, sessoes_estudo:sess,
 config_cronograma:[{aluno_id:'al1',concurso_id:'c1',atualizado_em:D(-45),sessoes_por_dia:2}],
 simulado_tentativas:[{aluno_id:'al1',acertos:30,total:50,finalizado_em:D(-5)}],
 relatorio_ciclo_visto:[],auth_users:[],compras:[{id:'cp1',origem:'kiwify',pedido_id:'K1',email:'kiwi@aluno.com',nome:'Kiwi Aluno',produto_id:'P1',produto_nome:'Mentoria 6 meses',valor:497,status:'aprovada',aluno_id:null,criado_em:D(-1)}],produtos_acesso:[{produto_id:'P1',produto_nome:'Mentoria 6 meses',concurso_id:null,dias:365,ativo:false,criado_em:D(-1)}],pedidos_acesso:[],kiwify_eventos:[{id:'ev1',recebido_em:D(-1),evento:'order_approved',pedido_id:'K1',email:'kiwi@aluno.com',resultado:'produto sem configuracao',payload:{order_status:'paid'}}],leis:[],lei_leituras:[],sim_banca:[],sim_itens:[],sim_gabaritos:[],sim_respostas:[],sim_resultados:[],questao_reportes:[],erros_site:[],questao_comentarios:[],caderno_erros:[{id:'n1',aluno_id:'al1',titulo:'Crase antes de masculino',conteudo:'Nao ha crase antes de palavra masculina, salvo a moda de.',disciplina:'Portugues',atualizado_em:D(-5)},{id:'n2',aluno_id:'al1',titulo:'Tortura-castigo',conteudo:'Exige vitima sob guarda, poder ou autoridade.',disciplina:'Leg. Penal',atualizado_em:D(-3),revisar_em:Y(10),nivel:2},{id:'n3',aluno_id:'al1',titulo:'Pena do homicidio culposo',conteudo:'Detencao de 1 a 3 anos.',disciplina:'Leg. Penal',atualizado_em:D(-2)}],config_marca:[],questao_concursos:[],mapas_mentais:[],edital_topicos:[],edital_progresso:[],avisos:[],registros_diarios:[],plano_aluno:[],flashcards:[],flashcard_progresso:[],relatorios_aluno:[],anotacoes_aluno:[],cronograma_log:[]
}})();

(function(){
const K='mockdb'
function load(){try{return JSON.parse(localStorage.getItem(K))}catch(e){return null}}
let db=load()
if(!db){db=window.SEED||{};}
function save(){localStorage.setItem(K,JSON.stringify(db))}
window._db=function(){return db}
let nid=1000
function Q(t){this.t=t;this.f=[];this.op='select';this.one=0;this.ord=[];this.rg=null;this.d=null;this.oc=null}
Q.prototype.select=function(){if(this.op==='select')this.op='select';return this}
Q.prototype.eq=function(c,v){this.f.push(r=>String(r[c])===String(v));return this}
Q.prototype.in=function(c,v){this.f.push(r=>v.map(String).includes(String(r[c])));return this}
Q.prototype.or=function(){return this}
Q.prototype.order=function(c,o){this.ord.push([c,!(o&&o.ascending===false)]);return this}
Q.prototype.limit=function(){return this}
Q.prototype.range=function(a,b){this.rg=[a,b];return this}
Q.prototype.not=function(){return this}
Q.prototype.lte=function(c,v){this.f.push(r=>String(r[c])<=String(v));return this}
Q.prototype.lt=function(c,v){this.f.push(r=>String(r[c])<String(v));return this}
Q.prototype.neq=function(c,v){this.f.push(r=>String(r[c])!==String(v));return this}
Q.prototype.is=function(c,v){this.f.push(r=>v===null?(r[c]==null):r[c]===v);return this}
Q.prototype.gte=function(c,v){this.f.push(r=>String(r[c])>=String(v));return this}
Q.prototype.ilike=function(){return this}
Q.prototype.upsert=function(d,o){this.op='upsert';this.d=d;this.oc=(o&&o.onConflict||'id').split(',');return this}
Q.prototype.maybeSingle=function(){this.one=1;return this}
Q.prototype.single=function(){this.one=2;return this}
Q.prototype.insert=function(d){this.op='insert';this.d=d;return this}
Q.prototype.update=function(d){this.op='update';this.d=d;return this}
Q.prototype.delete=function(){this.op='delete';return this}
Q.prototype.then=function(res,rej){try{res(this.run())}catch(e){rej(e)}}
Q.prototype.run=function(){
  if(window.SEM&&window.SEM.indexOf(this.t)>=0)return {data:null,error:{message:'relation "public.'+this.t+'" does not exist'}}
  const T=db[this.t]=db[this.t]||[]
  if(window.FAIL&&window.FAIL(this))return {data:null,error:{message:window.FAIL(this)}}
  const m=r=>this.f.every(f=>f(r))
  if(this.op==='insert'){const a=Array.isArray(this.d)?this.d:[this.d];const ins=a.map(x=>{x=Object.assign({},x);if(x.id==null)x.id=String(nid++);T.push(x);return x});save();return {data:this.one?ins[0]:ins,error:null}}
  if(this.op==='upsert'){const a=Array.isArray(this.d)?this.d:[this.d];a.forEach(x=>{const ex=T.find(r=>this.oc.every(k=>String(r[k])===String(x[k])));if(ex)Object.assign(ex,x);else{const y=Object.assign({},x);if(y.id==null)y.id=String(nid++);T.push(y)}});save();return {data:null,error:null}}
  if(this.op==='update'){const up=T.filter(m);up.forEach(r=>Object.assign(r,this.d));save();const c=up.map(x=>Object.assign({},x));return {data:this.one?(c[0]||null):c,error:null}}
  if(this.op==='delete'&&window.BLOQ_DEL){return {data:[],error:null}}
  if(this.op==='delete'){const del=T.filter(m);db[this.t]=T.filter(r=>!m(r));save();return {data:window.BLOQ_DEL?[]:del,error:null}}
  let r=T.filter(m).map(x=>Object.assign({},x))
  this.ord.slice().reverse().forEach(([c,a])=>r.sort((x,y)=>(x[c]>y[c]?1:x[c]<y[c]?-1:0)*(a?1:-1)))
  if(this.rg)r=r.slice(this.rg[0],this.rg[1]+1)
  r=r.slice(0,1000) // CAP1000
  if(this.one)return {data:r[0]||null,error:null}
  return {data:r,error:null}
}
const PQ=t=>new Proxy(new Q(t),{get(o,k){if(k in o)return o[k];if(typeof k==='symbol')return undefined;return function(){return this}}});
window._supabase={from:t=>PQ(t),storage:{from:()=>({upload:async()=>({data:{},error:null}),getPublicUrl:n=>({data:{publicUrl:'https://exemplo/'+n}})})},rpc:async(n,a)=>(window.RPC&&window.RPC[n]?{data:window.RPC[n](a),error:null}:{data:!!window.ADMIN,error:null}),
 auth:{signUp:async(o)=>window.AUTH.signUp(o),signInWithPassword:async(o)=>window.AUTH.signIn(o),resetPasswordForEmail:async()=>({error:null}),getSession:async()=>({data:{session:window.UID?{user:{id:window.UID}}:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:async()=>({data:{user:window.UID?{id:window.UID,email:(window.EMAIL||'a@a'),user_metadata:{}}:null}}),signOut:async()=>{window.UID=null;try{sessionStorage.removeItem('uid')}catch(e){};return {}},updateUser:async()=>({})}}
window.Chart=function(){return {destroy(){}}};window.jspdf={}
})();

window.RPC={
 desempenho_assuntos:function(a){const db=window._db(),al=a.p_aluno||window.UID,g={}
  db.questao_respostas.filter(r=>r.aluno_id===al&&(!a.p_desde||r.respondido_em>=a.p_desde)&&(!a.p_ate||r.respondido_em<a.p_ate)).forEach(r=>{const q=db.questoes.find(x=>x.id===r.questao_id);if(!q)return;const k=q.disciplina+'||'+q.assunto;g[k]=g[k]||{disciplina:q.disciplina,assunto:q.assunto,feitas:0,certas:0,ultima:null};g[k].feitas++;if(r.correta)g[k].certas++;if(!g[k].ultima||r.respondido_em>g[k].ultima)g[k].ultima=r.respondido_em});return Object.values(g)},
 estatisticas_questoes:function(a){const db=window._db(),g={};let alunos=null
  if(a.p_concurso){alunos=new Set(db.alunos.filter(x=>x.concurso_id===a.p_concurso).map(x=>x.id));db.aluno_concursos.filter(v=>v.concurso_id===a.p_concurso).forEach(v=>alunos.add(v.aluno_id))}
  db.questao_respostas.forEach(r=>{if(alunos&&!alunos.has(r.aluno_id))return;const x=g[r.questao_id]=g[r.questao_id]||{questao_id:r.questao_id,respostas:0,acertos:0,dist:{}};x.respostas++;if(r.correta)x.acertos++;x.dist[r.resposta]=(x.dist[r.resposta]||0)+1})
  return Object.values(g).filter(x=>x.respostas>=a.p_min)}
}
;(function(){
const R=window.RPC, db=()=>window._db(), U=()=>window.UID, now=()=>new Date().toISOString()
const save=()=>localStorage.setItem('mockdb',JSON.stringify(db()))
const T=t=>(db()[t]=db()[t]||[])
R.sim_iniciar=function(a){let r=T('sim_resultados').find(x=>x.simulado_id===a.p_sim&&x.aluno_id===U());if(!r){r={id:'r'+Math.random(),simulado_id:a.p_sim,aluno_id:U(),iniciado_em:now(),finalizado_em:null};T('sim_resultados').push(r);save()}return r}
function corrigir(sim,al){const s=T('sim_banca').find(x=>x.id===sim),r=T('sim_resultados').find(x=>x.simulado_id===sim&&x.aluno_id===al);let c=0,e=0,b=0,an=0,t=0;const disc={}
 T('sim_itens').filter(i=>i.simulado_id===sim).forEach(i=>{const g=(T('sim_gabaritos').find(x=>x.item_id===i.id)||{}).gabarito,x=T('sim_respostas').find(y=>y.item_id===i.id&&y.aluno_id===al);const d=i.disciplina||'Geral';disc[d]=disc[d]||{total:0,certas:0,erradas:0,brancas:0,anuladas:0};disc[d].total++;t++
  let st=i.anulada?'anuladas':(!x||!x.resposta)?'brancas':(x.resposta===g?'certas':'erradas');disc[d][st]++;if(st==='certas')c++;if(st==='erradas')e++;if(st==='brancas')b++;if(st==='anuladas')an++})
 Object.assign(r,{certas:c,erradas:e,brancas:b,anuladas:an,total:t,nota:c+an-(s.penaliza?e:0),nota_max:t,por_disciplina:disc,finalizado_em:r.finalizado_em||now(),tempo_seg:r.tempo_seg||Math.round((Date.now()-new Date(r.iniciado_em))/1000)});save();return r}
R.sim_finalizar=function(a){const r=T('sim_resultados').find(x=>x.simulado_id===a.p_sim&&x.aluno_id===U());if(r.finalizado_em)return r;return corrigir(a.p_sim,U())}
R.sim_recalcular=function(a){const l=T('sim_resultados').filter(x=>x.simulado_id===a.p_sim&&x.finalizado_em);l.forEach(x=>corrigir(a.p_sim,x.aluno_id));return l.length}
R.sim_gabarito=function(a){return T('sim_gabaritos').filter(x=>x.simulado_id===a.p_sim).map(x=>({item_id:x.item_id,gabarito:x.gabarito}))}
R.sim_ranking=function(a){const l=T('sim_resultados').filter(x=>x.simulado_id===a.p_sim&&x.finalizado_em).sort((x,y)=>y.nota-x.nota||x.tempo_seg-y.tempo_seg);return l.map((x,i)=>({posicao:i+1,nome:((T('alunos').find(z=>z.id===x.aluno_id)||{}).nome||'Aluno').split(' ')[0],nota:x.nota,certas:x.certas,erradas:x.erradas,brancas:x.brancas,tempo_seg:x.tempo_seg,eu:x.aluno_id===U()}))}
R.sim_estat_itens=function(a){const fin=T('sim_resultados').filter(x=>x.simulado_id===a.p_sim&&x.finalizado_em).map(x=>x.aluno_id);return T('sim_itens').filter(i=>i.simulado_id===a.p_sim).map(i=>{const g=(T('sim_gabaritos').find(x=>x.item_id===i.id)||{}).gabarito;let n=0,ac=0,bl=0,tm=0,tn=0;const d={};fin.forEach(al=>{n++;const x=T('sim_respostas').find(y=>y.item_id===i.id&&y.aluno_id===al);if(!x||!x.resposta){bl++;return}d[x.resposta]=(d[x.resposta]||0)+1;if(x.resposta===g)ac++;if(x.tempo_seg){tm+=x.tempo_seg;tn++}});return {item_id:i.id,respostas:n,acertos:ac,brancas:bl,tempo_medio:tn?Math.round(tm/tn):0,dist:d}})}
})();
;(function(){
const R=window.RPC, db=()=>window._db(), T=t=>(db()[t]=db()[t]||[]), save=()=>localStorage.setItem('mockdb',JSON.stringify(db()))
try{const u=sessionStorage.getItem('uid');if(u){window.UID=u;window.EMAIL=sessionStorage.getItem('email')}}catch(e){}
window.AUTH={
 signUp(o){const us=T('auth_users');if(us.find(u=>u.email===o.email))return {data:{},error:{message:'User already registered'}};const id='u'+Math.random().toString(36).slice(2,8);us.push({id,email:o.email,senha:o.password});save();window.UID=id;window.EMAIL=o.email;sessionStorage.setItem('uid',id);sessionStorage.setItem('email',o.email);return {data:{user:{id},session:{}},error:null}},
 signIn(o){const u=T('auth_users').find(u=>u.email===o.email&&u.senha===o.password);if(!u)return {data:{},error:{message:'Invalid'}};window.UID=u.id;window.EMAIL=u.email;sessionStorage.setItem('uid',u.id);sessionStorage.setItem('email',u.email);return {data:{user:u,session:{}},error:null}}
}
function hoje(n){const d=new Date();d.setDate(d.getDate()+(n||0));return d.toISOString().slice(0,10)}
function liberar(uid,nome,email,tel,conc,dias){const al=T('alunos').find(a=>a.id===uid);let exp
 if(al){exp=hoje(Math.max(0,Math.round((new Date(al.data_expiracao||hoje())-new Date(hoje()))/864e5))+dias);al.data_expiracao=exp}
 else{exp=hoje(dias);T('alunos').push({id:uid,nome,email,concurso_id:conc,data_expiracao:exp,telefone:tel,criado_em:new Date().toISOString()})}
 T('pedidos_acesso').filter(p=>p.aluno_id===uid&&p.status==='pendente').forEach(p=>{p.status='aprovado'});save();return exp}
function meu(){const u=T('auth_users').find(u=>u.id===window.UID)||{email:window.EMAIL};const al=T('alunos').find(a=>a.id===window.UID);const ped=T('pedidos_acesso').find(p=>p.aluno_id===window.UID&&p.status==='pendente')
 const comp=T('compras').some(c=>c.email===u.email&&c.status==='aprovada'&&!c.aluno_id&&!(T('produtos_acesso').find(p=>p.produto_id===c.produto_id)||{}).ativo)
 return {status:al&&al.data_expiracao>=hoje()&&!ped?'ativo':ped?'pendente':comp?'configurando':al?'vencido':'novo',email:u.email,expira:al?al.data_expiracao:null}}
R.meu_acesso=()=>meu()
R.eh_admin=()=>!!window.ADMIN
R.ativar_acesso=function(a){const u=T('auth_users').find(u=>u.id===window.UID);let n=0
 T('compras').filter(c=>c.email===u.email&&c.status==='aprovada'&&!c.aluno_id).forEach(c=>{const p=T('produtos_acesso').find(p=>p.produto_id===c.produto_id);if(p&&p.ativo){c.expira_aplicada=liberar(u.id,a.p_nome,u.email,a.p_telefone,p.concurso_id,p.dias);c.aluno_id=u.id;n++}});save();return Object.assign(meu(),{liberadas:n})}
R.pedir_acesso=function(a){const u=T('auth_users').find(u=>u.id===window.UID);T('pedidos_acesso').push({id:'pd'+Math.random().toString(36).slice(2,7),aluno_id:u.id,email:u.email,nome:a.p_nome,telefone:a.p_telefone,concurso_id:a.p_concurso,forma_pagamento:a.p_forma,observacao:a.p_obs,status:'pendente',tipo:'novo',criado_em:new Date().toISOString()});save();return meu()}
R.aprovar_pedido=function(a){const p=T('pedidos_acesso').find(x=>x.id===a.p_pedido);const exp=liberar(p.aluno_id,p.nome,p.email,p.telefone,a.p_concurso,a.p_dias);p.status='aprovado';save();return exp}
R.reaplicar_produto=function(a){return 0}
})();
