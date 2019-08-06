export interface IHelm {
  chartLocation: string;
  tempDirectory: {
    path: string;
    cleanupCallback: () => void;
  };
  version: string | undefined;
  appVersion: string | undefined;
}


export interface IHelmRepository {
  name: string;
  repository: string;
}
