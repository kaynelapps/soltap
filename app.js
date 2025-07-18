// Solana Tip Tap - Main Application
class SolanaTipTap {
    constructor() {
        this.wallet = null;
        this.connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com');
        this.setupFeeWallet = 'B7zzqLYVNm2urtdoX9NMxfhj6CwaQzjSnnVZE4rCWgfU';
        this.currentTipJar = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.startCountdown();
        this.checkForTipJarPage();
        this.updateSocialProof();
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        
        // Tip jar creation
        document.getElementById('createDefault').addEventListener('click', () => this.createTipJar('default'));
        document.getElementById('createCustom').addEventListener('click', () => this.showCustomNameInput());
        
        // Custom name handling
        document.getElementById('confirmCustom').addEventListener('click', () => this.createTipJar('custom'));
        document.getElementById('cancelCustom').addEventListener('click', () => this.hideCustomNameInput());
        
        // Tip jar actions
        document.getElementById('copyUrl').addEventListener('click', () => this.copyToClipboard('tipJarUrl'));
        document.getElementById('shareTwitter').addEventListener('click', () => this.shareOnTwitter());
        document.getElementById('createAnother').addEventListener('click', () => this.resetToHome());
        
        // Custom name input validation
        document.getElementById('customName').addEventListener('input', (e) => this.validateCustomName(e.target.value));
        
        // Tip jar page actions (if on tip jar page)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tip-btn')) {
                const amount = parseFloat(e.target.dataset.amount);
                this.processTip(amount);
            }
        });
    }

    async connectWallet() {
        try {
            if (window.solana && window.solana.isPhantom) {
                const response = await window.solana.connect();
                this.wallet = response.publicKey.toString();
                
                document.getElementById('connectWallet').textContent = `${this.wallet.slice(0, 4)}...${this.wallet.slice(-4)}`;
                document.getElementById('connectWallet').classList.add('bg-green-600');
                
                this.showNotification('Wallet connected! Ready to create your tip jar! 🎉', 'success');
            } else {
                this.showNotification('Please install Phantom wallet', 'error');
                window.open('https://phantom.app/', '_blank');
            }
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.showNotification('Failed to connect wallet', 'error');
        }
    }

    showCustomNameInput() {
        document.getElementById('customNameSection').classList.remove('hidden');
        document.getElementById('heroSection').style.opacity = '0.5';
        document.getElementById('customName').focus();
    }

    hideCustomNameInput() {
        document.getElementById('customNameSection').classList.add('hidden');
        document.getElementById('heroSection').style.opacity = '1';
    }

    validateCustomName(name) {
        const isValid = /^[a-zA-Z0-9]{3,20}$/.test(name);
        const confirmBtn = document.getElementById('confirmCustom');
        
        if (isValid && !this.isReservedName(name)) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50');
            return true;
        } else {
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50');
            return false;
        }
    }

    isReservedName(name) {
        const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'blog', 'help', 'support', 'terms', 'privacy'];
        return reserved.includes(name.toLowerCase());
    }

    async createTipJar(type) {
        if (!this.wallet) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        try {
            // Updated fee structure - FREE for default!
            const fee = type === 'default' ? 0 : 0.005;
            const customName = type === 'custom' ? document.getElementById('customName').value : null;
            
            // Validate custom name if provided
            if (type === 'custom' && (!customName || !this.validateCustomName(customName))) {
                this.showNotification('Please enter a valid custom name', 'error');
                return;
            }

            // Check if custom name already exists
            if (type === 'custom' && StorageManager.getTipJar(customName)) {
                this.showNotification('This name is already taken', 'error');
                return;
            }

            // Only process payment for custom tip jars
            if (fee > 0) {
                this.showNotification('Processing payment...', 'info');
                await this.processPayment(fee);
            } else {
                this.showNotification('Creating your free tip jar...', 'info');
            }

            // Generate tip jar
            const tipJarId = type === 'default' ? this.generateRandomId() : customName;
            const tipJarData = {
                id: tipJarId,
                wallet: this.wallet,
                type: type,
                created: Date.now(),
                tips: 0,
                totalAmount: 0,
                plan: type === 'default' ? 'free' : 'premium'
            };

            // Save tip jar locally
            StorageManager.saveTipJar(tipJarId, tipJarData);
            
            // Show success with universal URL
            this.showTipJarSuccess(tipJarId, tipJarData);
            
        } catch (error) {
            console.error('Failed to create tip jar:', error);
            this.showNotification('Failed to create tip jar. Please try again.', 'error');
        }
    }

    async processPayment(amount) {
        try {
            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: new solanaWeb3.PublicKey(this.wallet),
                    toPubkey: new solanaWeb3.PublicKey(this.setupFeeWallet),
                    lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
                })
            );

            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new solanaWeb3.PublicKey(this.wallet);

            const signedTransaction = await window.solana.signTransaction(transaction);
            const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
            
            await this.connection.confirmTransaction(signature);
            
            this.showNotification(`Payment of ${amount} SOL successful!`, 'success');
            
        } catch (error) {
            console.error('Payment failed:', error);
            throw new Error('Payment failed');
        }
    }

    generateRandomId() {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    showTipJarSuccess(tipJarId, tipJarData) {
        // If tipJarData not provided, get it from storage
        if (!tipJarData) {
            tipJarData = StorageManager.getTipJar(tipJarId);
        }
        
        if (!tipJarData) {
            this.showNotification('Error: Tip jar data not found', 'error');
            return;
        }
        
        // Hide other sections
        document.getElementById('heroSection').classList.add('hidden');
        document.getElementById('customNameSection').classList.add('hidden');
        document.getElementById('featuresSection').classList.add('hidden');
        
        // Show tip jar section
        document.getElementById('tipJarSection').classList.remove('hidden');
        
        // Create universal URL that works on any device/browser
        const tipJarUrl = `${window.location.origin}/?id=${tipJarId}&wallet=${encodeURIComponent(tipJarData.wallet)}&type=${tipJarData.type}&created=${tipJarData.created}`;
        
        document.getElementById('tipJarUrl').textContent = tipJarUrl;
        
        // Generate QR code for sharing the tip jar URL
        QRManager.generateUrlQR('qrcode', tipJarUrl);
        
        this.currentTipJar = tipJarId;
        
        // Show success message
        const planType = tipJarData.plan === 'premium' ? 'Premium' : 'Free';
        this.showNotification(`${planType} tip jar created successfully! Works on any device! 🌍`, 'success');
    }

    async processTip(amount) {
        if (!this.currentTipJar) return;
        
        try {
            const tipJarData = StorageManager.getTipJar(this.currentTipJar);
            if (!tipJarData) {
                this.showNotification('Tip jar not found', 'error');
                return;
            }

            if (!this.wallet) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            this.showNotification('Processing tip...', 'info');

            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: new solanaWeb3.PublicKey(this.wallet),
                    toPubkey: new solanaWeb3.PublicKey(tipJarData.wallet),
                    lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
                })
            );

            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new solanaWeb3.PublicKey(this.wallet);

            const signedTransaction = await window.solana.signTransaction(transaction);
            const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
            
            await this.connection.confirmTransaction(signature);
            
            // Update tip counter
            tipJarData.tips += 1;
            tipJarData.totalAmount += amount;
            StorageManager.saveTipJar(this.currentTipJar, tipJarData);
            
            this.updateTipCounter(tipJarData.tips, tipJarData.totalAmount);
            this.showNotification(`Thanks for tipping ${amount} SOL! 🎉`, 'success');
            
        } catch (error) {
            console.error('Tip failed:', error);
            this.showNotification('Tip failed. Please try again.', 'error');
        }
    }

    updateTipCounter(tips, totalAmount) {
        const tipCountEl = document.getElementById('tipCount');
        const tipAmountEl = document.getElementById('tipAmount');
        
        if (tipCountEl) tipCountEl.textContent = `${tips} tips`;
        if (tipAmountEl) tipAmountEl.textContent = `${totalAmount.toFixed(4)} SOL received`;
    }

    checkForTipJarPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const tipJarId = urlParams.get('id');
        
        if (tipJarId) {
            this.loadTipJarPage(tipJarId);
        }
    }

    loadTipJarPage(tipJarId) {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Try localStorage first (for creator's browser)
        let tipJarData = StorageManager.getTipJar(tipJarId);
        
        // If not found locally, get from URL parameters (universal access)
        if (!tipJarData) {
            const walletFromUrl = urlParams.get('wallet');
            const typeFromUrl = urlParams.get('type') || 'default';
            const createdFromUrl = urlParams.get('created') || Date.now();
            
            if (walletFromUrl) {
                tipJarData = {
                    id: tipJarId,
                    wallet: decodeURIComponent(walletFromUrl),
                    type: typeFromUrl,
                    created: parseInt(createdFromUrl),
                    tips: 0,
                    totalAmount: 0,
                    plan: typeFromUrl === 'default' ? 'free' : 'premium'
                };
                
                // Save locally for faster future access
                StorageManager.saveTipJar(tipJarId, tipJarData);
            }
        }

        if (!tipJarData) {
            this.showNotification('Tip jar not found. Please check the URL.', 'error');
            return;
        }

        // Hide main content and show tip jar page
        document.querySelector('main').innerHTML = document.getElementById('tipJarPageTemplate').innerHTML;
        
        // Set wallet address
        document.getElementById('walletAddress').textContent = 
            `${tipJarData.wallet.slice(0, 8)}...${tipJarData.wallet.slice(-8)}`;
        
        // Generate wallet QR code for payments
        QRManager.generateWalletQR('walletQR', tipJarData.wallet);
        
        // Update tip counter
        this.updateTipCounter(tipJarData.tips || 0, tipJarData.totalAmount || 0);
        
        // Set up copy wallet functionality
        document.getElementById('copyWallet').addEventListener('click', () => {
            navigator.clipboard.writeText(tipJarData.wallet).then(() => {
                this.showNotification('Wallet address copied!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy wallet address', 'error');
            });
        });
        
        // Set up share functionality
        document.getElementById('shareTipJar').addEventListener('click', () => {
            this.shareOnTwitter(tipJarId);
        });
        
        this.currentTipJar = tipJarId;
        
        // Update page title
        document.title = `Tip Jar - ${tipJarId} | Solana Tip Tap`;
    }

    copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        const text = element.textContent;
        
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied to clipboard!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy', 'error');
        });
    }

    shareOnTwitter(tipJarId = null) {
        let url, text;
        
        if (tipJarId) {
            // Get tip jar data to create universal URL
            const tipJarData = StorageManager.getTipJar(tipJarId);
            if (tipJarData) {
                url = `${window.location.origin}/?id=${tipJarId}&wallet=${encodeURIComponent(tipJarData.wallet)}&type=${tipJarData.type}&created=${tipJarData.created}`;
                text = `Send me SOL tips easily! 💜 ${url} #SolanaTipTap #Solana #Crypto`;
            } else {
                              url = `${window.location.origin}/?id=${tipJarId}`;
                text = `Send me SOL tips easily! 💜 ${url} #SolanaTipTap #Solana #Crypto`;
            }
        } else {
            url = document.getElementById('tipJarUrl').textContent;
            text = `Just created my SOL tip jar! 🚀 ${url} #SolanaTipTap #Solana #Crypto`;
        }
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank');
    }

    resetToHome() {
        window.location.href = window.location.origin;
    }

    startCountdown() {
        const endTime = new Date().getTime() + (48 * 60 * 60 * 1000); // 48 hours from now
        
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;
            
            if (distance < 0) {
                clearInterval(timer);
                document.getElementById('fomoTimer').style.display = 'none';
                return;
            }
            
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            document.getElementById('countdown').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    updateSocialProof() {
        // Simulate growing user count
        const baseCount = 100;
        const randomAdd = Math.floor(Math.random() * 50);
        const totalUsers = baseCount + randomAdd;
        
        const socialProofElement = document.querySelector('.text-solana-green');
        if (socialProofElement) {
            socialProofElement.textContent = `🚀 Join ${totalUsers}+ creators getting tipped!`;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 transition-all duration-300 transform translate-x-full`;
        
        // Set colors based on type
        switch (type) {
            case 'success':
                notification.className += ' bg-green-600 text-white';
                break;
            case 'error':
                notification.className += ' bg-red-600 text-white';
                break;
            case 'info':
                notification.className += ' bg-blue-600 text-white';
                break;
            case 'warning':
                notification.className += ' bg-yellow-600 text-black';
                break;
            default:
                notification.className += ' bg-gray-600 text-white';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Error handling for wallet disconnection
    handleWalletDisconnect() {
        this.wallet = null;
        const connectButton = document.getElementById('connectWallet');
        if (connectButton) {
            connectButton.textContent = 'Connect Wallet';
            connectButton.classList.remove('bg-green-600');
            connectButton.classList.add('bg-solana-purple');
        }
        this.showNotification('Wallet disconnected', 'warning');
    }

    // Validate URL parameters
    validateUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const tipJarId = urlParams.get('id');
        const wallet = urlParams.get('wallet');
        
        if (tipJarId && !wallet) {
            // Check if tip jar exists in localStorage
            const tipJarData = StorageManager.getTipJar(tipJarId);
            if (!tipJarData) {
                this.showNotification('Invalid tip jar URL. Missing wallet parameter.', 'error');
                return false;
            }
        }
        
        return true;
    }

    // Get current tip jar data
    getCurrentTipJarData() {
        if (this.currentTipJar) {
            return StorageManager.getTipJar(this.currentTipJar);
        }
        return null;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for wallet events
    if (window.solana) {
        window.solana.on('connect', () => {
            console.log('Wallet connected');
        });
        
        window.solana.on('disconnect', () => {
            console.log('Wallet disconnected');
            if (window.solanaTipTap) {
                window.solanaTipTap.handleWalletDisconnect();
            }
        });
    }
    
    // Initialize the app
    window.solanaTipTap = new SolanaTipTap();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.solanaTipTap) {
        // Refresh social proof when page becomes visible
        window.solanaTipTap.updateSocialProof();
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.solanaTipTap) {
        window.solanaTipTap.showNotification('An unexpected error occurred', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.solanaTipTap) {
        window.solanaTipTap.showNotification('Transaction failed or was cancelled', 'error');
    }
});

// Console welcome message
console.log(`
🚀 Solana Tip Tap
💜 Create your Solana tip jar in seconds!
⚡ Powered by Solana blockchain
`);

