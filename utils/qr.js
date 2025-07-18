// QR Code Management for Solana Tip Tap (Using QRious library)
class QRManager {
    static generateQR(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return;
        }
        
        // Check if QRious library is loaded
        if (typeof QRious === 'undefined') {
            console.error('QRious library not loaded. Make sure to include qrious.min.js');
            this.showFallback(canvas, 'QR Library\nNot Loaded');
            return;
        }
        
        try {
            // Clear any existing content
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const qr = new QRious({
                element: canvas,
                size: options.size || 200,
                value: data,
                background: options.background || options.colorLight || '#ffffff',
                foreground: options.foreground || options.colorDark || '#000000',
                level: options.level || 'M' // Error correction level
            });
            
            console.log('QR Code generated successfully for:', canvasId);
            
        } catch (error) {
            console.error('QR Code generation error:', error);
            this.showFallback(canvas, 'QR Generation\nFailed');
        }
    }
    
    static showFallback(canvas, text) {
        const ctx = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        
        // Draw background
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, size, size);
        
        // Draw border
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size-2, size-2);
        
        // Draw text
        ctx.fillStyle = '#374151';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lines = text.split('\n');
        lines.forEach((line, index) => {
            ctx.fillText(line, size/2, size/2 + (index - lines.length/2 + 0.5) * 20);
        });
    }
    
    // Generate QR for tip jar URL (for sharing)
    static generateUrlQR(canvasId, url, options = {}) {
        this.generateQR(canvasId, url, {
            size: options.size || options.width || 200,
            background: options.background || options.colorLight || '#ffffff',
            foreground: options.foreground || options.colorDark || '#000000',
            level: options.level || 'M'
        });
    }
    
    // Generate QR for Solana wallet address (for payments)
    static generateWalletQR(canvasId, walletAddress, options = {}) {
        // Create Solana URI for wallet apps to recognize
        const solanaUri = `solana:${walletAddress}`;
        this.generateQR(canvasId, solanaUri, {
            size: options.size || options.width || 150,
            background: options.background || options.colorLight || '#ffffff',
            foreground: options.foreground || options.colorDark || '#000000',
            level: options.level || 'M'
        });
    }
    
    // Generate QR for Solana payment with specific amount
    static generateTipQR(canvasId, walletAddress, amount = null, options = {}) {
        let solanaUri = `solana:${walletAddress}`;
        
        if (amount) {
            solanaUri += `?amount=${amount}`;
        }
        
        this.generateQR(canvasId, solanaUri, {
            size: options.size || options.width || 200,
            background: options.background || options.colorLight || '#ffffff',
            foreground: options.foreground || options.colorDark || '#000000',
            level: options.level || 'M'
        });
    }
    
    // Generate QR with custom styling for premium tip jars
    static generatePremiumQR(canvasId, data, options = {}) {
        this.generateQR(canvasId, data, {
            size: options.size || 250,
            background: options.background || '#ffffff',
            foreground: options.foreground || '#9945FF', // Solana purple
            level: options.level || 'H' // Higher error correction for premium
        });
    }
    
    // Generate QR with Solana branding colors
    static generateSolanaQR(canvasId, data, options = {}) {
        this.generateQR(canvasId, data, {
            size: options.size || 200,
            background: options.background || '#ffffff',
            foreground: options.foreground || '#9945FF', // Solana purple
            level: options.level || 'M'
        });
    }
    
    // Download QR code as PNG
    static downloadQR(canvasId, filename = 'qrcode.png') {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return;
        }
        
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            console.log('QR Code downloaded:', filename);
        } catch (error) {
            console.error('QR Code download failed:', error);
        }
    }
    
    // Get QR code as data URL
    static getQRDataUrl(canvasId, format = 'image/png') {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }
        
        try {
            return canvas.toDataURL(format);
        } catch (error) {
            console.error('Failed to get QR data URL:', error);
            return null;
        }
    }
    
    // Copy QR code to clipboard as image
    static async copyQRToClipboard(canvasId) {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return false;
        }
        
        try {
            // Convert canvas to blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
            
            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            
            console.log('QR Code copied to clipboard');
            return true;
        } catch (error) {
            console.error('Failed to copy QR code to clipboard:', error);
            return false;
        }
    }
    
    // Generate QR with error handling and retry
    static generateQRWithRetry(canvasId, data, options = {}, maxRetries = 3) {
        let attempts = 0;
        
        const tryGenerate = () => {
            attempts++;
            
            try {
                this.generateQR(canvasId, data, options);
                return true;
            } catch (error) {
                console.error(`QR generation attempt ${attempts} failed:`, error);
                
                if (attempts < maxRetries) {
                    setTimeout(tryGenerate, 1000 * attempts); // Exponential backoff
                } else {
                    const canvas = document.getElementById(canvasId);
                    if (canvas) {
                        this.showFallback(canvas, 'QR Generation\nFailed After\nRetries');
                    }
                }
                return false;
            }
        };
        
        return tryGenerate();
    }
    
    // Validate QR data before generation
    static validateQRData(data) {
        if (!data || typeof data !== 'string') {
            return { valid: false, error: 'Data must be a non-empty string' };
        }
        
        if (data.length > 2953) { // QR code capacity limit for alphanumeric
            return { valid: false, error: 'Data too long for QR code' };
        }
        
        return { valid: true };
    }
    
    // Generate QR with validation
    static generateValidatedQR(canvasId, data, options = {}) {
        const validation = this.validateQRData(data);
        
        if (!validation.valid) {
            console.error('QR validation failed:', validation.error);
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                this.showFallback(canvas, 'Invalid QR Data\n' + validation.error);
            }
            return false;
        }
        
        return this.generateQR(canvasId, data, options);
    }
    
    // Batch generate multiple QR codes
    static generateBatchQR(qrConfigs) {
        const results = [];
        
        qrConfigs.forEach((config, index) => {
            try {
                this.generateQR(config.canvasId, config.data, config.options || {});
                results.push({ index, success: true, canvasId: config.canvasId });
            } catch (error) {
                console.error(`Batch QR generation failed for index ${index}:`, error);
                results.push({ index, success: false, error: error.message, canvasId: config.canvasId });
            }
        });
        
        return results;
    }
    
    // Get QR code info
    static getQRInfo(canvasId) {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            return null;
        }
        
        return {
            canvasId: canvasId,
            width: canvas.width,
            height: canvas.height,
            hasContent: canvas.width > 0 && canvas.height > 0,
            dataUrl: this.getQRDataUrl(canvasId)
        };
    }
    
    // Clear QR code canvas
    static clearQR(canvasId) {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        console.log('QR Code cleared for:', canvasId);
    }
    
    // Check if QRious library is available
    static isQRiousAvailable() {
        return typeof QRious !== 'undefined';
    }
    
    // Initialize QR manager (call this on page load)
    static init() {
        if (!this.isQRiousAvailable()) {
            console.warn('QRious library not found. QR code generation will not work.');
            return false;
        }
        
        console.log('QR Manager initialized with QRious library');
        return true;
    }
}

// Auto-initialize when script loads
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        QRManager.init();
    });
}

// Export for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRManager;
}
