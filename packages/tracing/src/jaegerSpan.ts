export type JaegerTagType = 'string' | 'bool' | 'int64' | 'float64';

export type JaegerTag = {
  key: string;
  value: unknown;
  type?: JaegerTagType;
};

export type JaegerLog = {
  timestamp: number;
  fields: JaegerTag[];
};

export type JaegerReference = {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM';
  traceID: string;
  spanID: string;
};

export type JaegerSpan = {
  traceID: string;
  spanID: string;
  operationName: string;
  startTime: number;
  duration: number;
  tags: JaegerTag[];
  logs: JaegerLog[];
  references: JaegerReference[];
  processID: string;
};

export type JaegerProcess = {
  serviceName: string;
  tags: JaegerTag[];
};

export type JaegerTraceDocument = {
  data: Array<{
    traceID: string;
    spans: JaegerSpan[];
    processes: Record<string, JaegerProcess>;
  }>;
};
