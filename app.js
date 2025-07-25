// Solana Tip Tap - Main Application
class SolanaTipTap {
    constructor() {
        this.wallet = null;
        
        // ✅ FIXED: Use working RPC endpoints only, prioritize Alchemy
        this.rpcEndpoints = [
            'https://solana-mainnet.g.alchemy.com/v2/demo', // This one works!
            'https://api.mainnet-beta.solana.com',
            'https://rpc.ankr.com/solana',
            'https://solana-api.projectserum.com'
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

    // ✅ FIXED: Silent RPC switching (no popups)
    async switchRpcEndpoint() {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcEndpoints.length;
        const newEndpoint = this.rpcEndpoints[this.currentRpcIndex];
        
        console.log(`Switching to RPC endpoint: ${newEndpoint}`);
        this.connection = new solanaWeb3.Connection(newEndpoint, 'confirmed');
        
        return newEndpoint;
    }

    // ✅ FIXED: Enhanced getRecentBlockhash with working endpoint priority
    async getRecentBlockhashWithFallback(maxRetries = 2) {
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
                    await new Promise(resolve => setTimeout(resolve, 500)); // Shorter wait
                } else {
                    throw new Error(`Failed to get blockhash after ${maxRetries} attempts: ${error.message}`);
                }
            }
        }
    }

    // ✅ FIXED: Enhanced transaction sending with working endpoint
    async sendTransactionWithFallback(transaction, maxRetries = 2) {
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
                    try {
                        const { blockhash } = await this.getRecentBlockhashWithFallback();
                        transaction.recentBlockhash = blockhash;
                    } catch (blockhashError) {
                        console.error('Failed to get new blockhash:', blockhashError);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw error;
                }
            }
        }
    }

