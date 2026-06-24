export type CollectorResult = {
  raw: {
    url: string;
    contentType?: string;
    bodyText?: string;
  };
  payload: unknown;
};

export type Collector = (url: string) => Promise<CollectorResult>;
