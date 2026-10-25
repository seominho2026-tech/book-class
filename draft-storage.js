// 계정과 학급을 키에 넣어 공용 기기의 다른 학생 글과 섞이지 않게 합니다.
export const ACTIVITY_TYPES = ['consonants', 'catapult', 'raft', 'kwls'];
// 브라우저 저장값도 외부 입력처럼 검사합니다. 손상된 값으로 화면이 멈추지 않게 합니다.
export function validDraftData(activity, data) {
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  const cards = (keys, max) => data.cards && keys.every(k => text(data.cards[k], max));
  if (!data || !text(data.studentName, 60)) return false;
  if (activity === 'consonants') return data.board && [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'].every(k => Array.isArray(data.board[k]) && data.board[k].length <= 200 && data.board[k].every(w => text(w, 20)));
  if (activity === 'catapult') return cards(['covers','author','title','audience','page','underlying','reference','visuals'], 2000);
  if (activity === 'kwls') return cards(['know','want','learned','still'], 3000);
  return activity === 'raft' && ['role','audience','format','topic'].every(k => text(data[k], 150)) && text(data.content, 20000);
}
export function draftKey(uid, classId, activity) {
  return `book-class:draft:v1:${uid}:${classId}:${activity}`;
}
export function writeLocalDraft(storage, uid, classId, activity, data) {
  const draft = { uid, classId, activity, data, savedAt: Date.now(), revision: crypto.randomUUID() };
  storage.setItem(draftKey(uid, classId, activity), JSON.stringify(draft));
  return draft;
}
export function readLocalDrafts(storage, uid, classId) {
  return ACTIVITY_TYPES.flatMap(activity => {
    try {
      const d = JSON.parse(storage.getItem(draftKey(uid, classId, activity)));
      return d && d.uid === uid && d.classId === classId && d.activity === activity && validDraftData(activity, d.data) && typeof d.revision === 'string' ? [d] : [];
    } catch { return []; } // 손상된 임시 글 하나 때문에 다른 활동까지 멈추지 않습니다.
  });
}
export function removeLocalDraft(storage, uid, classId, activity, revision) {
  const key = draftKey(uid, classId, activity);
  const d = JSON.parse(storage.getItem(key));
  // 제출하는 동안 새로 쓴 내용이 있으면 그 임시 글은 지우지 않습니다.
  if (d?.revision === revision) storage.removeItem(key);
}
