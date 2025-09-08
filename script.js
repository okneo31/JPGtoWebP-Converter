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
            console.log('Google API 초기화 시작');
            
            // gapi가 로드될 때까지 대기
            if (typeof gapi === 'undefined') {
                throw new Error('gapi가 로드되지 않았습니다.');
            }
            
            // gapi 초기화
            await new Promise((resolve, reject) => {
                gapi.load('client:picker', {
                    callback: () => {
                        console.log('gapi client와 picker 로드됨');
                        resolve();
                    },
                    onerror: (error) => {
                        console.error('gapi 로드 실패:', error);
                        reject(error);
                    }
                });
            });
            
            // Google API Client 초기화
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: this.DISCOVERY_DOCS
            });
            console.log('gapi client 초기화 완료');
            
            // Google Identity Services가 로드될 때까지 대기
            if (typeof google === 'undefined' || !google.accounts) {
                throw new Error('Google Identity Services가 로드되지 않았습니다.');
            }
            
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
                    console.log('Google 인증 성공');
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
            
            // 기존 토큰이 있는지 확인
            if (gapi.client.getToken() !== null) {
                this.isAuthenticated = true;
                this.hideLoadingMessage();
                this.updateUI();
                this.showSuccessMessage('이미 로그인되어 있습니다!');
                return;
            }
            
            // 새로운 토큰 요청
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

            const profile = this.currentUser.getBasicProfile();
            document.getElementById('user-name').textContent = profile.getName();
            document.getElementById('user-email').textContent = profile.getEmail();
            document.getElementById('user-avatar').src = profile.getImageUrl();
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
            
            return new Promise((resolve) => {
                const picker = new google.picker.PickerBuilder()
                    .addView(new google.picker.DocsView(google.picker.ViewId.DOCS)
                        .setMimeTypes('image/jpeg')
                        .setSelectFolderEnabled(false))
                    .setOAuthToken(token.access_token)
                    .setDeveloperKey(this.API_KEY)
                    .setCallback((data) => {
                        if (data.action === google.picker.Action.PICKED) {
                            this.selectedFiles = data.docs.filter(doc => 
                                doc.mimeType === 'image/jpeg' && 
                                doc.sizeBytes <= 100 * 1024 * 1024 // 100MB 제한
                            ).slice(0, 30); // 최대 30개 파일
                            
                            if (this.selectedFiles.length !== data.docs.length) {
                                this.showErrorMessage('일부 파일이 제외되었습니다. (100MB 이하 JPG 파일만, 최대 30개)');
                            }
                            
                            this.updateFileSelectionUI();
                            this.showSuccessMessage(`${this.selectedFiles.length}개 파일이 선택되었습니다.`);
                        }
                        resolve();
                    })
                    .build();
                picker.setVisible(true);
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
            
            return new Promise((resolve) => {
                const picker = new google.picker.PickerBuilder()
                    .addView(new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                        .setSelectFolderEnabled(true))
                    .setOAuthToken(token.access_token)
                    .setDeveloperKey(this.API_KEY)
                    .setCallback((data) => {
                        if (data.action === google.picker.Action.PICKED) {
                            this.targetFolder = data.docs[0];
                            this.updateFileSelectionUI();
                            this.showSuccessMessage(`폴더 "${this.targetFolder.name}"이 선택되었습니다.`);
                        }
                        resolve();
                    })
                    .build();
                picker.setVisible(true);
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
        this.updateFileStatus(index, '다운로드 중', 'loading');

        const fileBlob = await this.downloadFile(file.id);
        
        this.updateFileStatus(index, '변환 중', 'loading');
        const webpBlob = await this.convertToWebP(fileBlob, quality);
        
        this.updateFileStatus(index, '업로드 중', 'loading');
        const webpFileName = file.name.replace(/\.(jpg|jpeg)$/i, '.webp');
        await this.uploadFile(webpBlob, webpFileName, this.targetFolder.id);
        
        this.updateFileStatus(index, '완료', 'success');
    }

    async downloadFile(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            if (!response.body) {
                throw new Error('파일 데이터를 받을 수 없습니다.');
            }
            
            return this.base64ToBlob(response.body);
        } catch (error) {
            console.error('File download failed:', error);
            if (error.status === 403) {
                throw new Error('파일 접근 권한이 없습니다.');
            } else if (error.status === 404) {
                throw new Error('파일을 찾을 수 없습니다.');
            } else {
                throw new Error('파일 다운로드에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
            }
        }
    }

    base64ToBlob(base64) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'image/jpeg' });
    }

    async convertToWebP(blob, quality) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(resolve, 'image/webp', quality);
            };
            
            img.src = URL.createObjectURL(blob);
        });
    }

    async uploadFile(blob, fileName, folderId) {
        try {
            if (!blob || blob.size === 0) {
                throw new Error('업로드할 파일 데이터가 없습니다.');
            }
            
            const metadata = {
                name: fileName,
                parents: [folderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            if (!this.isAuthenticated) {
                throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
            }
            
            const token = gapi.client.getToken();
            if (!token || !token.access_token) {
                throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
            }

            const accessToken = token.access_token;
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': `Bearer ${accessToken}`
                }),
                body: form
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage = errorData?.error?.message || `업로드 실패 (${response.status}: ${response.statusText})`;
                throw new Error(errorMessage);
            }

            return response.json();
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