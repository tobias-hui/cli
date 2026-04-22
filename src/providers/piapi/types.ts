export type PiapiTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'staged';

export interface PiapiEnvelope<T> {
  code: number;
  data?: T;
  message?: string;
}

export interface PiapiTask<Output = unknown> {
  task_id: string;
  model: string;
  task_type: string;
  status: PiapiTaskStatus;
  error?: { code?: number; message?: string };
  output?: Output;
  meta?: {
    created_at?: string;
    started_at?: string;
    ended_at?: string;
  };
}

export interface NanoBananaInput {
  prompt: string;
  aspect_ratio?: string;
  output_format?: 'png' | 'jpeg';
  resolution?: '1K' | '2K' | '4K';
  image_urls?: string[];
  safety_level?: 'low' | 'medium' | 'high';
}

export interface NanoBananaOutput {
  image_url?: string;
  image_urls?: string[];
}

export interface SubmitTaskBody {
  model: string;
  task_type: string;
  input: Record<string, unknown>;
}
