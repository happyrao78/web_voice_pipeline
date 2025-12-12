/**
 * Knowledge Base Service
 * Handles local question-answer lookups with fuzzy matching
 */

class KnowledgeBase {
    constructor() {
        this.data = {};
        this.normalizedData = {};
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
            
            // Create normalized version for matching
            this.normalizedData = {};
            for (const [key, value] of Object.entries(this.data)) {
                const normalizedKey = this.normalize(key);
                this.normalizedData[normalizedKey] = {
                    original: key,
                    answer: value
                };
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
     * Calculate similarity between two strings (simple word overlap)
     */
    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        
        let matches = 0;
        for (const word1 of words1) {
            if (words2.includes(word1)) {
                matches++;
            }
        }
        
        // Jaccard similarity
        const union = new Set([...words1, ...words2]).size;
        return matches / union;
    }
    
    /**
     * Find answer for a question
     */
    find(question) {
        if (!this.isLoaded) {
            console.warn('Knowledge base not loaded');
            return null;
        }
        
        const normalized = this.normalize(question);
        
        // Exact match first
        if (this.normalizedData[normalized]) {
            return this.normalizedData[normalized].answer;
        }
        
        // Fuzzy match with similarity threshold
        let bestMatch = null;
        let bestScore = 0;
        const threshold = 0.3; // Minimum similarity score
        
        for (const [key, value] of Object.entries(this.normalizedData)) {
            const score = this.calculateSimilarity(normalized, key);
            
            if (score > bestScore && score >= threshold) {
                bestScore = score;
                bestMatch = value.answer;
            }
        }
        
        if (bestMatch) {
            console.log(`Found match with similarity ${bestScore.toFixed(2)}`);
            return bestMatch;
        }
        
        // No match found
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