// Solana Tip Tap - Main Application
class SolanaTipTap {
    constructor() {
        this.wallet = null;
        this.connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com');
        this.setupFeeWallet = 'B7zzqLYVNm2urtdoX9NMxfhj6CwaQzjSnnVZE4rCWgfU';
        this.currentTipJar = null;
        
        // Your Supabase credentials
        this.supabaseUrl = 'https://zqkfivewbhigycpotcrl.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxa2ZpdmV3YmhpZ3ljcG90Y3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MDI4NTMsImV4cCI6MjA2ODM3ODg1M30.JJGxHm2q_BlANnmTiJLly9ocV8OBjrfLU18LBpkWNJs';
        
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
                // Convert database format to app format
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

            // Check if custom name exists in database
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
        
        // Create clean URL - just the ID as path (no parameters needed!)
        const tipJarUrl = `${window.location.origin}/${tipJarId}`;
        
        const tipJarUrlElement = document.getElementById('tipJarUrl');
        if (tipJarUrlElement) {
            tipJarUrlElement.textContent = tipJarUrl;
        }
        
        // Generate QR code for sharing the tip jar URL (FIXED: Use generateUrlQR for links)
        if (typeof QRManager !== 'undefined') {
            QRManager.generateUrlQR('qrcode', tipJarUrl);
        }
        
        this.currentTipJar = tipJarId;
        
               // Show success message
        const planType = tipJarData.plan === 'premium' ? 'Premium' : 'Free';
        this.showNotification(`${planType} tip jar created successfully! Works on any device! 🌍`, 'success');
    }

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
        const path = window.location.pathname;
        
