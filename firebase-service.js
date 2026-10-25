import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, collection, query, where, onSnapshot, runTransaction, getDoc, setDoc, writeBatch, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { readLocalDrafts, writeLocalDraft, removeLocalDraft } from './draft-storage.js';
import { firebaseConfig } from './firebase-config.js';

const app=initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
export const cloud={user:null,profile:null,classId:'',classData:null,classes:[],students:[],ready:false,saveStatus:''};
const collections={consonants:'consonant_submissions',catapult:'paratext_submissions',raft:'raft_submissions',kwls:'kwls_submissions'};
let notify=()=>{},generation=0,classGeneration=0,authUnsubscribe=null,classListUnsubscribe=null,unsubscribers=[];
const pending=new Map();let saveTimer=null,saveChain=Promise.resolve(),signupName='';
const blankStudent=(id,name)=>({id,name,words:[],notes:{},raft:{role:'',audience:'',format:'',topic:'',body:''},kwls:{know:'',want:'',learned:'',still:''}});
const message=(type,extra={})=>notify({type,...extra});
export function friendlyError(error){
 const messages={'auth/popup-closed-by-user':'로그인 창이 닫혔어요. 다시 로그인해 주세요.','auth/popup-blocked':'팝업이 차단됐어요. 이 사이트의 팝업을 허용해 주세요.','auth/unauthorized-domain':'이 사이트 주소가 Firebase 로그인 허용 도메인에 등록되지 않았습니다.','auth/operation-not-allowed':'Firebase 콘솔에서 이 로그인 방식을 먼저 활성화해야 합니다.','auth/invalid-credential':'이메일 또는 비밀번호를 확인해 주세요.','auth/invalid-login-credentials':'이메일 또는 비밀번호를 확인해 주세요.','auth/email-already-in-use':'이미 가입한 이메일입니다. 로그인해 주세요.','auth/weak-password':'비밀번호는 6자 이상으로 입력해 주세요.','auth/invalid-email':'이메일 형식을 확인해 주세요.','auth/too-many-requests':'요청이 많습니다. 잠시 후 다시 시도해 주세요.','auth/network-request-failed':'네트워크 연결을 확인해 주세요.','permission-denied':'접근 권한이 없습니다. 로그인 계정과 Firestore 보안 규칙을 확인해 주세요.','unavailable':'서버에 연결되지 않습니다. 인터넷 연결을 확인해 주세요.'};
 return messages[error?.code] || (error?.safeMessage) || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
function safeError(text){const error=new Error(text);error.safeMessage=text;return error;}
function report(error){message('error',{text:friendlyError(error)});}
function clearClassListeners(){classGeneration++;unsubscribers.forEach(stop=>stop());unsubscribers=[];cloud.ready=false;cloud.students=[];cloud.classData=null;}
function clearAll(){generation++;clearClassListeners();classListUnsubscribe?.();classListUnsubscribe=null;clearTimeout(saveTimer);pending.clear();cloud.saveStatus='';cloud.classId='';cloud.classes=[];cloud.profile=null;}
function isTeacherIdentity(user,admin){return user.uid===admin.adminTeacherUid || (user.emailVerified && user.email?.toLowerCase()===admin.adminTeacherEmail?.toLowerCase());}
async function resolveProfile(user){
 const adminRef=doc(db,'system','admin'),userRef=doc(db,'users',user.uid),baseRef=doc(db,'classes','BOOK26');
 return runTransaction(db,async tx=>{
  const admin=await tx.get(adminRef),profile=await tx.get(userRef);
  const data=profile.exists()?profile.data():null;
  if(!admin.exists()){
   // Rules restrict bootstrap to the verified project-owner email; no public admin takeover.
   if(!user.emailVerified) throw safeError('최초 교사 등록은 이메일 인증이 필요합니다. Google 로그인 또는 이메일 인증 후 다시 로그인해 주세요.');
   const base=await tx.get(baseRef);
   if(base.exists()) throw safeError('기본 클래스가 이미 있습니다. 관리자 설정을 확인해 주세요.');
   const first={email:user.email||'',name:signupName||user.displayName||'선생님',role:'teacher',classId:''};
   tx.set(adminRef,{adminTeacherUid:user.uid,adminTeacherEmail:user.email.toLowerCase()});
   tx.set(userRef,first);tx.set(baseRef,{className:'우리 반 독서 클래스',classCode:'BOOK26',teacherUid:user.uid,activeActivity:'act-1'});return first;
  }
  const role=isTeacherIdentity(user,admin.data())?'teacher':'student';
  const next={email:user.email||'',name:data?.name||signupName||user.displayName||user.email?.split('@')[0]||'학생',role,classId:data?.classId||''};
  if(!data || data.role!==role || data.email!==next.email) tx.set(userRef,next);
  return next;
 });
}
export function startCloud(callback){
 notify=callback;
 authUnsubscribe?.();
 authUnsubscribe=onAuthStateChanged(auth,async user=>{
  clearAll();cloud.user=user;const epoch=generation;message('session');
  if(!user)return;
  try{
   const profile=await resolveProfile(user);if(epoch!==generation)return;cloud.profile=profile;message('profile');
   if(profile.role==='teacher'){
    classListUnsubscribe=onSnapshot(query(collection(db,'classes'),where('teacherUid','==',user.uid)),snapshot=>{
     if(epoch!==generation)return;
     cloud.classes=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.className.localeCompare(b.className,'ko'));
     message('classes');
     if(!cloud.classId && cloud.classes.length) selectClass(cloud.classes[0].id).catch(report);
    },report);
   }else if(profile.classId) await selectClass(profile.classId);
   else message('join-required');
  }catch(error){if(epoch===generation)report(error);}
 });
}
export async function googleLogin(){await signInWithPopup(auth,new GoogleAuthProvider());}
export async function emailLogin(email,password){await signInWithEmailAndPassword(auth,email.trim(),password);}
export async function emailSignup(name,email,password){
 signupName=name.trim();
 try{const result=await createUserWithEmailAndPassword(auth,email.trim(),password);await updateProfile(result.user,{displayName:signupName});await sendEmailVerification(result.user);message('notice',{text:'회원가입이 완료되었습니다. 받은 편지함의 이메일 인증 링크를 확인해 주세요.'});}
 finally{signupName='';}
}
function saveStatus(text){cloud.saveStatus=text;message('save');}
export function saveActivity(activity,data){
 if(!cloud.user || cloud.profile?.role!=='student' || !cloud.classId || !cloud.ready) return;
 if(!collections[activity])return;
 // 마지막 입력부터 1초를 세어, 타이핑마다 서버에 쓰지 않습니다.
 const path=`classes/${cloud.classId}/students/${cloud.user.uid}/drafts/${activity}`;
 pending.set(path,{path,activity,classId:cloud.classId,data:structuredClone(data),uid:cloud.user.uid,epoch:generation,revision:crypto.randomUUID()});
 saveStatus('임시 저장 대기 중…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>flushSaves().catch(report),1000);
}
const clockText=()=>new Date().toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
// 네트워크 응답을 기다리기 전에 기기에 복사본부터 남깁니다.
function persistLocal(){
 let ok=true;
 for(const item of pending.values()){
  if(item.epoch!==generation || item.uid!==cloud.user?.uid)continue;
  try{if(item.localRevision!==item.revision){item.local=writeLocalDraft(localStorage,item.uid,item.classId,item.activity,item.data);item.localRevision=item.revision;}}
  catch{ok=false;saveStatus('기기 저장 실패 · 저장 공간이나 브라우저 설정을 확인해 주세요.');}
 }
 return ok;
}
async function flushSaves(){
 clearTimeout(saveTimer);
 const localOK=persistLocal();
 if(!navigator.onLine){if(localOK)saveStatus(`기기에 자동 저장됨 (${clockText()}) · 오프라인`);return;}
 const epoch=generation;
 const job=async()=>{
  if(epoch!==generation)return;
  if(!pending.size)return;
  saveStatus(navigator.onLine?'저장 중…':'오프라인 · 연결되면 다시 저장합니다.');
  for(const [path,item] of [...pending]){
   if(item.uid!==cloud.user?.uid || item.epoch!==generation){pending.delete(path);continue;}
   try{
    await setDoc(doc(db,path),{...item.data,updatedAt:serverTimestamp()});
    if(epoch!==generation)return;
    if(pending.get(path)?.revision===item.revision)pending.delete(path);
   }catch(error){if(epoch!==generation)return;saveStatus('저장 실패 · 작성 내용은 현재 화면에 남아 있습니다.');throw error;}
  }
  saveStatus(pending.size?'임시 저장 대기 중…':`자동 저장됨 (${clockText()}) · ${localOK?'기기·서버':'서버만'}`);
 };
 saveChain=saveChain.catch(()=>{}).then(job);return saveChain;
}
export async function retrySaves(){await flushSaves();}
// 다른 계정의 임시 글은 읽지 않으며, 복구 여부는 학생이 직접 선택합니다.
export function recoverDrafts(){
 if(cloud.profile?.role!=='student' || !cloud.ready)return;
 let drafts;try{drafts=readLocalDrafts(localStorage,cloud.user.uid,cloud.classId);}catch{saveStatus('기기 임시 저장소를 읽을 수 없습니다.');return;}
 if(!drafts.length)return;
 if(!window.confirm('이전에 작성 중이던 임시 저장 글이 있습니다. 복구하시겠습니까?')){
  for(const d of drafts){pending.delete(`classes/${d.classId}/students/${d.uid}/drafts/${d.activity}`);try{removeLocalDraft(localStorage,d.uid,d.classId,d.activity,d.revision);}catch{}}
  return;
 }
 message('restore',{drafts});
 for(const d of drafts)saveActivity(d.activity,d.data);
}
// 최종 제출 원본과 기존 교사 대시보드용 문서를 한 번에 저장합니다.
export async function submitActivity(activity,data){
 if(!cloud.ready || cloud.profile?.role!=='student' || !collections[activity])throw safeError('학생 계정과 학급을 확인해 주세요.');
 if(!navigator.onLine)throw safeError('오프라인에서는 임시 저장만 가능합니다. 연결 후 최종 제출해 주세요.');
 const uid=cloud.user.uid,cid=cloud.classId,epoch=generation;
 saveActivity(activity,data);persistLocal();
 const path=`classes/${cid}/students/${uid}/drafts/${activity}`,item=pending.get(path);
 const payload={...structuredClone(data),studentName:cloud.profile.name,updatedAt:serverTimestamp()};
 const batch=writeBatch(db);
 batch.set(doc(db,'students',uid,'activities',activity),{classId:cid,data:payload});
 batch.set(doc(db,'classes',cid,collections[activity],uid),payload);
 await batch.commit();
 if(epoch!==generation)return;
 if(pending.get(path)?.revision===item.revision)pending.delete(path);
 try{removeLocalDraft(localStorage,uid,cid,activity,item.local?.revision);}catch{}
 message('submitted',{activity});saveStatus(`최종 제출됨 (${clockText()})${pending.size?' · 추가 작성 내용은 임시 저장 중':''}`);
}
export async function logoutCloud(){
 if(pending.size && !persistLocal())throw safeError('기기에 저장하지 못했습니다. 내용을 복사한 뒤 다시 로그아웃해 주세요.');
 await signOut(auth);
}
window.addEventListener('online',()=>{
 persistLocal();
 // 오프라인 상태에서 앱을 처음 열어 계정 조회가 실패했을 때도 다시 연결합니다.
 if(cloud.user && (!cloud.profile || !cloud.ready)){startCloud(notify);return;}
 recoverDrafts();
});
window.addEventListener('offline',()=>{persistLocal();saveStatus('오프라인 · 기기에 임시 저장합니다.');});
window.addEventListener('pagehide',persistLocal);
window.addEventListener('beforeunload',event=>{if(pending.size && !persistLocal()){event.preventDefault();event.returnValue='';}});
export async function createClass(name){
 if(cloud.profile?.role!=='teacher')throw safeError('교사만 클래스를 만들 수 있습니다.');
 name=name.trim();if(!name || name.length>80)throw safeError('학급 이름을 1~80자로 입력해 주세요.');
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 for(let attempt=0;attempt<12;attempt++){
  const bytes=crypto.getRandomValues(new Uint8Array(6));const code=[...bytes].map(n=>alphabet[n%alphabet.length]).join('');
  const ref=doc(db,'classes',code);
  const made=await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())return false;tx.set(ref,{className:name,classCode:code,teacherUid:cloud.user.uid,activeActivity:'act-1'});return true;});
  if(made){await selectClass(code);return code;}
 }
 throw safeError('코드 생성이 지연되고 있어요. 다시 시도해 주세요.');
}
export async function joinClass(raw){
 if(!cloud.user || cloud.profile?.role!=='student')throw safeError('학생 계정으로 로그인해 주세요.');
 const code=raw.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))throw safeError('영문과 숫자로 된 6자리 코드를 입력해 주세요.');
 const classRef=doc(db,'classes',code),userRef=doc(db,'users',cloud.user.uid),memberRef=doc(db,'classes',code,'students',cloud.user.uid);
 const uid=cloud.user.uid,epoch=generation;
 await runTransaction(db,async tx=>{
  const found=await tx.get(classRef),user=await tx.get(userRef),member=await tx.get(memberRef);
  if(!found.exists() || found.data().classCode!==code)throw safeError('해당 코드를 찾지 못했어요. 선생님이 알려 준 코드를 확인해 주세요.');
  if(user.data().classId && user.data().classId!==code)throw safeError('이미 다른 클래스에 소속되어 있습니다. 선생님에게 문의해 주세요.');
  if(!member.exists())tx.set(memberRef,{studentName:user.data().name,email:user.data().email,joinedAt:serverTimestamp()});
  tx.update(userRef,{classId:code});
 });
 if(epoch!==generation || uid!==cloud.user?.uid)return;
 cloud.profile.classId=code;await selectClass(code);
}
export async function setActiveActivity(activity){
 if(cloud.profile?.role!=='teacher' || !cloud.classId)return;
 if(!['act-1','act-2','act-3','act-4'].includes(activity))return;
 await updateDoc(doc(db,'classes',cloud.classId),{activeActivity:activity});
}
export async function selectClass(id){
 if(!cloud.profile)return;
 if(cloud.profile.role==='student' && cloud.profile.classId!==id)throw safeError('소속된 클래스만 열 수 있습니다.');
 clearClassListeners();cloud.classId=id;const epoch=generation,scope=classGeneration;message('loading');
 const teacher=cloud.profile.role==='teacher',uid=cloud.user.uid;
 const members=new Map(),submissions=Object.fromEntries(Object.keys(collections).map(k=>[k,new Map()])),loaded=new Set();
 const current=()=>epoch===generation && scope===classGeneration;
 function assemble(){
  if(!current())return;
  if(loaded.size<6)return;
  cloud.students=[...members].map(([id,member])=>{
   const student=blankStudent(id,member.studentName);
   const c=submissions.consonants.get(id),p=submissions.catapult.get(id),r=submissions.raft.get(id),k=submissions.kwls.get(id);
   student.words=Object.values(c?.board||{}).flat().filter(w=>typeof w==='string');student.notes=p?.cards||{};
   if(r)student.raft={role:r.role||'',audience:r.audience||'',format:r.format||'',topic:r.topic||'',body:r.content||''};
   if(k)student.kwls={...student.kwls,...k.cards};return student;
  }).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id));
  cloud.ready=true;message('data');
 }
 function failed(error){if(!current())return;cloud.ready=false;message('loading');report(error);}
 unsubscribers.push(onSnapshot(doc(db,'classes',id),snapshot=>{
  if(!current())return;
  if(!snapshot.exists()){failed(safeError('클래스를 찾지 못했습니다.'));return;}
  cloud.classData={id,...snapshot.data()};loaded.add('class');message('class');assemble();
 },failed));
 const membersRef=teacher?collection(db,'classes',id,'students'):doc(db,'classes',id,'students',uid);
 unsubscribers.push(onSnapshot(membersRef,snapshot=>{
  if(!current())return;members.clear();
  if(teacher)snapshot.docs.forEach(d=>members.set(d.id,d.data()));else if(snapshot.exists())members.set(uid,snapshot.data());
  loaded.add('members');assemble();
 },failed));
 for(const [activity,path] of Object.entries(collections)){
  const ref=teacher?collection(db,'classes',id,path):doc(db,'classes',id,path,uid);
  unsubscribers.push(onSnapshot(ref,snapshot=>{
   if(!current())return;
   submissions[activity].clear();
   if(teacher)snapshot.docs.forEach(d=>submissions[activity].set(d.id,d.data()));else if(snapshot.exists())submissions[activity].set(uid,snapshot.data());
   loaded.add(activity);assemble();
  },failed));
 }
}
