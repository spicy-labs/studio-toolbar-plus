export type SupportedAuthentication = {
  browser: string[];
  server: string[];
};

export type Connector = {
  id: string;
  name: string;
  description: string;
  type: "media" | "fonts";
  default: boolean;
  enabled: boolean;
  iconUrl: string | null;
  scriptSource: string;
  ownerType: "builtIn" | "user";
  status: "published";
  supportedAuthentication: SupportedAuthentication;
};

export type ConnectorResponse = {
  links: Record<string, any>;
  data: Connector[];
};

export type LocalSource = {
  source: "local";
  url: string;
};

export type GrafxSource = {
  id: string;
  source: "grafx";
};

export type Source = LocalSource | GrafxSource;

export type DocumentConnector = {
  id: string;
  name: string;
  source: Source;
  options: Record<string, any>;
  mappings: any[];
};

export type DocumentConnectorGraFx = {
  id: string;
  name: string;
  source: GrafxSource;
  options: Record<string, any>;
  mappings: any[];
};

// Type for the getCurrentConnectors function return value
export type DocumentConnectorWithUsage = {
  id: string;
  sourceId:string;
  name: string;
  type: "media" | "fonts";
  usesInTemplate: {
    images: { id: string; name: string }[];
    variables: { id: string; name: string }[];
  };
};
