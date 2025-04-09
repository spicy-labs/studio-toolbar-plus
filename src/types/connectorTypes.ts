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