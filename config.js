// Google API Configuration
// 이 파일을 수정하여 본인의 Google API 자격 증명을 설정하세요.

const CONFIG = {
    // Google Cloud Console에서 발급받은 클라이언트 ID
    // 1. https://console.cloud.google.com/ 에서 새 프로젝트 생성
    // 2. "API 및 서비스" > "라이브러리"에서 Google Drive API와 Google Picker API 활성화
    // 3. "API 및 서비스" > "사용자 인증 정보"에서 OAuth 2.0 클라이언트 ID 생성
    CLIENT_ID: '1084510936539-hohf61f106rtviss6tig473cmq0db7ie.apps.googleusercontent.com',
    
    // Google Cloud Console에서 발급받은 API 키
    // "API 및 서비스" > "사용자 인증 정보"에서 API 키 생성
    API_KEY: 'AIzaSyDxUD6u6TVk6saBgUDsGDClB6pD98M30fM',
    
    // 필요한 권한 범위 - 전체 Google Drive 액세스 권한
    // drive: 모든 파일과 폴더에 대한 전체 접근 권한 (읽기/쓰기/삭제)
    SCOPES: 'https://www.googleapis.com/auth/drive',
    
    // 사용할 Google API 문서
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
};

// script.js에서 CONFIG 사용
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}