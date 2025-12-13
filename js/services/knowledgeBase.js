/**
 * Knowledge Base Service (Optimized)
 * Handles local question-answer lookups with better fuzzy matching
 */

class KnowledgeBase {
    constructor() {
        this.data = {};
        this.normalizedData = {};
        this.keywords = {};
        this.isLoaded = false;
    }
    
    /**
     * Load knowledge base from JSON file
     */
    async load() {
        try {
            const response = await fetch('knowledge_base.json');
            if (!response.ok) {
                throw new Error('Failed to load knowledge base');
            }
            
            this.data = await response.json();
            
            // Create normalized version and extract keywords
            this.normalizedData = {};
            this.keywords = {};
            
            for (const [key, value] of Object.entries(this.data)) {
                const normalizedKey = this.normalize(key);
                this.normalizedData[normalizedKey] = {
                    original: key,
                    answer: value
                };
                
                // Extract keywords
                const words = normalizedKey.split(' ');
                for (const word of words) {
                    if (word.length > 2) { // Skip very short words
                        if (!this.keywords[word]) {
                            this.keywords[word] = [];
                        }
                        this.keywords[word].push(normalizedKey);
                    }
                }
            }
            
            this.isLoaded = true;
            console.log(`Knowledge base loaded with ${Object.keys(this.data).length} entries`);
            return true;
        } catch (error) {
            console.error('Failed to load knowledge base:', error);
            throw error;
        }
    }
    
    /**
     * Normalize text for matching
     */
    normalize(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[.,!?;:'"]/g, '') // Remove punctuation
            .replace(/\s+/g, ' '); // Normalize whitespace
    }
    
    /**
     * Calculate similarity using Levenshtein distance
     */
    calculateLevenshtein(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];
        
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        
        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);
        return 1 - (distance / maxLen);
    }
    
    /**
     * Find answer for a question using multiple strategies
     */
    find(question) {
        if (!this.isLoaded) {
            console.warn('Knowledge base not loaded');
            return null;
        }
        
        const normalized = this.normalize(question);
        
        // Strategy 1: Exact match
        if (this.normalizedData[normalized]) {
            console.log('✓ Exact match found');
            return this.normalizedData[normalized].answer;
        }
        
        // Strategy 2: Contains match
        for (const [key, value] of Object.entries(this.normalizedData)) {
            if (normalized.includes(key) || key.includes(normalized)) {
                console.log('✓ Contains match found');
                return value.answer;
            }
        }
        
        // Strategy 3: Keyword matching
        const queryWords = normalized.split(' ').filter(w => w.length > 2);
        const candidates = new Set();
        
        for (const word of queryWords) {
            if (this.keywords[word]) {
                this.keywords[word].forEach(key => candidates.add(key));
            }
        }
        
        if (candidates.size > 0) {
            // Find best match among candidates
            let bestMatch = null;
            let bestScore = 0;
            
            for (const candidate of candidates) {
                const score = this.calculateLevenshtein(normalized, candidate);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = this.normalizedData[candidate].answer;
                }
            }
            
            if (bestScore > 0.4) {
                console.log(`✓ Keyword match found (score: ${bestScore.toFixed(2)})`);
                return bestMatch;
            }
        }
        
        // Strategy 4: Fuzzy match with all entries
        let bestMatch = null;
        let bestScore = 0;
        const threshold = 0.5;
        
        for (const [key, value] of Object.entries(this.normalizedData)) {
            const score = this.calculateLevenshtein(normalized, key);
            
            if (score > bestScore && score >= threshold) {
                bestScore = score;
                bestMatch = value.answer;
            }
        }
        
        if (bestMatch) {
            console.log(`✓ Fuzzy match found (score: ${bestScore.toFixed(2)})`);
            return bestMatch;
        }
        
        // No match found
        console.log('✗ No match found');
        return null;
    }
    
    /**
     * Get default response for unknown questions
     */
    getDefaultResponse() {
        return "I'm sorry, I don't have information about that. Please try asking about Qplus or Quantum Strides.";
    }
    
    /**
     * Get answer with fallback
     */
    getAnswer(question) {
        const answer = this.find(question);
        return answer || this.getDefaultResponse();
    }
    
    /**
     * Check if loaded
     */
    isReady() {
        return this.isLoaded;
    }
    
    /**
     * Get all questions
     */
    getAllQuestions() {
        return Object.keys(this.data);
    }
}

export default KnowledgeBase;