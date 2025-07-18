// Wallet Integration for Solana Tip Tap
class WalletManager {
    constructor() {
        this.wallet = null;
        this.connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com');
        this.provider = null;
    }

    async detectWallet() {
        // Check for Phantom
        if (window.solana && window.solana.isPhantom) {
            this.provider = window.solana;
            return 'phantom';
        }
        
        // Check for Solflare
        if (window.solflare && window.solflare.isSolflare) {
            this.provider = window.solflare;
            return 'solflare';
        }
        
        return null;
    }

    async connect() {
        const walletType = await this.detectWallet();
        
        if (!walletType) {
            throw new Error('No Solana wallet detected. Please install Phantom or Solflare.');
        }

        try {
            const response = await this.provider.connect();
            this.wallet = response.publicKey.toString();
            
            // Listen for wallet changes
            this.provider.on('connect', () => {
                console.log('Wallet connected');
            });
            
            this.provider.on('disconnect', () => {
                console.log('Wallet disconnected');
                this.wallet = null;
            });
            
            return this.wallet;
        } catch (error) {
            throw new Error('Failed to connect wallet: ' + error.message);
        }
    }

    async disconnect() {
        if (this.provider) {
            await this.provider.disconnect();
            this.wallet = null;
        }
    }

    async signAndSendTransaction(transaction) {
        if (!this.provider || !this.wallet) {
            throw new Error('Wallet not connected');
        }

        try {
            const { blockhash } = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new solanaWeb3.PublicKey(this.wallet);

            const signedTransaction = await this.provider.signTransaction(transaction);
            const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
            
            // Wait for confirmation
            await this.connection.confirmTransaction(signature, 'confirmed');
            
            return signature;
        } catch (error) {
            throw new Error('Transaction failed: ' + error.message);
        }
    }

    async getBalance() {
        if (!this.wallet) return 0;
        
        try {
            const publicKey = new solanaWeb3.PublicKey(this.wallet);
            const balance = await this.connection.getBalance(publicKey);
            return balance / solanaWeb3.LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Failed to get balance:', error);
            return 0;
        }
    }

    async getTransactionHistory(limit = 10) {
        if (!this.wallet) return [];
        
        try {
            const publicKey = new solanaWeb3.PublicKey(this.wallet);
            const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit });
            
            const transactions = await Promise.all(
                signatures.map(async (sig) => {
                    const tx = await this.connection.getTransaction(sig.signature);
                    return {
                        signature: sig.signature,
                        slot: sig.slot,
                        timestamp: sig.blockTime,
                        transaction: tx
                    };
                })
            );
            
            return transactions;
        } catch (error) {
            console.error('Failed to get transaction history:', error);
            return [];
        }
    }

    isConnected() {
        return this.wallet !== null;
    }

    getWalletAddress() {
        return this.wallet;
    }

    formatAddress(address, length = 8) {
        if (!address) return '';
        return `${address.slice(0, length)}...${address.slice(-length)}`;
    }
}
