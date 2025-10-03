// Global variables
let selectedFiles = [];
let detectionResults = [];

// Color mapping for different damage types
const damageColors = {
    0: 'rgb(255,0,0)',     // dent
    1: 'rgb(0,255,0)',     // scratch
    2: 'rgb(0,0,255)',     // crack
    3: 'rgb(255,255,0)',   // shattered_glass
    4: 'rgb(255,0,255)',   // broken_lamp
    5: 'rgb(0,255,255)'   // flat_tire
};

const damageNames = {
    0: 'รอยบุบ',
    1: 'รอยขีดข่วน',
    2: 'รอยแตก',
    3: 'กระจกแตก',
    4: 'ไฟเสีย',
    5: 'ยางแบน'
};

// DOM elements
const imageFiles = document.getElementById('imageFiles');
const detectBtn = document.getElementById('detectBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const selectedFilesDiv = document.getElementById('selectedFiles');
const filesList = document.getElementById('filesList');
const loadingText = document.getElementById('loadingText');
const progressFill = document.getElementById('progressFill');

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Handle file selection
    imageFiles.addEventListener('change', function() {
        selectedFiles = Array.from(this.files);
        updateFilesList();
        detectBtn.disabled = selectedFiles.length === 0;
        downloadPdfBtn.disabled = true;
        downloadZipBtn.disabled = true;
    });
});

