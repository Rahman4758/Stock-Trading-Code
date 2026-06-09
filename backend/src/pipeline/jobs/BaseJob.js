/**
 * BaseJob.js
 *
 * Abstract base class for pipeline jobs. Provides automatic checkpointing
 * and resume-from-failure capabilities for long-running batch processes.
 */
const JobCheckpoint = require('../../models/JobCheckpoint');

class BaseJob {
    constructor(jobName) {
        this.jobName = jobName;
    }

    /**
     * Override this method with the logic to fetch a single item.
     * @param {string} item - usually a symbol (e.g. 'RELIANCE')
     * @param {Object} options - config options (e.g. { days: 10 })
     * @returns {Promise<any>}
     */
    async processItem(item, options) {
        throw new Error('processItem() must be implemented by subclass');
    }

    /**
     * Run a batch of items with checkpointing.
     * @param {Array<string>} items - full list of items to process
     * @param {Object} options - config options
     * @returns {Promise<Object>}
     */
    async runBatch(items, options = {}) {
        let checkpoint = await JobCheckpoint.findOne({ jobName: this.jobName });

        // If job completed successfully previously, reset for a new run
        if (!checkpoint || checkpoint.status === 'COMPLETED') {
            checkpoint = await JobCheckpoint.findOneAndUpdate(
                { jobName: this.jobName },
                { 
                    $set: { 
                        status: 'RUNNING', 
                        lastCompletedItem: null, 
                        itemsProcessed: 0, 
                        totalItems: items.length,
                        error: null,
                        startedAt: new Date()
                    } 
                },
                { upsert: true, new: true }
            );
        } else {
            console.log(`[Job:${this.jobName}] Resuming from failed state. Last completed: ${checkpoint.lastCompletedItem}`);
            checkpoint.status = 'RUNNING';
            await checkpoint.save();
        }

        // Determine where to start
        let startIndex = 0;
        if (checkpoint.lastCompletedItem) {
            const lastIdx = items.indexOf(checkpoint.lastCompletedItem);
            if (lastIdx !== -1) startIndex = lastIdx + 1;
        }

        let processedThisRun = 0;
        let failedItems = [];

        for (let i = startIndex; i < items.length; i++) {
            const item = items[i];
            try {
                await this.processItem(item, options);
                
                // Update checkpoint after successful item
                await JobCheckpoint.updateOne(
                    { _id: checkpoint._id },
                    { 
                        $set: { 
                            lastCompletedItem: item,
                            itemsProcessed: i + 1,
                            updatedAt: new Date()
                        } 
                    }
                );
                processedThisRun++;
            } catch (err) {
                console.error(`[Job:${this.jobName}] Failed on item ${item}: ${err.message}`);
                failedItems.push(item);
                
                // Mark job as failed and halt batch if fatal
                await JobCheckpoint.updateOne(
                    { _id: checkpoint._id },
                    { 
                        $set: { 
                            status: 'FAILED',
                            error: `Failed on ${item}: ${err.message}`,
                            updatedAt: new Date()
                        } 
                    }
                );
                
                // We choose to throw here to halt the pipeline.
                // The next run will resume from `lastCompletedItem`.
                throw err; 
            }
        }

        // If we get here, the entire batch completed successfully
        await JobCheckpoint.updateOne(
            { _id: checkpoint._id },
            { 
                $set: { 
                    status: 'COMPLETED',
                    error: null,
                    updatedAt: new Date()
                } 
            }
        );

        return {
            totalProcessed: checkpoint.itemsProcessed + processedThisRun,
            failedItems
        };
    }
}

module.exports = BaseJob;
