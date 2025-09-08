// 단순한 Google API 로딩 테스트
window.testGoogleAPI = function() {
    console.log('🚀 테스트 시작...');
    
    if (typeof gapi === 'undefined') {
        console.error('❌ gapi가 로드되지 않았습니다.');
        return;
    }
    
    console.log('✅ gapi 존재 확인');
    
    // 가장 기본적인 방법으로 테스트
    gapi.load('client', async () => {
        try {
            console.log('📦 gapi.client 로드됨');
            
            // API Key만으로 초기화
            await gapi.client.init({
                apiKey: CONFIG.API_KEY
            });
            console.log('🔑 gapi.client.init 성공');
            
            // Drive API 로드
            await gapi.client.load('drive', 'v3');
            console.log('💾 Drive API 로드 성공');
            
            console.log('🎉 모든 테스트 완료!');
            
        } catch (error) {
            console.error('❌ 테스트 실패:', error);
        }
    });
};