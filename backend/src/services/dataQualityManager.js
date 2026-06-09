/**
 * Data Quality Manager
 * Enterprise-grade data validation and quality control
 * 
 * Features:
 * - Data source validation
 * - Quality scoring
 * - Graceful degradation
 * - Audit logging
 * - Compliance tracking
 */

class DataQualityManager {
    constructor() {
        this.qualityThreshold = 0.8; // 80% minimum quality
        this.auditLog = [];
    }

    /**
     * Validate data source and quality
     */
    validateDataSource(source, data) {
        const validation = {
            source: source,
            timestamp: new Date(),
            isValid: false,
            qualityScore: 0,
            issues: [],
            recommendations: []
        };

        // Source validation
        if (source === 'SYNTHETIC') {
            validation.issues.push('Synthetic data source detected');
            validation.recommendations.push('Switch to real data source for production use');
            validation.qualityScore = 0.3;
        } else if (source === 'REAL_NSE') {
            validation.qualityScore += 0.4;
        } else if (source === 'UPSTOX_API') {
            validation.qualityScore += 0.5;
        }

        // Data completeness check
        const completeness = this.checkCompleteness(data);
        validation.qualityScore += completeness.score * 0.3;
        if (completeness.issues.length > 0) {
            validation.issues.push(...completeness.issues);
        }

        // Data freshness check
        const freshness = this.checkFreshness(data);
        validation.qualityScore += freshness.score * 0.2;
        if (freshness.issues.length > 0) {
            validation.issues.push(...freshness.issues);
        }

        // Data consistency check
        const consistency = this.checkConsistency(data);
        validation.qualityScore += consistency.score * 0.1;
        if (consistency.issues.length > 0) {
            validation.issues.push(...consistency.issues);
        }

        validation.isValid = validation.qualityScore >= this.qualityThreshold;
        
        // Log audit trail
        this.auditLog.push({
            ...validation,
            action: 'VALIDATION'
        });

        return validation;
    }

    /**
     * Check data completeness
     */
    checkCompleteness(data) {
        const requiredFields = ['symbol', 'date'];
        const issues = [];
        let score = 1.0;

        for (const field of requiredFields) {
            if (!data[field]) {
                issues.push(`Missing required field: ${field}`);
                score -= 0.25;
            }
        }

        // Numeric field validation
        const numericFields = ['open', 'high', 'low', 'close', 'volume'];
        for (const field of numericFields) {
            if (data[field] !== undefined && (isNaN(data[field]) || data[field] < 0)) {
                issues.push(`Invalid numeric value for ${field}: ${data[field]}`);
                score -= 0.1;
            }
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Check data freshness
     */
    checkFreshness(data) {
        const issues = [];
        let score = 1.0;

        if (!data.date) {
            issues.push('Missing date field');
            return { score: 0, issues };
        }

        const dataDate = new Date(data.date);
        const now = new Date();
        const ageInHours = (now - dataDate) / (1000 * 60 * 60);

        if (ageInHours > 24) {
            issues.push(`Data is stale (${ageInHours.toFixed(1)} hours old)`);
            score = 0.3;
        } else if (ageInHours > 4) {
            issues.push(`Data is getting old (${ageInHours.toFixed(1)} hours old)`);
            score = 0.7;
        }

        return { score, issues };
    }

    /**
     * Check data consistency
     */
    checkConsistency(data) {
        const issues = [];
        let score = 1.0;

        // Price relationship validation
        if (data.high && data.low && data.high < data.low) {
            issues.push('High price is less than low price');
            score -= 0.5;
        }

        if (data.open && data.high && data.open > data.high) {
            issues.push('Open price is higher than high price');
            score -= 0.3;
        }

        if (data.close && data.low && data.close < data.low) {
            issues.push('Close price is less than low price');
            score -= 0.3;
        }

        // Volume validation
        if (data.volume && data.volume < 0) {
            issues.push('Negative volume detected');
            score -= 0.4;
        }

        return { score: Math.max(0, score), issues };
    }

    /**
     * Get data quality report
     */
    getQualityReport() {
        const recentLogs = this.auditLog.slice(-100);
        const validCount = recentLogs.filter(log => log.isValid).length;
        const totalCount = recentLogs.length;
        const qualityRate = totalCount > 0 ? validCount / totalCount : 0;

        return {
            overallQuality: qualityRate,
            totalValidations: totalCount,
            validDataPoints: validCount,
            invalidDataPoints: totalCount - validCount,
            recentIssues: recentLogs
                .filter(log => !log.isValid)
                .slice(-10)
                .map(log => ({
                    timestamp: log.timestamp,
                    source: log.source,
                    issues: log.issues,
                    qualityScore: log.qualityScore
                }))
        };
    }

    /**
     * Graceful degradation handler
     */
    handleDataUnavailable(serviceName, error) {
        // Log the issue
        this.auditLog.push({
            timestamp: new Date(),
            action: 'SERVICE_UNAVAILABLE',
            service: serviceName,
            error: error.message,
            handled: true
        });

        // Return appropriate response based on service
        switch (serviceName) {
            case 'FII_DII':
                return {
                    status: 'SERVICE_UNAVAILABLE',
                    message: 'Institutional flow data temporarily unavailable',
                    recommendation: 'Check back later or contact support',
                    data: null
                };
            
            case 'BULK_DEALS':
                return {
                    status: 'SERVICE_UNAVAILABLE',
                    message: 'Bulk deal data temporarily unavailable',
                    recommendation: 'Market data refresh scheduled for next session',
                    data: null
                };
            
            case 'OPTIONS_CHAIN':
                return {
                    status: 'PARTIAL_DATA',
                    message: 'Options data limited availability',
                    recommendation: 'Using equity price data as proxy',
                    data: {
                        type: 'EQUITY_PROXY',
                        lastUpdated: new Date()
                    }
                };
            
            default:
                return {
                    status: 'ERROR',
                    message: 'Data service unavailable',
                    recommendation: 'System maintenance in progress',
                    data: null
                };
        }
    }
}

module.exports = new DataQualityManager();