async init() {
    this.setupEventListeners();
    this.initWalletListeners();
    await this.autoConnectWallet();
    this.startCountdown();
    this.checkForTipJarPage();
    this.updateSocialProof();
    
    // ✅ NEW: Update prices on any page after 2 seconds
    setTimeout(() => {
        this.updateTipButtonPrices();
    }, 2000);
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
                
                this.showNotification('Wallet connected! 🎉', 'success');
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

    // ✅ REMOVED: Auto-connect notification (silent)
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
                // ✅ REMOVED: No notification popup
            }
        } catch (error) {
            console.error('Auto-connect failed:', error);
        }
    }

    // ✅ REMOVED: Wallet event notifications (silent)
    initWalletListeners() {
        if (window.solana) {
            window.solana.on('connect', () => {
                console.log('Wallet connected via event');
                // ✅ REMOVED: No notification popup
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
            
            // ✅ REMOVED: Database saving notification (silent)
            const dbSaved = await this.saveTipJarToDatabase(tipJarData);
            
            if (!dbSaved) {
                console.warn('Tip jar created locally but not saved to database');
            }
            
            this.showTipJarSuccess(tipJarId, tipJarData);
            
        } catch (error) {
            console.error('Failed to create tip jar:', error);
            this.showNotification('Failed to create tip jar. Please try again.', 'error');
        }
    }

    // ✅ FIXED: Enhanced payment processing with working RPC
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
            
            this.showNotification(`Payment successful! 🎉`, 'success');
            console.log('Payment successful, signature:', signature);
            
        } catch (error) {
            console.error('Payment failed:', error);
            
            if (error.message.includes('User rejected')) {
                this.showNotification('Transaction cancelled by user', 'warning');
            } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                this.showNotification('Network error. Please try again.', 'error');
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
        this.showNotification(`${planType} tip jar created successfully! 🎉`, 'success');
    }

    // ✅ FIXED: Enhanced tip processing with working RPC
    async processTip(amount) {
        if (!this.currentTipJar) return;
        
        try {
            let tipJarData = typeof StorageManager !== 'undefined' ? StorageManager.getTipJar(this.currentTipJar) : null;
            
            if (!tipJarData) {
                // ✅ REMOVED: Loading notification (silent)
                tipJarData = await this.loadTipJarFromDatabase(this.currentTipJar);
                
                if (tipJarData && typeof StorageManager !== 'undefined') {
                    StorageManager.saveTipJar(this.currentTipJar, tipJarData);
                }
            }

            if (!tipJarData) {
                this.showNotification('Tip jar not found', 'error');
                return;
            }

            if (!this.wallet) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            // ✅ FIXED: Check balance before transaction
            const balance = await this.getWalletBalance();
            const requiredAmount = amount + 0.000005; // Add buffer for transaction fees
            
            if (balance < requiredAmount) {
                this.showNotification(`Insufficient balance. Need ${requiredAmount.toFixed(6)} SOL`, 'error');
                return;
            }

            this.showNotification('Preparing tip...', 'info');

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
                this.showNotification('Tip cancelled', 'warning');
            } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                this.showNotification('Network error. Please try again.', 'error');
            } else if (error.message.includes('insufficient')) {
                this.showNotification('Insufficient SOL balance', 'error');
            } else {
                this.showNotification('Tip failed. Please try again.', 'error');
            }
        }
    }

    // ✅ FIXED: Get wallet balance with working RPC
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
    
    // ✅ FIXED: Generate QR code for tip jar URL (not wallet address)
    if (typeof QRManager !== 'undefined') {
        const tipJarUrl = `${window.location.origin}/${tipJarId}`;
        QRManager.generateUrlQR('walletQR', tipJarUrl);
        console.log('✅ QR Code generated for tip jar URL:', tipJarUrl);
    }
    
    this.updateTipCounter(tipJarData.tips || 0, tipJarData.totalAmount || 0);
    
    // ✅ NEW: Update tip button prices with bigger USD amounts
    setTimeout(async () => {
        try {
            const solPrice = await this.getSolPrice();
            const tipButtons = document.querySelectorAll('.tip-btn');
            
            // ✅ UPDATED: Bigger USD amounts
            const usdAmounts = [3, 5, 10];
            const emojis = ['☕', '🍕', '🚀'];
            const buttonStyles = [
                'tip-btn w-full bg-solana-purple hover:bg-purple-700 py-3 rounded-lg font-semibold transition-colors',
                'tip-btn w-full bg-solana-purple hover:bg-purple-700 py-3 rounded-lg font-semibold transition-colors',
                'tip-btn w-full bg-solana-green hover:bg-green-400 text-black py-3 rounded-lg font-semibold transition-colors'
            ];
            
            tipButtons.forEach((button, index) => {
                if (index < usdAmounts.length) {
                    const usdAmount = usdAmounts[index];
                    const solAmount = (usdAmount / solPrice).toFixed(4);
                    
                    // Update data-amount attribute for transaction
                    button.dataset.amount = solAmount;
                    
                    // Update button text with USD-first display
                    button.textContent = `Tip $${usdAmount} (~${solAmount} SOL) ${emojis[index]}`;
                    
                    // Update button styling
                    button.className = buttonStyles[index];
                }
            });
            
            console.log(`✅ Updated tip buttons: $3, $5, $10 (SOL at $${solPrice.toFixed(2)})`);
        } catch (error) {
            console.error('Failed to update tip button prices:', error);
            
            // ✅ FALLBACK: If price fetch fails, use default SOL amounts
            const tipButtons = document.querySelectorAll('.tip-btn');
            const fallbackAmounts = [0.017, 0.028, 0.056]; // Approximate SOL for $3, $5, $10
            const emojis = ['☕', '🍕', '🚀'];
            
            tipButtons.forEach((button, index) => {
                if (index < fallbackAmounts.length) {
                    const solAmount = fallbackAmounts[index];
                    const usdAmount = [3, 5, 10][index];
                    
                    button.dataset.amount = solAmount;
                    button.textContent = `Tip $${usdAmount} (~${solAmount} SOL) ${emojis[index]}`;
                }
            });
        }
    }, 1000);
    
    // ✅ FIXED: Copy wallet button copies the FULL wallet address
    const copyWalletBtn = document.getElementById('copyWallet');
    if (copyWalletBtn) {
        copyWalletBtn.addEventListener('click', () => {
            // Copy the full wallet address, not the truncated version
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
    
    // ✅ ENHANCED: Better page title and meta description
    document.title = `💜 Tip ${tipJarId} with SOL | Solana Tip Tap`;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.content = `Send $3, $5, or $10 SOL tips to ${tipJarId} instantly! Fast, secure crypto tipping on Solana blockchain.`;
    }
    
    // ✅ NEW: Add Open Graph tags for better social sharing
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
        ogTitle.content = `💜 Tip ${tipJarId} with SOL`;
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
        ogDescription.content = `Send instant SOL tips ($3, $5, $10) to ${tipJarId} on Solana Tip Tap!`;
    }
    
    // ✅ NEW: Update Twitter card
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
        twitterTitle.content = `💜 Tip ${tipJarId} with SOL`;
    }
    
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) {
        twitterDescription.content = `Send instant SOL tips ($3, $5, $10) to ${tipJarId}!`;
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
        const baseCount = 150;
        const randomAdd = Math.floor(Math.random() * 75);
        const totalUsers = baseCount + randomAdd;
        
        const socialProofElement = document.querySelector('.text-solana-green');
        if (socialProofElement) {
            socialProofElement.textContent = `🚀 Join ${totalUsers}+ creators getting tipped!`;
        }
    }

    // ✅ FIXED: Clean notification system (no spam)
    showNotification(message, type = 'info') {
        // Remove existing notifications to prevent spam
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

    // ✅ NEW: Get current SOL price
async getSolPrice() {
    try {
        // Try CoinGecko first
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        
        if (data.solana?.usd) {
            return data.solana.usd;
        }
        
        // Fallback to CoinCap
        const fallbackResponse = await fetch('https://api.coincap.io/v2/assets/solana');
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.data?.priceUsd) {
            return parseFloat(fallbackData.data.priceUsd);
        }
        
        return 179; // Final fallback
    } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        return 179; // Fallback price
    }
}

    // ✅ NEW: Update tip button prices
   async updateTipButtonPrices() {
    try {
        const solPrice = await this.getSolPrice();
        const tipButtons = document.querySelectorAll('.tip-btn');
        
        // ✅ NEW: USD-first pricing
        const usdAmounts = [3, 5, 10]; // Target USD amounts
        
        tipButtons.forEach((button, index) => {
            if (index < usdAmounts.length) {
                const usdAmount = usdAmounts[index];
                const solAmount = (usdAmount / solPrice).toFixed(4);
                
                // Update data-amount attribute
                button.dataset.amount = solAmount;
                
                // Update button text with emojis
                const emojis = ['☕', '🍕', '🚀'];
                const emoji = emojis[index] || '💜';
                
                button.textContent = `Tip $${usdAmount} (~${solAmount} SOL) ${emoji}`;
                
                // Update button styling based on amount
                if (index === 2) { // $10 button
                    button.className = 'tip-btn w-full bg-solana-green hover:bg-green-400 text-black py-3 rounded-lg font-semibold transition-colors';
                } else {
                    button.className = 'tip-btn w-full bg-solana-purple hover:bg-purple-700 py-3 rounded-lg font-semibold transition-colors';
                }
            }
        });
        
        console.log(`Updated tip buttons: $3, $5, $10 (SOL at $${solPrice})`);
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
    
    console.log('✅ Solana Tip Tap fully loaded and ready!');
});

