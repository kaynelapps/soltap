// Solana Tip Tap - Main Application
class SolanaTipTap {
    constructor() {
        this.wallet = null;
        
        // ✅ FIXED: Use multiple RPC endpoints with fallback
        this.rpcEndpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com',
            'https://rpc.ankr.com/solana',
            'https://solana-mainnet.g.alchemy.com/v2/demo', // Free tier
            'https://api.metaplex.solana.com'
        ];
        
        this.currentRpcIndex = 0;
        this.connection = new solanaWeb3.Connection(this.rpcEndpoints[0], 'confirmed');
        
        this.setupFeeWallet = 'B7zzqLYVNm2urtdoX9NMxfhj6CwaQzjSnnVZE4rCWgfU';
        this.currentTipJar = null;
        
        // Your Supabase credentials
        this.supabaseUrl = 'https://zqkfivewbhigycpotcrl.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxa2ZpdmV3YmhpZ3ljcG90Y3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MDI4NTMsImV4cCI6MjA2ODM3ODg1M30.JJGxHm2q_BlANnmTiJLly9ocV8OBjrfLU18LBpkWNJs';
        
        this.init();
    }

    // ✅ NEW: Switch to next RPC endpoint on failure
    async switchRpcEndpoint() {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcEndpoints.length;
        const newEndpoint = this.rpcEndpoints[this.currentRpcIndex];
        
        console.log(`Switching to RPC endpoint: ${newEndpoint}`);
        this.connection = new solanaWeb3.Connection(newEndpoint, 'confirmed');
        
        this.showNotification(`Switching to backup server...`, 'info');
        return newEndpoint;
    }

    // ✅ FIXED: Enhanced getRecentBlockhash with fallback
    async getRecentBlockhashWithFallback(maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`Attempting to get blockhash from: ${this.rpcEndpoints[this.currentRpcIndex]}`);
                
                const { blockhash, feeCalculator } = await this.connection.getRecentBlockhash('confirmed');
                
                console.log('Successfully got blockhash:', blockhash);
                return { blockhash, feeCalculator };
                
            } catch (error) {
                console.error(`Blockhash attempt ${attempt + 1} failed:`, error);
                
                if (attempt < maxRetries - 1) {
                    await this.switchRpcEndpoint();
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                } else {
                    throw new Error(`Failed to get blockhash after ${maxRetries} attempts: ${error.message}`);
                }
            }
        }
    }

    // ✅ FIXED: Enhanced transaction sending with fallback
    async sendTransactionWithFallback(transaction, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`Sending transaction attempt ${attempt + 1}`);
                
                const signature = await this.connection.sendRawTransaction(
                    transaction.serialize(),
                    {
                        skipPreflight: false,
                        preflightCommitment: 'confirmed'
                    }
                );
                
                console.log('Transaction sent, signature:', signature);
                
                // Wait for confirmation
                const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
                
                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }
                
                console.log('Transaction confirmed:', signature);
                return signature;
                
            } catch (error) {
                console.error(`Transaction attempt ${attempt + 1} failed:`, error);
                
                if (attempt < maxRetries - 1) {
                    await this.switchRpcEndpoint();
                    
                    // Re-get blockhash with new endpoint
                    const { blockhash } = await this.getRecentBlockhashWithFallback();
                    transaction.recentBlockhash = blockhash;
                    
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                } else {
                    throw error;
                }
            }
        }
    }

    async init() {
        this.setupEventListeners();
        this.startCountdown();
        this.checkForTipJarPage();
        this.updateSocialProof();
    }

    setupEventListeners() {
        // Wallet connection
        const connectWalletBtn = document.getElementById('connectWallet');
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', () => this.connectWallet());
        }
        
        // Tip jar creation
        const createDefaultBtn = document.getElementById('createDefault');
        if (createDefaultBtn) {
            createDefaultBtn.addEventListener('click', () => this.createTipJar('default'));
        }
        
        const createCustomBtn = document.getElementById('createCustom');
        if (createCustomBtn) {
            createCustomBtn.addEventListener('click', () => this.showCustomNameInput());
        }
        
        // Custom name handling
        const confirmCustomBtn = document.getElementById('confirmCustom');
        if (confirmCustomBtn) {
            confirmCustomBtn.addEventListener('click', () => this.createTipJar('custom'));
        }
        
        const cancelCustomBtn = document.getElementById('cancelCustom');
        if (cancelCustomBtn) {
            cancelCustomBtn.addEventListener('click', () => this.hideCustomNameInput());
        }
        
        // Tip jar actions
        const copyUrlBtn = document.getElementById('copyUrl');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => this.copyToClipboard('tipJarUrl'));
        }
        
        const shareTwitterBtn = document.getElementById('shareTwitter');
        if (shareTwitterBtn) {
            shareTwitterBtn.addEventListener('click', () => this.shareOnTwitter());
        }
        
        const createAnotherBtn = document.getElementById('createAnother');
        if (createAnotherBtn) {
            createAnotherBtn.addEventListener('click', () => this.resetToHome());
        }
        
        // Custom name input validation
        const customNameInput = document.getElementById('customName');
        if (customNameInput) {
            customNameInput.addEventListener('input', (e) => this.validateCustomName(e.target.value));
        }
        
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
                
                const connectBtn = document.getElementById('connectWallet');
                if (connectBtn) {
                    connectBtn.textContent = `${this.wallet.slice(0, 4)}...${this.wallet.slice(-4)}`;
                    connectBtn.classList.add('bg-green-600');
                    connectBtn.classList.remove('bg-solana-purple');
                }
                
                this.showNotification('Wallet connected! Ready to create your tip jar! 🎉', 'success');
                console.log('Wallet connected:', this.wallet);
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
        const customNameSection = document.getElementById('customNameSection');
        const heroSection = document.getElementById('heroSection');
        const customNameInput = document.getElementById('customName');
        
        if (customNameSection) customNameSection.classList.remove('hidden');
        if (heroSection) heroSection.style.opacity = '0.5';
        if (customNameInput) customNameInput.focus();
    }

    hideCustomNameInput() {
        const customNameSection = document.getElementById('customNameSection');
        const heroSection = document.getElementById('heroSection');
        
        if (customNameSection) customNameSection.classList.add('hidden');
        if (heroSection) heroSection.style.opacity = '1';
    }

    validateCustomName(name) {
        const isValid = /^[a-zA-Z0-9_-]{3,20}$/.test(name);
        const confirmBtn = document.getElementById('confirmCustom');
        
        if (confirmBtn) {
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
        
        return isValid && !this.isReservedName(name);
    }

    isReservedName(name) {
        const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'blog', 'help', 'support', 'terms', 'privacy', 'about', 'contact', 'app', 'assets', 'static', 'public'];
        return reserved.includes(name.toLowerCase());
    }

    async saveTipJarToDatabase(tipJarData) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/tip_jars`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    id: tipJarData.id,
                    wallet: tipJarData.wallet,
                    type: tipJarData.type,
                    created: tipJarData.created,
                    tips: tipJarData.tips || 0,
                    total_amount: tipJarData.totalAmount || 0,
                    plan: tipJarData.plan || 'free'
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                console.error('Database save failed:', error);
                return false;
            }
            
            console.log('Tip jar saved to database successfully');
            return true;
        } catch (error) {
            console.error('Database save error:', error);
            return false;
        }
    }

    async loadTipJarFromDatabase(tipJarId) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/tip_jars?id=eq.${tipJarId}`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`
                }
            });
            
            if (!response.ok) {
                console.error('Database load failed:', response.status);
                return null;
            }
            
            const data = await response.json();
            const dbData = data[0];
            
            if (dbData) {
                return {
                    id: dbData.id,
                    wallet: dbData.wallet,
                    type: dbData.type,
                    created: dbData.created,
                    tips: dbData.tips || 0,
                    totalAmount: dbData.total_amount || 0,
                    plan: dbData.plan || 'free'
                };
            }
            
            return null;
        } catch (error) {
            console.error('Database load error:', error);
            return null;
        }
    }

    async updateTipJarInDatabase(tipJarId, updates) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/tip_jars?id=eq.${tipJarId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    tips: updates.tips,
                    total_amount: updates.totalAmount
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error('Database update error:', error);
            return false;
        }
    }

    async createTipJar(type) {
        if (!this.wallet) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        try {
            const fee = type === 'default' ? 0 : 0.005;
            const customName = type === 'custom' ? document.getElementById('customName')?.value : null;
            
            if (type === 'custom' && (!customName || !this.validateCustomName(customName))) {
                this.showNotification('Please enter a valid custom name', 'error');
                return;
            }

            if (type === 'custom') {
                this.showNotification('Checking name availability...', 'info');
                const existingTipJar = await this.loadTipJarFromDatabase(customName);
                if (existingTipJar) {
                    this.showNotification('This name is already taken', 'error');
                    return;
                }
            }

            if (fee > 0) {
                this.showNotification('Processing payment...', 'info');
                await this.processPayment(fee);
            } else {
                this.showNotification('Creating your free tip jar...', 'info');
            }

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

            // Save to both localStorage AND database
            if (typeof StorageManager !== 'undefined') {
                StorageManager.saveTipJar(tipJarId, tipJarData);
            }
            
            this.showNotification('Saving to database...', 'info');
            const dbSaved = await this.saveTipJarToDatabase(tipJarData);
            
            if (!dbSaved) {
                this.showNotification('Warning: Tip jar created locally but not saved to database', 'warning');
            }
            
            this.showTipJarSuccess(tipJarId, tipJarData);
            
        } catch (error) {
            console.error('Failed to create tip jar:', error);
            this.showNotification('Failed to create tip jar. Please try again.', 'error');
        }
    }

    // ✅ FIXED: Enhanced payment processing with fallback RPC
    async processPayment(amount) {
        try {
            this.showNotification('Preparing transaction...', 'info');
            
            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: new solanaWeb3.PublicKey(this.wallet),
                    toPubkey: new solanaWeb3.PublicKey(this.setupFeeWallet),
                    lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
                })
            );

            // Get blockhash with fallback
            const { blockhash } = await this.getRecentBlockhashWithFallback();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new solanaWeb3.PublicKey(this.wallet);

            this.showNotification('Please approve the transaction in your wallet...', 'info');
            
            // Sign transaction
            const signedTransaction = await window.solana.signTransaction(transaction);
            
            this.showNotification('Sending transaction...', 'info');
            
            // Send with fallback
            const signature = await this.sendTransactionWithFallback(signedTransaction);
            
            this.showNotification(`Payment of ${amount} SOL successful!`, 'success');
            console.log('Payment successful, signature:', signature);
            
        } catch (error) {
            console.error('Payment failed:', error);
            
            if (error.message.includes('User rejected')) {
                this.showNotification('Transaction cancelled by user', 'warning');
            } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                this.showNotification('Network error. Please try again in a moment.', 'error');
            } else {
                this.showNotification('Payment failed. Please try again.', 'error');
            }
            
            throw new Error('Payment failed');
        }
    }

    generateRandomId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    showTipJarSuccess(tipJarId, tipJarData) {
        if (!tipJarData) {
            tipJarData = typeof StorageManager !== 'undefined' ? StorageManager.getTipJar(tipJarId) : null;
        }
        
        if (!tipJarData) {
            this.showNotification('Error: Tip jar data not found', 'error');
            return;
        }
        
        // Hide other sections
        const heroSection = document.getElementById('heroSection');
        const customNameSection = document.getElementById('customNameSection');
        const featuresSection = document.getElementById('featuresSection');
        const tipJarSection = document.getElementById('tipJarSection');
        
        if (heroSection) heroSection.classList.add('hidden');
        if (customNameSection) customNameSection.classList.add('hidden');
        if (featuresSection) featuresSection.classList.add('hidden');
        if (tipJarSection) tipJarSection.classList.remove('hidden');
        
        // Create clean URL
        const tipJarUrl = `${window.location.origin}/${tipJarId}`;
        
        const tipJarUrlElement = document.getElementById('tipJarUrl');
        if (tipJarUrlElement) {
            tipJarUrlElement.textContent = tipJarUrl;
        }
        
        // Generate QR code for sharing the tip jar URL
        if (typeof QRManager !== 'undefined') {
            QRManager.generateUrlQR('qrcode', tipJarUrl);
        }
        
        this.currentTipJar = tipJarId;
        
        const planType = tipJarData.plan === 'premium' ? 'Premium' : 'Free';
        this.showNotification(`${planType} tip jar created successfully! Works on any device! 🌍`, 'success');
    }

    // ✅ FIXED: Enhanced tip processing with fallback RPC
    async processTip(amount) {
        if (!this.currentTipJar) return;
        
        try {
            let tipJarData = typeof StorageManager !== 'undefined' ? StorageManager.getTipJar(this.currentTipJar) : null;
            
            if (!tipJarData) {
                this.showNotification('Tip jar not found', 'error');
                return;
            }

            if (!this.wallet) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            this.showNotification('Preparing tip transaction...', 'info');

            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: new solanaWeb3.PublicKey(this.wallet),
                    toPubkey: new solanaWeb3.PublicKey(tipJarData.wallet),
                    lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
                })
            );

            // Get blockhash with fallback
            const { blockhash } = await this.getRecentBlockhashWithFallback();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new solanaWeb3.PublicKey(this.wallet);

            this.showNotification('Please approve the tip in your wallet...', 'info');
            
            // Sign transaction
            const signedTransaction = await window.solana.signTransaction(transaction);
            
            this.showNotification('Sending tip...', 'info');
            
            // Send with fallback
            const signature = await this.sendTransactionWithFallback(signedTransaction);
            
            // Update tip counter
            tipJarData.tips += 1;
            tipJarData.totalAmount += amount;
            
            // Save to both localStorage and database
            if (typeof StorageManager !== 'undefined') {
                StorageManager.saveTipJar(this.currentTipJar, tipJarData);
            }
            
            await this.updateTipJarInDatabase(this.currentTipJar, {
                tips: tipJarData.tips,
                totalAmount: tipJarData.totalAmount
            });
            
            this.updateTipCounter(tipJarData.tips, tipJarData.totalAmount);
            this.showNotification(`Thanks for tipping ${amount} SOL! 🎉`, 'success');
            console.log('Tip successful, signature:', signature);
            
        } catch (error) {
            console.error('Tip failed:', error);
            
            if (error.message.includes('User rejected')) {
                this.showNotification('Tip cancelled by user', 'warning');
            } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                this.showNotification('Network error. Please try again in a moment.', 'error');
            } else if (error.message.includes('insufficient')) {
                this.showNotification('Insufficient SOL balance for this tip', 'error');
            } else {
                this.showNotification('Tip failed. Please try again.', 'error');
            }
        }
    }

    updateTipCounter(tips, totalAmount) {
        const tipCountEl = document.getElementById('tipCount');
        const tipAmountEl = document.getElementById('tipAmount');
        
        if (tipCountEl) tipCountEl.textContent = `${tips} tips`;
        if (tipAmountEl) tipAmountEl.textContent = `${totalAmount.toFixed(4)} SOL received`;
    }

    checkForTipJarPage() {
        const path = window.location.pathname;
        
        if (path !== '/' && path.length > 1) {
            const tipJarId = path.substring(1);
            if (tipJarId && tipJarId.length >= 3) {
                this.loadTipJarPage(tipJarId);
            }
        }
    }

    async loadTipJarPage(tipJarId) {
        let tipJarData = typeof StorageManager !== 'undefined' ? StorageManager.getTipJar(tipJarId) : null;
        
        if (!tipJarData) {
            this.showNotification('Loading tip jar...', 'info');
            tipJarData = await this.loadTipJarFromDatabase(tipJarId);
            
            if (tipJarData && typeof StorageManager !== 'undefined') {
                StorageManager.saveTipJar(tipJarId, tipJarData);
            }
        }

        if (!tipJarData) {
            this.showNotification('Tip jar not found. Please check the URL.', 'error');
            setTimeout(() => window.location.href = '/', 3000);
            return;
        }

        const mainElement = document.querySelector('main');
        const templateElement = document.getElementById('tipJarPageTemplate');
        
        if (mainElement && templateElement) {
            mainElement.innerHTML = templateElement.innerHTML;
        }
        
        const walletAddressElement = document.getElementById('walletAddress');
        if (walletAddressElement) {
            walletAddressElement.textContent = `${tipJarData.wallet.slice(0, 8)}...${tipJarData.wallet.slice(-8)}`;
        }
        
        // Generate wallet QR code for payments
        if (typeof QRManager !== 'undefined') {
            QRManager.generateWalletQR('walletQR', tipJarData.wallet);
        }
        
        this.updateTipCounter(tipJarData.tips || 0, tipJarData.totalAmount || 0);
        
        const copyWalletBtn = document.getElementById('copyWallet');
        if (copyWalletBtn) {
            copyWalletBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(tipJarData.wallet).then(() => {
                    this.showNotification('Wallet address copied!', 'success');
                }).catch(() => {
                    this.showNotification('Failed to copy wallet address', 'error');
                });
            });
        }
        
        const shareTipJarBtn = document.getElementById('shareTipJar');
        if (shareTipJarBtn) {
            shareTipJarBtn.addEventListener('click', () => {
                this.shareOnTwitter(tipJarId);
            });
        }
        
        this.currentTipJar = tipJarId;
        
        document.title = `Tip Jar - ${tipJarId} | Solana Tip Tap`;
        
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.content = `Send SOL tips to ${tipJarId} on Solana Tip Tap. Fast, secure crypto tipping powered by Solana blockchain.`;
        }
    }

    copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
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
            url = `${window.location.origin}/${tipJarId}`;
            text = `Send me SOL tips easily! 💜 ${url} #SolanaTipTap #Solana #Crypto`;
        } else {
            const tipJarUrlElement = document.getElementById('tipJarUrl');
            url = tipJarUrlElement ? tipJarUrlElement.textContent : window.location.href;
            text = `Just created my SOL tip jar! 🚀 ${url} #SolanaTipTap #Solana #Crypto`;
        }
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank');
    }

    resetToHome() {
        window.location.href = '/';
    }

    startCountdown() {
        const endTime = new Date().getTime() + (48 * 60 * 60 * 1000);
        
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;
            
            if (distance < 0) {
                clearInterval(timer);
                const fomoTimer = document.getElementById('fomoTimer');
                if (fomoTimer) {
                    fomoTimer.style.display = 'none';
                }
                return;
            }
            
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            const countdownEl = document.getElementById('countdown');
            if (countdownEl) {
                countdownEl.textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    updateSocialProof() {
        const baseCount = 100;
        const randomAdd = Math.floor(Math.random() * 50);
        const totalUsers = baseCount + randomAdd;
        
        const socialProofElement = document.querySelector('.text-solana-green');
        if (socialProofElement) {
            socialProofElement.textContent = `🚀 Join ${totalUsers}+ creators getting tipped!`;
        }
    }

    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification-toast');
        existingNotifications.forEach(notification => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });

        const notification = document.createElement('div');
        notification.className = `notification-toast fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold z-50 transition-all duration-300 transform translate-x-full max-w-sm`;
        
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
        
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // ✅ NEW: Test RPC connection
    async testRpcConnection() {
        try {
            console.log(`Testing RPC: ${this.rpcEndpoints[this.currentRpcIndex]}`);
            const slot = await this.connection.getSlot();
            console.log(`RPC working, current slot: ${slot}`);
            return true;
        } catch (error) {
            console.error(`RPC test failed: ${error.message}`);
            return false;
        }
    }

    // ✅ NEW: Initialize with RPC testing
    async initWithRpcTest() {
        // Test current RPC endpoint
        const isWorking = await this.testRpcConnection();
        
        if (!isWorking) {
            this.showNotification('Testing backup servers...', 'info');
            
            // Try other endpoints
            for (let i = 1; i < this.rpcEndpoints.length; i++) {
                await this.switchRpcEndpoint();
                const testResult = await this.testRpcConnection();
                
                if (testResult) {
                    this.showNotification('Connected to backup server', 'success');
                    break;
                }
            }
        }
        
        // Continue with normal initialization
        this.setupEventListeners();
        this.startCountdown();
        this.checkForTipJarPage();
        this.updateSocialProof();
    }

    // ✅ NEW: Get wallet balance with fallback
    async getWalletBalance() {
        if (!this.wallet) return 0;
        
        try {
            const publicKey = new solanaWeb3.PublicKey(this.wallet);
            const balance = await this.connection.getBalance(publicKey);
            return balance / solanaWeb3.LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Failed to get wallet balance:', error);
            
            // Try with different RPC
            await this.switchRpcEndpoint();
            try {
                const publicKey = new solanaWeb3.PublicKey(this.wallet);
                const balance = await this.connection.getBalance(publicKey);
                return balance / solanaWeb3.LAMPORTS_PER_SOL;
            } catch (retryError) {
                console.error('Balance check failed on backup RPC:', retryError);
                return 0;
            }
        }
    }

    // ✅ NEW: Check sufficient balance before transaction
    async checkSufficientBalance(amount) {
        const balance = await this.getWalletBalance();
        const requiredAmount = amount + 0.000005; // Add buffer for transaction fees
        
        console.log(`Balance: ${balance} SOL, Required: ${requiredAmount} SOL`);
        
        if (balance < requiredAmount) {
            this.showNotification(`Insufficient balance. You need ${requiredAmount.toFixed(6)} SOL but have ${balance.toFixed(6)} SOL`, 'error');
            return false;
        }
        
        return true;
    }

    // ✅ ENHANCED: Process tip with balance check
    async processTipWithBalanceCheck(amount) {
        if (!this.wallet) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        // Check balance first
        const hasSufficientBalance = await this.checkSufficientBalance(amount);
        if (!hasSufficientBalance) {
            return;
        }

        // Proceed with tip
        return this.processTip(amount);
    }

    // ✅ NEW: Auto-connect wallet if previously connected
    async autoConnectWallet() {
        try {
            if (window.solana && window.solana.isConnected) {
                this.wallet = window.solana.publicKey.toString();
                const connectBtn = document.getElementById('connectWallet');
                if (connectBtn) {
                    connectBtn.textContent = `${this.wallet.slice(0, 4)}...${this.wallet.slice(-4)}`;
                    connectBtn.classList.add('bg-green-600');
                    connectBtn.classList.remove('bg-solana-purple');
                }
                console.log('Wallet auto-connected:', this.wallet);
                this.showNotification('Wallet reconnected!', 'success');
            }
        } catch (error) {
            console.error('Auto-connect failed:', error);
        }
    }

    // ✅ NEW: Handle wallet events
    initWalletListeners() {
        if (window.solana) {
            window.solana.on('connect', () => {
                console.log('Wallet connected via event');
            });
            
            window.solana.on('disconnect', () => {
                console.log('Wallet disconnected via event');
                this.handleWalletDisconnect();
            });

            window.solana.on('accountChanged', (publicKey) => {
                if (publicKey) {
                    console.log('Account changed:', publicKey.toString());
                    this.wallet = publicKey.toString();
                    const connectBtn = document.getElementById('connectWallet');
                    if (connectBtn) {
                        connectBtn.textContent = `${this.wallet.slice(0, 4)}...${this.wallet.slice(-4)}`;
                    }
                } else {
                    this.handleWalletDisconnect();
                }
            });
        }
    }

    // ✅ NEW: Handle wallet disconnect
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

    // ✅ NEW: Enhanced initialization
    async enhancedInit() {
        console.log('🚀 Initializing Solana Tip Tap...');
        
        // Initialize wallet listeners
        this.initWalletListeners();
        
        // Auto-connect if previously connected
        await this.autoConnectWallet();
        
        // Test RPC and initialize
        await this.initWithRpcTest();
        
        console.log('✅ Solana Tip Tap initialized successfully');
    }

    // ✅ NEW: Get current SOL price
    async getSolPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            const data = await response.json();
            return data.solana?.usd || 172;
        } catch (error) {
            console.error('Failed to fetch SOL price:', error);
            return 172;
        }
    }

    // ✅ NEW: Update tip button prices
    async updateTipButtonPrices() {
        try {
            const solPrice = await this.getSolPrice();
            const tipButtons = document.querySelectorAll('.tip-btn');
            
            tipButtons.forEach(button => {
                const amount = parseFloat(button.dataset.amount);
                const usdValue = (amount * solPrice).toFixed(2);
                const currentText = button.textContent;
                const newText = currentText.replace(/\(~\$[\d.]+\)/, `(~$${usdValue})`);
                button.textContent = newText;
            });
            
            console.log(`Updated tip button prices with SOL at $${solPrice}`);
        } catch (error) {
            console.error('Failed to update tip button prices:', error);
        }
    }

    // ✅ NEW: Format numbers nicely
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // ✅ NEW: Format SOL amounts
    formatSolAmount(amount) {
        if (amount < 0.001) {
            return amount.toFixed(6);
        } else if (amount < 1) {
            return amount.toFixed(4);
        } else {
            return amount.toFixed(2);
        }
    }

    // ✅ NEW: Check if on mobile
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // ✅ NEW: Handle browser navigation
    handlePopState() {
        window.location.reload();
    }
}

