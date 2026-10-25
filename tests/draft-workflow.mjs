// 실제 Firebase에 접속하지 않고 시간·네트워크·저장소를 바꿔 실패 상황까지 재현합니다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readLocalDrafts, draftKey} from '../draft-storage.js';
const values=new Map(),listeners={},events=[],writes=[],batches=[],timers=new Map();
let timerId=0,online=true,confirmResult=true,failWrites=false,failStorage=false,failSubmit=false,holdCommit=false,releaseCommit;
globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(failStorage)throw Error('quota');values.set(k,v);},removeItem:k=>values.delete(k)};
globalThis.window={addEventListener:(name,fn)=>listeners[name]=fn,confirm:()=>confirmResult};
Object.defineProperty(globalThis,'navigator',{value:{get onLine(){return online;}},configurable:true});
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};
globalThis.clearTimeout=id=>timers.delete(id);
globalThis.firebaseMocks={initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),onAuthStateChanged:()=>()=>{},
 doc:(_db,...parts)=>parts.join('/'),serverTimestamp:()=>'<server-time>',
 setDoc:async(path,data)=>{if(failWrites)throw Error('network');writes.push({path,data});},
 writeBatch:()=>{const items=[];return {set:(path,data)=>items.push({path,data}),commit:async()=>{if(failSubmit)throw Error('rejected');if(holdCommit)await new Promise(resolve=>releaseCommit=resolve);batches.push(items);}}},signOut:async()=>{}};
let source=await fs.readFile(new URL('../firebase-service.js',import.meta.url),'utf8');
source=source.replace(/import \{([^}]+)\} from 'https:[^']+';/g,(_,names)=>`const {${names}}=globalThis.firebaseMocks;`)
 .replace("from './draft-storage.js'",`from '${new URL('../draft-storage.js',import.meta.url).href}'`)
 .replace("import { firebaseConfig } from './firebase-config.js';","const firebaseConfig={};");
const service=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
service.startCloud(e=>events.push(e));
Object.assign(service.cloud,{user:{uid:'student-a'},profile:{role:'student',name:'검사 학생'},classId:'BOOK26',ready:true});
const raft=content=>({studentName:'검사 학생',role:'기술자',audience:'친구',format:'편지',topic:'미래',content});
async function tick(){const jobs=[...timers.values()];timers.clear();for(const job of jobs)await job.fn();}
let checks=0;function check(label,fn){fn();checks++;console.log('PASS '+label);}
service.saveActivity('raft',raft('첫 입력'));service.saveActivity('raft',raft('마지막 입력'));
check('타이핑 중 쓰지 않고 1000ms 타이머 하나만 유지',()=>{assert.equal(values.size,0);assert.equal(writes.length,0);assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,1000);});
await tick();
check('마지막 입력을 기기와 drafts에 저장',()=>{assert.equal(writes.length,1);assert.match(writes[0].path,/students\/student-a\/drafts\/raft$/);assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26')[0].data.content,'마지막 입력');assert.match(service.cloud.saveStatus,/자동 저장됨 \(\d\d:\d\d:\d\d\)/);assert.equal(batches.length,0);});
check('다른 학생과 학급의 로컬 글 격리',()=>{assert.equal(readLocalDrafts(localStorage,'student-b','BOOK26').length,0);assert.equal(readLocalDrafts(localStorage,'student-a','OTHERS').length,0);});
online=false;service.saveActivity('raft',raft('오프라인 글'));await tick();
check('오프라인에서는 기기에만 저장',()=>{assert.equal(writes.length,1);assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26')[0].data.content,'오프라인 글');});
await assert.rejects(()=>service.submitActivity('raft',raft('오프라인 제출')));checks++;
online=true;listeners.online();
check('재연결 복구 승인 시 복구 이벤트',()=>assert.equal(events.findLast(e=>e.type==='restore').drafts[0].data.content,'오프라인 글'));
await tick();
check('복구한 글을 서버 임시 문서에 다시 저장',()=>assert.equal(writes.at(-1).data.content,'오프라인 글'));
failWrites=true;service.saveActivity('raft',raft('서버 실패에도 남을 글'));await tick();failWrites=false;
check('서버 실패 시 로컬 글 유지',()=>assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26')[0].data.content,'서버 실패에도 남을 글'));
await service.retrySaves();
failSubmit=true;await assert.rejects(()=>service.submitActivity('raft',raft('제출 실패')));failSubmit=false;
check('최종 제출 실패 시 임시 글 보존',()=>assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26')[0].data.content,'제출 실패'));
await service.submitActivity('raft',raft('최종 글'));
check('최종 제출 원본과 교사용 문서 일괄 저장',()=>{assert.equal(batches.length,1);assert.deepEqual(batches[0].map(d=>d.path),['students/student-a/activities/raft','classes/BOOK26/raft_submissions/student-a']);assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26').length,0);});
service.saveActivity('raft',raft('복구 안 할 글'));await tick();confirmResult=false;service.recoverDrafts();
check('복구 거절 시 이전 글 자동 재저장 안 함',()=>assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26').length,0));
service.saveActivity('raft',raft('닫기 직전'));listeners.pagehide();
check('1초 전 창을 닫아도 기기 저장',()=>assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26')[0].data.content,'닫기 직전'));
failStorage=true;service.saveActivity('raft',raft('용량 부족'));let warned=false;listeners.beforeunload({preventDefault:()=>warned=true});
check('저장소 실패 시 창 닫기 경고',()=>assert.equal(warned,true));failStorage=false;
values.set(draftKey('student-a','BOOK26','kwls'),JSON.stringify({uid:'student-a',classId:'BOOK26',activity:'kwls',revision:'bad',data:{studentName:'검사 학생',cards:{know:123}}}));
check('손상된 복구 글 무시',()=>assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26').some(d=>d.activity==='kwls'),false));
holdCommit=true;
const submission=service.submitActivity('raft',raft('전송 중인 본문'));
service.saveActivity('raft',raft('전송 중 새로 입력한 본문'));listeners.pagehide();
releaseCommit();await submission;holdCommit=false;
check('제출 응답이 늦어도 그 사이 새로 쓴 임시 글 보존',()=>assert.equal(readLocalDrafts(localStorage,'student-a','BOOK26')[0].data.content,'전송 중 새로 입력한 본문'));
console.log(`PASS ${checks} draft workflow checks`);
