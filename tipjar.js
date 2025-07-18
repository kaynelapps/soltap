// Tip Jar Management for Solana Tip Tap
class TipJarManager {
    constructor() {
        this.connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com');
        this.setupFeeWallet = 'B7zzqLYVNm2urtdoX9NMxfhj6CwaQzjSnnVZE4rCWgfU';
    }

    async createTipJar(walletAddress, type = 'default', customName = null) {
        const tipJarId = type === 'custom' && customName ? customName : this.generateRandomId();
        
        // Check if custom name already exists
        if (type === 'custom' && StorageManager.getTipJar(tipJarId)) {
            throw new Error('Custom name already exists');
        }

        const tipJarData = {
            id: tipJarId,
            wallet: walletAddress,
            type: type,
            created: Date.now(),
            tips: 0,
            totalAmount: 0,
            lastUpdated: Date.now(),
            theme: type === 'custom' ? 'premium' : 'default'
        };

        // Save to storage
        StorageManager.saveTipJar(tipJarId, tipJarData);
        
        return tipJarData;
    }

    generateRandomId() {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    async processTip(tipJarId, fromWallet, amount) {
        const tipJarData = StorageManager.getTipJar(tipJarId);
        
        if (!tipJarData) {
            throw new Error('Tip jar not found');
        }

        try {
            // Create transaction
            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: new solanaWeb3.PublicKey(fromWallet),
                    toPubkey: new solanaWeb3.PublicKey(tipJarData.wallet),
                    lamports: amount * solanaWeb3.LAMPORTS_PER_SOL,
                })
            );

            // Sign and send transaction would be handled by wallet
            // This is just the transaction preparation
            
                        // Update tip jar data
            tipJarData.tips += 1;
            tipJarData.totalAmount += amount;
            tipJarData.lastUpdated = Date.now();
            
            // Add tip record
            if (!tipJarData.tipHistory) {
                tipJarData.tipHistory = [];
            }
            
            tipJarData.tipHistory.push({
                amount: amount,
                timestamp: Date.now(),
                from: fromWallet
            });
            
            // Keep only last 100 tips to save storage
            if (tipJarData.tipHistory.length > 100) {
                tipJarData.tipHistory = tipJarData.tipHistory.slice(-100);
            }
            
            StorageManager.saveTipJar(tipJarId, tipJarData);
            
            return transaction;
        } catch (error) {
            throw new Error('Failed to process tip: ' + error.message);
        }
    }

    getTipJar(tipJarId) {
        return StorageManager.getTipJar(tipJarId);
    }

    async updateTipJarStats(tipJarId) {
        const tipJarData = StorageManager.getTipJar(tipJarId);
        
        if (!tipJarData) {
            throw new Error('Tip jar not found');
        }

        try {
            // Get recent transactions to verify tip count
            const publicKey = new solanaWeb3.PublicKey(tipJarData.wallet);
            const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 50 });
            
            let verifiedTips = 0;
            let verifiedAmount = 0;
            
            for (const sig of signatures) {
                if (sig.blockTime * 1000 < tipJarData.created) break;
                
                try {
                    const tx = await this.connection.getTransaction(sig.signature);
                    if (tx && tx.meta && !tx.meta.err) {
                        const amount = tx.meta.postBalances[1] - tx.meta.preBalances[1];
                        if (amount > 0) {
                            verifiedTips++;
                            verifiedAmount += amount / solanaWeb3.LAMPORTS_PER_SOL;
                        }
                    }
                } catch (error) {
                    console.warn('Failed to fetch transaction:', error);
                }
            }
            
            // Update with verified data
            tipJarData.tips = verifiedTips;
            tipJarData.totalAmount = verifiedAmount;
            tipJarData.lastUpdated = Date.now();
            
            StorageManager.saveTipJar(tipJarId, tipJarData);
            
            return tipJarData;
        } catch (error) {
            console.error('Failed to update tip jar stats:', error);
            return tipJarData; // Return existing data if update fails
        }
    }

    getAllTipJars() {
        return StorageManager.getAllTipJars();
    }

    deleteTipJar(tipJarId) {
        return StorageManager.deleteTipJar(tipJarId);
    }

    validateCustomName(name) {
        // Check format
        if (!/^[a-zA-Z0-9]{3,20}$/.test(name)) {
            return { valid: false, error: 'Name must be 3-20 characters, letters and numbers only' };
        }
        
        // Check reserved words
        const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'blog', 'help', 'support', 'terms', 'privacy', 'about', 'contact'];
        if (reserved.includes(name.toLowerCase())) {
            return { valid: false, error: 'This name is reserved' };
        }
        
        // Check if already exists
        if (StorageManager.getTipJar(name)) {
            return { valid: false, error: 'This name is already taken' };
        }
        
        return { valid: true };
    }

    generateTipJarUrl(tipJarId) {
        return `${window.location.origin}/?id=${tipJarId}`;
    }

    generateShareText(tipJarId, isCreator = false) {
        const url = this.generateTipJarUrl(tipJarId);
        
        if (isCreator) {
            return `Just created my SOL tip jar! 🚀 Support me with crypto tips: ${url} #SolanaTipTap #Solana #Crypto`;
        } else {
            return `Send me SOL tips easily! 💜 ${url} #SolanaTipTap #Solana #Crypto`;
        }
    }

    getRecentTips(tipJarId, limit = 10) {
        const tipJarData = StorageManager.getTipJar(tipJarId);
        
        if (!tipJarData || !tipJarData.tipHistory) {
            return [];
        }
        
        return tipJarData.tipHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    getTipJarStats(tipJarId) {
        const tipJarData = StorageManager.getTipJar(tipJarId);
        
        if (!tipJarData) {
            return null;
        }
        
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;
        
        let dailyTips = 0;
        let weeklyTips = 0;
        let dailyAmount = 0;
        let weeklyAmount = 0;
        
        if (tipJarData.tipHistory) {
            tipJarData.tipHistory.forEach(tip => {
                const age = now - tip.timestamp;
                
                if (age <= dayMs) {
                    dailyTips++;
                    dailyAmount += tip.amount;
                }
                
                if (age <= weekMs) {
                    weeklyTips++;
                    weeklyAmount += tip.amount;
                }
            });
        }
        
        return {
            totalTips: tipJarData.tips || 0,
            totalAmount: tipJarData.totalAmount || 0,
            dailyTips,
            weeklyTips,
            dailyAmount,
            weeklyAmount,
            created: tipJarData.created,
            lastUpdated: tipJarData.lastUpdated
        };
    }
}
