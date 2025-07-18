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

    // Connect wallet with free tier messaging
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

    // Updated createTipJar with universal URL generation
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
            console.log('Saving tip jar:', tipJarData);
            const saved = StorageManager.saveTipJar(tipJarId, tipJarData);
            console.log('Save result:', saved);
            
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

    // Updated to create universal URLs that work on any device
    showTipJarSuccess(tipJarId, tipJarData) {
        // Hide other sections
        document.getElementById('heroSection').classList.add('hidden');
        document.getElementById('customNameSection').classList.add('hidden');
        document.getElementById('featuresSection').classList.add('hidden');
        
        // Show tip jar section
        document.getElementById('tipJarSection').classList.remove('hidden');
        
        // Create UNIVERSAL URL that works on any device/browser
        const tipJarUrl = `${window.location.origin}/?id=${tipJarId}&wallet=${encodeURIComponent(tipJarData.wallet)}&type=${tipJarData.type}&created=${tipJarData.created}`;
        document.getElementById('tipJarUrl').textContent = tipJarUrl;
        
        // Generate QR code
        QRManager.generateQR('qrcode', tipJarUrl);
        
        this.currentTipJar = tipJarId;
        this.showNotification('Tip jar created successfully! Works on any device! 🌍', 'success');
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

    // Updated to work universally across all devices and browsers
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
                
                console.log('✅ Tip jar loaded from URL - works on any device!');
            }
        } else {
            console.log('✅ Tip jar loaded from localStorage - same browser');
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
        
        // Generate wallet QR code
        QRManager.generateQR('walletQR', tipJarData.wallet);
        
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
        const url = tipJarId ? 
            `${window.location.origin}/?id=${tipJarId}` : 
            document.getElementById('tipJarUrl').textContent;
        
        const text = tipJarId ? 
            `Send me SOL tips easily! 💜 ${url} #SolanaTipTap #Solana #Crypto` :
            `Just created my SOL tip jar! 🚀 ${url} #SolanaTipTap #Solana #Crypto`;
        
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
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.notification-toast');
        existingNotifications.forEach(notification => {
            document.body.removeChild(notification);
        });

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification-toast fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 transition-all duration-300 transform translate-x-full max-w-sm`;
        
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
        
        // Remove after 4 seconds (longer for better UX)
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Utility method to format wallet addresses
    formatWalletAddress(address, startChars = 8, endChars = 8) {
        if (!address) return '';
        if (address.length <= startChars + endChars) return address;
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    }

    // Utility method to validate Solana wallet address
    isValidSolanaAddress(address) {
        try {
            new solanaWeb3.PublicKey(address);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Method to handle errors gracefully
    handleError(error, userMessage = 'An error occurred') {
        console.error('Application error:', error);
        this.showNotification(userMessage, 'error');
    }

    // Method to get current tip jar data
    getCurrentTipJarData() {
        if (!this.currentTipJar) return null;
        return StorageManager.getTipJar(this.currentTipJar);
    }

    // Method to refresh tip jar data (useful for real-time updates)
    refreshTipJarData() {
        const tipJarData = this.getCurrentTipJarData();
        if (tipJarData) {
            this.updateTipCounter(tipJarData.tips || 0, tipJarData.totalAmount || 0);
        }
    }

    // Method to validate tip amount
    validateTipAmount(amount) {
        if (!amount || amount <= 0) {
            return { valid: false, error: 'Amount must be greater than 0' };
        }
        
        if (amount < 0.000001) {
            return { valid: false, error: 'Amount too small (minimum 0.000001 SOL)' };
        }
        
        if (amount > 1000) {
            return { valid: false, error: 'Amount too large (maximum 1000 SOL)' };
        }
        
        return { valid: true };
    }

    // Method to get tip jar statistics
    getTipJarStats(tipJarId) {
        const tipJarData = StorageManager.getTipJar(tipJarId);
        if (!tipJarData) return null;
        
        const now = Date.now();
        const ageInDays = Math.floor((now - tipJarData.created) / (1000 * 60 * 60 * 24));
        
        return {
            id: tipJarData.id,
            wallet: tipJarData.wallet,
            type: tipJarData.type,
            plan: tipJarData.plan,
            created: tipJarData.created,
            ageInDays: ageInDays,
            totalTips: tipJarData.tips || 0,
            totalAmount: tipJarData.totalAmount || 0,
            averageTip: tipJarData.tips > 0 ? (tipJarData.totalAmount / tipJarData.tips) : 0
        };
    }

    // Method to generate shareable content
    generateShareContent(tipJarId, platform = 'twitter') {
        const tipJarData = StorageManager.getTipJar(tipJarId);
        if (!tipJarData) return null;
        
        const url = `${window.location.origin}/?id=${tipJarId}&wallet=${encodeURIComponent(tipJarData.wallet)}&type=${tipJarData.type}&created=${tipJarData.created}`;
        
        const content = {
            twitter: {
                text: `Send me SOL tips easily! 💜 Support creators on Solana blockchain. ${url} #SolanaTipTap #Solana #Crypto #Web3`,
                url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Send me SOL tips easily! 💜 Support creators on Solana blockchain. ${url} #SolanaTipTap #Solana #Crypto #Web3`)}`
            },
            facebook: {
                text: `Check out my Solana tip jar! Support creators with crypto tips.`,
                url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
            },
            linkedin: {
                text: `Supporting the creator economy with Solana blockchain technology.`,
                url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
            },
            reddit: {
                text: `Created my Solana tip jar - accepting SOL tips!`,
                url: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent('Created my Solana tip jar - accepting SOL tips!')}`
            }
        };
        
        return content[platform] || content.twitter;
    }

    // Method to handle wallet disconnection
    async disconnectWallet() {
        try {
            if (window.solana && window.solana.disconnect) {
                await window.solana.disconnect();
            }
            
            this.wallet = null;
            document.getElementById('connectWallet').textContent = 'Connect Wallet';
            document.getElementById('connectWallet').classList.remove('bg-green-600');
            
            this.showNotification('Wallet disconnected', 'info');
        } catch (error) {
            console.error('Wallet disconnection failed:', error);
            this.showNotification('Failed to disconnect wallet', 'error');
        }
    }

    // Method to check wallet connection status
    checkWalletConnection() {
        if (window.solana && window.solana.isConnected) {
            return window.solana.isConnected;
        }
        return false;
    }

    // Method to get wallet balance
    async getWalletBalance() {
        if (!this.wallet) return 0;
        
        try {
            const publicKey = new solanaWeb3.PublicKey(this.wallet);
            const balance = await this.connection.getBalance(publicKey);
            return balance / solanaWeb3.LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Failed to get wallet balance:', error);
            return 0;
        }
    }

    // Method to estimate transaction fee
    async estimateTransactionFee() {
        try {
            const { feeCalculator } = await this.connection.getRecentBlockhash();
            return feeCalculator.lamportsPerSignature / solanaWeb3.LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Failed to estimate transaction fee:', error);
            return 0.000005; // Default estimate
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if required elements exist before initializing
    const requiredElements = [
        'connectWallet',
        'createDefault', 
        'createCustom',
        'heroSection'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return;
    }
    
    // Initialize the application
    try {
        new SolanaTipTap();
        console.log('✅ Solana Tip Tap initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Solana Tip Tap:', error);
    }
});

// Handle wallet events
window.addEventListener('load', () => {
    if (window.solana) {
        window.solana.on('connect', () => {
            console.log('Wallet connected via event');
        });
        
        window.solana.on('disconnect', () => {
            console.log('Wallet disconnected via event');
        });
        
        window.solana.on('accountChanged', (publicKey) => {
            console.log('Wallet account changed:', publicKey?.toString());
            // Optionally reload the page or update the UI
            if (publicKey) {
                window.location.reload();
            }
        });
    }
});

// Handle page visibility changes (for potential real-time updates)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible - could refresh tip jar data here
        console.log('Page became visible');
    }
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaTipTap;
}
