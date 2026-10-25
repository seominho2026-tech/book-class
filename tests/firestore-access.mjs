// Run against the local demo-book-class emulator only. No production API calls.
import assert from 'node:assert/strict';
const project=process.env.TEST_PROJECT || 'demo-book-class';
assert.match(project,/^demo-book-class(?:-[a-z0-9-]+)?$/);
const root=`http://127.0.0.1:8085/v1/projects/${project}/databases/(default)/documents`;
const prefix=`projects/${project}/databases/(default)/documents/`;
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(uid,email=uid+'@example.invalid',verified=false){return b64({alg:'none',typ:'JWT'})+'.'+b64({sub:uid,user_id:uid,email,email_verified:verified,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,aud:project,iss:'https://securetoken.google.com/'+project,firebase:{sign_in_provider:'password'}})+'.';}
const teacher=token('teacher','seominho2026@gmail.com',true),a=token('student-a'),b=token('student-b'),outsider=token('outsider');
const value=v=>typeof v==='string'?{stringValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(value)}}:{mapValue:{fields:fields(v)}};
const fields=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,value(v)]));
const write=(path,data,time,create=false)=>({update:{name:prefix+path,fields:fields(data)},...(time?{updateTransforms:[{fieldPath:time,setToServerValue:'REQUEST_TIME'}]}:{}),...(create?{currentDocument:{exists:false}}:{})});
async function call(method,path,auth,body){const response=await fetch(root+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});let data=await response.json();return {status:response.status,data};}
let checks=0;
async function check(label,promise,allow=true){const r=await promise;assert.equal(r.status,allow?200:403,`${label}: HTTP ${r.status} ${r.data.error?.message||''}`);checks++;console.log('PASS '+label);return r.data;}
const commit=(auth,writes)=>call('POST',':commit',auth,{writes});
const user=(name,role='student',classId='')=>({email:name+'@example.invalid',name,role,classId});
const classroom={className:'Test class',classCode:'BOOK26',teacherUid:'teacher',activeActivity:'act-1'};
await check('unauthenticated admin read denied',call('GET','/system/admin'),false);
await check('unverified administrator claim denied',commit(a,[write('system/admin',{adminTeacherUid:'student-a',adminTeacherEmail:'student-a@example.invalid'})]),false).catch(e=>{throw e});

