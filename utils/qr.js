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
                size: options.width || 200,
                value: data,
                background: options.colorLight || '#ffffff',
                foreground: options.colorDark || '#000000',
                level: 'M' // Error correction level
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
            width: options.width || 200,
            height: options.height || 200,
            colorLight: options.colorLight || '#ffffff',
            colorDark: options.colorDark || '#000000'
        });
    }
    
    // Generate QR for Solana wallet address (for payments)
    static generateWalletQR(canvasId, walletAddress, options = {}) {
        // Create Solana URI for wallet apps to recognize
        const solanaUri = `solana:${walletAddress}`;
        this.generateQR(canvasId, solanaUri, {
            width: options.width || 150,
            height: options.height || 150,
            colorLight: options.colorLight || '#ffffff',
            colorDark: options.colorDark || '#000000'
        });
    }
    
    // Generate QR for Solana payment with specific amount
    static generateTipQR(canvasId, walletAddress, amount = null, options = {}) {
        let solanaUri = `solana:${walletAddress}`;
        
        if (amount) {
            solanaUri += `?amount=${amount}`;
        }
        
        this.generateQR(canvasId, solanaUri, {
            width: options.width || 200,
            height: options.height || 200,
            colorLight: options.colorLight || '#ffffff',
            colorDark: options.colorDark || '#000000'
        });
    }
    
    static downloadQR(canvasId, filename = 'qrcode.png') {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return;
        }
        
        try {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL();
            link.click();
        } catch (error) {
            console.error('QR Code download failed:', error);
        }
    }
    
    static getQRDataUrl(canvasId) {
        const canvas = document.getElementById(canvasId);
        
        if (!canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }
        
        try {
            return canvas.toDataURL();
        } catch (error) {
            console.error('Failed to get QR data URL:', error);
            return null;
        }
    }
}