        // Check if we're on a tip jar page (not homepage)
        if (path !== '/' && path.length > 1) {
            const tipJarId = path.substring(1); // Remove leading slash
            if (tipJarId && tipJarId.length >= 3) {
                this.loadTipJarPage(tipJarId);
            }
        }
    }

    async loadTipJarPage(tipJarId) {
        // Try localStorage first (fast)
        let tipJarData = typeof StorageManager !== 'undefined' ? StorageManager.getTipJar(tipJarId) : null;
        
        // If not found locally, try database
        if (!tipJarData) {
            this.showNotification('Loading tip jar...', 'info');
            tipJarData = await this.loadTipJarFromDatabase(tipJarId);
            
            if (tipJarData && typeof StorageManager !== 'undefined') {
                // Save locally for faster future access
                StorageManager.saveTipJar(tipJarId, tipJarData);
            }
        }

        // If still not found, show error
        if (!tipJarData) {
            this.showNotification('Tip jar not found. Please check the URL.', 'error');
            setTimeout(() => window.location.href = '/', 3000);
            return;
        }

        // Hide main content and show tip jar page
        const mainElement = document.querySelector('main');
        const templateElement = document.getElementById('tipJarPageTemplate');
        
        if (mainElement && templateElement) {
            mainElement.innerHTML = templateElement.innerHTML;
        }
        
        // Set wallet address
        const walletAddressElement = document.getElementById('walletAddress');
        if (walletAddressElement) {
            walletAddressElement.textContent = `${tipJarData.wallet.slice(0, 8)}...${tipJarData.wallet.slice(-8)}`;
        }
        
        // Generate wallet QR code for payments (FIXED: Use generateWalletQR for payments)
        if (typeof QRManager !== 'undefined') {
            QRManager.generateWalletQR('walletQR', tipJarData.wallet);
        }
        
        // Update tip counter
        this.updateTipCounter(tipJarData.tips || 0, tipJarData.totalAmount || 0);
        
        // Set up copy wallet functionality
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
        
        // Set up share functionality
        const shareTipJarBtn = document.getElementById('shareTipJar');
        if (shareTipJarBtn) {
            shareTipJarBtn.addEventListener('click', () => {
                this.shareOnTwitter(tipJarId);
            });
        }
        
        this.currentTipJar = tipJarId;
        
        // Update page title
        document.title = `Tip Jar - ${tipJarId} | Solana Tip Tap`;
        
        // Update meta description for better sharing
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
        const endTime = new Date().getTime() + (48 * 60 * 60 * 1000); // 48 hours from now
        
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
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.notification-toast');
        existingNotifications.forEach(notification => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
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

    // Get current tip jar data
    getCurrentTipJarData() {
        if (this.currentTipJar && typeof StorageManager !== 'undefined') {
            return StorageManager.getTipJar(this.currentTipJar);
        }
        return null;
    }

    // Handle browser back/forward navigation
    handlePopState() {
        // Reload the page to handle navigation properly
        window.location.reload();
    }

    // Check if we're on mobile device
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Get SOL price (optional feature)
    async getSolPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            const data = await response.json();
            return data.solana?.usd || 172; // Fallback price
        } catch (error) {
            console.error('Failed to fetch SOL price:', error);
            return 172; // Fallback price
        }
    }

    // Update tip button prices with current SOL price
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
        } catch (error) {
            console.error('Failed to update tip button prices:', error);
        }
    }

    // Initialize wallet event listeners
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

    // Check if tip jar ID is valid format
    isValidTipJarId(id) {
        return /^[a-zA-Z0-9_-]{3,20}$/.test(id);
    }

    // Get tip jar stats
    async getTipJarStats(tipJarId) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/tip_jars?id=eq.${tipJarId}`, {
                headers: {
                    'apikey': this.supabaseKey,
                                       'Authorization': `Bearer ${this.supabaseKey}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data[0] || null;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get tip jar stats:', error);
            return null;
        }
    }

    // Validate wallet address format
    isValidSolanaAddress(address) {
        try {
            new solanaWeb3.PublicKey(address);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Format large numbers
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Format SOL amount
    formatSolAmount(amount) {
        if (amount < 0.001) {
            return amount.toFixed(6);
        } else if (amount < 1) {
            return amount.toFixed(4);
        } else {
            return amount.toFixed(2);
        }
    }

    // Get wallet balance
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

    // Check if user has enough SOL for transaction
    async checkSufficientBalance(amount) {
        const balance = await this.getWalletBalance();
        const requiredAmount = amount + 0.000005; // Add small buffer for transaction fees
        return balance >= requiredAmount;
    }

    // Enhanced tip processing with balance check
    async processTipWithValidation(amount) {
        if (!this.wallet) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        // Check balance
        const hasSufficientBalance = await this.checkSufficientBalance(amount);
        if (!hasSufficientBalance) {
            this.showNotification('Insufficient SOL balance for this tip', 'error');
            return;
        }

        // Proceed with normal tip processing
        return this.processTip(amount);
    }

    // Auto-connect wallet if previously connected
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
            }
        } catch (error) {
            console.error('Auto-connect failed:', error);
        }
    }

    // Enhanced initialization
    async enhancedInit() {
        this.setupEventListeners();
        this.initWalletListeners();
        await this.autoConnectWallet();
        this.startCountdown();
        this.checkForTipJarPage();
        this.updateSocialProof();
        
        // Update tip button prices if on tip jar page
        if (window.location.pathname !== '/') {
            setTimeout(() => this.updateTipButtonPrices(), 1000);
        }
    }

    // Handle network errors gracefully
    async handleNetworkError(error, retryFunction, maxRetries = 3) {
        console.error('Network error:', error);
        
        if (maxRetries > 0) {
            this.showNotification('Network error, retrying...', 'warning');
            setTimeout(() => {
                retryFunction(maxRetries - 1);
            }, 2000);
        } else {
            this.showNotification('Network error. Please check your connection.', 'error');
        }
    }

    // Enhanced error handling for transactions
    async processTransactionWithRetry(transaction, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const { blockhash } = await this.connection.getRecentBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = new solanaWeb3.PublicKey(this.wallet);

                const signedTransaction = await window.solana.signTransaction(transaction);
                const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
                
                await this.connection.confirmTransaction(signature);
                return signature;
                
            } catch (error) {
                console.error(`Transaction attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // Get tip jar analytics
    async getTipJarAnalytics(tipJarId) {
        try {
            const tipJarData = await this.loadTipJarFromDatabase(tipJarId);
            if (!tipJarData) return null;

            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            const weekMs = 7 * dayMs;
            const monthMs = 30 * dayMs;

            return {
                totalTips: tipJarData.tips || 0,
                totalAmount: tipJarData.totalAmount || 0,
                createdDate: new Date(tipJarData.created),
                daysActive: Math.floor((now - tipJarData.created) / dayMs),
                averageTip: tipJarData.tips > 0 ? (tipJarData.totalAmount / tipJarData.tips) : 0,
                plan: tipJarData.plan || 'free'
            };
        } catch (error) {
            console.error('Failed to get analytics:', error);
            return null;
        }
    }

    // Export tip jar data
    async exportTipJarData(tipJarId) {
        try {
            const analytics = await this.getTipJarAnalytics(tipJarId);
            if (!analytics) {
                this.showNotification('Failed to export data', 'error');
                return;
            }

            const exportData = {
                tipJarId: tipJarId,
                exportDate: new Date().toISOString(),
                ...analytics
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `tip-jar-${tipJarId}-export.json`;
            link.click();
            
            this.showNotification('Data exported successfully!', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Failed to export data', 'error');
        }
    }

    // Share tip jar with different platforms
    shareOnPlatform(platform, tipJarId) {
        const url = `${window.location.origin}/${tipJarId}`;
        const text = `Send me SOL tips easily! 💜`;
        
        const shareUrls = {
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + ' ' + url + ' #SolanaTipTap #Solana #Crypto')}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
            reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
            telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
        };
        
        if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank');
        }
    }

    // Copy tip jar link with custom message
    copyTipJarLink(tipJarId, customMessage = '') {
        const url = `${window.location.origin}/${tipJarId}`;
        const message = customMessage || `Check out my Solana tip jar: ${url}`;
        
        navigator.clipboard.writeText(message).then(() => {
            this.showNotification('Tip jar link copied!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy link', 'error');
        });
    }

    // Initialize performance monitoring
    initPerformanceMonitoring() {
        // Monitor page load time
        window.addEventListener('load', () => {
            const loadTime = performance.now();
            console.log(`Page loaded in ${loadTime.toFixed(2)}ms`);
        });

        // Monitor transaction times
        this.transactionStartTime = null;
    }

    // Log transaction performance
    logTransactionPerformance(type, success, duration) {
        console.log(`Transaction ${type}: ${success ? 'SUCCESS' : 'FAILED'} in ${duration}ms`);
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
    
    // Initialize the app with enhanced features
    window.solanaTipTap = new SolanaTipTap();
    
    // Use enhanced initialization
    window.solanaTipTap.enhancedInit();
    
    // Handle browser navigation
    window.addEventListener('popstate', () => {
        if (window.solanaTipTap) {
            window.solanaTipTap.handlePopState();
        }
    });
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

// Service Worker registration (for PWA features)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Console welcome message
console.log(`
🚀 Solana Tip Tap v2.0
💜 Create your Solana tip jar in seconds!
⚡ Powered by Solana blockchain
🗄️ Database: Supabase
🔧 Enhanced with auto-connect, analytics, and error handling
`);

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaTipTap;
}