await check('atomic teacher bootstrap',commit(teacher,[write('system/admin',{adminTeacherUid:'teacher',adminTeacherEmail:'seominho2026@gmail.com'},null,true),write('users/teacher',{email:'seominho2026@gmail.com',name:'Teacher',role:'teacher',classId:''},null,true),write('classes/BOOK26',classroom,null,true)]));
await check('administrator cannot be replaced',commit(a,[write('system/admin',{adminTeacherUid:'student-a',adminTeacherEmail:'student-a@example.invalid'})]),false);
await check('student profile creation',commit(a,[write('users/student-a',user('student-a'),null,true)]));
await check('second student profile creation',commit(b,[write('users/student-b',user('student-b'),null,true)]));
await check('outsider profile creation',commit(outsider,[write('users/outsider',user('outsider'),null,true)]));
await check('self teacher escalation denied',commit(a,[write('users/student-a',user('student-a','teacher'))]),false);
await check('profile read isolation',call('GET','/users/student-a',b),false);
await check('exact invitation lookup',call('GET','/classes/BOOK26',a));
await check('class enumeration denied',call('GET','/classes',a),false);
await check('student cannot create class',commit(a,[write('classes/ABCDEF',{...classroom,classCode:'ABCDEF',teacherUid:'student-a'})]),false);
await check('join requires matching membership',commit(a,[write('users/student-a',user('student-a','student','BOOK26'))]),false);
for(const [uid,t] of [['student-a',a],['student-b',b]])await check(uid+' atomic class join',commit(t,[write('classes/BOOK26/students/'+uid,{studentName:uid,email:uid+'@example.invalid'},'joinedAt',true),write('users/'+uid,user(uid,'student','BOOK26'))]));
await check('roster enumeration denied to students',call('GET','/classes/BOOK26/students',a),false);
await check('roster visible to class teacher',call('GET','/classes/BOOK26/students',teacher));
const common={studentName:'student-a'};
const submissions={
 consonant_submissions:{...common,board:Object.fromEntries([...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'].map(k=>[k,k==='ㄱ'?['기술']:[]]))},
 paratext_submissions:{...common,cards:Object.fromEntries(['covers','author','title','audience','page','underlying','reference','visuals'].map(k=>[k,'탐색 기록']))},
 raft_submissions:{...common,role:'AI 기술자',audience:'어린이들',format:'편지글',topic:'미래',content:'안녕하세요.\n함께 생각해요.'},
 kwls_submissions:{...common,cards:{know:'알던 것',want:'질문',learned:'배운 것',still:'새로운 질문'}}
};
for(const [collection,data] of Object.entries(submissions)){
 const path=`classes/BOOK26/${collection}/student-a`;
 await check(collection+' own write',commit(a,[write(path,data,'updatedAt')]));
 await check(collection+' own read',call('GET','/'+path,a));
 await check(collection+' teacher read',call('GET','/'+path,teacher));
 await check(collection+' unauth read denied',call('GET','/'+path),false);
 await check(collection+' peer read denied',call('GET','/'+path,b),false);
 await check(collection+' peer write denied',commit(b,[write(path,{...data,studentName:'student-b'},'updatedAt')]),false);
 await check(collection+' outsider denied',call('GET','/'+path,outsider),false);
 await check(collection+' schema pollution denied',commit(a,[write(path,{...data,extra:'oops'},'updatedAt')]),false);
}
await check('oversized update denied',commit(a,[write('classes/BOOK26/raft_submissions/student-a',{...submissions.raft_submissions,content:'x'.repeat(20001)},'updatedAt')]),false);
await check('name spoof denied',commit(a,[write('classes/BOOK26/raft_submissions/student-a',{...submissions.raft_submissions,studentName:'student-b'},'updatedAt')]),false);
await check('missing fields denied',commit(a,[write('classes/BOOK26/raft_submissions/student-a',{studentName:'student-a',content:'incomplete'},'updatedAt')]),false);
await check('teacher active activity update',commit(teacher,[write('classes/BOOK26',{...classroom,activeActivity:'act-4'})]));
await check('student active activity update denied',commit(a,[write('classes/BOOK26',{...classroom,activeActivity:'act-2'})]),false);
await check('second class creation',commit(teacher,[write('classes/ZXCVBN',{...classroom,classCode:'ZXCVBN'},null,true)]));
await check('cross-class own submission denied',commit(a,[write('classes/ZXCVBN/raft_submissions/student-a',submissions.raft_submissions,'updatedAt')]),false);
await check('cannot replace class owner',commit(teacher,[write('classes/BOOK26',{...classroom,teacherUid:'student-a'})]),false);

for(const [activity,collection] of Object.entries({consonants:'consonant_submissions',catapult:'paratext_submissions',raft:'raft_submissions',kwls:'kwls_submissions'})){
 const data=submissions[collection],draft='classes/BOOK26/students/student-a/drafts/'+activity,final='students/student-a/activities/'+activity;
 await check(activity+' draft own write',commit(a,[write(draft,data,'updatedAt')]));
 await check(activity+' draft own read',call('GET','/'+draft,a));
 await check(activity+' draft teacher read denied',call('GET','/'+draft,teacher),false);
 await check(activity+' draft peer read denied',call('GET','/'+draft,b),false);
 await check(activity+' draft peer write denied',commit(b,[write(draft,data,'updatedAt')]),false);
 await check(activity+' draft schema denied',commit(a,[write(draft,{...data,extra:1},'updatedAt')]),false);
 await check(activity+' final atomic mirror',commit(a,[write(final,{classId:'BOOK26',data},'data.updatedAt'),write('classes/BOOK26/'+collection+'/student-a',data,'updatedAt')]));
 await check(activity+' final teacher read',call('GET','/'+final,teacher));
 await check(activity+' final peer read denied',call('GET','/'+final,b),false);
 await check(activity+' final anonymous read denied',call('GET','/'+final),false);
 await check(activity+' final wrong class denied',commit(a,[write(final,{classId:'ZXCVBN',data},'data.updatedAt')]),false);
}

// 살펴보기 코드는 운영 학급 권한을 부여하지 않는지 검사합니다.
const visitor=token('visitor','visitor@example.invalid',true),unverified=token('unverified');
const hash='a'.repeat(64),wrongHash='b'.repeat(64);
await check('preview visitor profile',commit(visitor,[write('users/visitor',user('visitor'))]));
await check('preview unverified profile',commit(unverified,[write('users/unverified',user('unverified'))]));
await check('preview invite owner creates atomically',commit(teacher,[write('previewInvites/'+hash,{createdBy:'teacher'}),write('system/previewInvitation',{code:'ABCDEFGHJKLM',hash})]));
await check('preview invite anonymous denied',call('GET','/previewInvites/'+hash),false);
await check('preview invite unverified denied',call('GET','/previewInvites/'+hash,unverified),false);
await check('preview invitation plaintext private',call('GET','/system/previewInvitation',visitor),false);
await check('preview invitations cannot enumerate',call('GET','/previewInvites',visitor),false);
await check('preview invite verified lookup',call('GET','/previewInvites/'+hash,visitor));
await check('preview visitor cannot mint invite',commit(visitor,[write('previewInvites/'+wrongHash,{createdBy:'visitor'})]),false);
await check('preview wrong code denied',commit(visitor,[write('previewAccess/visitor',{inviteHash:wrongHash})]),false);
await check('preview unverified redemption denied',commit(unverified,[write('previewAccess/unverified',{inviteHash:hash})]),false);
await check('preview cannot redeem for another user',commit(visitor,[write('previewAccess/outsider',{inviteHash:hash})]),false);
await check('preview joined student denied',commit(token('student-a','student-a@example.invalid',true),[write('previewAccess/student-a',{inviteHash:hash})]),false);
await check('preview valid redemption',commit(visitor,[write('previewAccess/visitor',{inviteHash:hash})]));
await check('preview own access persisted',call('GET','/previewAccess/visitor',visitor));
await check('preview access peer denied',call('GET','/previewAccess/visitor',b),false);
await check('preview cannot become teacher',commit(visitor,[write('users/visitor',user('visitor','teacher'))]),false);
await check('preview cannot create real class',commit(visitor,[write('classes/PRVIEW',{...classroom,classCode:'PRVIEW',teacherUid:'visitor'})]),false);
await check('preview cannot join real class',commit(visitor,[write('classes/BOOK26/students/visitor',{studentName:'visitor',email:'visitor@example.invalid'},'joinedAt'),write('users/visitor',user('visitor','student','BOOK26'))]),false);
await check('preview cannot read roster',call('GET','/classes/BOOK26/students',visitor),false);
for(const collection of Object.keys(submissions))await check('preview cannot read '+collection,call('GET','/classes/BOOK26/'+collection+'/student-a',visitor),false);
await check('preview cannot write real submission',commit(visitor,[write('classes/BOOK26/raft_submissions/visitor',{...submissions.raft_submissions,studentName:'visitor'},'updatedAt')]),false);
console.log('PASS '+checks+' access-control checks');

