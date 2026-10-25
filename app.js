import { cloud, startCloud, googleLogin, emailLogin, emailSignup, logoutCloud, joinClass, createClass, selectClass, setActiveActivity, saveActivity, retrySaves, recoverDrafts, submitActivity, getTeacherInvite, redeemTeacherInvite, startOwnerPreview, leavePreview } from "./firebase-service.js";
"use strict";
console.log("book-class 앱이 준비되었습니다");
const LETTERS = [..."ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ"];
const INITIALS = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const DOUBLE = {"ㄲ":"ㄱ","ㄸ":"ㄷ","ㅃ":"ㅂ","ㅆ":"ㅅ","ㅉ":"ㅈ"};
function initialOf(word) {
  const code = word.normalize("NFC").codePointAt(0);
  if (code < 0xAC00 || code > 0xD7A3 || !Number.isFinite(code)) return null;
  const initial = INITIALS[Math.floor((code - 0xAC00) / 588)];
  return DOUBLE[initial] || initial;
}
const students = [];
let activeView = "cloud";
let selectedStudent = "";
const $ = selector => document.querySelector(selector);
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(text, handler, className) {
  const el = element("button", className, text);
  el.type = "button";
  el.addEventListener("click", handler);
  return el;
}
function persist() { saveCurrentActivity("consonants"); }
function addWord(raw, expected) {
  const word = raw.trim().normalize("NFC");
  const initial = initialOf(word);
  if (!word) return "낱말을 먼저 입력해 주세요.";
  if (word.length > 20) return "낱말은 20자 이내로 입력해 주세요.";
  if (!initial || !/^[가-힣]+$/u.test(word)) return "띄어쓰기나 기호 없이 한글 낱말 하나를 입력해 주세요.";
  if (expected && initial !== expected) return `‘${word}’은 ${initial} 칸에 들어가요. ${expected}으로 시작하는 낱말을 입력해 주세요.`;
  if (students[0].words.includes(word)) return "이미 채운 낱말이에요. 다른 낱말을 생각해 보세요.";
  if (students[0].words.length >= 200) return "200개를 모두 채웠어요. 기존 낱말을 지우면 더 추가할 수 있어요.";
  students[0].words.push(word);
  persist(); renderBoard();
  $("#status").textContent = `‘${word}’을 ${initial} 칸에 채웠어요.`;
  return null;
}
function renderBoard() {
  const board = $("#consonant-board"); board.replaceChildren();
  LETTERS.forEach(letter => {
    const card = element("section", "letter-card");
    const head = element("div", "card-head");
    head.append(element("h3", "", letter));
    const add = button("+ 추가", () => openAdd(letter), "add-button");
    add.setAttribute("aria-label", `${letter} 칸에 단어 추가`); head.append(add); card.append(head);
    const words = students[0].words.filter(w => initialOf(w) === letter);
    const chips = element("div", "chips");
    words.forEach(word => {
      const chip = element("span", "chip"); chip.append(element("span", "", word));
      const remove = button("×", () => {
        students[0].words = students[0].words.filter(w => w !== word); persist(); renderBoard();
        $("#status").textContent = `‘${word}’을 지웠어요.`;
        [...$("#consonant-board").querySelectorAll(".add-button")][LETTERS.indexOf(letter)].focus();
      });
      remove.setAttribute("aria-label", `${word} 삭제`); chip.append(remove); chips.append(chip);
    });
    if (!words.length) chips.append(element("p", "empty", "어떤 낱말이 떠오르나요?"));
    card.append(chips); board.append(card);
  });
  const book = element("section", "book-card");
  const icon = element("i", "fa-solid fa-book-open"); icon.setAttribute("aria-hidden", "true");
  book.append(icon, element("span", "", "함께 읽는 가상 도서"), element("h3", "", "AI와 함께 살아갈 미래"), element("p", "", "인공지능과 우리의 내일은 어떤 모습일까요?"));
  board.append(book);
  const filled = new Set(students[0].words.map(initialOf)).size;
  $("#progress").textContent = `${filled} / 14 닿소리 · ${students[0].words.length}개 낱말`;
}
const dialog = $("#word-dialog");
function openDialog(title) {
  $("#dialog-title").textContent = title; $("#dialog-body").replaceChildren();
  if (!dialog.open) dialog.showModal();
}
function openAdd(letter) {
  openDialog(`${letter} · 단어 채우기`);
  const form = element("form", "dialog-form");
  const label = element("label", "", `${letter}으로 시작하는 낱말`); label.htmlFor = "card-word";
  const input = element("input"); input.id = "card-word"; input.maxLength = 20; input.required = true; input.autocomplete = "off";
  const error = element("p", "dialog-error"); error.id = "dialog-error"; error.setAttribute("role", "status"); input.setAttribute("aria-describedby", error.id);
  const submit = element("button", "primary", "+ 단어 채우기"); submit.type = "submit";
  form.append(label,input,error,submit);
  form.addEventListener("submit", event => {event.preventDefault(); const message = addWord(input.value,letter); if (message) {error.textContent = message; input.focus();} else dialog.close();});
  $("#dialog-body").append(form); input.focus();
}
$("#close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {if (event.target === dialog) {const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();}});
$("#word-form").addEventListener("submit", event => {event.preventDefault(); const input = $("#word-input"); const error = addWord(input.value); if (error) $("#status").textContent = error; else input.value = ""; input.focus();});
function frequencies() {
  const map = new Map();
  students.forEach(student => student.words.forEach(word => map.set(word,(map.get(word) || 0) + 1)));
  return [...map].map(([word,count]) => ({word,count})).sort((a,b) => b.count-a.count || a.word.localeCompare(b.word,"ko"));
}
function showWord(word) {
  const letter = initialOf(word); openDialog(`${letter} · ${word}`);
  const body = $("#dialog-body");
  const owners = students.filter(s => s.words.includes(word));
  body.append(element("p", "", `${owners.length}명이 이 낱말을 떠올렸어요.`), element("p", "hint", owners.map(s => `${s.name} 학생`).join(" · ")));
  body.append(element("h3", "", `${letter} 칸의 다른 낱말`));
  const related = frequencies().filter(entry => initialOf(entry.word) === letter);
  related.forEach(entry => {const row = element("div", "word-detail"); row.append(element("strong", "", entry.word),element("span", "", `${entry.count}명`)); body.append(row);});
}
function changeMode(teacher) {
  if (!cloud.profile || !cloud.classId || !students.length) return;
  teacher = cloud.profile.role === "preview" ? previewTeacher : cloud.profile.role === "teacher";
  teacherMode = teacher;
  $("#student-view").hidden = teacher || activeActivity !== "consonants"; $("#teacher-view").hidden = !teacher || activeActivity !== "consonants";
  $("#catapult-view").hidden = activeActivity !== "catapult";
  $("#raft-view").hidden = activeActivity !== "raft";
  $("#kwls-view").hidden = activeActivity !== "kwls";

  if (activeActivity === "catapult") renderCatapult();
  else if (activeActivity === "raft") renderRaft();
  else if (activeActivity === "kwls") renderKwls();
  else if (teacher) renderTeacher();
}
const tabs = [...document.querySelectorAll("[data-view]")];
function selectTab(tab) {activeView = tab.dataset.view; tabs.forEach(t => {t.setAttribute("aria-selected", String(t === tab)); t.tabIndex = t === tab ? 0 : -1;}); $("#teacher-panel").setAttribute("aria-labelledby",tab.id); renderTeacher();}
tabs.forEach((tab,index) => {tab.addEventListener("click", () => selectTab(tab)); tab.addEventListener("keydown", event => {let next; if(event.key === "ArrowRight") next=(index+1)%3; if(event.key === "ArrowLeft") next=(index+2)%3; if(event.key === "Home") next=0; if(event.key === "End") next=2; if(next !== undefined){event.preventDefault(); tabs[next].focus(); selectTab(tabs[next]);}});});
function renderTeacher() {
  const content = $("#teacher-content"); content.replaceChildren();
  const entries = frequencies();
  $("#class-summary").textContent = `${students.length}명 · ${students.reduce((sum,s) => sum+s.words.length,0)}개 낱말 · 서로 다른 낱말 ${entries.length}개`;
  if (activeView === "cloud") {
    const wrap = element("div", "cloud-wrap"); const heading = element("div", "cloud-heading");
    heading.append(element("h3", "", "우리가 그리는, 인공지능의 미래"),element("p", "", "크게 보이는 낱말일수록 더 많은 친구가 떠올렸어요."));
    const cloud = element("div", "cloud"); cloud.id = "word-cloud"; cloud.setAttribute("aria-label", "낱말 구름: 낱말을 누르면 등록한 학생과 같은 자음의 낱말을 볼 수 있습니다");
    wrap.append(heading,cloud,element("p", "cloud-note", "낱말을 눌러 친구들의 생각을 자세히 살펴보세요.")); content.append(wrap);
    const top = element("ol", "top-list"); entries.slice(0,5).forEach((e,i) => top.append(element("li", "", `${i+1}. ${e.word} · ${e.count}명`))); content.append(top);
    scheduleCloud();
  } else {
    if (activeView === "individual") {
      const picker = element("div", "student-picker"); const label = element("label", "", "학생 선택"); label.htmlFor = "student-select";
      const select = element("select"); select.id = "student-select";
      students.forEach(s => {const option = element("option", "", `${s.name} 학생 · ${s.words.length}개`); option.value = s.id; select.append(option);}); select.value = selectedStudent;
      select.addEventListener("change", () => {selectedStudent=select.value; renderTeacher(); $("#student-select").focus();}); picker.append(label,select); content.append(picker);
    }
    const grid = element("div", "results");
    LETTERS.forEach(letter => {
      const people = activeView === "individual" ? students.filter(s => s.id === selectedStudent) : students;
      const rows = people.flatMap(s => s.words.filter(w => initialOf(w) === letter).map(word => ({word,name:s.name})));
      const card = element("section", "result-card"); card.append(element("h3", "", `${letter} · ${rows.length}개`));
      rows.forEach(row => {const line = element("div", "word-detail"); line.append(element("strong", "", row.word),element("span", "", row.name)); card.append(line);});
      if (!rows.length) card.append(element("p", "empty", "아직 채운 낱말이 없어요.")); grid.append(card);
    }); content.append(grid);
  }
}
let cloudFrame;
function scheduleCloud() {cancelAnimationFrame(cloudFrame); cloudFrame=requestAnimationFrame(drawCloud);}
// r = a + bθ: 중앙에서 바깥으로 탐색하고 실제 버튼 사각형의 충돌을 검사합니다.
function drawCloud() {
  const cloud = $("#word-cloud"); if (!cloud || $("#teacher-view").hidden) return;
  cloud.replaceChildren(); const entries = frequencies();
  if (!entries.length) {cloud.append(element("p", "empty", "낱말을 채우면 구름이 나타나요.")); return;}
  const width = cloud.clientWidth; if (!width) return;
  let height = width < 600 ? 430 : 480;
  const colors = ["#355c48","#a05d32","#57755c","#78638c","#376d79"];
  const nodes = entries.map((entry,index) => {
    const node = button(entry.word, () => showWord(entry.word), `cloud-word${index < 5 ? " top-word" : ""}`);
    node.style.color = colors[index%colors.length]; node.setAttribute("aria-label", `${entry.word}, ${entry.count}명, ${initialOf(entry.word)} 칸 자세히 보기`); cloud.append(node); return node;
  });
  // 공간이 부족하면 축소하고, 그래도 부족하면 캔버스 높이를 늘려 모두 표시합니다.
  let complete = false;
  for (let attempt=0; attempt<16 && !complete; attempt++) {
    cloud.style.height = `${height}px`; const placed=[]; complete=true;
    for (let index=0; index<nodes.length; index++) {
      const node=nodes[index]; const ratio=entries[index].count/entries[0].count;
      const base=width<600 ? 14+ratio*23 : 16+ratio*38;
      node.style.fontSize=`${Math.max(12,base*Math.pow(.94,Math.min(attempt,5)))}px`;
      if (node.offsetWidth > width-16) node.style.fontSize=`${Math.max(8,parseFloat(node.style.fontSize)*(width-16)/node.offsetWidth)}px`;
      const w=node.offsetWidth,h=node.offsetHeight; let found=false;
      const limit=Math.hypot(width,height)/2;
      for(let theta=0;theta*3.5<limit;theta+=.13) {
        const radius=3.5*theta; const x=width/2+radius*Math.cos(theta)-w/2; const y=height/2+radius*Math.sin(theta)-h/2;
        if(x<8 || y<8 || x+w>width-8 || y+h>height-8) continue;
        if(placed.some(p => x<p.x+p.w+5 && x+w+5>p.x && y<p.y+p.h+5 && y+h+5>p.y)) continue;
        node.style.left=`${x}px`;node.style.top=`${y}px`;placed.push({x,y,w,h});found=true;break;
      }
      if(!found){complete=false;break;}
    }
    if (!complete && attempt>=4) height+=180;
  }
  // 극단적으로 많은 낱말에서도 누락이나 겹침 대신 읽을 수 있는 줄바꿈을 제공합니다.
  if(!complete){cloud.style.display="flex";cloud.style.flexWrap="wrap";cloud.style.alignContent="center";cloud.style.justifyContent="center";cloud.style.gap="12px";cloud.style.height="auto";cloud.style.padding="32px 16px";nodes.forEach(n => {n.style.position="static";});}
  else {cloud.style.display="block";cloud.style.padding="0";}
}
let resizeTimer;
window.addEventListener("resize", () => {clearTimeout(resizeTimer); resizeTimer=setTimeout(scheduleCloud,120);});
if (document.fonts) document.fonts.ready.then(scheduleCloud);

/* CATAPULT: 반복되는 A / T도 각각 고유한 키로 저장합니다. */
const CATAPULT = [
  {key:"covers",letter:"C",title:"표지",english:"Covers",question:"표지의 그림과 색을 보고 어떤 내용일지 상상해 보세요."},
  {key:"author",letter:"A",title:"지은이",english:"Author",question:"작가 소개나 작가의 다른 책을 찾아보고 알게 된 점을 적어 보세요."},
  {key:"title",letter:"T",title:"제목",english:"Title",question:"제목을 보고 어떤 이야기가 펼쳐질지 예상해 보세요."},
  {key:"audience",letter:"A",title:"독자",english:"Audience",question:"이 책을 누구에게 추천하고 싶나요? 그 이유도 적어 보세요."},
  {key:"page",letter:"P",title:"목차",english:"Page",question:"마음에 드는 소제목을 고르고 어떤 내용일지 예상해 보세요."},
  {key:"underlying",letter:"U",title:"머리말",english:"Underlying message",question:"머리말에서 저자가 책을 쓴 이유와 전하려는 주제를 찾아보세요."},
  {key:"reference",letter:"L",title:"참고문헌",english:"Look at reference",question:"참고문헌을 살펴보고 이 책의 내용과 어떤 관련이 있는지 적어 보세요."},
  {key:"visuals",letter:"T",title:"시각자료",english:"Time/Place/Visuals",question:"그림, 지도, 사진을 훑어보며 시대와 장소, 눈에 띄는 정보를 적어 보세요."}
];
let activeActivity = "consonants";
let teacherMode = false;
function completedNotes(student) {return CATAPULT.filter(({key}) => (student.notes[key] || "").trim().length > 0).length;}
function persistNotes() { saveCurrentActivity("catapult"); }
function updateSaveStatus() { $("#catapult-save-status").textContent = cloud.profile?.role==='preview' ? "가상 예시 · 입력 내용은 저장되지 않습니다." : teacherMode ? "학생이 저장한 탐색 노트입니다." : "입력을 마치면 자동으로 저장합니다."; }
function updateCatapultProgress(student) {
  const text=`${completedNotes(student)} / 8칸 작성 완료`;
  if ($("#catapult-progress").textContent !== text) $("#catapult-progress").textContent=text;
}
function renderCatapult() {
  const student = teacherMode ? students.find(s => s.id === selectedStudent) || students[0] : students[0];
  $("#catapult-student-picker").hidden=!teacherMode;
  const select=$("#catapult-select"); select.replaceChildren();
  students.forEach(s => {const option=element("option","",`${s.name}`); option.value=s.id; select.append(option);});
  select.value=selectedStudent;
  $("#catapult-student-name").textContent=`${student.name} 학생`;
  $("#catapult-help").textContent=teacherMode ? "CATAPULT 탐색 노트 · 선택한 학생의 기록입니다." : "질문을 따라 책의 바깥과 안을 살펴보세요. 글을 입력하면 작성 완료로 표시돼요. 책에 없는 요소는 ‘없음’과 그 이유를 적어도 좋아요.";
  updateCatapultProgress(student); updateSaveStatus();
  const grid=$("#catapult-cards"); grid.replaceChildren();
  CATAPULT.forEach((item,index) => {
    const value=student.notes[item.key] || "";
    const card=element("article",`catapult-card tone-${index%4}`); card.classList.toggle("is-complete",Boolean(value.trim()));
    const head=element("div","catapult-card-head"); const identity=element("div","catapult-identity");
    const badge=element("span","alphabet-badge",item.letter); badge.setAttribute("aria-hidden","true");
    const heading=element("h3","",`${index+1}. ${item.title}`); identity.append(badge,heading);
    const state=element("span","writing-state",value.trim() ? "작성 완료" : "작성 중");
    head.append(identity,state); card.append(head,element("p","catapult-english",`${item.letter} · ${item.english}`));
    const question=element("p","catapult-question",item.question); question.id=`question-${item.key}`; card.append(question);
    if (teacherMode) {
      const note=element("p",value.trim() ? "exploration-note" : "empty-note",value.trim() ? value : "✏️ 아직 작성된 텍스트가 없습니다"); card.append(note);
    } else {
      const input=element("textarea"); input.id=`note-${item.key}`; input.value=value; input.maxLength=2000; input.rows=6;
      input.setAttribute("aria-label",`${item.title} 탐색 노트`); input.setAttribute("aria-describedby",question.id); input.placeholder="나의 생각을 자유롭게 적어 보세요.";
      const count=element("span","note-length",`${value.length} / 2,000자`);
      input.addEventListener("input",() => {
        student.notes[item.key]=input.value;
        const complete=Boolean(input.value.trim()); state.textContent=complete ? "작성 완료" : "작성 중"; card.classList.toggle("is-complete",complete);
        count.textContent=`${input.value.length} / 2,000자`; updateCatapultProgress(student); persistNotes();
      }); card.append(input,count);
    }
    grid.append(card);
  });
}
$("#catapult-select").addEventListener("change", event => {selectedStudent=event.target.value; renderCatapult(); $("#catapult-select").focus();});
document.querySelectorAll("[data-activity]").forEach(tab => tab.addEventListener("click", () => {
  if (!cloud.profile || !cloud.classId) return;
  activeActivity=tab.dataset.activity;
  if (cloud.profile.role === "teacher") setActiveActivity(activityToId[activeActivity]).catch(showCloudError);
  document.querySelectorAll("[data-activity]").forEach(t => t.setAttribute("aria-pressed",String(t===tab)));
  const activityCopy = {
    consonants:["1. 닿소리 채우기","책에서 만난 생각을, 열네 개의 닿소리에 담아 보세요."],
    catapult:["2. 곁텍스트 읽기","책을 펼치기 전, 여덟 가지 단서로 이야기에 가까이 다가가요."],
    raft:["3. RAFT 전략 글쓰기","새로운 역할과 목소리로, 책에서 시작된 생각을 글로 펼쳐 보세요."],
    kwls:["4. KWLS 성찰하기","알고 있던 것에서 더 알고 싶은 것으로, 독서가 넓혀 준 생각을 만나 보세요."]
  };
  $("#activity-title").textContent=activityCopy[activeActivity][0];
  $("#activity-description").textContent=activityCopy[activeActivity][1];
  changeMode(teacherMode);
}));


// RAFT 조건과 본문은 곁텍스트 노트와 별도의 키로 보관합니다.
const RAFT_FIELDS = [
  {key:"role",letter:"R",title:"역할",english:"Role",hint:"글쓴이는 누구인가요?",placeholder:"예: 책 속 주인공, 미래의 과학자"},
  {key:"audience",letter:"A",title:"청중",english:"Audience",hint:"누구에게 들려주고 싶은 이야기인가요?",placeholder:"예: 후배들, 시민들, 작가님"},
  {key:"format",letter:"F",title:"형식",english:"Format",hint:"어떤 형식으로 생각을 전할까요?",placeholder:"추천 형식을 고르거나 직접 입력하세요"},
  {key:"topic",letter:"T",title:"주제",english:"Topic",hint:"글에서 전하고 싶은 핵심은 무엇인가요?",placeholder:"예: 사람과 인공지능이 함께 살아가는 방법"}
];
const RAFT_FORMATS = ["편지글","신문 기사","연설문","건의문"];
function raftSentence(draft) {
  return `나는 ${draft.role.trim() || "[역할]"}이 되어, ${draft.audience.trim() || "[청중]"}에게, ${draft.format.trim() || "[형식]"} 방식으로, ${draft.topic.trim() || "[주제]"}에 대해 씁니다.`;
}
function raftCharacterCount(text) {return Array.from(text).length;}
function updateRaftStatus() { $("#raft-save-status").textContent = cloud.profile?.role==='preview' ? "가상 예시 · 입력 내용은 저장되지 않습니다." : teacherMode ? "학생이 작성한 작품입니다." : "입력을 마치면 자동으로 저장합니다."; }
function persistRaft() { saveCurrentActivity("raft"); }
function updateRaftSentence(draft) {$("#raft-sentence").textContent=raftSentence(draft);}
function updateFormatChips(draft) {
  document.querySelectorAll("[data-raft-format]").forEach(chip=>chip.setAttribute("aria-pressed",String(chip.dataset.raftFormat===draft.format.trim())));
}
function renderRaft() {
  const student=teacherMode ? students.find(s=>s.id===selectedStudent) || students[0] : students[0];
  const draft=student.raft;
  $("#raft-student-picker").hidden=!teacherMode;
  const select=$("#raft-select");select.replaceChildren();
  students.forEach(s=>{const option=element("option","",`${s.name}`);option.value=s.id;select.append(option);});select.value=selectedStudent;
  $("#raft-student-name").textContent=`${student.name} 학생`;
  updateRaftSentence(draft);updateRaftStatus();
  const grid=$("#raft-conditions");grid.replaceChildren();
  RAFT_FIELDS.forEach(field=>{
    const card=element("section",`raft-condition raft-${field.key}`);
    const head=element("div","raft-condition-heading");
    const badge=element("span","raft-letter",field.letter);badge.setAttribute("aria-hidden","true");
    const title=element("h3","",`${field.title} · ${field.english}`);head.append(badge,title);card.append(head);
    if(teacherMode) card.append(element("p",draft[field.key].trim()?"raft-value":"empty",draft[field.key].trim() || "아직 설정하지 않았어요."));
    else {
      const label=element("label","raft-label",field.hint);label.htmlFor=`raft-${field.key}`;
      const input=element("input");input.id=`raft-${field.key}`;input.value=draft[field.key];input.maxLength=150;input.placeholder=field.placeholder;input.autocomplete="off";
      input.addEventListener("input",()=>{draft[field.key]=input.value;updateRaftSentence(draft);if(field.key==="format")updateFormatChips(draft);persistRaft();});
      card.append(label,input);
      if(field.key==="format"){
        const chips=element("div","raft-format-chips");chips.setAttribute("aria-label","추천 글 형식");
        RAFT_FORMATS.forEach(format=>{
          const chip=button(format,()=>{draft.format=format;input.value=format;updateRaftSentence(draft);updateFormatChips(draft);persistRaft();},"raft-format-chip");
          chip.dataset.raftFormat=format;chip.setAttribute("aria-pressed",String(draft.format.trim()===format));chips.append(chip);
        });card.append(chips);
      }
    }
    grid.append(card);
  });
  const writing=$("#raft-writing");writing.replaceChildren();
  const paper=element("section","raft-paper");
  const heading=element("div","raft-paper-heading");heading.append(element("h3","",teacherMode?"생각을 담은 글":"나의 글쓰기"));
  const counter=element("span","raft-counter",`${raftCharacterCount(draft.body)}자 작성`);counter.id="raft-character-count";heading.append(counter);paper.append(heading);
  if(teacherMode) paper.append(element("p",draft.body.trim()?"raft-prose":"empty",draft.body.trim()?draft.body:"✏️ 아직 작성된 글이 없습니다."));
  else {
    const label=element("label","raft-body-label","위에서 정한 역할과 청중을 떠올리며 글을 써 보세요.");label.htmlFor="raft-body";
    const input=element("textarea");input.id="raft-body";input.value=draft.body;input.maxLength=20000;input.rows=16;input.placeholder="첫 문장부터 천천히, 나의 목소리로 이야기를 시작해 보세요.";input.setAttribute("aria-describedby","raft-count-help raft-character-count");
    input.addEventListener("input",()=>{draft.body=input.value;counter.textContent=`${raftCharacterCount(input.value)}자 작성`;persistRaft();});
    paper.append(label,input,element("p","hint","공백과 줄바꿈을 포함해 글자 수를 셉니다. 최대 20,000자까지 입력할 수 있어요."));paper.children[paper.children.length-1].id="raft-count-help";
  }
  writing.append(paper);
}
$("#raft-select").addEventListener("change",event=>{selectedStudent=event.target.value;renderRaft();$("#raft-select").focus();});

// KWLS: 공백만 있는 칸은 미작성, 네 칸 모두 내용이 있으면 완료입니다.
const KWLS_FIELDS = [
  {key:"know",letter:"K",title:"이미 알고 있는 것",english:"Know",phase:"읽기 전",question:"이 주제에 대해 이미 알고 있던 내용을 적어 보세요."},
  {key:"want",letter:"W",title:"알기를 원하는 것",english:"Want to know",phase:"읽기 전 · 읽는 중",question:"책을 읽으며 새로 알고 싶었던 내용은 무엇인가요?"},
  {key:"learned",letter:"L",title:"알게 된 것",english:"Learned",phase:"읽은 후",question:"책을 다 읽고 새롭게 알게 된 사실이나 깨달음을 적어 보세요."},
  {key:"still",letter:"S",title:"더 알고 싶은 것",english:"Still want to know",phase:"읽은 후 · 다음 탐구",question:"책을 읽은 후에도 더 탐구하고 싶은 질문은 무엇인가요?"}
];
function kwlsStats(notes) {
  return {completed:KWLS_FIELDS.filter(({key})=>notes[key].trim()).length,characters:KWLS_FIELDS.reduce((sum,{key})=>sum+Array.from(notes[key]).length,0)};
}
function kwlsClassStats() {
  const counts=students.map(student=>kwlsStats(student.kwls).completed);
  return {started:counts.filter(count=>count>0).length,completed:counts.filter(count=>count===4).length};
}
function updateKwlsSummary(student) {
  const stats=kwlsStats(student.kwls);
  const summary=`${stats.completed} / 4칸 작성 완료 · 총 ${stats.characters}자`;
  if($("#kwls-progress").textContent!==summary) $("#kwls-progress").textContent=summary;
  const group=kwlsClassStats();
  $("#kwls-class-stats").textContent=`우리 반 ${students.length}명 · 활동 시작 ${group.started}명 · 작성 완료 ${group.completed}명`;
}
function updateKwlsSaveStatus() { $("#kwls-save-status").textContent = cloud.profile?.role==='preview' ? "가상 예시 · 입력 내용은 저장되지 않습니다." : teacherMode ? "1칸 이상은 활동 시작, 4칸 모두 작성하면 완료입니다." : "공백·줄바꿈을 포함한 글자 수입니다. 입력을 마치면 자동 저장합니다."; }
function persistKwls() { saveCurrentActivity("kwls"); }
function renderKwls() {
  const student=teacherMode ? students.find(s=>s.id===selectedStudent) || students[0] : students[0];
  $("#kwls-student-picker").hidden=!teacherMode;$("#kwls-class-stats").hidden=!teacherMode;
  const select=$("#kwls-select");select.replaceChildren();
  students.forEach(s=>{const option=element("option","",`${s.name}`);option.value=s.id;select.append(option);});select.value=selectedStudent;
  $("#kwls-student-name").textContent=`${student.name} 학생`;
  updateKwlsSummary(student);updateKwlsSaveStatus();
  const grid=$("#kwls-cards");grid.replaceChildren();
  KWLS_FIELDS.forEach(field=>{
    const value=student.kwls[field.key];
    const card=element("article",`kwls-card kwls-${field.key}`);
    const header=element("div","kwls-card-heading");
    const badge=element("span","kwls-letter",field.letter);badge.setAttribute("aria-hidden","true");
    const state=element("span","kwls-state",value.trim()?"작성 완료":"작성 중");header.append(badge,state);
    card.append(header,element("h3","",field.title),element("p","kwls-english",`${field.letter} · ${field.english}`),element("p","kwls-phase",field.phase));
    const question=element("p","kwls-question",field.question);question.id=`kwls-question-${field.key}`;card.append(question);
    const count=element("p","note-length",`${Array.from(value).length}자 작성`);
    if(teacherMode) card.append(element("p",value.trim()?"kwls-note":"kwls-note empty",value.trim()?value:"아직 쓰지 않았어요"));
    else {
      const input=element("textarea");input.id=`kwls-${field.key}`;input.value=value;input.rows=9;input.maxLength=3000;input.placeholder="나의 생각을 적어 보세요.";input.setAttribute("aria-label",`${field.letter} · ${field.title}`);input.setAttribute("aria-describedby",question.id);
      input.addEventListener("input",()=>{student.kwls[field.key]=input.value;state.textContent=input.value.trim()?"작성 완료":"작성 중";count.textContent=`${Array.from(input.value).length}자 작성`;updateKwlsSummary(student);persistKwls();});
      card.append(input);
    }
    card.append(count);grid.append(card);
  });
}
$("#kwls-select").addEventListener("change",event=>{selectedStudent=event.target.value;renderKwls();$("#kwls-select").focus();});

// 실제 계정/학급과 기존 워크시트를 연결하는 화면 계층입니다.
const activityToId={consonants:'act-1',catapult:'act-2',raft:'act-3',kwls:'act-4'};
const idToActivity=Object.fromEntries(Object.entries(activityToId).map(([key,value])=>[value,key]));
let hydrated=false,signupMode=false,previewTeacher=true;
const dirtyActivities=new Set();
function showCloudError(error){
 const messages={'permission-denied':'접근 권한이 없습니다. 학급과 보안 규칙을 확인해 주세요.','auth/invalid-credential':'이메일 또는 비밀번호를 확인해 주세요.','auth/invalid-login-credentials':'이메일 또는 비밀번호를 확인해 주세요.','auth/email-already-in-use':'이미 가입한 이메일입니다. 로그인해 주세요.','auth/weak-password':'비밀번호는 6자 이상으로 입력해 주세요.','auth/popup-blocked':'팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.','auth/popup-closed-by-user':'로그인 창이 닫혔습니다. 다시 시도해 주세요.','auth/unauthorized-domain':'Firebase 인증의 허용 도메인에 이 사이트를 등록해 주세요.','auth/operation-not-allowed':'Firebase 콘솔에서 해당 로그인 방식을 활성화해 주세요.','auth/too-many-requests':'요청이 많습니다. 잠시 후 다시 시도해 주세요.'};
 const text=typeof error==='string'?error:error?.safeMessage||messages[error?.code]||'처리하지 못했습니다. 인터넷 연결과 설정을 확인해 주세요.';
 $('#cloud-error').textContent=text;return text;
}
function activityPayload(activity){
 if(cloud.profile?.role!=='student' || !students[0])return;
 const student=students[0],name={studentName:cloud.profile.name};let payload;
 if(activity==='consonants')payload={...name,board:Object.fromEntries(LETTERS.map(letter=>[letter,student.words.filter(w=>initialOf(w)===letter)]))};
 if(activity==='catapult')payload={...name,cards:Object.fromEntries(CATAPULT.map(({key})=>[key,student.notes[key]||'']))};
 if(activity==='raft')payload={...name,role:student.raft.role,audience:student.raft.audience,format:student.raft.format,topic:student.raft.topic,content:student.raft.body};
 if(activity==='kwls')payload={...name,cards:{...student.kwls}};
 return payload;
}
function saveCurrentActivity(activity){
 if(cloud.profile?.role==='preview')return; // 체험 입력은 서버와 기기 저장소에 기록하지 않습니다.
 const payload=activityPayload(activity);if(!payload)return;
 dirtyActivities.add(activity);saveActivity(activity,payload);
}
function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function clearSessionScreen(){
 // Remove records from the DOM as well as hiding them on shared classroom devices.
 ['consonant-board','teacher-content','catapult-cards','raft-conditions','raft-writing','kwls-cards','dialog-body','class-select','catapult-select','raft-select','kwls-select'].forEach(id=>$('#'+id).replaceChildren());
 ['student-board-name','progress','status','class-summary','catapult-student-name','catapult-progress','raft-student-name','raft-sentence','kwls-student-name','kwls-progress','kwls-class-stats','class-name','class-code','dialog-title'].forEach(id=>$('#'+id).textContent='');
 document.querySelectorAll('form').forEach(form=>form.reset());
 document.querySelectorAll('.error-banner').forEach(banner=>banner.textContent='');
 $('#session-label').textContent='실시간 독서 교실';$('#teacher-invite').textContent='';teacherMode=false;activeActivity='consonants';updateActivityHeading();
}
function hideActivities(){['student-view','teacher-view','catapult-view','raft-view','kwls-view'].forEach(id=>$('#'+id).hidden=true);}
function renderSessionHeader(){
 const logged=Boolean(cloud.user);
 $('#preview-open').hidden=cloud.profile?.role==='teacher'||cloud.profile?.role==='preview';
 $('#invite-manage').hidden=cloud.profile?.role!=='teacher';$('#owner-preview').hidden=cloud.profile?.role!=='teacher';
 $('#preview-bar').hidden=cloud.profile?.role!=='preview';
 $('#login-open').classList.toggle('hidden',logged);$('#user-profile').classList.toggle('hidden',!logged);
 $('#profile-name').textContent=logged?(cloud.profile?.name||cloud.user?.displayName||'계정 확인 중'):'';
 $('#profile-role').textContent=!logged?'':cloud.profile?.role==='teacher'?'교사':cloud.profile?.role==='preview'?'교사 살펴보기':cloud.profile?'학생':'확인 중';
 let fallback=$('#profile-initial');
 if(!fallback){fallback=element('span','profile-initial');fallback.id='profile-initial';fallback.setAttribute('aria-hidden','true');$('#user-profile').prepend(fallback);}
 fallback.textContent=logged?Array.from($('#profile-name').textContent)[0]:'';fallback.hidden=!logged;
 const photo=$('#profile-photo');photo.hidden=true;photo.removeAttribute('src');
 photo.onerror=()=>{photo.hidden=true;fallback.hidden=!cloud.user;};
 if(cloud.user?.photoURL?.startsWith('https://')){photo.src=cloud.user.photoURL;photo.referrerPolicy='no-referrer';photo.hidden=false;fallback.hidden=true;}
}
function renderClassBar(){
 if(cloud.profile?.role==='preview'){$('#class-bar').hidden=true;return;}
 const teacher=cloud.profile?.role==='teacher';$('#class-bar').hidden=!cloud.profile;
 $('#class-select').hidden=!teacher;$('#class-bar label').hidden=!teacher;
 $('#new-class-open').hidden=!teacher;$('#copy-code').hidden=!teacher;$('#class-code').hidden=!teacher;
 const select=$('#class-select');select.replaceChildren();
 cloud.classes.forEach(c=>{const option=element('option','',c.className);option.value=c.id;select.append(option);});select.value=cloud.classId;
 $('#class-name').textContent=cloud.classData?.className||'클래스 연결 중';$('#class-code').textContent=cloud.classData?.classCode||'';
}
function updateActivityHeading(){
 const titles={consonants:['1. 닿소리 채우기','책에서 만난 생각을, 열네 개의 닿소리에 담아 보세요.'],catapult:['2. 곁텍스트 읽기','책을 펼치기 전, 여덟 가지 단서로 이야기에 가까이 다가가요.'],raft:['3. RAFT 전략 글쓰기','새로운 역할과 목소리로, 책에서 시작된 생각을 글로 펼쳐 보세요.'],kwls:['4. KWLS 성찰하기','독서가 넓혀 준 생각을 만나 보세요.']};
 $('#activity-title').textContent=titles[activeActivity][0];$('#activity-description').textContent=titles[activeActivity][1];
 document.querySelectorAll('[data-activity]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.activity===activeActivity)));
}
function paintActivities(){
 if(!cloud.ready)return;
 if(cloud.profile?.role==='preview'){paintPreview();return;}
 $('#welcome-panel').hidden=true;$('#activity-workspace').hidden=false;hideActivities();
 $('#empty-class').hidden=students.length>0 || cloud.profile.role!=='teacher';
 updateActivityHeading();
 $('#submit-activity').hidden=cloud.profile.role!=='student';
 $('#draft-help').textContent=cloud.profile.role==='student'?'입력을 멈추면 1초 후 임시 저장됩니다. 교사에게 보내려면 현재 활동을 제출하세요.':'학생이 최종 제출한 내용만 실시간으로 표시됩니다. 임시 작성 글은 학생만 볼 수 있습니다.';
 if(!students.length)return;
 if(!students.some(s=>s.id===selectedStudent))selectedStudent=students[0].id;
 if(cloud.profile.role==='student'){$('#student-board-name').textContent=`${cloud.profile.name} 학생의 닿소리 판`;renderBoard();}
 changeMode(cloud.profile.role==='teacher');
}
function onCloudEvent(event){
 if(event.type==='preview'){closeDialogs();clearSessionScreen();students.splice(0,students.length,...previewSamples());selectedStudent=students[0].id;previewTeacher=true;renderSessionHeader();renderClassBar();paintPreview();return;}
 // 복구는 제출 데이터를 덮어쓰지 않고 현재 학생의 작성 화면에만 적용합니다.
 if(event.type==='restore'){
  const s=students[0];if(!s)return;
  for(const {activity,data} of event.drafts){
   if(activity==='consonants')s.words=Object.values(data.board||{}).flat().filter(v=>typeof v==='string');
   if(activity==='catapult')s.notes={...s.notes,...data.cards};
   if(activity==='raft')s.raft={role:data.role||'',audience:data.audience||'',format:data.format||'',topic:data.topic||'',body:data.content||''};
   if(activity==='kwls')s.kwls={...s.kwls,...data.cards};
   dirtyActivities.add(activity);
  }
  paintActivities();return;
 }
 if(event.type==='submitted'){return;}
 if(event.type==='error'){showCloudError(event.text);return;}
 if(event.type==='notice'){$('#welcome-message').textContent=event.text;$('#cloud-save-status').textContent=event.text;return;}
 if(event.type==='session'){
  hydrated=false;dirtyActivities.clear();students.splice(0);selectedStudent='';closeDialogs();clearSessionScreen();hideActivities();
  $('#activity-workspace').hidden=true;$('#class-bar').hidden=true;$('#empty-class').hidden=true;$('#welcome-panel').hidden=false;$('#join-open').hidden=true;
  $('#welcome-login').hidden=Boolean(cloud.user);$('#welcome-message').textContent=cloud.user?'계정을 확인하고 있습니다…':'로그인하면 독서 활동을 저장하고 이어갈 수 있어요.';
  $('#cloud-error').textContent='';$('#cloud-save-status').textContent='';$('#retry-save').hidden=true;renderSessionHeader();return;
 }
 if(event.type==='profile'){closeDialogs();renderSessionHeader();renderClassBar();return;}
 if(event.type==='classes'){renderClassBar();return;}
 if(event.type==='join-required'){$('#welcome-message').textContent='선생님이 알려 준 클래스 코드로 입장해 주세요.';$('#join-open').hidden=false;$('#join-dialog').showModal();return;}
 if(event.type==='loading'){hydrated=false;students.splice(0);hideActivities();$('#activity-workspace').hidden=true;$('#empty-class').hidden=true;$('#welcome-panel').hidden=false;$('#welcome-message').textContent='학급 활동을 불러오고 있습니다…';return;}
 if(event.type==='class'){
  renderClassBar();
  const next=idToActivity[cloud.classData?.activeActivity];
  if(next && next!==activeActivity){activeActivity=next;paintActivities();}
  return;
 }
 if(event.type==='save'){
  $('#cloud-save-status').textContent=cloud.saveStatus;$('#retry-save').hidden=!cloud.saveStatus.includes('실패');
  return; // 임시 글은 교사에게 보이는 최종 제출과 다르므로 작성 상태를 유지합니다.
 }
 if(event.type==='data'){
  const firstLoad=!hydrated;
  const editing=document.activeElement?.matches('textarea, #word-input, .raft-condition input');
  if(!hydrated || teacherMode || (!editing && !dirtyActivities.size)){
   students.splice(0,students.length,...cloud.students.map(s=>structuredClone(s)));hydrated=true;teacherMode=cloud.profile.role==='teacher';paintActivities();
  }
  if(firstLoad && cloud.profile.role==='student')recoverDrafts();
 }
}
async function withForm(form,errorId,action){
 const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$(errorId).textContent='';
 try{await action();}catch(error){$(errorId).textContent=showCloudError(error);}finally{buttons.forEach(b=>b.disabled=false);}
}
$('#login-open').addEventListener('click',()=>$('#login-dialog').showModal());
$('#welcome-login').addEventListener('click',()=>$('#login-dialog').showModal());
$('#join-open').addEventListener('click',()=>$('#join-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
$('#toggle-signup').addEventListener('click',()=>{signupMode=!signupMode;$('#signup-name').hidden=!signupMode;$('#signup-name').required=signupMode;$('#signup-name-label').hidden=!signupMode;$('#email-submit').textContent=signupMode?'회원가입':'로그인';$('#toggle-signup').textContent=signupMode?'이미 가입했다면 로그인':'처음이라면 회원가입';$('#login-password').autocomplete=signupMode?'new-password':'current-password';});
$('#email-form').addEventListener('submit',event=>{event.preventDefault();withForm(event.currentTarget,'#login-error',async()=>{const email=$('#login-email').value,password=$('#login-password').value;try{if(signupMode)await emailSignup($('#signup-name').value,email,password);else await emailLogin(email,password);}finally{$('#login-password').value='';}});});
$('#google-login').addEventListener('click',async()=>{const b=$('#google-login');b.disabled=true;try{await googleLogin();}catch(error){$('#login-error').textContent=showCloudError(error);}finally{b.disabled=false;}});
$('#logout-button').addEventListener('click',async()=>{const b=$('#logout-button');b.disabled=true;try{await logoutCloud();}catch(error){showCloudError(error);}finally{b.disabled=false;}});
// 현재 열려 있는 활동만 제출합니다. 다른 활동의 임시 글은 그대로 남깁니다.
$('#submit-activity').addEventListener('click',async()=>{
 const button=$('#submit-activity');button.disabled=true;
 try{await submitActivity(activeActivity,activityPayload(activeActivity));}
 catch(error){showCloudError(error);}finally{button.disabled=false;}
});
$('#join-code').addEventListener('input',event=>{event.target.value=event.target.value.trim().toUpperCase();});
$('#join-form').addEventListener('submit',event=>{event.preventDefault();withForm(event.currentTarget,'#join-error',async()=>{await joinClass($('#join-code').value);$('#join-dialog').close();});});
$('#new-class-open').addEventListener('click',()=>{if(cloud.profile?.role==='teacher')$('#new-class-dialog').showModal();});
$('#new-class-form').addEventListener('submit',event=>{event.preventDefault();withForm(event.currentTarget,'#new-class-error',async()=>{await createClass($('#new-class-name').value);$('#new-class-dialog').close();$('#new-class-name').value='';});});
$('#class-select').addEventListener('change',event=>selectClass(event.target.value).catch(showCloudError));
$('#copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(cloud.classData.classCode);$('#copy-code').textContent='복사 완료!';setTimeout(()=>$('#copy-code').textContent='코드 복사',1800);}catch{$('#cloud-error').textContent='복사 권한이 없습니다. 표시된 코드를 선택해 복사해 주세요.';}});
$('#retry-save').addEventListener('click',()=>retrySaves().catch(showCloudError));

// 모든 예시는 가상의 학생 자료입니다. 실제 명부와 제출물을 조회하지 않습니다.
function previewSamples(){
 return ['가상 학생 가람','가상 학생 나래','가상 학생 다온'].map((name,i)=>({id:'preview-'+i,name,words:i===0?['인공지능','기술','로봇','미래','협력']:i===1?['인공지능','미래','생각']:['기술','미래','책'],notes:{covers:'표지의 로봇과 아이가 친구가 되는 이야기일 것 같다.',author:'과학 이야기를 쉽게 설명하는 작가의 다른 책도 찾아보고 싶다.',title:'AI와 사람이 함께 사는 미래를 예상해 보았다.',audience:'인공지능이 궁금한 친구에게 추천하고 싶다.',page:'로봇과 함께하는 하루라는 소제목이 궁금하다.',underlying:'기술을 책임 있게 사용하는 태도를 알려 주려는 것 같다.',reference:'과학 자료가 이야기의 근거를 보태 준다.',visuals:'사람과 로봇이 함께 일하는 그림이 눈에 띈다.'},raft:{role:'AI 기술자',audience:'미래의 어린이들',format:'편지글',topic:'사람을 돕는 인공지능',body:'미래의 어린이들에게,\n\n인공지능은 우리를 돕는 도구입니다. 편리함만큼 서로를 배려하는 마음도 중요하답니다. 기술이 누구에게 도움이 되는지 함께 질문해 주세요.\n\nAI 기술자가'},kwls:{know:'인공지능은 많은 자료에서 규칙을 배운다.',want:'인공지능은 사람의 마음도 이해할 수 있을까?',learned:'기술을 만드는 사람의 판단과 책임이 중요하다.',still:'모두에게 공정한 인공지능을 만들려면 어떻게 해야 할까?'}}));
}
function paintPreview(){
 $('#welcome-panel').hidden=true;$('#activity-workspace').hidden=false;$('#class-bar').hidden=true;$('#empty-class').hidden=true;
 $('#submit-activity').hidden=true;$('#draft-help').textContent='가상 자료 체험 · 입력한 내용은 저장·제출되지 않습니다.';
 $('#cloud-save-status').textContent='';$('#retry-save').hidden=true;$('#session-label').textContent='교사용 살펴보기';
 updateActivityHeading();hideActivities();teacherMode=previewTeacher;
 $('#preview-student').setAttribute('aria-pressed',String(!previewTeacher));$('#preview-teacher').setAttribute('aria-pressed',String(previewTeacher));
 if(!previewTeacher){$('#student-board-name').textContent='가상 학생의 닿소리 판';renderBoard();}
 changeMode(previewTeacher);
}
function showPreviewEntry(){closeDialogs();if(!cloud.user){$('#login-dialog').showModal();return;}$('#preview-dialog').showModal();}
$('#preview-open').addEventListener('click',showPreviewEntry);$('#join-preview').addEventListener('click',showPreviewEntry);
$('#preview-code').addEventListener('input',e=>e.target.value=e.target.value.trim().toUpperCase());
$('#preview-form').addEventListener('submit',e=>{e.preventDefault();withForm(e.currentTarget,'#preview-error',()=>redeemTeacherInvite($('#preview-code').value));});
$('#invite-manage').addEventListener('click',async()=>{$('#invite-dialog').showModal();$('#invite-error').textContent='';$('#teacher-invite').textContent='불러오는 중…';try{$('#teacher-invite').textContent=await getTeacherInvite();}catch(e){$('#teacher-invite').textContent='';$('#invite-error').textContent=showCloudError(e);}});
$('#invite-copy').addEventListener('click',async()=>{const code=$('#teacher-invite').textContent;if(!/^[A-HJ-NP-Z2-9]{12}$/.test(code))return;try{await navigator.clipboard.writeText(code);$('#invite-copy').textContent='복사 완료!';}catch{$('#invite-error').textContent='표시된 코드를 직접 선택해 복사해 주세요.';}});
$('#owner-preview').addEventListener('click',startOwnerPreview);
$('#preview-student').addEventListener('click',()=>{previewTeacher=false;paintPreview();});
$('#preview-teacher').addEventListener('click',()=>{previewTeacher=true;paintPreview();});
$('#preview-exit').addEventListener('click',()=>{if(cloud.previewOwner)leavePreview();else logoutCloud().catch(showCloudError);});
hideActivities();startCloud(onCloudEvent);

