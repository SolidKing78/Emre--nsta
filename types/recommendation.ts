export type RecommendationType =
  | 'format'
  | 'timing'
  | 'hook'
  | 'saves'
  | 'conversation'
  | 'consistency'
  | 'reach'
  | 'insufficient_data';

export type Confidence = 'low' | 'medium' | 'high';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  evidence: string;
  confidence: Confidence;
  /** 1 = highest */
  priority: number;
  insufficientData?: boolean;
}
