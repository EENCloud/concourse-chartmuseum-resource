export interface IHelm {
  chartLocation: string;
  tempDirectory: {
    path: string;
    cleanupCallback: () => void;
  };
  appVersion: string | undefined;
  chartVersion: string;
}


export interface IHelmRepository {
  name: string;
  repository: string;
}