// ✅ ENHANCED: Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, initializing Solana Tip Tap...');
    
    // Check for wallet events
    if (window.solana) {
        window.solana.on('connect', () => {
            console.log('Wallet connected via global event');
        });
        
        window.solana.on('disconnect', () => {
            console.log('Wallet disconnected via global event');
            if (window.solanaTipTap) {
                window.solanaTipTap.handleWalletDisconnect();
            }
        });
    }
    
    // Initialize the app
    window.solanaTipTap = new SolanaTipTap();
    
    // Use enhanced initialization with RPC testing
    await window.solanaTipTap.enhancedInit();
    
    // Update tip button prices if on tip jar page
    if (window.location.pathname !== '/') {
        setTimeout(() => {
            if (window.solanaTipTap) {
                window.solanaTipTap.updateTipButtonPrices();
            }
        }, 2000);
    }
    
    // Handle browser navigation
    window.addEventListener('popstate', () => {
        if (window.solanaTipTap) {
            window.solanaTipTap.handlePopState();
        }
    });
    
    console.log('✅ Solana Tip Tap fully loaded and ready!');
});

// ✅ NEW: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.solanaTipTap) {
        window.solanaTipTap.updateSocialProof();
    }
});

// ✅ NEW: Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.solanaTipTap) {
        window.solanaTipTap.showNotification('An unexpected error occurred', 'error');
    }
});

// ✅ NEW: Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.solanaTipTap && event.reason?.message) {
        if (event.reason.message.includes('User rejected')) {
            window.solanaTipTap.showNotification('Transaction cancelled by user', 'warning');
        } else if (event.reason.message.includes('403') || event.reason.message.includes('forbidden')) {
            window.solanaTipTap.showNotification('Network error. Trying backup servers...', 'warning');
        } else {
            window.solanaTipTap.showNotification('Transaction failed. Please try again.', 'error');
        }
    }
});

// ✅ NEW: Console welcome message
console.log(`
🚀 Solana Tip Tap v2.1 - ENHANCED
💜 Create your Solana tip jar in seconds!
⚡ Powered by Solana blockchain
🔄 Multiple RPC endpoints with automatic fallback
🗄️ Database: Supabase
🔧 Enhanced with balance checks, auto-reconnect, and error handling

Current RPC endpoints:
- api.mainnet-beta.solana.com
- solana-api.projectserum.com  
- rpc.ankr.com/solana
- solana-mainnet.g.alchemy.com
- api.metaplex.solana.com
`);

// ✅ NEW: Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaTipTap;
}
