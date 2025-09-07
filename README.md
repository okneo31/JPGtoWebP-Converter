# 드라이브 WebP 컨버터 (Drive WebP Converter)

구글 드라이브의 JPG 파일을 WebP 형식으로 간편하게 변환하는 웹 애플리케이션입니다.

## 🚀 주요 기능

- **Google 계정 연동**: OAuth 2.0을 통한 안전한 인증
- **파일 선택**: Google Drive에서 최대 30개의 JPG 파일 선택 (파일당 최대 100MB)
- **폴더 지정**: 변환된 파일을 저장할 폴더 선택 가능
- **품질 조절**: 20%~100% 범위에서 WebP 변환 품질 설정
- **실시간 진행률**: 각 파일의 변환 상태와 전체 진행률 표시
- **동시 처리**: 최대 5개 파일 동시 변환으로 빠른 처리
- **반응형 UI**: 모든 디바이스에서 최적화된 사용자 경험

## 🛠 설정 방법

### 1. Google API 자격 증명 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스 > 라이브러리**에서 다음 API 활성화:
   - Google Drive API
   - Google Picker API
4. **API 및 서비스 > 사용자 인증 정보**에서:
   - OAuth 2.0 클라이언트 ID 생성
   - API 키 생성

### 2. 설정 파일 수정

`config.js` 파일에서 다음 값들을 업데이트하세요:

```javascript
const CONFIG = {
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com',
    API_KEY: 'YOUR_GOOGLE_API_KEY_HERE',
    // ...
};
```

### 3. OAuth 승인된 도메인 설정

Google Cloud Console의 OAuth 2.0 클라이언트 설정에서:
- **승인된 JavaScript 원본**에 본인의 도메인 추가
- 예: `https://yourdomain.com` 또는 로컬 테스트용 `http://localhost:3000`

## 📁 파일 구조

```
JPGtoWebP Converter/
├── index.html          # 메인 HTML 파일
├── script.js           # 핵심 애플리케이션 로직
├── config.js           # Google API 설정 파일
└── README.md           # 프로젝트 문서
```

## 🚦 사용 방법

1. **로그인**: Google 계정으로 로그인
2. **파일 선택**: 변환할 JPG 파일들을 Google Drive에서 선택
3. **폴더 지정**: 변환된 파일을 저장할 폴더 선택 (선택사항)
4. **품질 설정**: 슬라이더를 사용해 WebP 변환 품질 조정
5. **변환 시작**: "변환 시작!" 버튼 클릭
6. **진행 확인**: 실시간으로 각 파일의 변환 상태 확인

## 🔧 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome
- **APIs**: 
  - Google Identity Services
  - Google Drive API v3
  - Google Picker API
- **이미지 변환**: HTML5 Canvas API

## 📋 제한사항

- 파일 크기: 개당 최대 100MB
- 동시 선택: 최대 30개 파일
- 지원 형식: JPG/JPEG → WebP 변환만 지원
- 브라우저 호환성: 모던 브라우저 (Chrome, Firefox, Safari, Edge)

## 🔒 보안 및 개인정보

- 모든 변환 작업은 클라이언트 사이드에서 수행됩니다
- 파일 데이터가 외부 서버로 전송되지 않습니다
- Google OAuth를 통한 안전한 인증
- 필요한 최소한의 권한만 요청 (Google Drive 파일 읽기/쓰기)

## 🚀 배포 옵션

### 정적 호스팅 서비스
- **Netlify**: `netlify deploy`
- **Vercel**: `vercel --prod`
- **GitHub Pages**: GitHub 저장소 Settings에서 활성화

### 로컬 개발
```bash
# 간단한 HTTP 서버 실행 (Python)
python -m http.server 8000

# 또는 Node.js 사용
npx http-server
```

## 🤝 문제 해결

### 일반적인 문제들

1. **로그인이 안 됨**
   - `config.js`의 CLIENT_ID가 올바른지 확인
   - OAuth 승인된 도메인 설정 확인

2. **API 호출 오류**
   - API_KEY가 올바른지 확인
   - Google Drive API가 활성화되어 있는지 확인

3. **파일 선택이 안 됨**
   - Google Picker API가 활성화되어 있는지 확인
   - 브라우저의 팝업 차단 해제

4. **변환이 실패함**
   - 파일 크기가 100MB 이하인지 확인
   - JPG/JPEG 형식인지 확인
   - 인터넷 연결 상태 확인

## 📈 향후 개선 계획

- [ ] PNG → WebP 변환 지원
- [ ] 일괄 다운로드 기능
- [ ] 변환 기록 저장
- [ ] 더 많은 이미지 형식 지원
- [ ] 프리셋 품질 설정
- [ ] 다국어 지원

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

💡 **팁**: 처음 사용하시는 경우, 작은 파일 몇 개로 테스트해보세요!