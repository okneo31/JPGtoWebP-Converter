// 전역 변수로 API 로딩 상태 추적
let gapiLoaded = false;
let gsiLoaded = false;

// API 로딩 완료 후 호출되는 함수들
function initGoogleAPI() {
    gapiLoaded = true;
    checkAndInitialize();
}

function initGoogleIdentity() {
    gsiLoaded = true;
    checkAndInitialize();
}

function checkAndInitialize() {
    if (gapiLoaded && gsiLoaded && typeof CONFIG !== 'undefined') {
        // gapi가 실제로 로드되었는지 확인
        if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
            new DriveWebPConverter();
        } else {
            console.log('API 로딩 대기 중...');
            setTimeout(checkAndInitialize, 500);
        }
    }
}

class DriveWebPConverter {
    constructor() {
        if (typeof CONFIG === 'undefined') {
            throw new Error('CONFIG is not defined. Please check if config.js is loaded correctly.');
        }
        
        this.CLIENT_ID = CONFIG.CLIENT_ID;
        this.API_KEY = CONFIG.API_KEY;
        this.DISCOVERY_DOCS = CONFIG.DISCOVERY_DOCS;
        this.SCOPES = CONFIG.SCOPES;
        
        this.isAuthenticated = false;
        this.selectedFiles = [];
        this.targetFolder = null;
        this.conversionQueue = [];
        this.completedCount = 0;
        this.failedCount = 0;
        
        this.init();
    }

    async init() {
        try {
            this.showLoadingMessage('Google API를 로드하는 중...');
            await this.loadGoogleAPIs();
            this.hideLoadingMessage();
            this.initializeUI();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showErrorMessage('앱 초기화에 실패했습니다: ' + error.message);
        }
    }

