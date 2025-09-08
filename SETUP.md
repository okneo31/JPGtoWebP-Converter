# 🚀 드라이브 WebP 컨버터 설정 가이드

## 📋 준비 사항

1. **Google 계정** (Google Drive 사용 가능)
2. **Google Cloud Console 접근 권한**
3. **웹 브라우저** (Chrome, Firefox, Safari, Edge)

## ⚙️ Google API 설정 (필수)

### 1단계: Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 좌상단 프로젝트 선택 드롭다운 클릭
3. "새 프로젝트" 클릭
4. 프로젝트 이름 입력 (예: "Drive WebP Converter")
5. "만들기" 클릭

### 2단계: 필요한 API 활성화

1. 좌측 메뉴에서 **"API 및 서비스" > "라이브러리"** 클릭
2. 다음 API들을 검색하여 활성화:

   **Google Drive API**
   - "Google Drive API" 검색
   - "사용" 버튼 클릭

   **Google Picker API**
   - "Google Picker API" 검색  
   - "사용" 버튼 클릭

### 3단계: 사용자 인증 정보 생성

#### OAuth 2.0 클라이언트 ID 생성

1. **"API 및 서비스" > "사용자 인증 정보"** 클릭
2. **"사용자 인증 정보 만들기" > "OAuth 클라이언트 ID"** 선택
3. 애플리케이션 유형: **"웹 애플리케이션"** 선택
4. 이름 입력 (예: "Drive WebP Converter Web Client")
5. **승인된 JavaScript 원본**에 다음 추가:
   ```
   http://localhost:8000
   http://127.0.0.1:8000
   https://yourdomain.com (실제 배포 도메인)
   ```
6. **"만들기"** 클릭
7. 클라이언트 ID 복사 (나중에 사용)

#### API 키 생성

1. **"사용자 인증 정보 만들기" > "API 키"** 선택
2. 생성된 API 키 복사
3. **"키 제한"** 클릭하여 보안 설정:
   - **애플리케이션 제한사항**: HTTP 리퍼러(웹사이트)
   - **웹사이트 제한사항**에 도메인 추가:
     ```
     localhost:8000/*
     127.0.0.1:8000/*
     yourdomain.com/*
     ```
   - **API 제한사항**: 키를 다음 API로 제한
     - Google Drive API
     - Google Picker API

### 4단계: 설정 파일 업데이트

`config.js` 파일을 열고 생성한 인증 정보로 수정:

```javascript
const CONFIG = {
    // 3단계에서 생성한 OAuth 클라이언트 ID
    CLIENT_ID: '1234567890-abcdef.apps.googleusercontent.com',
    
    // 3단계에서 생성한 API 키
    API_KEY: 'AIzaSyABC123DEF456GHI789JKL012MNO345PQR',
    
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
};
```

## 🌐 로컬 테스트

### Node.js 사용 (권장)

```bash
# 1. Node.js가 설치되어 있지 않다면 설치
# https://nodejs.org/

# 2. 프로젝트 폴더에서 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 http://localhost:8000 접속
```

### Python 사용

```bash
# Python 3
python -m http.server 8000

# Python 2
python -SimpleHTTPServer 8000

# 브라우저에서 http://localhost:8000 접속
```

### PHP 사용

```bash
php -S localhost:8000

# 브라우저에서 http://localhost:8000 접속
```

## 🚀 배포

### Netlify 배포

1. [Netlify](https://netlify.com) 계정 생성
2. GitHub에 프로젝트 업로드
3. Netlify에서 "Import from Git" 선택
4. 자동 배포 후 도메인 확인
5. Google Cloud Console에서 새 도메인을 승인된 원본에 추가

### Vercel 배포

```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. 프로젝트 폴더에서 배포
vercel --prod

# 3. 배포된 URL을 Google Cloud Console의 승인된 원본에 추가
```

### GitHub Pages 배포

1. GitHub 저장소 생성 후 코드 업로드
2. 저장소 Settings > Pages
3. Source: "Deploy from a branch"
4. Branch: "main" 또는 "master" 선택
5. 생성된 URL을 Google Cloud Console 설정에 추가

## ✅ 테스트 체크리스트

- [ ] 로컬에서 정상 실행 (http://localhost:8000)
- [ ] Google 로그인 성공
- [ ] Google Drive 파일 선택 가능
- [ ] 폴더 선택 정상 작동
- [ ] JPG → WebP 변환 성공
- [ ] 변환된 파일이 Drive에 저장됨
- [ ] 에러 메시지 정상 표시
- [ ] 모바일 환경에서 UI 정상 작동

## 🔧 문제 해결

### 자주 발생하는 오류

#### "CLIENT_ID가 정의되지 않았습니다"
- `config.js` 파일의 CLIENT_ID가 올바른지 확인
- 파일이 HTML에서 제대로 로드되는지 확인

#### "Google API 로드에 실패했습니다"
- 인터넷 연결 확인
- 브라우저의 광고 차단기 또는 보안 설정 확인
- 개발자 도구에서 네트워크 탭 확인

#### "로그인이 안 됩니다"
- OAuth 클라이언트 ID가 올바른지 확인
- 승인된 JavaScript 원본에 현재 도메인이 포함되어 있는지 확인
- 브라우저 팝업이 차단되었는지 확인

#### "파일을 선택할 수 없습니다"
- Google Picker API가 활성화되어 있는지 확인
- API 키 제한 설정이 올바른지 확인
- 브라우저 콘솔에서 에러 메시지 확인

#### "파일 업로드가 실패합니다"
- Google Drive API 권한 확인
- 네트워크 연결 상태 확인
- 파일 크기가 100MB 이하인지 확인

### 디버깅 팁

1. **브라우저 개발자 도구 활용**
   ```javascript
   // 콘솔에서 현재 설정 확인
   console.log(CONFIG);
   console.log(window.converter);
   ```

2. **네트워크 탭 확인**
   - API 호출이 실패하는지 확인
   - 403, 404 오류 등 확인

3. **Google Cloud Console 로그**
   - API 사용량 모니터링
   - 오류 로그 확인

## 📞 지원

문제가 해결되지 않으면:

1. **GitHub Issues**: 버그 리포트 및 기능 요청
2. **Google Cloud Console 문서**: API 관련 문제
3. **브라우저 콘솔**: 자세한 오류 메시지 확인

## 🔒 보안 권장사항

- [ ] API 키에 HTTP 리퍼러 제한 설정
- [ ] OAuth 클라이언트 ID에 도메인 제한 설정
- [ ] 정기적인 액세스 로그 모니터링
- [ ] 불필요한 API 권한 제거

---

축하합니다! 🎉 이제 드라이브 WebP 컨버터를 사용할 준비가 완료되었습니다.