function updateFilesList() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.style.display = 'none';
        return;
    }
    
    selectedFilesDiv.style.display = 'block';
    filesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span>📁 ${file.name}</span>
                <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button class="remove-file" onclick="removeFile(${index})">❌</button>
        `;
        filesList.appendChild(fileItem);
    });
    
    // Update file input to reflect current selection
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    imageFiles.files = dt.files;
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
    detectBtn.disabled = selectedFiles.length === 0;
    downloadPdfBtn.disabled = true;
    downloadZipBtn.disabled = true;
    
    // Update file input
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    imageFiles.files = dt.files;
}

function clearAllFiles() {
    selectedFiles = [];
    updateFilesList();
    detectBtn.disabled = true;
    downloadPdfBtn.disabled = true;
    downloadZipBtn.disabled = true;
    
    // Clear file input
    imageFiles.value = '';
    
    // Hide results if any
    results.style.display = 'none';
    detectionResults = [];
}

async function detectDamage() {
    if (selectedFiles.length === 0) {
        alert('กรุณาเลือกไฟล์รูปภาพก่อน');
        return;
    }
    
    loading.style.display = 'block';
    results.style.display = 'none';
    detectBtn.disabled = true;
    downloadPdfBtn.disabled = true;
    downloadZipBtn.disabled = true;
    detectionResults = [];
    
    try {
        // Use batch processing for multiple files
        loadingText.textContent = `กำลังประมวลผล ${selectedFiles.length} ไฟล์...`;
        progressFill.style.width = '50%';
        
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });
        
        const response = await fetch('/detect-batch', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const batchResult = await response.json();
        progressFill.style.width = '90%';
        
        // Process results
        detectionResults = batchResult.results.map(result => ({
            filename: result.filename,
            originalUrl: `data:image/jpeg;base64,${result.original_image}`,
            detectedUrl: `data:image/jpeg;base64,${result.detected_image}`,
            detections: result.detections,
            fileSize: result.file_size
        }));
        
        displayResults();
        downloadPdfBtn.disabled = false;
        downloadZipBtn.disabled = false;
        
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการตรวจจับ: ' + error.message);
    } finally {
        loading.style.display = 'none';
        detectBtn.disabled = false;
        progressFill.style.width = '100%';
    }
}

function displayResults() {
    const imagesGrid = document.getElementById('imagesGrid');
    imagesGrid.innerHTML = '';
    
    let totalDetections = 0;
    let damagedImages = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    detectionResults.forEach(result => {
        if (result.detections.length > 0) {
            damagedImages++;
            totalDetections += result.detections.length;
            
            result.detections.forEach(det => {
                totalConfidence += det.confidence;
                confidenceCount++;
            });
        }
        
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        
        let detectionsHtml = '';
        if (result.detections.length > 0) {
            detectionsHtml = `
                <div class="detections-list">
                    <h4>🎯 ความเสียหายที่พบ (${result.detections.length} รายการ):</h4>
                    ${result.detections.map(det => `
                        <div class="detection-item" style="border-left-color: ${damageColors[det.class_id]}">
                            <span class="detection-name">${damageNames[det.class_id]}</span>
                            <span class="detection-confidence">${(det.confidence * 100).toFixed(1)}%</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            detectionsHtml = `
                <div class="detections-list">
                    <h4 style="color: #28a745;">✅ ไม่พบความเสียหาย</h4>
                </div>
            `;
        }
        
        imageCard.innerHTML = `
            <div class="image-header">
                <span class="image-title">📁 ${result.filename}</span>
                <span class="detection-count">${result.detections.length} ความเสียหาย</span>
            </div>
            <div class="image-comparison">
                <div class="image-section">
                    <h4>📷 รูปต้นฉบับ</h4>
                    <img src="${result.originalUrl}" alt="Original ${result.filename}">
                </div>
                <div class="image-section">
                    <h4>🎯 ผลการตรวจจับ</h4>
                    <img src="${result.detectedUrl}" alt="Detected ${result.filename}">
                </div>
            </div>
            ${detectionsHtml}
        `;
        
        imagesGrid.appendChild(imageCard);
    });
    
    // Update summary
    document.getElementById('totalImages').textContent = detectionResults.length;
    document.getElementById('totalDetections').textContent = totalDetections;
    document.getElementById('damagedImages').textContent = damagedImages;
    document.getElementById('averageConfidence').textContent = 
        confidenceCount > 0 ? `${(totalConfidence / confidenceCount * 100).toFixed(1)}%` : '0%';
    
    results.style.display = 'block';
}

async function downloadPDF() {
    if (detectionResults.length === 0) {
        alert('ไม่มีผลการตรวจจับสำหรับสร้างรายงาน');
        return;
    }
    
    try {
        downloadPdfBtn.disabled = true;
        loadingText.textContent = 'กำลังสร้างรายงาน PDF...';
        loading.style.display = 'block';
        
        const response = await fetch('/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                results: detectionResults.map(r => ({
                    filename: r.filename,
                    detections: r.detections,
                    fileSize: r.fileSize
                }))
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Vehicle_Damage_Detection_Report_${new Date().toISOString().slice(0,10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาดในการสร้างรายงาน: ' + error.message);
    } finally {
        loading.style.display = 'none';
        downloadPdfBtn.disabled = false;
    }
}

// Function to download all detected images as ZIP
async function downloadImagesZip() {
    if (detectionResults.length === 0) {
        alert('ไม่มีรูปภาพสำหรับดาวน์โหลด');
        return;
    }
    
    try {
        downloadZipBtn.disabled = true;
        loadingText.textContent = 'กำลังสร้างไฟล์ ZIP...';
        loading.style.display = 'block';
        
        // Use JSZip library to create ZIP file
        const JSZip = window.JSZip || await loadJSZip();
        const zip = new JSZip();
        
        // Add original images folder
        const originalFolder = zip.folder("original_images");
        const detectedFolder = zip.folder("detected_images");
        
        // Process each image
        for (let i = 0; i < detectionResults.length; i++) {
            const result = detectionResults[i];
            const filename = result.filename;
            const baseFilename = filename.split('.')[0];
            const extension = filename.split('.').pop();
            
            // Convert base64 to blob for original image
            const originalBase64 = result.originalUrl.split(',')[1];
            const originalBlob = base64ToBlob(originalBase64, 'image/jpeg');
            originalFolder.file(`${baseFilename}_original.${extension}`, originalBlob);
            
            // Convert base64 to blob for detected image
            const detectedBase64 = result.detectedUrl.split(',')[1];
            const detectedBlob = base64ToBlob(detectedBase64, 'image/jpeg');
            detectedFolder.file(`${baseFilename}_detected.${extension}`, detectedBlob);
            
            // Update progress
            const progress = ((i + 1) / detectionResults.length * 90);
            progressFill.style.width = `${progress}%`;
        }
        
        // Generate ZIP file
        loadingText.textContent = 'กำลังบีบอัดไฟล์...';
        const zipBlob = await zip.generateAsync({type: "blob"});
        
        // Download ZIP file
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Vehicle_Damage_Detection_Images_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP: ' + error.message);
    } finally {
        loading.style.display = 'none';
        downloadZipBtn.disabled = false;
        progressFill.style.width = '100%';
    }
}

// Helper function to convert base64 to blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: mimeType});
}

// Load JSZip library dynamically
async function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (window.JSZip) {
            resolve(window.JSZip);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}