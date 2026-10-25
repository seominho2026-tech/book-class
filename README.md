# book-class

빌드 없이 실행하는 HTML/CSS/JavaScript 독서 활동 앱입니다. Firebase Authentication과 서울 리전의 Cloud Firestore에 연결됩니다.

공개 사이트: https://book-class-rho.vercel.app

공개 소스 저장소: https://github.com/seominho2026-tech/book-class

학생에게는 공개 사이트 주소와 교사가 선택한 학급의 6자리 코드만 전달합니다. 기본 학급은 BOOK26이며, CC6UDL은 연동 검사 전용 학급입니다. 서버 실행 파일은 로컬 개발용이고 공개 사이트 이용에는 필요하지 않습니다.

## 복사해서 사용하기

이 저장소의 Firebase 설정은 원래 운영 프로젝트를 가리킵니다. 독립적인 학급 앱을 운영하려면 본인의 Firebase 프로젝트를 만들고, firebase-config.js와 .firebaserc의 프로젝트 정보를 바꾸세요. firestore.rules와 firebase.json에 지정된 최초 관리자 이메일도 본인 계정에 맞게 바꾸고 보안 규칙을 배포해야 합니다. Google·이메일 로그인을 활성화하고 실제 배포 도메인을 Firebase Authentication의 허용 도메인에 등록하세요. 원래 프로젝트의 설정을 그대로 사용하면 별도 교사 관리자가 되지 않습니다.

## 사용하기

Windows에서는 `start-book-class.cmd`를 더블클릭하면 로컬 서버를 시작하고 브라우저를 엽니다. Node.js가 설치되어 있어야 합니다. 컴퓨터를 재시작한 뒤에도 이 파일로 다시 실행하세요. `ERR_CONNECTION_REFUSED`가 뜨면 서버가 종료되었는지 확인하고 이 실행 파일을 다시 여세요.

1. 정적 웹 서버로 폴더를 열거나 GitHub Pages에 올립니다. 파일을 더블클릭하는 `file://` 실행은 지원하지 않습니다.
2. 교사는 Google 로그인 후 학급을 선택합니다. 기본 학급 초대 코드는 `BOOK26`입니다.
3. 학생은 Google 로그인 또는 이메일 회원가입 후 교사가 알려 준 코드를 입력합니다.
4. 활동 입력을 멈추면 **1초 후** 기기의 localStorage와 Firestore의 `drafts`에 임시 저장됩니다. **자동 저장됨 (HH:mm:ss) · 기기·서버** 표시를 확인하세요. 오프라인이면 기기에만 저장되며, 저장 공간이 부족하면 오류를 표시합니다.
5. **현재 활동 최종 제출**을 누르면 교사에게 해당 활동이 전달됩니다. 임시 글은 교사에게 표시되지 않습니다. 재접속하거나 연결이 복구되면 본인 계정·학급의 임시 글을 복구할지 확인창이 뜹니다.
6. 교사는 네 활동 탭에서 최종 제출 기록을 실시간으로 봅니다. 교사가 활동을 바꾸면 학생에게도 해당 활동이 표시됩니다.

## 파일

- `index.html`, `styles.css`, `app.js`: 화면과 네 독서 활동
- `firebase-service.js`: 인증, 학급 관리, 실시간 구독, 저장
- `draft-storage.js`: 계정·학급별 로컬 임시 저장, 복구 자료 검사
- `dev-server.cjs`: `node dev-server.cjs`로 실행하는 로컬 확인 서버(기본 포트 8018)
- `firebase-config.js`: 브라우저에서 사용하는 공개 Firebase 연결 정보
- `firestore.rules`: 서버에서 검사하는 접근 권한과 입력 형식
- `firebase.json`, `.firebaserc`: Firebase 프로젝트 설정
- `tests/firestore-access.mjs`: 실제 운영 데이터와 분리된 에뮬레이터 접근 권한 검사

Firebase 웹 연결 정보는 브라우저에 전달됩니다. 서비스 계정 키나 관리자 토큰을 이 파일에 넣으면 안 됩니다. 학생 기록 보호는 Firestore 보안 규칙에서 처리합니다. `.private`, `.env`, 인증 파일과 디버그 로그는 배포하거나 Git에 넣지 않습니다.

## GitHub Pages 배포

앱 실행에 필요한 HTML/CSS/JS 파일 6개(index.html, styles.css, app.js, firebase-service.js, firebase-config.js, draft-storage.js)를 같은 폴더에 둡니다. 경로는 상대 경로이며 npm 설치나 빌드는 필요하지 않습니다. 현재는 GitHub main 브랜치를 Vercel의 book-class 프로젝트에 연결해 배포했습니다. .vercelignore와 vercel.json의 경로 제한으로 웹 실행 파일만 공개합니다.

배포 주소가 정해지면 Firebase 콘솔 → Authentication → Settings → Authorized domains에 실제 Pages 도메인(예: 계정명.github.io)을 추가해야 Google 로그인이 동작합니다. 주소 경로는 넣지 않습니다. 공개 후에는 실제 주소에서 로그인, 학급 입장, 저장, 모바일 화면을 다시 확인해야 합니다.

## 데이터와 권한

