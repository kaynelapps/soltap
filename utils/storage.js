// Storage Management for Solana Tip Tap
class StorageManager {
    static STORAGE_KEY = 'solanatiptap_data';
    static TIP_JARS_KEY = 'tip_jars';
    static SETTINGS_KEY = 'settings';
    
    static getData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : { [this.TIP_JARS_KEY]: {}, [this.SETTINGS_KEY]: {} };
        } catch (error) {
            console.error('Failed to get data from storage:', error);
            return { [this.TIP_JARS_KEY]: {}, [this.SETTINGS_KEY]: {} };
        }
    }
    
    static saveData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save data to storage:', error);
            return false;
        }
    }
    
    static saveTipJar(tipJarId, tipJarData) {
        const data = this.getData();
        data[this.TIP_JARS_KEY][tipJarId] = tipJarData;
        return this.saveData(data);
    }
    
    static getTipJar(tipJarId) {
        const data = this.getData();
        return data[this.TIP_JARS_KEY][tipJarId] || null;
    }
    
    static getAllTipJars() {
        const data = this.getData();
        return data[this.TIP_JARS_KEY] || {};
    }
    
    static deleteTipJar(tipJarId) {
        const data = this.getData();
        if (data[this.TIP_JARS_KEY][tipJarId]) {
            delete data[this.TIP_JARS_KEY][tipJarId];
            return this.saveData(data);
        }
        return false;
    }
    
    static updateTipJar(tipJarId, updates) {
        const data = this.getData();
        if (data[this.TIP_JARS_KEY][tipJarId]) {
            data[this.TIP_JARS_KEY][tipJarId] = { ...data[this.TIP_JARS_KEY][tipJarId], ...updates };
            return this.saveData(data);
        }
        return false;
    }
    
    static saveSetting(key, value) {
        const data = this.getData();
        data[this.SETTINGS_KEY][key] = value;
        return this.saveData(data);
    }
    
    static getSetting(key, defaultValue = null) {
        const data = this.getData();
        return data[this.SETTINGS_KEY][key] !== undefined ? data[this.SETTINGS_KEY][key] : defaultValue;
    }
    
    static clearAllData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return false;
        }
    }
    
    static exportData() {
        const data = this.getData();
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'solanatiptap_backup.json';
        link.click();
    }
    
    static importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            return this.saveData(data);
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
    
    static getStorageSize() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? new Blob([data]).size : 0;
        } catch (error) {
            console.error('Failed to get storage size:', error);
            return 0;
        }
    }
    
    static isStorageAvailable() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }
}
