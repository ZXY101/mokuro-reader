// Worker pool for managing parallel downloads

// Import the worker script using Vite's worker plugin
import DownloadWorker from '$lib/workers/download-worker.ts?worker';

export interface WorkerTask {
  id: string;
  data: any;
  onProgress?: (progress: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private workerTaskMap: Map<Worker, string | null> = new Map();
  private maxConcurrent: number;

  constructor(workerUrl?: string, maxConcurrent = 4) {
    this.maxConcurrent = Math.max(1, Math.min(maxConcurrent, navigator.hardwareConcurrency || 4));
    
    // Initialize workers
    for (let i = 0; i < this.maxConcurrent; i++) {
      this.addWorker();
    }
  }

  private addWorker() {
    // Create a new worker using Vite's worker instantiation
    const worker = new DownloadWorker();
    
    worker.onmessage = (event) => {
      const taskId = this.workerTaskMap.get(worker);
      if (!taskId) return;
      
      const task = this.activeTasks.get(taskId);
      if (!task) return;
      
      const data = event.data;
      
      if (data.type === 'progress' && task.onProgress) {
        task.onProgress(data);
      } else if (data.type === 'complete' && task.onComplete) {
        task.onComplete(data);
        this.completeTask(worker);
      } else if (data.type === 'error' && task.onError) {
        task.onError(data);
        this.completeTask(worker);
      }
    };
    
    worker.onerror = (error) => {
      const taskId = this.workerTaskMap.get(worker);
      if (!taskId) return;
      
      const task = this.activeTasks.get(taskId);
      if (task && task.onError) {
        task.onError({ type: 'error', error: error.message });
      }
      
      this.completeTask(worker);
    };
    
    this.workers.push(worker);
    this.workerTaskMap.set(worker, null);
  }

  private completeTask(worker: Worker) {
    const taskId = this.workerTaskMap.get(worker);
    if (taskId) {
      this.activeTasks.delete(taskId);
      this.workerTaskMap.set(worker, null);
    }
    
    // Assign next task if available
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift()!;
      this.assignTaskToWorker(worker, nextTask);
    }
  }

  private assignTaskToWorker(worker: Worker, task: WorkerTask) {
    this.activeTasks.set(task.id, task);
    this.workerTaskMap.set(worker, task.id);
    worker.postMessage(task.data);
  }

  public addTask(task: WorkerTask) {
    // Find an available worker
    const availableWorker = this.workers.find(worker => this.workerTaskMap.get(worker) === null);
    
    if (availableWorker) {
      // Assign task to available worker
      this.assignTaskToWorker(availableWorker, task);
    } else {
      // Queue the task
      this.taskQueue.push(task);
    }
  }

  public terminate() {
    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.workerTaskMap.clear();
  }
  
  public get activeTaskCount() {
    return this.activeTasks.size;
  }
  
  public get queuedTaskCount() {
    return this.taskQueue.length;
  }
  
  public get totalPendingTasks() {
    return this.activeTaskCount + this.queuedTaskCount;
  }
}