- 최초 교사 등록은 인증된 프로젝트 소유자 이메일로 제한합니다. 누구나 먼저 로그인해서 관리자가 되는 것을 막습니다.
- 학생은 자신의 프로필·명부·제출물만 기록하고 읽습니다. 교사는 자신이 개설한 학급의 제출물을 읽습니다.
- 클래스 문서 ID는 초대 코드와 같습니다. 코드로 문서를 직접 조회하므로 학생에게 학급 전체 목록을 공개하지 않습니다.
- CATAPULT의 반복 알파벳은 covers, author, title, audience, page, underlying, reference, visuals처럼 서로 다른 키로 구분합니다. 실제 키는 app.js의 CATAPULT 정의를 기준으로 합니다.
- KWLS는 know, want, learned, still 키를 사용합니다.
- 임시 글 경로: `classes/{classId}/students/{uid}/drafts/{activityType}`. 기존 활동 스키마와 서버 수정 시각을 저장하며 학생 본인만 접근합니다.
- 최종 제출 경로: `students/{uid}/activities/{activityType}`. `{classId, data}` 형태이며 data는 기존 활동 스키마입니다. 기존 학급별 `*_submissions/{uid}`에도 원자적 배치로 함께 기록하므로 기존 교사 실시간 리스너를 그대로 사용합니다.
- activityType은 `consonants`, `catapult`, `raft`, `kwls`입니다. 이름이나 학번 대신 인증 UID로 학생을 구별합니다.
- 기기 임시 글은 로그아웃 후에도 복구를 위해 남습니다. 최종 제출 성공 시 해당 활동의 기기 임시 글을 지우되, 전송 도중 새로 입력한 내용은 보존합니다. 브라우저 저장소를 지우면 기기 복구본도 사라집니다. 서버 drafts는 남지만 다른 기기로 옮기는 복구 기능은 포함하지 않습니다.
- 현재 학생은 한 학급에 가입합니다. 학생의 학급 이동·탈퇴 기능과 학번 필드는 별도로 구현하지 않았습니다.

## 검증 기록 (2026-10-25)

- 실제 Firebase: 교사 Google 로그인, 최초 기본 학급 생성, 새 학급 생성, 학생 이메일 회원가입과 소문자 코드 입장 확인.
- 실제 Firebase: 네 활동 저장 및 교사 화면 반영, 학생 새로고침 후 KWLS 기록 유지, 교사의 학급 전환 시 명부 분리 확인.
- 에뮬레이터: 비로그인·본인·타인·다른 학급 접근, 역할 상승 차단, 데이터 형식 및 새 drafts/activities 경로 검사 등 101개 통과.
- 자동 저장 검사: 1000ms 디바운스, 로컬 격리, 오프라인·재연결, 복구 승인·거절, 서버/저장소 실패, 제출 중 추가 입력 보존 등 15개 통과. `node tests/draft-workflow.mjs`로 재현합니다.
- 실제 Firebase: 네 활동의 임시 저장과 최종 제출, KWLS 새로고침 복구, 제출 전 교사 비노출 및 제출 후 실시간 표시 확인. 새 보안 규칙도 적용했습니다. 실제 기기의 인터넷 차단 검사는 수행하지 않았으며 오프라인 동작은 자동 검사로 확인했습니다.
- 테스트용 학급 `CC6UDL`(연동 확인용 테스트 학급)과 `연동검사 학생`, `임시저장 검사 학생` 기록은 확인용으로 남아 있습니다.
- Vercel 공개 주소 배포 및 Firebase 로그인 도메인 등록 완료. 비로그인 HTTP 200, 교사 Google 로그인과 제출물 조회, 비공개 파일 경로 404를 확인했습니다. 실제 모바일 기기와 학교 네트워크 검사는 남아 있습니다.
- 도름스체크: 공개 화면 최소 점검 완료(확인 30건, 미확인 5건, 해당 없음 1건). 비밀 노출 미검출. API 키 권고 3건은 배포되지 않는 로컬 백업 2개와 공개 Firebase 웹 설정 1개입니다. CSP·Permissions-Policy·개인정보처리방침 등은 추가 검토 항목입니다. 이 검사가 모든 보안을 보증하지는 않습니다.

규칙 테스트는 Java 21 이상과 Firebase CLI로 `firebase emulators:exec --only firestore --project demo-book-class --config firebase.test.json "node tests/firestore-access.mjs"`를 실행합니다. 별도 8085 포트에서 운영 데이터와 분리되어 실행됩니다. 운영 프로젝트에 이 테스트를 연결하지 마세요. 규칙 변경 전 백업은 `.private/firestore.rules.before-drafts`에 있습니다.

## 교사용 살펴보기

관리 교사는 로그인 후 **교사용 초대 코드** 버튼을 눌러 별도의 12자리 코드를 확인하고 복사합니다. 학생용 6자리 학급 코드와 다르며, 승인한 선생님에게만 전달하세요.

방문 교사는 Google 로그인 또는 이메일 인증 후 **교사용 살펴보기**에서 코드를 입력합니다. 학생 학급 입장 창에서도 **선생님이신가요?** 버튼으로 이동할 수 있습니다. 이미 학생 학급에 가입한 계정은 사용할 수 없습니다.

살펴보기에서는 네 활동의 가상 예시, 학생처럼 작성하기, 교사 화면 보기를 제공합니다. 실제 학생 자료는 조회하지 않으며, 체험 입력은 저장·제출되지 않고 새로고침하면 초기화됩니다. 인증한 계정은 다음 로그인에도 살펴보기로 진입합니다. 코드는 교원 신분을 자동 확인하지 않습니다. 현재 코드 교체와 방문 권한 취소 UI는 제공하지 않습니다.

방문 권한은 `previewAccess/{uid}`에 별도로 기록하며 운영 교사 역할을 부여하지 않습니다. 코드 원문은 관리자만 읽는 `system/previewInvitation`, 조회용 SHA-256 해시는 `previewInvites/{hash}`에 저장합니다. 126개 에뮬레이터 권한 검사와 기존 15개 임시 저장 검사를 통과했습니다.