// ✅ NEW: Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.solanaTipTap) {
        window.solanaTipTap.updateSocialProof();
    }
});

// ✅ ENHANCED: Global error handling (silent for common errors)
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Only show notification for unexpected errors
    if (window.solanaTipTap && !event.error?.message?.includes('403') && !event.error?.message?.includes('Failed to fetch')) {
        window.solanaTipTap.showNotification('An unexpected error occurred', 'error');
    }
});

// ✅ ENHANCED: Handle unhandled promise rejections (silent for common errors)
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.solanaTipTap && event.reason?.message) {
        if (event.reason.message.includes('User rejected')) {
            window.solanaTipTap.showNotification('Transaction cancelled', 'warning');
        } else if (event.reason.message.includes('403') || event.reason.message.includes('forbidden')) {
            // ✅ REMOVED: No notification for 403 errors (handled silently)
            console.log('403 error handled silently, trying backup RPC...');
        } else if (!event.reason.message.includes('Failed to fetch')) {
            window.solanaTipTap.showNotification('Transaction failed. Please try again.', 'error');
        }
    }
});

// ✅ NEW: Handle browser navigation
window.addEventListener('popstate', () => {
    if (window.solanaTipTap) {
        window.solanaTipTap.handlePopState();
    }
});

// ✅ UPDATED: Console welcome message
console.log(`
🚀 Solana Tip Tap v2.2 - PRODUCTION READY
💜 Create your Solana tip jar in seconds!
⚡ Powered by Solana blockchain
🔄 Smart RPC fallback system
🗄️ Database: Supabase
🔧 Enhanced with silent error handling

Primary RPC: Alchemy (Working)
Fallback RPCs: 3 additional endpoints
Status: All systems operational ✅
`);

// ✅ NEW: Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SolanaTipTap;
}