    async loadGoogleAPIs() {
        try {
            console.log('🚀 Google API 초기화 시작...');
            
            // gapi 존재 확인
            if (typeof gapi === 'undefined') {
                throw new Error('gapi가 로드되지 않았습니다.');
            }
            console.log('✅ gapi 존재 확인');
            
            // 가장 기본적인 방법으로 gapi.client 로드
            await new Promise((resolve, reject) => {
                gapi.load('client', {
                    callback: () => {
                        console.log('📦 gapi.client 로드됨');
                        resolve();
                    },
                    onerror: (error) => {
                        console.error('❌ gapi.client 로드 실패:', error);
                        reject(error);
                    }
                });
            });
            
            // API Key만으로 기본 초기화
            await gapi.client.init({
                apiKey: this.API_KEY
            });
            console.log('🔑 gapi.client.init 성공');
            
            // Drive API 로드
            await gapi.client.load('drive', 'v3');
            console.log('💾 Drive API 로드 성공');
            
            // Picker API 로드
            await new Promise((resolve, reject) => {
                gapi.load('picker', {
                    callback: () => {
                        console.log('📁 Picker API 로드됨');
                        resolve();
                    },
                    onerror: (error) => {
                        console.error('❌ Picker API 로드 실패:', error);
                        reject(error);
                    }
                });
            });
            
            // Google Identity Services 확인
            if (typeof google === 'undefined' || !google.accounts) {
                throw new Error('Google Identity Services가 로드되지 않았습니다.');
            }
            console.log('🔐 Google Identity Services 확인됨');
            
            // Google Identity Services 초기화
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error !== undefined) {
                        console.error('인증 오류:', response);
                        this.showErrorMessage('인증에 실패했습니다: ' + response.error);
                        return;
                    }
                    this.isAuthenticated = true;
                    console.log('🎉 Google 인증 성공');
                    
                    // 토큰 정보 상세 출력
                    const token = gapi.client.getToken();
                    console.log('🔑 인증 완료 토큰 정보:', {
                        hasToken: !!token,
                        scope: token?.scope || 'scope 없음',
                        expiresIn: token?.expires_in,
                        tokenType: token?.token_type
                    });
                    
                    // 권한 확인
                    if (token?.scope && token.scope.includes('auth/drive')) {
                        console.log('✅ Google Drive 전체 액세스 권한 확인됨');
                    } else {
                        console.error('❌ Google Drive 권한이 부족합니다. 현재 scope:', token?.scope);
                    }
                    
                    // 사용자 정보 가져오기
                    this.getUserInfo();
                    
                    this.hideLoadingMessage();
                    this.updateUI();
                    this.showSuccessMessage('로그인에 성공했습니다!');
                }
            });
            
            console.log('Google APIs loaded successfully');
            return true;
        } catch (error) {
            console.error('Google API 로딩 실패:', error);
            throw new Error('Google API 로딩에 실패했습니다: ' + error.message);
        }
    }

    initializeUI() {
        document.getElementById('google-signin-btn').addEventListener('click', () => this.signIn());
        document.getElementById('logout-btn').addEventListener('click', () => this.signOut());
        document.getElementById('test-permission-btn').addEventListener('click', () => this.testPermissions());
        document.getElementById('select-files-btn').addEventListener('click', () => this.selectFiles());
        document.getElementById('select-folder-btn').addEventListener('click', () => this.selectFolder());
        document.getElementById('start-conversion-btn').addEventListener('click', () => this.startConversion());
        document.getElementById('new-conversion-btn').addEventListener('click', () => this.resetApp());
        
        const qualitySlider = document.getElementById('quality-slider');
        const qualityValue = document.getElementById('quality-value');
        qualitySlider.addEventListener('input', (e) => {
            qualityValue.textContent = e.target.value + '%';
        });

        this.updateUI();
    }

    async signIn() {
        try {
            this.showLoadingMessage('로그인 중...');
            
            if (!this.tokenClient) {
                throw new Error('Google 인증이 초기화되지 않았습니다.');
            }
            
            // 기존 토큰이 있어도 권한 변경으로 인해 재인증 필요
            const existingToken = gapi.client.getToken();
            if (existingToken !== null) {
                console.log('기존 토큰 발견, 권한 업데이트를 위해 재인증 진행');
                // 기존 토큰 해제
                google.accounts.oauth2.revoke(existingToken.access_token);
                gapi.client.setToken('');
            }
            
            // 새로운 토큰 요청 (권한 변경으로 인해 강제로 동의 화면 표시)
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
            
        } catch (error) {
            console.error('로그인 실패:', error);
            this.hideLoadingMessage();
            
            let errorMessage = '로그인에 실패했습니다.';
            if (error.error === 'popup_closed_by_user') {
                errorMessage = '로그인이 취소되었습니다.';
            } else if (error.error === 'access_denied') {
                errorMessage = '접근 권한이 거부되었습니다.';
            } else if (error.message) {
                errorMessage += ' ' + error.message;
            }
            
            this.showErrorMessage(errorMessage);
        }
    }

    async signOut() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
        }
        this.isAuthenticated = false;
        this.currentUser = null;
        this.resetData();
        this.updateUI();
    }

    async getUserInfo() {
        try {
            // Google Drive API를 통해 사용자 정보 가져오기
            const response = await gapi.client.drive.about.get({
                fields: 'user'
            });
            
            if (response.result && response.result.user) {
                this.currentUser = {
                    name: response.result.user.displayName,
                    email: response.result.user.emailAddress,
                    picture: response.result.user.photoLink
                };
                console.log('👤 사용자 정보 로드됨:', this.currentUser);
            }
        } catch (error) {
            console.warn('⚠️ 사용자 정보 로드 실패:', error);
            // 기본 정보 설정
            this.currentUser = {
                name: '사용자',
                email: '',
                picture: ''
            };
        }
    }

    testPermissions() {
        console.log('🔍 권한 상태 테스트 시작...');
        
        if (!this.isAuthenticated) {
            console.error('❌ 로그인되지 않음');
            this.showErrorMessage('먼저 로그인해주세요.');
            return;
        }
        
        const token = gapi.client.getToken();
        console.log('🔑 현재 토큰 상태:', {
            hasToken: !!token,
            scope: token?.scope || 'scope 없음',
            expiresIn: token?.expires_in,
            tokenType: token?.token_type,
            accessToken: token?.access_token ? '토큰 존재함' : '토큰 없음'
        });
        
        if (!token) {
            console.error('❌ 토큰 없음');
            this.showErrorMessage('토큰이 없습니다. 다시 로그인해주세요.');
            return;
        }
        
        if (!token.scope) {
            console.error('❌ Scope 정보 없음');
            this.showErrorMessage('권한 정보가 없습니다. 다시 로그인해주세요.');
            return;
        }
        
        if (token.scope.includes('auth/drive')) {
            console.log('✅ Google Drive 전체 액세스 권한 확인됨!');
            this.showSuccessMessage('Google Drive 전체 액세스 권한이 있습니다!');
        } else {
            console.error('❌ Google Drive 권한 부족. 현재 scope:', token.scope);
            this.showErrorMessage('Google Drive 권한이 부족합니다. 다시 로그인하여 권한을 승인해주세요.');
        }
    }

    resetData() {
        this.selectedFiles = [];
        this.targetFolder = null;
        this.conversionQueue = [];
        this.completedCount = 0;
        this.failedCount = 0;
    }

    updateUI() {
        const loginSection = document.getElementById('login-section');
        const userInfo = document.getElementById('user-info');
        const fileSelection = document.getElementById('file-selection');

        if (this.isAuthenticated) {
            loginSection.classList.add('hidden');
            userInfo.classList.remove('hidden');
            fileSelection.classList.remove('hidden');

            // 사용자 정보가 있을 때만 표시
            if (this.currentUser) {
                document.getElementById('user-name').textContent = this.currentUser.name || '사용자';
                document.getElementById('user-email').textContent = this.currentUser.email || '';
                if (this.currentUser.picture) {
                    document.getElementById('user-avatar').src = this.currentUser.picture;
                }
            }
        } else {
            loginSection.classList.remove('hidden');
            userInfo.classList.add('hidden');
            fileSelection.classList.add('hidden');
            document.getElementById('progress-section').classList.add('hidden');
        }

        this.updateFileSelectionUI();
    }

    updateFileSelectionUI() {
        const selectedFilesInfo = document.getElementById('selected-files-info');
        const selectedFolderInfo = document.getElementById('selected-folder-info');
        const startBtn = document.getElementById('start-conversion-btn');

        if (this.selectedFiles.length > 0) {
            selectedFilesInfo.innerHTML = `
                <div class="text-green-600">
                    <i class="fas fa-check-circle mr-1"></i>
                    ${this.selectedFiles.length}개 파일 선택됨
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    ${this.selectedFiles.map(f => f.name).join(', ')}
                </div>
            `;
        } else {
            selectedFilesInfo.textContent = '선택된 파일이 없습니다.';
        }

        if (this.targetFolder) {
            selectedFolderInfo.innerHTML = `
                <div class="text-green-600">
                    <i class="fas fa-check-circle mr-1"></i>
                    저장 폴더: ${this.targetFolder.name}
                </div>
            `;
        } else {
            selectedFolderInfo.innerHTML = `
                <div class="text-gray-500">
                    미선택 시 'WebP-Converted' 폴더에 저장됩니다.
                </div>
            `;
        }

        startBtn.disabled = this.selectedFiles.length === 0;
    }

    async selectFiles() {
        try {
            if (!this.isAuthenticated) {
                this.showErrorMessage('먼저 로그인해주세요.');
                return;
            }
            
            const token = gapi.client.getToken();
            if (!token) {
                this.showErrorMessage('인증 토큰이 없습니다. 다시 로그인해주세요.');
                return;
            }
            
            // 파일 선택 전 권한 재확인
            console.log('📁 파일 선택 시 토큰 상태:', {
                hasToken: !!token,
                scope: token?.scope || 'scope 없음',
                hasDriveAccess: token?.scope?.includes('auth/drive') || false
            });
            
            if (!token.scope || !token.scope.includes('auth/drive')) {
                this.showErrorMessage('Google Drive 권한이 없습니다. 다시 로그인해주세요.');
                return;
            }
            
            return new Promise((resolve, reject) => {
                try {
                    const picker = new google.picker.PickerBuilder()
                        .addView(new google.picker.DocsView(google.picker.ViewId.DOCS)
                            .setMimeTypes('image/jpeg,image/jpg')
                            .setSelectFolderEnabled(false)
                            .setIncludeFolders(true))
                        .setOAuthToken(token.access_token)
                        .setDeveloperKey(this.API_KEY)
                        .setOrigin(window.location.protocol + '//' + window.location.host)
                        .setSize(600, 425)
                        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                        .setCallback((data) => {
                            console.log('Picker callback:', data);
                            
                            if (data.action === google.picker.Action.PICKED) {
                                console.log(`총 ${data.docs.length}개 파일이 선택됨`);
                                
                                // JPG 파일만 필터링하고 크기 제한 적용
                                const validFiles = data.docs.filter(doc => {
                                    const isValidType = doc.mimeType === 'image/jpeg' || doc.mimeType === 'image/jpg';
                                    const isValidSize = doc.sizeBytes <= 100 * 1024 * 1024; // 100MB 제한
                                    return isValidType && isValidSize;
                                });
                                
                                // 최대 30개로 제한
                                this.selectedFiles = validFiles.slice(0, 30);
                                
                                // 제외된 파일이 있으면 알림
                                const excludedCount = data.docs.length - this.selectedFiles.length;
                                if (excludedCount > 0) {
                                    let message = `${excludedCount}개 파일이 제외되었습니다. `;
                                    if (validFiles.length > 30) {
                                        message += `(최대 30개만 선택 가능)`;
                                    } else {
                                        message += `(100MB 이하 JPG 파일만 지원)`;
                                    }
                                    this.showErrorMessage(message);
                                }
                                
                                this.updateFileSelectionUI();
                                this.showSuccessMessage(`${this.selectedFiles.length}개 파일이 선택되었습니다. (최대 30개)`);
                            } else if (data.action === google.picker.Action.CANCEL) {
                                console.log('사용자가 파일 선택을 취소했습니다.');
                            }
                            resolve(data);
                        })
                        .build();
                    
                    picker.setVisible(true);
                } catch (pickerError) {
                    console.error('Picker 생성 오류:', pickerError);
                    reject(pickerError);
                }
            });
        } catch (error) {
            console.error('파일 선택 오류:', error);
            this.showErrorMessage('파일 선택 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async selectFolder() {
        try {
            if (!this.isAuthenticated) {
                this.showErrorMessage('먼저 로그인해주세요.');
                return;
            }
            
            const token = gapi.client.getToken();
            if (!token) {
                this.showErrorMessage('인증 토큰이 없습니다. 다시 로그인해주세요.');
                return;
            }
            
            return new Promise((resolve, reject) => {
                try {
                    const picker = new google.picker.PickerBuilder()
                        .addView(new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                            .setSelectFolderEnabled(true))
                        .setOAuthToken(token.access_token)
                        .setDeveloperKey(this.API_KEY)
                        .setOrigin(window.location.protocol + '//' + window.location.host)
                        .setSize(600, 425)
                        .setCallback((data) => {
                            console.log('Folder picker callback:', data);
                            
                            if (data.action === google.picker.Action.PICKED) {
                                this.targetFolder = data.docs[0];
                                this.updateFileSelectionUI();
                                this.showSuccessMessage(`폴더 "${this.targetFolder.name}"이 선택되었습니다.`);
                            } else if (data.action === google.picker.Action.CANCEL) {
                                console.log('사용자가 폴더 선택을 취소했습니다.');
                            }
                            resolve(data);
                        })
                        .build();
                    
                    picker.setVisible(true);
                } catch (pickerError) {
                    console.error('Folder picker 생성 오류:', pickerError);
                    reject(pickerError);
                }
            });
        } catch (error) {
            console.error('폴더 선택 오류:', error);
            this.showErrorMessage('폴더 선택 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async startConversion() {
        if (this.selectedFiles.length === 0) return;

        if (!this.targetFolder) {
            this.targetFolder = await this.createDefaultFolder();
        }

        document.getElementById('progress-section').classList.remove('hidden');
        document.getElementById('file-selection').classList.add('hidden');
        
        this.initializeProgress();
        await this.processFiles();
    }

    async createDefaultFolder() {
        try {
            const response = await gapi.client.drive.files.create({
                resource: {
                    name: 'WebP-Converted',
                    mimeType: 'application/vnd.google-apps.folder'
                }
            });
            return { id: response.result.id, name: 'WebP-Converted' };
        } catch (error) {
            console.error('폴더 생성 실패:', error);
            throw error;
        }
    }

    initializeProgress() {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';
        
        this.completedCount = 0;
        this.failedCount = 0;
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between p-3 bg-white rounded border';
            fileItem.id = `file-${index}`;
            fileItem.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-file-image text-blue-500 mr-3"></i>
                    <span class="font-medium">${file.name}</span>
                </div>
                <div class="flex items-center">
                    <span class="text-sm text-gray-500 mr-3" id="file-status-${index}">대기 중</span>
                    <div class="w-6 h-6 border-2 border-gray-300 rounded-full" id="file-icon-${index}"></div>
                </div>
            `;
            fileList.appendChild(fileItem);
        });

        this.updateOverallProgress();
    }

    async processFiles() {
        const quality = parseInt(document.getElementById('quality-slider').value) / 100;
        const maxConcurrent = 5;
        const semaphore = new Array(maxConcurrent).fill(null);
        
        const processFile = async (file, index) => {
            await this.waitForSlot(semaphore);
            try {
                await this.convertAndUploadFile(file, index, quality);
                this.completedCount++;
            } catch (error) {
                console.error(`파일 처리 실패 (${file.name}):`, error);
                this.updateFileStatus(index, '실패', 'error');
                this.failedCount++;
            } finally {
                this.releaseSlot(semaphore);
                this.updateOverallProgress();
            }
        };

        await Promise.all(this.selectedFiles.map(processFile));
        this.showResults();
    }

    async waitForSlot(semaphore) {
        return new Promise(resolve => {
            const tryAcquire = () => {
                const index = semaphore.indexOf(null);
                if (index !== -1) {
                    semaphore[index] = true;
                    resolve();
                } else {
                    setTimeout(tryAcquire, 50);
                }
            };
            tryAcquire();
        });
    }

    releaseSlot(semaphore) {
        const index = semaphore.indexOf(true);
        if (index !== -1) {
            semaphore[index] = null;
        }
    }

    async convertAndUploadFile(file, index, quality) {
        const fileName = file.name;
        const fileId = file.id;
        
        try {
            console.log(`🚀 [${fileName}] 변환 프로세스 시작 (ID: ${fileId})`);
            
            // 1단계: 파일 다운로드
            console.log(`📥 [${fileName}] 1단계: Google Drive에서 다운로드 시작...`);
            this.updateFileStatus(index, '다운로드 중', 'loading');
            
            const startDownload = Date.now();
            const fileBlob = await this.downloadFile(fileId);
            const downloadTime = Date.now() - startDownload;
            
            if (!fileBlob || fileBlob.size === 0) {
                throw new Error('다운로드된 파일이 비어있습니다.');
            }
            
            console.log(`✅ [${fileName}] 1단계 성공: 다운로드 완료 (${fileBlob.size} bytes, ${downloadTime}ms)`);
            
            // 2단계: WebP 변환
            console.log(`🔄 [${fileName}] 2단계: WebP 변환 시작... (품질: ${quality})`);
            this.updateFileStatus(index, '변환 중 (합성 사이즈에 따라 30초 소요)', 'loading');
            
            const startConvert = Date.now();
            const webpBlob = await this.convertToWebP(fileBlob, quality);
            const convertTime = Date.now() - startConvert;
            
            if (!webpBlob || webpBlob.size === 0) {
                throw new Error('WebP 변환에 실패했습니다.');
            }
            
            const compressionRatio = ((fileBlob.size - webpBlob.size) / fileBlob.size * 100).toFixed(1);
            console.log(`✅ [${fileName}] 2단계 성공: WebP 변환 완료 (${webpBlob.size} bytes, ${convertTime}ms, ${compressionRatio}% 압축)`);
            
            // 3단계: Google Drive에 업로드
            const webpFileName = fileName.replace(/\.(jpg|jpeg)$/i, '.webp');
            console.log(`📤 [${fileName}] 3단계: Google Drive에 업로드 시작... (${webpFileName})`);
            this.updateFileStatus(index, `업로드 중 (${(webpBlob.size / 1024 / 1024).toFixed(2)}MB)`, 'loading');
            
            const startUpload = Date.now();
            await this.uploadFile(webpBlob, webpFileName, this.targetFolder.id);
            const uploadTime = Date.now() - startUpload;
            
            console.log(`✅ [${fileName}] 3단계 성공: 업로드 완료 (${uploadTime}ms)`);
            
            const totalTime = Date.now() - (startDownload);
            this.updateFileStatus(index, `완료 (${compressionRatio}% 압축, ${(totalTime/1000).toFixed(1)}초)`, 'success');
            console.log(`🎉 [${fileName}] 전체 프로세스 완료 (총 ${totalTime}ms)`);
            
        } catch (error) {
            console.error(`❌ [${fileName}] 변환 실패:`, {
                error: error.message,
                stack: error.stack,
                fileId: fileId,
                fileName: fileName
            });
            this.updateFileStatus(index, `실패: ${error.message}`, 'error');
            throw error;
        }
    }

    async downloadFile(fileId) {
        try {
            const token = gapi.client.getToken();
            if (!token || !token.access_token) {
                throw new Error('인증 토큰이 없습니다.');
            }
            
            // 토큰 디버깅 정보 (간소화)
            console.log('🔑 다운로드용 토큰 검증:', {
                hasToken: !!token,
                hasAccessToken: !!token.access_token,
                hasDriveAccess: token.scope?.includes('auth/drive') || false
            });
            
            // 먼저 gapi.client 방식 시도
            try {
                console.log('gapi.client 방식으로 파일 다운로드 시도...');
                const response = await gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                
                if (response.body) {
                    // base64 디코딩
                    const byteCharacters = atob(response.body);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/jpeg' });
                    
                    console.log(`gapi.client로 파일 다운로드 성공: ${blob.size} bytes`);
                    return blob;
                }
            } catch (gapiError) {
                console.log('gapi.client 방식 실패, fetch 방식 시도...', gapiError);
            }
            
            // gapi 실패 시 fetch 방식으로 폴백
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token.access_token}`,
                    'Accept': 'image/jpeg, image/jpg, */*'
                }
            });
            
            if (!response.ok) {
                console.error('Download response:', response.status, response.statusText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            
            if (!blob || blob.size === 0) {
                throw new Error('빈 파일이 다운로드되었습니다.');
            }
            
            console.log(`파일 다운로드 성공: ${blob.size} bytes`);
            return blob;
        } catch (error) {
            console.error('File download failed:', error);
            if (error.message.includes('403')) {
                throw new Error('파일 접근 권한이 없습니다. Google Drive에서 파일을 공유했는지 확인해주세요.');
            } else if (error.message.includes('404')) {
                throw new Error('파일을 찾을 수 없습니다. 파일이 삭제되었거나 이동되었을 수 있습니다.');
            } else if (error.message.includes('401')) {
                throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
            } else {
                throw new Error('파일 다운로드에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
            }
        }
    }


    async convertToWebP(blob, quality) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            let objectUrl = null;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            };
            
            try {
                const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
                console.log('🔄 WebP 변환 시작:', {
                    원본파일크기: `${fileSizeMB}MB`,
                    품질설정: `${(quality * 100).toFixed(0)}% (${quality})`,
                    예상시간: fileSizeMB > 10 ? '20-30초' : fileSizeMB > 5 ? '10-20초' : '5-10초'
                });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                // 시간초과 설정 (30초 연장)
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error('이미지 변환 시간 초과 (30초)'));
                }, 30000);
                
                img.onload = () => {
                    try {
                        const megapixels = (img.width * img.height / 1000000).toFixed(1);
                        console.log('🖼️ 이미지 로드 완룼:', {
                            크기: `${img.width}x${img.height}`,
                            메가픽셀: `${megapixels}MP`
                        });
                        
                        // 대형 이미지 최적화: 4K 이상일 경우 리사이즈
                        let targetWidth = img.width;
                        let targetHeight = img.height;
                        const maxDimension = 3840; // 4K 해상도
                        
                        if (Math.max(targetWidth, targetHeight) > maxDimension) {
                            const ratio = maxDimension / Math.max(targetWidth, targetHeight);
                            targetWidth = Math.floor(targetWidth * ratio);
                            targetHeight = Math.floor(targetHeight * ratio);
                            console.log('🔍 대형 이미지 리사이즈:', `${targetWidth}x${targetHeight}`);
                        }
                        
                        canvas.width = targetWidth;
                        canvas.height = targetHeight;
                        
                        // 이미지 그리기 (최고품질 설정)
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        
                        // 고해상도를 위한 픽셀 비율 적용
                        const pixelRatio = window.devicePixelRatio || 1;
                        if (pixelRatio > 1 && targetWidth * targetHeight < 4000000) { // 4MP 이하에서만 적용
                            const scaledWidth = targetWidth * pixelRatio;
                            const scaledHeight = targetHeight * pixelRatio;
                            canvas.width = scaledWidth;
                            canvas.height = scaledHeight;
                            canvas.style.width = targetWidth + 'px';
                            canvas.style.height = targetHeight + 'px';
                            ctx.scale(pixelRatio, pixelRatio);
                            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                        } else {
                            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                        }
                        
                        console.log('🎨 Canvas에 이미지 그리기 완료');
                        
                        // WebP 변환
                        canvas.toBlob((webpBlob) => {
                            cleanup();
                            if (webpBlob && webpBlob.size > 0) {
                                const compressionRatio = ((blob.size - webpBlob.size) / blob.size * 100).toFixed(1);
                                console.log('✅ WebP 변환 성공:', {
                                    원본크기: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
                                    변환크기: `${(webpBlob.size / 1024 / 1024).toFixed(2)}MB`,
                                    압축률: `${compressionRatio}%`,
                                    품질: `${(quality * 100).toFixed(0)}%`
                                });
                                resolve(webpBlob);
                            } else {
                                reject(new Error('WebP 변환 결과가 비어있습니다.'));
                            }
                        }, 'image/webp', quality);
                        
                    } catch (drawError) {
                        cleanup();
                        reject(new Error('이미지 처리 실패: ' + drawError.message));
                    }
                };
                
                img.onerror = (errorEvent) => {
                    cleanup();
                    console.error('❌ 이미지 로드 실패:', errorEvent);
                    reject(new Error('이미지 로드에 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.'));
                };
                
                objectUrl = URL.createObjectURL(blob);
                img.src = objectUrl;
                
            } catch (error) {
                cleanup();
                reject(new Error('WebP 변환 초기화 실패: ' + error.message));
            }
        });
    }

    async uploadFile(blob, fileName, folderId) {
        try {
            console.log(`📤 업로드 시작: ${fileName} (${blob.size} bytes) → 폴더 ID: ${folderId}`);
            
            if (!blob || blob.size === 0) {
                throw new Error('업로드할 파일 데이터가 없습니다.');
            }
            
            const metadata = {
                name: fileName,
                parents: [folderId]
            };
            console.log('📝 업로드 메타데이터:', metadata);

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);
            console.log('📦 FormData 생성 완료');

            if (!this.isAuthenticated) {
                throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
            }
            
            const token = gapi.client.getToken();
            if (!token || !token.access_token) {
                throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
            }

            const accessToken = token.access_token;
            console.log('🌐 Google Drive Upload API 호출 중...');
            
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': `Bearer ${accessToken}`
                }),
                body: form
            });

            console.log(`📡 업로드 응답 상태: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('❌ 업로드 실패 응답:', errorData);
                const errorMessage = errorData?.error?.message || `업로드 실패 (${response.status}: ${response.statusText})`;
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('✅ 업로드 성공 응답:', result);
            return result;
        } catch (error) {
            console.error('Upload failed:', error);
            throw new Error('파일 업로드에 실패했습니다: ' + error.message);
        }
    }

    updateFileStatus(index, status, type) {
        const statusElement = document.getElementById(`file-status-${index}`);
        const iconElement = document.getElementById(`file-icon-${index}`);
        
        statusElement.textContent = status;
        
        switch (type) {
            case 'loading':
                iconElement.className = 'w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin';
                break;
            case 'success':
                iconElement.className = 'w-6 h-6 bg-green-500 rounded-full flex items-center justify-center';
                iconElement.innerHTML = '<i class="fas fa-check text-white text-xs"></i>';
                break;
            case 'error':
                iconElement.className = 'w-6 h-6 bg-red-500 rounded-full flex items-center justify-center';
                iconElement.innerHTML = '<i class="fas fa-times text-white text-xs"></i>';
                statusElement.className = 'text-sm text-red-500 mr-3';
                break;
            default:
                iconElement.className = 'w-6 h-6 border-2 border-gray-300 rounded-full';
        }
    }

    updateOverallProgress() {
        const total = this.selectedFiles.length;
        const completed = this.completedCount + this.failedCount;
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        
        document.getElementById('overall-progress-bar').style.width = `${percentage}%`;
        document.getElementById('overall-progress-text').textContent = `${completed}/${total} 완료`;
    }

    showResults() {
        const resultsSection = document.getElementById('results-section');
        const resultsSummary = document.getElementById('results-summary');
        
        const total = this.selectedFiles.length;
        const success = this.completedCount;
        const failed = this.failedCount;
        
        resultsSection.classList.remove('hidden');
        
        if (failed === 0) {
            resultsSection.className = 'mt-6 p-6 rounded-lg bg-green-50 border border-green-200';
            resultsSummary.innerHTML = `
                <div class="text-green-800">
                    <i class="fas fa-check-circle text-green-600 mr-2"></i>
                    모든 파일이 성공적으로 변환되었습니다!
                </div>
                <div class="text-sm text-green-700 mt-2">
                    총 ${total}개 파일이 WebP 형식으로 변환되어 Google Drive에 저장되었습니다.
                </div>
            `;
        } else {
            resultsSection.className = 'mt-6 p-6 rounded-lg bg-yellow-50 border border-yellow-200';
            resultsSummary.innerHTML = `
                <div class="text-yellow-800">
                    <i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                    변환이 완료되었습니다.
                </div>
                <div class="text-sm text-yellow-700 mt-2">
                    성공: ${success}개 | 실패: ${failed}개 | 총 ${total}개
                </div>
            `;
        }
    }

    resetApp() {
        this.resetData();
        document.getElementById('file-selection').classList.remove('hidden');
        document.getElementById('progress-section').classList.add('hidden');
        this.updateFileSelectionUI();
    }

    showLoadingMessage(message) {
        this.removeExistingMessages();
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-message';
        loadingDiv.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded shadow-lg z-50';
        loadingDiv.innerHTML = `
            <div class="flex items-center">
                <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(loadingDiv);
    }

    hideLoadingMessage() {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
    }

    showSuccessMessage(message) {
        this.removeExistingMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg z-50';
        successDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas fa-check-circle text-green-600 mr-3"></i>
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-green-600 hover:text-green-800">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(successDiv);
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 5000);
    }

    showErrorMessage(message) {
        this.removeExistingMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 max-w-md';
        errorDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-red-600 mr-3"></i>
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-red-600 hover:text-red-800 flex-shrink-0">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    removeExistingMessages() {
        const existingMessages = document.querySelectorAll('[class*="fixed top-4 right-4"]');
        existingMessages.forEach(msg => msg.remove());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        window.converter = new DriveWebPConverter();
    } catch (error) {
        console.error('Failed to initialize converter:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-triangle text-red-600 mr-3"></i>
                <span>애플리케이션 초기화에 실패했습니다. config.js 파일을 확인해주세요.</span>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});