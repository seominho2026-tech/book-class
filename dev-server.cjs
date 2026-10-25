// 빌드나 패키지 설치 없이 로컬에서 확인하는 정적 서버입니다.
// 인증 자료, 테스트 파일, 보안 규칙은 외부에 제공하지 않습니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['index.html','styles.css','app.js','firebase-service.js','firebase-config.js','draft-storage.js']);
const port = Number(process.env.PORT || 8018);
http.createServer((req,res)=>{
 let name;
 try { name=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html'; }
 catch { res.writeHead(400);res.end();return; }
 if(!allowed.has(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.end(fs.readFileSync(path.join(__dirname,name)));
}).listen(port,'127.0.0.1',()=>console.log(`book-class: http://127.0.0.1:${port}`));
