export type ArtifactDeliveryChannel = 'photo' | 'document' | 'link' | 'none';

export interface ArtifactRecord {
  id: string;
  key: string;
  type: string;
  kind: string;
  name: string;
  source: string;
  path: string | null;
  url: string | null;
  mimeType: string | null;
  summary: string | null;
  description: string | null;
  previewText: string | null;
  sizeBytes: number | null;
  exists: boolean;
  deliveryChannel: ArtifactDeliveryChannel;
  createdAt: string;
}

export type ArtifactInput = Partial<ArtifactRecord> | string;
